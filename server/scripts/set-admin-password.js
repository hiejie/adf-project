#!/usr/bin/env node
/**
 * Usage:
 *   npm run seed-admin -- "your-new-password"
 *
 * Hashes the given password with bcrypt and writes it into server/.env
 * as ADMIN_PASSWORD_HASH. Creates .env from .env.example if it doesn't exist yet.
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password || password.length < 8) {
  console.error("Please provide a password of at least 8 characters.");
  console.error('Example: npm run seed-admin -- "MyStrongPassword123"');
  process.exit(1);
}

const envPath = path.join(__dirname, "..", ".env");
const examplePath = path.join(__dirname, "..", ".env.example");

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
}

const hash = bcrypt.hashSync(password, 12);
let envContents = fs.readFileSync(envPath, "utf8");

if (/^ADMIN_PASSWORD_HASH=.*$/m.test(envContents)) {
  envContents = envContents.replace(/^ADMIN_PASSWORD_HASH=.*$/m, `ADMIN_PASSWORD_HASH=${hash}`);
} else {
  envContents += `\nADMIN_PASSWORD_HASH=${hash}\n`;
}

fs.writeFileSync(envPath, envContents);

console.log("Admin password hash saved to server/.env");
console.log("You can now log in to /admin with that username/password.");
