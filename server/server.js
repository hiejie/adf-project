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
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
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
  if (isProduction && (process.env.SESSION_SECRET || "").startsWith("dev-only")) {
    console.warn("[warning] SESSION_SECRET looks like the default dev value. Set a real one before going live.");
  }
  verifyMailer();
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down.");
  process.exit(0);
});
