const express = require("express");
const fs = require("fs");
const db = require("../db");
const { upload } = require("../middleware/upload");
const { sendRegistrationConfirmationEmail } = require("../mailer");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_NUMBER_RE = /^\d{8}$/;

function cleanupUploadedFile(file) {
  if (file && file.path) {
    fs.unlink(file.path, () => {});
  }
}

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

    const fullName = (req.body["full-name"] || "").trim();
    const email = (req.body["email"] || "").trim().toLowerCase();
    const studentNumber = (req.body["student-number"] || "").replace(/\D/g, "").trim();
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

    if (errors.length > 0) {
      cleanupUploadedFile(req.file);
      return res.status(400).json({ error: errors[0], errors });
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO registrations (full_name, email, student_number, screenshot_filename, screenshot_original_name)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        fullName,
        email,
        studentNumber,
        req.file.filename,
        req.file.originalname
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
      cleanupUploadedFile(req.file);

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
