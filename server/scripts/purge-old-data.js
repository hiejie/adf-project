#!/usr/bin/env node
/**
 * Usage:
 *   npm run purge-old-data -- 2027-06-01
 *
 * Permanently deletes every registration (and its screenshot file) created
 * before the given date. Same operation as the "Data Retention" panel in
 * the admin dashboard, exposed here so an organizer comfortable with the
 * command line can run it directly, or so it can be wired into a scheduled
 * cron job on your host once your org settles on a fixed retention period
 * (e.g. "delete 90 days after the event").
 *
 * This does NOT run automatically on its own — nothing deletes data unless
 * this script or the dashboard button is explicitly run.
 */
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { uploadDir } = require("../middleware/upload");

const beforeArg = process.argv[2];

if (!beforeArg) {
  console.error("Please provide a cutoff date, e.g.:");
  console.error("  npm run purge-old-data -- 2027-06-01");
  process.exit(1);
}

const cutoff = new Date(beforeArg);
if (Number.isNaN(cutoff.getTime())) {
  console.error(`"${beforeArg}" is not a valid date.`);
  process.exit(1);
}

const rows = db
  .prepare(`SELECT id, full_name, screenshot_filename FROM registrations WHERE created_at < ?`)
  .all(cutoff.toISOString());

if (rows.length === 0) {
  console.log(`No registrations older than ${beforeArg}. Nothing to do.`);
  process.exit(0);
}

console.log(`About to permanently delete ${rows.length} registration(s) and their screenshots:`);
rows.forEach((r) => console.log(`  - #${r.id} ${r.full_name}`));

const deleteStmt = db.prepare(`DELETE FROM registrations WHERE id = ?`);
const purge = db.transaction((items) => {
  items.forEach((row) => {
    deleteStmt.run(row.id);
    if (row.screenshot_filename) {
      fs.unlink(path.join(uploadDir, row.screenshot_filename), () => {});
    }
  });
});

purge(rows);
console.log(`Done. Deleted ${rows.length} registration(s).`);
