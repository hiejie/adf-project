const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

// Defaults to a folder next to this file for local dev. On a host with a
// mounted persistent disk, point UPLOAD_DIR at that disk's mount path
// instead of a subfolder of the code — see the note in db.js.
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

// PRD FR-4 calls for a 5MB cap on the Campus++ screenshot (previously 10MB).
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Files are held in memory just long enough to be validated and encrypted
// in routes/register.js — nothing unencrypted is ever written to disk.
// See lib/encryption.js.
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    cb(new Error("INVALID_FILE_TYPE"));
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

// Generates the filename the *encrypted* file will be saved under.
// The ".enc" suffix makes it obvious (to us, and to anyone who stumbles
// onto the uploads folder) that this isn't a viewable image file as-is.
function generateStoredFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : "";
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}.enc`;
}

module.exports = { upload, uploadDir, MAX_FILE_SIZE_BYTES, generateStoredFilename };
