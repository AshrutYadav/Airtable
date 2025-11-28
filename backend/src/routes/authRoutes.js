import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config.js";
import { exchangeCodeForToken, getAirtableProfile } from "../services/airtableService.js";
import { User } from "../models/User.js";

export const authRouter = express.Router();
const PKCE_COOKIE = "airtable_code_verifier";

function base64UrlEncode(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier() {
  return base64UrlEncode(crypto.randomBytes(64));
}

function generateCodeChallenge(codeVerifier) {
  return base64UrlEncode(crypto.createHash("sha256").update(codeVerifier).digest());
}

authRouter.get("/airtable/login", (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  res.cookie(PKCE_COOKIE, codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 5 * 60 * 1000
  });

  const params = new URLSearchParams({
    client_id: config.airtable.clientId,
    redirect_uri: config.airtable.redirectUri,
    response_type: "code",
    scope: "data.records:read data.records:write schema.bases:read",
    state: "state-" + Date.now(),
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });
  const url = `${config.airtable.oauthAuthorizeUrl}?${params.toString()}`;
  res.redirect(url);
});

authRouter.get("/airtable/callback", async (req, res, next) => {
  try {
    // Check for OAuth errors from Airtable
    if (req.query.error) {
      console.error("Airtable OAuth error:", req.query.error, req.query.error_description);
      return res.redirect(`${config.clientBaseUrl}?error=${encodeURIComponent(req.query.error_description || req.query.error)}`);
    }

    const { code } = req.query;
    if (!code) {
      console.error("Missing authorization code in callback");
      return res.redirect(`${config.clientBaseUrl}?error=${encodeURIComponent("Missing authorization code")}`);
    }

    const codeVerifier = req.cookies?.[PKCE_COOKIE];
    if (!codeVerifier) {
      console.error("Missing PKCE code verifier cookie");
      return res.redirect(`${config.clientBaseUrl}?error=${encodeURIComponent("Session expired. Please try logging in again.")}`);
    }

    console.log("Exchanging code for token...");
    const tokenData = await exchangeCodeForToken(code, codeVerifier);
    res.clearCookie(PKCE_COOKIE);
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!accessToken) {
      console.error("No access token received from Airtable");
      return res.redirect(`${config.clientBaseUrl}?error=${encodeURIComponent("Failed to get access token")}`);
    }

    console.log("Getting Airtable profile...");
    const profile = await getAirtableProfile(accessToken);

    let user = await User.findOne({ airtableUserId: profile.airtableUserId });
    if (!user) {
      user = await User.create({
        airtableUserId: profile.airtableUserId,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        accessToken,
        refreshToken,
        lastLoginAt: new Date()
      });
    } else {
      user.accessToken = accessToken;
      user.refreshToken = refreshToken;
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, config.jwtSecret, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });

    console.log("OAuth flow completed successfully");
    res.redirect(config.clientBaseUrl);
  } catch (err) {
    console.error("OAuth callback error:", err.message);
    if (err.response?.data) {
      console.error("Airtable API error response:", JSON.stringify(err.response.data, null, 2));
    }
    next(err);
  }
});

authRouter.get("/me", async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.json({ user: null });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.userId).lean();
    if (!user) return res.json({ user: null });
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl
      }
    });
  } catch {
    res.json({ user: null });
  }
});


