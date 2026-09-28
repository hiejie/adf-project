require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const registerRoute = require("./routes/register");
const contactRoute = require("./routes/contact");
const adminRoute = require("./routes/admin");
const { verifyMailer } = require("./mailer");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

// Front-end lives one directory up from /server
const SITE_ROOT = path.join(__dirname, "..");

// ---------- Fail-fast startup checks ----------
// Better to refuse to start with a clear message than to run insecurely.
// The screenshot-encryption key is required in every environment, because
// without it the registration form is fundamentally broken (uploads can't
// be encrypted or decrypted). The session/admin secrets are only enforced
// in production — a fresh local dev checkout should still boot with the
// documented dev-only fallbacks so newcomers aren't blocked before they've
// even run the admin seed script.
const encryptionKey = process.env.UPLOAD_ENCRYPTION_KEY || "";
if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
  console.error(
    "[startup] UPLOAD_ENCRYPTION_KEY is missing or invalid. It must be a 64-character hex string.\n" +
      "Generate one with:\n" +
      "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
      "and add it to your .env file as UPLOAD_ENCRYPTION_KEY."
  );
  process.exit(1);
}

if (isProduction) {
  const sessionSecret = process.env.SESSION_SECRET || "";
  if (!sessionSecret || sessionSecret.startsWith("dev-only")) {
    console.error(
      "[startup] Refusing to start in production with a missing/default SESSION_SECRET.\n" +
        "Set a real, random value in your .env file."
    );
    process.exit(1);
  }
  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.error(
      '[startup] Refusing to start in production without ADMIN_PASSWORD_HASH.\n' +
        'Run: npm run seed-admin -- "yourStrongPassword123"'
    );
    process.exit(1);
  }
  if ((process.env.ADMIN_USERNAME || "admin") === "admin") {
    console.warn(
      "[startup] warning: ADMIN_USERNAME is still the default 'admin'. Consider changing it " +
        "in .env — it doesn't need to be a secret, but a non-default value removes one easy guess."
    );
  }
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// If deployed behind a single reverse proxy / load balancer (nginx, Render,
// Railway, Heroku, etc.), this makes req.secure and rate-limit client IPs
// correct. Adjust if your setup has multiple proxy hops.
app.set("trust proxy", 1);

app.use(morgan(isProduction ? "combined" : "dev"));

// Force HTTPS in production (relies on the reverse proxy setting
// X-Forwarded-Proto, which is standard for nginx/most PaaS providers).
if (isProduction) {
  app.use((req, res, next) => {
    if (req.secure || req.get("x-forwarded-proto") === "https") {
      next();
      return;
    }
    res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  });
}

// Simple health check for uptime monitoring / load balancers
app.get("/healthz", (req, res) => res.status(200).json({ status: "ok" }));

app.use(
  helmet({
    // The existing front end loads Google Fonts and inline styles/scripts,
    // so CSP is relaxed slightly rather than locked to defaults.
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        "script-src": ["'self'"],
      },
    },
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  session({
    name: "adf2027.sid",
    secret: process.env.SESSION_SECRET || "dev-only-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// Basic rate limiting on the public form endpoints to deter spam/abuse
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions from this device. Please try again later." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Please try again later.",
});

// ---------- API routes ----------
app.use("/api/register", formLimiter, registerRoute);
app.use("/api/contact", formLimiter, contactRoute);

// ---------- Admin ----------
app.use("/admin/login", loginLimiter);
app.use("/admin", adminRoute);

// ---------- Static front end (the existing HTML/CSS/JS site) ----------
app.use(express.static(SITE_ROOT, { index: "index.html" }));

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(SITE_ROOT, "index.html"), (err) => {
    if (err) res.status(404).send("Not found.");
  });
});

app.listen(PORT, () => {
  console.log(`ADF 2027 server running at http://localhost:${PORT}`);
  verifyMailer();
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down.");
  process.exit(0);
});
