# Deployment Guide — ADF2027

## 1. The folder you deploy

Everything ships as one folder. `server.js` serves the front-end files
(`index.html`, `css/`, `scripts/`, etc.) as static files from one directory
above itself, so the whole thing deploys as a single unit — there's no
separate front-end/backend deploy:

```
adf-folder/                  ← deploy this whole folder
├── index.html
├── features.html
├── services.html
├── contacts.html
├── registration.html
├── privacy.html
├── terms.html
├── README.md
├── css/
│   ├── home.css, features.css, services.css, contacts.css, registration.css
│   └── legal.css
├── scripts/
│   └── main.js
└── server/
    ├── server.js            ← entry point (npm start runs this)
    ├── db.js, mailer.js
    ├── package.json
    ├── .env                 ← you create this (never commit it)
    ├── .env.example
    ├── lib/                 (encryption.js, spamCheck.js)
    ├── routes/               (admin.js, contact.js, register.js)
    ├── middleware/           (requireAdmin.js, upload.js)
    ├── views/                (dashboard.ejs, login.ejs)
    ├── scripts/              (set-admin-password.js, purge-old-data.js)
    ├── data/                 ← created automatically (SQLite database)
    └── uploads/              ← created automatically (encrypted screenshots)
```

`data/` and `uploads/` don't exist yet in a fresh checkout — the app creates
them on first run. That's exactly why **where they physically live matters**
once you deploy (see the warning below).

## 2. ⚠️ Read this before picking a host

This app stores everything itself: a SQLite file (`server/data/adf2027.db`)
and encrypted screenshots (`server/uploads/`) on local disk. There's no
external database or object storage.

**Render and Railway's free tiers do not include persistent disk** — Render
says so explicitly ("Free services do not support persistent disks"), and
its free Postgres databases expire after 30 days regardless. Railway's free
usage credit doesn't include a Volume either; Volumes are a paid-plan
feature. On either platform's free tier, this app will run fine right up
until the first restart/redeploy silently deletes every registration and
screenshot you've collected. Confirmed as of September 2026 — worth
double-checking on their pricing pages before you commit, since these terms
do shift.

### The zero-cost option: a genuinely free VPS

Good news for a student budget — you don't need to pay for anything, and
you don't need to change a line of code. Both of these give you a real,
persistent Linux disk, free forever (not a trial that expires):

- **Oracle Cloud "Always Free"** — includes small compute VMs plus **200GB
  of real, persistent block storage**, for as long as your account stays
  active (not a time-limited trial). This is the best fit here: your
  SQLite file and uploads folder just live on that disk like normal.
  Requires a card for identity verification (a $1 authorization hold,
  refunded), but nothing is charged unless you deliberately provision paid
  resources. Some regions occasionally show "out of capacity" for the
  free ARM shapes — if that happens, try a different region or the
  free x86 micro shape instead.
- **Google Cloud's free e2-micro VM** — one small VM free forever (in
  select US regions) with 30GB of persistent disk. Smaller, but plenty for
  a single-event SQLite database and a folder of compressed screenshot
  images, and a solid backup option if Oracle's signup is being difficult.

Either way, follow **Option C (VPS) below** — the setup steps are identical,
you're just paying $0/month for the box.

### If later you do have a little budget

Render/Railway (Options A/B below) buy you one-click deploys and less
server administration. On Render specifically, note that a disk requires a
paid Starter-tier (or higher) instance — it's not something you can bolt
onto a free service for a couple dollars. Worth it once you outgrow "free
and manual," not required to launch.

## 3. Environment variables checklist

Copy `server/.env.example` to `server/.env` and fill in:

- [ ] `NODE_ENV=production`
- [ ] `SITE_URL` — your real domain, no trailing slash
- [ ] `SESSION_SECRET` — random, generated, not the dev default (the app
      refuses to start in production without this)
- [ ] `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` (run
      `npm run seed-admin -- "yourStrongPassword123"`)
- [ ] `UPLOAD_ENCRYPTION_KEY` — random 64-char hex (the app refuses to start
      without this, in *any* environment). **Back this up somewhere outside
      of git or the server** — if it's lost, existing screenshots become
      permanently unreadable.
- [ ] `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` —
      for registration confirmation emails (optional but recommended)
- [ ] `ADMIN_NOTIFY_EMAIL` — optional, for contact-form notifications

