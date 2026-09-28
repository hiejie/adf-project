const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const db = require("../db");
const { upload, uploadDir, generateStoredFilename } = require("../middleware/upload");
const { encryptBuffer } = require("../lib/encryption");
const { isSpam } = require("../lib/spamCheck");
const { sendRegistrationConfirmationEmail } = require("../mailer");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_NUMBER_RE = /^\d{8}$/;

router.post("/", (req, res) => {
  upload.single("profile-screenshot")(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.message === "INVALID_FILE_TYPE") {
        return res.status(400).json({
          error: "Please upload a JPG, PNG, WEBP, or GIF image for your Campus++ screenshot.",
        });
      }
      if (uploadErr.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Screenshot must be smaller than 5MB." });
      }
      return res.status(400).json({ error: "There was a problem uploading your screenshot." });
    }

    // Honeypot check — a real registrant never fills this hidden field in.
    // Bots almost always do. We reject rather than silently "succeed" so a
    // real user who somehow triggers it (e.g. aggressive browser autofill)
    // gets a clear error instead of thinking they registered when they didn't.
    if (isSpam(req.body)) {
      return res.status(400).json({ error: "Your submission could not be processed. Please try again." });
    }

    const fullName = (req.body["full-name"] || "").trim();
    const email = (req.body["email"] || "").trim().toLowerCase();
    const studentNumber = (req.body["student-number"] || "").replace(/\D/g, "").trim();
    const consentGiven = req.body["consent"] === "on" || req.body["consent"] === "true";
    const errors = [];

    if (!fullName || fullName.length < 2) {
      errors.push("Please enter your full name.");
    }
    if (!email || !EMAIL_RE.test(email)) {
      errors.push("Please enter a valid email address.");
    }
    if (!studentNumber || !STUDENT_NUMBER_RE.test(studentNumber)) {
      errors.push("Student number must be exactly 8 digits.");
    }
    if (!req.file) {
      errors.push("Please upload your Campus++ profile screenshot.");
    }
    if (!consentGiven) {
      errors.push("Please agree to the Privacy Policy and Terms of Service to register.");
    }

    if (errors.length > 0) {
      // Nothing has been written to disk yet at this point (multer is
      // using memoryStorage), so there's nothing to clean up on failure.
      return res.status(400).json({ error: errors[0], errors });
    }

    // Encrypt the screenshot in memory and only then write it to disk.
    let storedFilename;
    try {
      storedFilename = generateStoredFilename(req.file.originalname);
      const encrypted = encryptBuffer(req.file.buffer);
      await fs.writeFile(path.join(uploadDir, storedFilename), encrypted);
    } catch (encryptErr) {
      console.error("Failed to encrypt/store screenshot:", encryptErr);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }

    try {
      const consentAt = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO registrations
          (full_name, email, student_number, screenshot_filename, screenshot_original_name, consent_given, consent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        fullName,
        email,
        studentNumber,
        storedFilename,
        req.file.originalname,
        1,
        consentAt
      );

      // Registration is saved regardless of whether the confirmation email succeeds.
      let emailResult = { sent: false };
      try {
        emailResult = await sendRegistrationConfirmationEmail({
          to: email,
          fullName,
          studentNumber,
        });
      } catch (mailErr) {
        console.error("Unexpected mailer error:", mailErr);
      }

      return res.status(201).json({
        message: emailResult.sent
          ? "You're registered! Check your email for a confirmation."
          : "You're registered! We'll see you at ADF 2027.",
        registrationId: result.lastInsertRowid,
        emailSent: emailResult.sent,
      });
    } catch (dbErr) {
      // Roll back the encrypted file we just wrote since the record wasn't saved.
      fs.unlink(path.join(uploadDir, storedFilename)).catch(() => {});

      if (dbErr.code === "SQLITE_CONSTRAINT_UNIQUE") {
        const field = dbErr.message.includes("email") ? "email address" : "student number";
        return res.status(409).json({
          error: `That ${field} has already been registered for ${process.env.EVENT_NAME || "this event"}.`,
        });
      }

      console.error("Registration error:", dbErr);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
});

module.exports = router;
