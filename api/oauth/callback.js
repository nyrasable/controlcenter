const {
  parseCookies,
  clearCookie,
  writeSession
} = require("../../lib/session");

const {
  tokenExchange,
  appUrl
} = require("../../lib/tiktok");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      code,
      state,
      error,
      error_description
    } = req.query;

    if (error) {
      throw new Error(error_description || error);
    }

    if (!code) {
      throw new Error("Code OAuth manquant.");
    }

    const cookies = parseCookies(req);
    const expectedState = cookies.nyra_oauth_state;

    if (!state || !expectedState || state !== expectedState) {
      throw new Error("OAuth state invalide.");
    }

    clearCookie(res, "nyra_oauth_state");

    const token = await tokenExchange(code);

    writeSession(res, token);

    return res.redirect(302, appUrl());

  } catch (e) {
    const msg = String(e.message || e).replace(/[<>&]/g, "");

    return res.status(400).send(`
      <h1>TikTok OAuth error</h1>
      <p>${msg}</p>
      <p><a href="/">Retour au Nyra Control Center</a></p>
    `);
  }
};