## 4. Option A — Render (step by step)

**Important:** Render's free web services can't have a disk attached at
all — that's a paid-plan feature (Starter tier or above), not just an
add-on cost. So step 3 below means picking a paid instance size, not
upgrading a free one after the fact. Check Render's current pricing page
for what Starter costs before you commit — it's changed a few times this
year.

1. Push this folder to a GitHub repo.
2. In the Render dashboard: **New → Web Service**, connect the repo.
3. **Root Directory:** `server` · **Build Command:** `npm install` ·
   **Start Command:** `npm start` · **Instance Type:** Starter (or above —
   not Free, since Free has no disk support).
4. Add the environment variables from the checklist in section 3, **plus**:
   ```
   DATA_DIR=/var/data/db
   UPLOAD_DIR=/var/data/uploads
   ```
   Don't point these at anything under `server/` — a mounted disk replaces
   everything already at its mount path, and `server/` also holds your
   actual code. `/var/data` is a clean, separate location.
5. Click **Advanced** (or, after the service is created, go to its
   **Disks** tab) → **Add Disk**:
   - **Mount Path:** `/var/data`
   - **Size:** 1GB is plenty to start (a SQLite file plus a reasonable
     number of encrypted screenshots). You can grow it later; you can't
     shrink it.
6. Create/save — Render (re)deploys with the disk attached. The disk
   starts empty; the app creates `db/` and `uploads/` inside it
   automatically on first run (same `fs.mkdirSync` logic as local dev).
7. Once it's live, open Render's **Shell** for the service (or a one-off
   job) and run, if you haven't already baked `ADMIN_PASSWORD_HASH` into
   your env vars locally:
   ```bash
   npm run seed-admin -- "yourStrongPassword123"
   ```
   replacing that placeholder with a real password of your choosing (see
   the earlier note on how that script works).
8. Visit `https://your-app.onrender.com/admin` and confirm you can log in.
9. **Verify persistence before you trust it:** register a test entry,
   then manually restart the service from the Render dashboard, then
   check that test entry is still in the admin dashboard. If it's gone,
   the disk isn't actually mounted where the app is writing — recheck
   `DATA_DIR`/`UPLOAD_DIR` against the disk's mount path.

Render's paid instances don't spin down when idle the way the free tier
does, so this also avoids the cold-start delay a free service would have.

## 5. Option B — Railway

Same shape as Render:

1. New project → deploy from GitHub repo, set the service's root/working
   directory to `server`.
2. Build/start commands are auto-detected from `package.json`
   (`npm install` / `npm start`).
3. Add the same environment variables as the Render steps above, including
   `DATA_DIR=/data/db` and `UPLOAD_DIR=/data/uploads`.
