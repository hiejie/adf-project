const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");
const { uploadDir } = require("../middleware/upload");
const { decryptBuffer } = require("../lib/encryption");

const router = express.Router();

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// ---------- Login / logout ----------

router.get("/login", (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect("/admin");
  }
  res.render("login", { error: null });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedHash = process.env.ADMIN_PASSWORD_HASH || "";

  if (!expectedHash) {
    return res.render("login", {
      error: "Admin password is not configured yet. See server/README.md.",
    });
  }

  const validUser = username === expectedUser;
  const validPass = validUser && (await bcrypt.compare(password || "", expectedHash));

  if (!validUser || !validPass) {
    return res.render("login", { error: "Invalid username or password." });
  }

  req.session.isAdmin = true;
  req.session.adminUsername = username;
  res.redirect("/admin");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

// ---------- Dashboard page ----------

// The dashboard's JavaScript lives in its own file rather than inline in the
// page, because the site's Content-Security-Policy (server.js) only allows
// scripts from our own origin — inline <script> blocks are refused by the
// browser. Keeping it behind requireAdmin also means the admin UI code isn't
// handed out to anonymous visitors.
router.get("/dashboard.js", requireAdmin, (req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(__dirname, "..", "public", "dashboard.js"));
});

router.get("/", requireAdmin, (req, res) => {
  const registrationCount = db.prepare("SELECT COUNT(*) AS c FROM registrations").get().c;
  const messageCount = db.prepare("SELECT COUNT(*) AS c FROM contact_messages").get().c;
  const unreadCount = db
    .prepare("SELECT COUNT(*) AS c FROM contact_messages WHERE is_read = 0")
    .get().c;

  res.render("dashboard", {
    adminUsername: req.session.adminUsername,
    registrationCount,
    messageCount,
    unreadCount,
  });
});

// ---------- JSON data APIs (consumed by the dashboard page) ----------

router.get("/api/registrations", requireAdmin, (req, res) => {
  const search = (req.query.search || "").trim();
  let rows;

  if (search) {
    const like = `%${search}%`;
    rows = db
      .prepare(
        `SELECT id, full_name, email, student_number, screenshot_filename, created_at
         FROM registrations
         WHERE full_name LIKE ? OR email LIKE ? OR student_number LIKE ?
         ORDER BY created_at DESC`
      )
      .all(like, like, like);
  } else {
    rows = db
      .prepare(
        `SELECT id, full_name, email, student_number, screenshot_filename, created_at
         FROM registrations ORDER BY created_at DESC`
      )
      .all();
  }

  res.json(rows);
});

router.get("/api/messages", requireAdmin, (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM contact_messages ORDER BY created_at DESC`)
    .all();
  res.json(rows);
});

router.post("/api/messages/:id/read", requireAdmin, (req, res) => {
  const result = db
    .prepare(`UPDATE contact_messages SET is_read = 1 WHERE id = ?`)
    .run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Message not found." });
  }
  res.json({ ok: true });
});

router.delete("/api/registrations/:id", requireAdmin, (req, res) => {
  const row = db
    .prepare(`SELECT screenshot_filename FROM registrations WHERE id = ?`)
    .get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: "Registration not found." });
  }

  db.prepare(`DELETE FROM registrations WHERE id = ?`).run(req.params.id);

  if (row.screenshot_filename) {
    fs.unlink(path.join(uploadDir, row.screenshot_filename), () => {});
  }

  res.json({ ok: true });
});

router.delete("/api/messages/:id", requireAdmin, (req, res) => {
  const result = db.prepare(`DELETE FROM contact_messages WHERE id = ?`).run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Message not found." });
  }
  res.json({ ok: true });
});

// ---------- CSV export ----------

router.get("/export/registrations.csv", requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, full_name, email, student_number, created_at FROM registrations ORDER BY created_at DESC`
    )
    .all();

  const escapeCsv = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const header = ["ID", "Full Name", "Email", "Student Number", "Registered At"];
  const lines = [header.join(",")];

  rows.forEach((r) => {
    lines.push(
      [r.id, r.full_name, r.email, r.student_number, r.created_at].map(escapeCsv).join(",")
    );
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="adf2027-registrations.csv"');
  res.send(lines.join("\n"));
});

// ---------- Protected screenshot access ----------

router.get("/screenshots/:filename", requireAdmin, (req, res) => {
  const filename = path.basename(req.params.filename); // guard against path traversal
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Not found.");
  }

  // Screenshots are stored encrypted at rest (see lib/encryption.js) — the
  // file on disk is not a viewable image on its own. Decrypt it in memory
  // and stream the result to the authenticated admin viewing it.
  try {
    const encrypted = fs.readFileSync(filePath);
    const decrypted = decryptBuffer(encrypted);
    const originalExt = path.extname(filename.replace(/\.enc$/i, "")).toLowerCase();
    const contentType = MIME_BY_EXT[originalExt] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(decrypted);
  } catch (err) {
    console.error("Failed to decrypt screenshot:", err);
    res.status(500).send("Could not decrypt this file. Check UPLOAD_ENCRYPTION_KEY.");
  }
});

// ---------- Data retention / purge ----------
// PRD's Data Privacy requirement: registrant data (including ID screenshots)
// should be deleted/archived after the event per your org's retention
// practice. Rather than guess a retention window and auto-delete on a
// timer, this gives an admin an explicit, deliberate action: pick a cutoff
// date, confirm, and everything registered before it — plus its screenshot
// file — is permanently deleted.
//
// The same operation is available from the command line via
// `npm run purge-old-data -- 2027-06-01`, e.g. to wire into a cron job on
// your host once your org settles on a fixed retention period.
router.post("/api/purge", requireAdmin, (req, res) => {
  const { before } = req.body || {};

  if (!before) {
    return res.status(400).json({ error: "A cutoff date is required." });
  }

  const cutoff = new Date(before);
  if (Number.isNaN(cutoff.getTime())) {
    return res.status(400).json({ error: "That doesn't look like a valid date." });
  }

  const rows = db
    .prepare(`SELECT id, screenshot_filename FROM registrations WHERE created_at < ?`)
    .all(cutoff.toISOString());

  const deleteStmt = db.prepare(`DELETE FROM registrations WHERE id = ?`);
  const purge = db.transaction((items) => {
    items.forEach((row) => {
      deleteStmt.run(row.id);
      if (row.screenshot_filename) {
        fs.unlink(path.join(uploadDir, row.screenshot_filename), () => {});
      }
    });
  });
  purge(rows);

  res.json({ ok: true, deletedCount: rows.length });
});

module.exports = router;
