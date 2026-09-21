const express = require("express");
const db = require("../db");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 5000;

router.post("/", (req, res) => {
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

    return res.status(201).json({
      message: "Message sent! We'll reply within 1-2 business days.",
    });
  } catch (dbErr) {
    console.error("Contact form error:", dbErr);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

module.exports = router;