4. **Add a Volume** (Railway's persistent storage) mounted at `/data` —
   a separate path from your code, same reasoning as Render's disk above.
   Volumes are a paid-plan feature on Railway too, not part of the free
   trial credit.
5. Run the admin seed script via Railway's one-off command/shell feature.
6. Same as Render: restart the service once after a test registration and
   confirm the data survived, before trusting it with real registrants.

## 6. Option C — A free VPS (Oracle Cloud, no card charges ever)

This is the realistic path with zero budget. Render/Railway's free tiers
literally cannot attach a disk (confirmed above) — there's no cheaper tier
to unlock there. A free VPS gives you a normal Linux disk instead, so
nothing about "where does the data live" is even a question.

### 6a. Create the free VM (Oracle Cloud)

1. Sign up at [cloud.oracle.com](https://cloud.oracle.com). You'll be asked
   for a card for identity verification — a $1 hold that's refunded, not a
   charge. Always-Free resources stay free unless you deliberately create
   something paid later.
2. Pick your **Home Region** carefully during signup — Always Free
   resources are locked to this one region forever. A larger region (e.g.
   one with 3 availability domains, like US-East Ashburn) tends to have
   better free-capacity availability than a small one. Given you're in the
   Philippines, a nearby region keeps latency lower, but availability
   matters more than latency for a single-day event — don't over-optimize
   this pick.
3. **Compute → Instances → Create Instance.**
4. **Shape — pick one:**
   - **Easier/more reliable: `VM.Standard.E2.1.Micro`** (x86, 1 OCPU, 1GB
     RAM). This is a separate free allocation from the ARM one below and
     rarely hits "out of capacity" errors. Plenty for a Node/SQLite app
     handling one event's worth of registrations.
   - **More power, sometimes contested: Ampere `VM.Standard.A1.Flex`**
     (ARM, up to 4 OCPUs / 24GB RAM free). More than you need here, but
     it's genuinely well known for "out of capacity" errors on the free
     tier in busy regions — people retry for days in forums. Don't burn
     time fighting for this when the Micro shape above already covers
     what this app needs.
5. **Image:** Canonical Ubuntu 24.04 (use the aarch64 build if you picked
   the ARM shape, standard x86_64 build for the Micro shape).
6. Add an SSH key (Oracle can generate one for you to download, or paste
   your own public key).
7. **Boot volume:** the default (~50GB) is far more than this app needs.
8. Create the instance and note its public IP.
9. **Open the firewall:** Networking → Virtual Cloud Networks → your VCN
   → Security Lists → Default Security List → **Add Ingress Rules** for
   TCP ports `22` (SSH), `80` (HTTP), and `443` (HTTPS), source `0.0.0.0/0`.
   (Oracle's OS-level firewall also blocks by default — `sudo ufw allow
   80,443,22/tcp` on the instance itself, or disable `ufw`/`iptables` rules
   for those ports, or step 9's ingress rules won't be enough on their own.)

If Oracle's signup or capacity is being difficult, **Google Cloud's** free
`e2-micro` VM (Compute Engine, us-central1/us-west1/us-east1 only, 30GB
disk) is a simpler backup with the same "always free, not a trial" deal —
smaller ceiling, less finicky to actually get.

### 6b. Deploy the app on the VM

Same steps regardless of which provider you used above:

1. SSH in: `ssh ubuntu@<your-instance-ip>` (Oracle's Ubuntu images use the
   `ubuntu` user by default).
2. Install Node.js and nginx:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs nginx
   ```
3. Clone the repo, `cd server && npm install`, copy `.env.example` to
   `.env` and fill it in (see the checklist in section 3) — **no need for
   `DATA_DIR`/`UPLOAD_DIR` here**, since this is a real, always-persistent
   disk; the defaults are fine.
4. Run the app with a process manager so it survives crashes/reboots:
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name adf2027
   pm2 save
   pm2 startup   # follow the printed instructions to enable on boot
   ```
5. Point nginx at `http://127.0.0.1:3000` as a reverse proxy, and get a
   free TLS cert with [certbot](https://certbot.eff.org/) (Let's Encrypt)
   once you've pointed a domain at the instance's IP.
6. `server.js` already assumes exactly one reverse-proxy hop
   (`app.set("trust proxy", 1)`) — correct for this nginx setup.
7. Back up `server/data/adf2027.db` and `server/uploads/` on a schedule —
   even a nightly `cron` job that copies them somewhere safe (e.g. rclone
   to a free Google Drive/Backblaze B2 tier) is enough for an event of
   this size, and costs nothing.

## 7. Post-deploy checklist

- [ ] Registration end-to-end: submit a real test registration, confirm it
      appears in the admin dashboard, confirm the screenshot opens/decrypts
      correctly, confirm the confirmation email arrives (if SMTP is set up).
- [ ] Contact form end-to-end: submit a test message, confirm it appears
      under Contact Messages, confirm the admin notification email arrives
      (if `ADMIN_NOTIFY_EMAIL` is set).
- [ ] `/privacy.html` and `/terms.html` load and the placeholders
      (`[DATE]`, `[RETENTION PERIOD]`, etc.) have been filled in and
      reviewed by someone who can actually speak for the organization
      legally — these were written as drafts, not final legal text.
- [ ] Admin login works with the real (non-default) username/password.
- [ ] `GET /healthz` returns `{"status":"ok"}` — point an uptime monitor at
      it if you have one.
- [ ] Confirm `server/data/` and `server/uploads/` are actually persistent
      on whichever host you chose (restart the service and check your test
      registration is still there).
- [ ] Decide and calendar a retention date — mark it on your team's
      calendar to actually run `npm run purge-old-data` (or use the
      dashboard panel) after the event, per your Privacy Policy's stated
      retention period.
- [ ] `UPLOAD_ENCRYPTION_KEY` and `SESSION_SECRET` are backed up somewhere
      safe outside the server (e.g. a password manager), not just left in
      the hosting platform's dashboard.
