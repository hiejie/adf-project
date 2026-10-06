const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// Defaults to a folder next to this file for local dev. On a host with a
// mounted persistent disk (e.g. Render, Railway), point DATA_DIR at that
// disk's mount path instead — mounting a disk directly over this folder
// (which also contains your code) is not safe, since a mounted disk
// replaces everything already at that path.
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "adf2027.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    student_number TEXT NOT NULL,
    screenshot_filename TEXT NOT NULL,
    screenshot_original_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_email
    ON registrations (email);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_student_number
    ON registrations (student_number);

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Lightweight, idempotent migrations -----------------------------------
// better-sqlite3 has no built-in migration system. These ALTER TABLE calls
// are wrapped in try/catch and simply no-op ("duplicate column name") on a
// database that already has them, so this file stays safe to run against
// both a brand-new database and an existing one from before consent
// tracking was added.
function addColumnIfMissing(table, columnDef) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (err) {
    if (!/duplicate column name/i.test(err.message)) {
      throw err;
    }
  }
}

// Records that a registrant explicitly agreed to the Privacy Policy /
// Terms of Service, and when — useful evidence of consent if it's ever
// questioned later.
addColumnIfMissing("registrations", "consent_given INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("registrations", "consent_at TEXT");

// Speeds up the data-retention purge query (WHERE created_at < ?).
db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations (created_at)`);

module.exports = db;
