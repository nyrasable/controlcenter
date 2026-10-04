const crypto = require("crypto");

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) throw new Error("SESSION_SECRET missing or too short");
  return s;
}

function createState() {
  const nonce = crypto.randomBytes(24).toString("hex");
  const ts = Date.now().toString();
  const payload = `${nonce}.${ts}`;
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function verifyState(state) {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;

  const [nonce, ts, sig] = parts;
  const payload = `${nonce}.${ts}`;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  const age = Date.now() - Number(ts);
  return Number.isFinite(age) && age >= 0 && age < 10 * 60 * 1000;
}

module.exports = { createState, verifyState };
