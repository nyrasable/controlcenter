const crypto = require("crypto");

function getSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error("SESSION_SECRET missing or too short");
  }

  return secret;
}

function createState() {
  const nonce = crypto.randomBytes(8).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString(36);

  const payload = `${nonce}.${timestamp}`;

  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url")
    .slice(0, 16);

  return `${payload}.${signature}`;
}

function verifyState(state) {
  if (!state || typeof state !== "string") {
    return false;
  }

  const parts = state.split(".");

  if (parts.length !== 3) {
    return false;
  }

  const [nonce, timestamp, signature] = parts;

  const payload = `${nonce}.${timestamp}`;

  const expectedSignature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url")
    .slice(0, 16);

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  const validSignature = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!validSignature) {
    return false;
  }

  const createdAt = parseInt(timestamp, 36) * 1000;
  const age = Date.now() - createdAt;

  return age >= 0 && age < 10 * 60 * 1000;
}

module.exports = {
  createState,
  verifyState
};
