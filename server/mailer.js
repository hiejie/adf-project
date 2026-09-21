const nodemailer = require("nodemailer");

const EVENT_NAME = process.env.EVENT_NAME || "A Day with the Foxes 2027";
const EVENT_DATE_TEXT = process.env.EVENT_DATE_TEXT || "February 23, 2027";
const EVENT_VENUE = process.env.EVENT_VENUE ||
  "Holy Angel University, School of Computing — #1 Holy Angel Avenue, Sto. Rosario, Angeles City, Philippines 2009";
const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");

let transporter = null;
let mailerReady = false;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn(
      "[mailer] SMTP is not configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS missing). " +
        "Registration confirmation emails will be skipped. See server/README.md."
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true", // true for port 465, false for 587/25
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  mailerReady = true;
  return transporter;
}

async function verifyMailer() {
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.verify();
    console.log("[mailer] SMTP connection verified, ready to send emails.");
    return true;
  } catch (err) {
    console.error("[mailer] SMTP verification failed:", err.message);
    return false;
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function sendRegistrationConfirmationEmail({ to, fullName, studentNumber }) {
  const t = getTransporter();
  if (!t) return { sent: false, reason: "SMTP not configured" };

  const fromAddress = process.env.MAIL_FROM || `"${EVENT_NAME}" <no-reply@example.com>`;
  const contactLink = SITE_URL ? `${SITE_URL}/contacts.html` : "our Contact Us page";

  const text = `Hi ${fullName},

You're registered for ${EVENT_NAME}!

Registration details:
  Full name:       ${fullName}
  Student number:  ${studentNumber}

Event details:
  Date:  ${EVENT_DATE_TEXT}
  Venue: ${EVENT_VENUE}

Please bring your Student ID with you on the day of the event.

If you have any questions, reach out via ${contactLink}.

See you there, fox!
School of Computing - Holy Angel University
`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333333; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #c9272d; margin-bottom: 4px;">You're registered!</h2>
      <p style="color: #627083; margin-top: 0;">${escapeHtml(EVENT_NAME)}</p>

      <p>Hi ${escapeHtml(fullName)},</p>
      <p>Thanks for registering. Here's a copy of your registration for your records:</p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 6px 0; color: #627083; font-size: 0.85em;">Full name</td>
          <td style="padding: 6px 0;">${escapeHtml(fullName)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #627083; font-size: 0.85em;">Student number</td>
          <td style="padding: 6px 0;">${escapeHtml(studentNumber)}</td>
        </tr>
      </table>

      <h3 style="color: #162b45; margin-bottom: 4px;">Event details</h3>
      <p style="margin: 4px 0;"><strong>Date:</strong> ${escapeHtml(EVENT_DATE_TEXT)}</p>
      <p style="margin: 4px 0;"><strong>Venue:</strong> ${escapeHtml(EVENT_VENUE)}</p>

      <p>Please bring your Student ID with you on the day of the event.</p>

      <p style="color: #627083; font-size: 0.85em; margin-top: 28px;">
        Questions? Visit our <a href="${SITE_URL || "#"}/contacts.html" style="color:#c9272d;">Contact Us</a> page.
      </p>
      <p style="color: #627083; font-size: 0.85em;">School of Computing &mdash; Holy Angel University</p>
    </div>
  `;

  try {
    await t.sendMail({
      from: fromAddress,
      to,
      subject: `You're registered for ${EVENT_NAME}`,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] Failed to send confirmation email:", err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendRegistrationConfirmationEmail, verifyMailer };
