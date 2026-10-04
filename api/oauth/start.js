const crypto = require("crypto");
const { setCookie } = require("../../lib/session");
const { authUrl } = require("../../lib/tiktok");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const state = crypto.randomBytes(24).toString("hex");

    setCookie(res, "nyra_oauth_state", state, 600);

    return res.redirect(302, authUrl(state));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
