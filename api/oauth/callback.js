const crypto = require("crypto");

const {
  write
} = require("../../lib/session");

const {
  exchange,
  app
} = require("../../lib/tiktok");

function verifyState(state) {
  if (!state || typeof state !== "string") {
    return false;
  }

  const parts = state.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [nonce, signature] = parts;
  const secretFingerprint = crypto
  .createHash("sha256")
  .update(process.env.SESSION_SECRET)
  .digest("hex")
  .slice(0, 12);

console.log("CALLBACK_SECRET_FP", secretFingerprint);
console.log("STATE_NONCE", nonce);
console.log("STATE_SIGNATURE_RECEIVED", signature);

  const expected = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(nonce)
    .digest("hex")
    .slice(0, 24);
  
console.log("STATE_SIGNATURE_EXPECTED", expected);
  
  if (signature.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    console.log("CALLBACK_VERSION", "V2-DEBUG-2026-10-04-1835");
    const {
      code,
      state,
      error,
      error_description
    } = req.query;
    console.log("STATE_RECEIVED", state);

console.log(
  "SESSION_SECRET_CALLBACK",
  Boolean(process.env.SESSION_SECRET),
  process.env.SESSION_SECRET
    ? process.env.SESSION_SECRET.length
    : 0
);

    if (error) {
      throw new Error(
        error_description || error
      );
    }

    if (!code) {
      throw new Error(
        "Code OAuth manquant."
      );
    }

 console.log("OAuth diagnostic:", {
  stateReceived: Boolean(state),
  stateLength: state ? state.length : 0
});
const stateValid = verifyState(state);

console.log("STATE_VERIFY_RESULT", stateValid);
    if (!stateValid) {
  throw new Error("OAuth state invalide.");
}
    const token = await exchange(code);

    write(res, token);

    return res.redirect(
      302,
      app()
    );

  } catch (e) {
    const msg = String(
      e.message || e
    ).replace(/[<>&]/g, "");

    return res.status(400).send(`
      <h1>TikTok OAuth error</h1>
      <p>${msg}</p>
      <p><a href="/">Retour au Nyra Control Center</a></p>
    `);
  }
};
