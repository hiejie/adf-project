# ADF 2027 Backend

Node.js + Express backend for the "A Day with the Foxes" 2027 site. It serves the
existing static front end (the folder one level up) and adds:

- `POST /api/register` — handles the registration form (name, email, student
  number, Campus++ screenshot upload). Validates input, rejects duplicate
  emails/student numbers, stores the screenshot on disk, and saves the
  registration to SQLite.
- `POST /api/contact` — handles the "Contact Us" form and saves messages to
  SQLite.
- `/admin` — a small session-protected dashboard to view/search registrations,
  view uploaded screenshots, view contact messages, mark messages read, delete
  entries, and export registrations as CSV.

## 1. Install dependencies

```bash
cd server
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set:

- `NODE_ENV` — `development` locally, `production` when deployed live. In
  production this enables secure (HTTPS-only) session cookies and an
  automatic HTTP → HTTPS redirect.
- `SITE_URL` — the public URL of your deployed site (no trailing slash), used
  as the link back to the site in confirmation emails.
- `SESSION_SECRET` — any long random string (used to sign the admin session
  cookie). Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `ADMIN_USERNAME` — the username you'll use to log into `/admin`.
- `UPLOAD_ENCRYPTION_KEY` — **required in every environment**, including
  local dev. Campus++ screenshots are encrypted before being written to
  disk; without this key the server refuses to start. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Back this up somewhere safe outside of git (e.g. a password manager). If
  it's ever lost or rotated, previously-uploaded screenshots become
  permanently unreadable.
- `ADMIN_NOTIFY_EMAIL` — optional. If set (and SMTP is configured), an email
  is sent to this address whenever a new Contact Us message comes in.

Then generate a bcrypt hash for your admin password and save it into `.env`
automatically:

```bash
npm run seed-admin -- "YourStrongPassword123"
```

(Never put the plain password directly in `.env` — only the hash.)

### Registration confirmation emails

Registrants get an automatic confirmation email once their registration is
saved. Fill in the SMTP block in `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your-16-character-app-password
MAIL_FROM="A Day with the Foxes 2027 <no-reply@yourdomain.edu>"
```

Any standard SMTP provider works (Gmail with an
[app password](https://support.google.com/accounts/answer/185833), your
school's mail server, SendGrid, Mailgun, Amazon SES SMTP, etc.) — just fill
in the matching host/port/credentials. If `SMTP_HOST` is left blank, the
server skips sending email and registration still completes normally
(`emailSent: false` in the API response) — useful for local development
without setting up SMTP.

On startup the server tries to verify the SMTP connection and logs whether it
succeeded, so check the console output after deploying.

## 3. Run it

```bash
npm start      # normal start
npm run dev    # auto-restarts on file changes (Node 18.19+/20+)
```

The whole site (front end + API + admin) is now available at
`http://localhost:3000`.

- Public site: `http://localhost:3000/`
- Admin dashboard: `http://localhost:3000/admin`

## Data storage

- SQLite database: `server/data/adf2027.db` (created automatically on first run)
- Uploaded screenshots: `server/uploads/` — stored **encrypted** (AES-256-GCM,
  see `lib/encryption.js`). The admin dashboard decrypts them on the fly when
  an authenticated organizer views one; the files are not viewable images on
  their own.

Both are git-ignored — back them up yourself before redeploying or wiping the
server. Note: on many free-tier PaaS hosts (Render, Railway, etc.) the local
disk is **not persistent** across restarts/redeploys — see `DEPLOYMENT.md` at
the project root before relying on this in production.

## Consent & spam protection

- The registration form includes a required consent checkbox (linked to
  `/privacy.html` and `/terms.html`). The server rejects any registration
  submitted without it, and records `consent_given`/`consent_at` per
  registrant as evidence consent was actually given.
- Both public forms include a hidden honeypot field (`hp_confirm`). Real
  users never see or fill it in; submissions where it's non-empty are
  rejected as spam. See `lib/spamCheck.js`. This has no external dependency
  or setup cost — if bot traffic remains a problem after launch, adding a
  CAPTCHA service (e.g. hCaptcha) on top is a reasonable next step.

## Data retention

Per the PRD's privacy requirement, registrant data (including screenshots)
should be deleted or archived after the event. Nothing deletes data
automatically — you choose when, via either:

- The **Data Retention** panel on the admin dashboard (pick a cutoff date,
  confirm, done), or
- The command line: `npm run purge-old-data -- 2027-06-01`

Both permanently delete every registration (and its screenshot file) created
before the date you give. Export a CSV backup first if you want a record.
If your organization settles on a fixed retention window (e.g. "90 days
after the event"), the CLI version can be wired into a scheduled cron job on
your host.

## Notes / things to revisit before going live

- **HTTPS**: set `NODE_ENV=production` in your deployment environment. This
  makes session cookies HTTPS-only and adds an automatic HTTP → HTTPS
  redirect. You still need TLS terminated somewhere (a reverse proxy like
  nginx/Caddy, or your host's built-in HTTPS, e.g. Render/Railway/Fly.io).
  `app.set("trust proxy", 1)` in `server.js` assumes a single reverse-proxy
  hop in front of Node — adjust that value if your setup differs.
- **Process manager**: don't run `node server.js` directly in production —
  use something that restarts it on crash/reboot, e.g.
  [PM2](https://pm2.keymetrics.io/) (`pm2 start server.js --name adf2027`)
  or a systemd service.
- **Reverse proxy**: point your domain's nginx/Caddy config at
  `http://127.0.0.1:3000` (or whatever `PORT` you set) and let the proxy
  handle the TLS certificate (e.g. via Let's Encrypt/certbot).
- **Health check**: `GET /healthz` returns `{"status":"ok"}` — point your
  uptime monitor or load balancer health check at it.
- **Backups**: the SQLite file and `uploads/` folder are the only copies of
  registration data — include them in whatever backup process you use for the
  server.
- **Rate limiting**: basic IP-based rate limits are applied to the form
  endpoints and the admin login to deter spam/brute-forcing. Tune the limits
  in `server.js` if needed.
- **Email deliverability**: if using Gmail SMTP, you're capped at ~500
  messages/day and messages can get flagged as spam at higher volumes — for
  a larger event, consider a transactional email service (SendGrid, Mailgun,
  Amazon SES) instead.
