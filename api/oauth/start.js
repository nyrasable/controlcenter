const { createState } = require("../../lib/oauthState");
const { authUrl } = require("../../lib/tiktok");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const state = createState();
    return res.redirect(302, authUrl(state));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

