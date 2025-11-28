const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

const TOKEN_PATH = __dirname + "/tokens.json";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Load tokens on startup
if (fs.existsSync(TOKEN_PATH)) {
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oauth2Client.setCredentials(tokens);
    console.log("✅ Loaded saved YouTube OAuth tokens (auto-login enabled).");
  } catch (err) {
    console.error("❌ Failed to load tokens:", err);
  }
}

// Save tokens to file permanently
function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log("💾 Saved new YouTube OAuth tokens.");
}

module.exports = { oauth2Client, saveTokens };
