const express = require("express");
const db = require("../db");
const { isSpam } = require("../lib/spamCheck");
const { sendContactNotificationEmail } = require("../mailer");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 5000;

router.post("/", (req, res) => {
  // Honeypot check — see lib/spamCheck.js.
  if (isSpam(req.body)) {
    return res.status(400).json({ error: "Your message could not be sent. Please try again." });
  }

  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const subject = (req.body.subject || "").trim();
  const message = (req.body.message || "").trim();
  const errors = [];

  if (!name || name.length < 2) {
    errors.push("Please enter your full name.");
  }
  if (!email || !EMAIL_RE.test(email)) {
    errors.push("Please enter a valid email address.");
  }
  if (!subject) {
    errors.push("Please enter a subject.");
  }
  if (!message) {
    errors.push("Please write a message.");
  } else if (message.length > MAX_MESSAGE_LENGTH) {
    errors.push("Message is too long.");
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO contact_messages (name, email, subject, message)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(name, email, subject, message);

    // Best-effort admin notification — doesn't block the response either way.
    sendContactNotificationEmail({ name, email, subject, message }).catch((err) => {
      console.error("Failed to send contact notification email:", err);
    });

    return res.status(201).json({
      message: "Message sent! We'll reply within 1-2 business days.",
    });
  } catch (dbErr) {
    console.error("Contact form error:", dbErr);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

module.exports = router;
