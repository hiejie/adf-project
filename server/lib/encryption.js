const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended IV length for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Uploaded Campus++ screenshots contain a student's photo/profile info, so
 * they're encrypted before ever touching disk. This keeps a leaked/stolen
 * copy of the uploads folder useless without the key, which is kept only in
 * the environment (never in the repo, never in the database).
 *
 * Generate a key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * and put it in .env as UPLOAD_ENCRYPTION_KEY.
 */
function getKey() {
  const keyHex = process.env.UPLOAD_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "UPLOAD_ENCRYPTION_KEY is not set. Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
        "and add it to your .env file."
    );
  }

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "UPLOAD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) for AES-256."
    );
  }
  return key;
}

// Returns a single Buffer laid out as: [12-byte IV][16-byte auth tag][ciphertext]
// so nothing extra needs to be stored in the database to decrypt it later.
function encryptBuffer(plainBuffer) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

function decryptBuffer(encryptedBuffer) {
  const key = getKey();
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = { encryptBuffer, decryptBuffer };
