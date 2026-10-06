# A Day with the Foxes (ADF2027) — HAU School of Computing

This repository contains the full site: the static front end (this folder)
plus its Node.js/Express backend (`server/`).

- **Front end:** plain HTML/CSS/JS — `index.html`, `features.html`,
  `services.html`, `contacts.html`, `registration.html`, `privacy.html`,
  `terms.html`, with shared styles in `css/` and shared behavior in
  `scripts/main.js`.
- **Backend:** see [`server/README.md`](server/README.md) for setup,
  environment variables, admin dashboard usage, and data retention.
- **Deployment:** see [`DEPLOYMENT.md`](DEPLOYMENT.md) for how to package
  this whole folder and put it online, including an important note about
  where SQLite + the uploads folder can and can't be hosted safely.

## Quick start (local)

```bash
cd server
npm install
cp .env.example .env      # then fill in the values — see server/README.md
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" # paste result into "UPLOAD ENCRYPTION KEY" in .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" # paste result into "SESSION_SECRET" in .env
npm run seed-admin -- "yourStrongPassword123"
npm start
```

Then open `http://localhost:3000`.
