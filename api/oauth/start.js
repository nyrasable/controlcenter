const crypto = require("crypto");
const { authUrl } = require("../../lib/tiktok");

function makeState() {
  const nonce = crypto.randomBytes(12).toString("hex");

  const signature = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(nonce)
    .digest("hex")
    .slice(0, 24);

  return `${nonce}.${signature}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const state = makeState();

    return res.redirect(
      302,
      authUrl(state)
    );
  } catch (e) {
    return res.status(500).json({
      error: e.message
    });
  }
};
