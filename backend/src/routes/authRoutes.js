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

function isProd() {
  return process.env.NODE_ENV === "production";
}

// --- LOGIN / START OAUTH ---
authRouter.get("/airtable/login", (req, res) => {
  try {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // cookie options: in production we need Secure + SameSite=None for cross-site OAuth flows
    const cookieOptions = {
      httpOnly: true,
      maxAge: 5 * 60 * 1000,
      sameSite: isProd() ? "none" : "lax",
      secure: isProd() ? true : false
    };

    res.cookie(PKCE_COOKIE, codeVerifier, cookieOptions);

    // Ensure redirectUri is trimmed (remove stray newlines or spaces)
    const redirectUri = (config.airtable.redirectUri || "").trim();
    const authorizeUrl = new URL((config.airtable.oauthAuthorizeUrl || "https://airtable.com/oauth2/v1/authorize").trim());

    const params = new URLSearchParams({
      client_id: (config.airtable.clientId || "").trim(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "data.records:read data.records:write schema.bases:read",
      state: "state-" + Date.now(),
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });

    authorizeUrl.search = params.toString();

    // Debug: log the exact authorize URL (will appear in Render logs)
    console.log("DEBUG: authorizeUrl =", authorizeUrl.toString());

    return res.redirect(authorizeUrl.toString());
  } catch (err) {
    console.error("Error building Airtable authorize URL:", err);
    return res.redirect(`${config.clientBaseUrl}?error=${encodeURIComponent("Failed to start OAuth")}`);
  }
});

// --- CALLBACK ---
authRouter.get("/airtable/callback", async (req, res, next) => {
  try {
    // Debug: log incoming callback query for troubleshooting
    console.log("DEBUG: Airtable callback req.query =", req.query);

    if (req.query.error) {
      console.error("Airtable OAuth error:", req.query.error, req.query.error_description);
      return res.redirect(`${config.clientBaseUrl}?error=${encodeURIComponent(req.query.error_description || req.query.error)}`);
    }

    const { code } = req.query;
    if (!code) {
      console.error("Missing authorization code in callback, req.query:", req.query);
      return res.redirect(`${config.clientBaseUrl}?error=${encodeURIComponent("Missing authorization code")}`);
    }

    const codeVerifier = req.cookies?.[PKCE_COOKIE];
    if (!codeVerifier) {
      console.error("Missing PKCE code verifier cookie");
      return res.redirect(`${config.clientBaseUrl}?error=${encodeURIComponent("Session expired. Please try logging in again.")}`);
    }

    console.log("Exchanging code for token...");
    const tokenData = await exchangeCodeForToken(code, codeVerifier);

    res.clearCookie(PKCE_COOKIE, {
      httpOnly: true,
      sameSite: isProd() ? "none" : "lax",
      secure: isProd() ? true : false
    });

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!accessToken) {
      console.error("No access token received from Airtable", tokenData);
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

    // Set auth cookie for client; use SameSite=None & Secure in production for cross-site compatibility
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: isProd() ? "none" : "lax",
      secure: isProd() ? true : false,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log("OAuth flow completed successfully for user:", user._id);
    return res.redirect(config.clientBaseUrl);
  } catch (err) {
    console.error("OAuth callback error:", err?.message || err);
    if (err.response?.data) {
      console.error("Airtable API error response:", JSON.stringify(err.response.data, null, 2));
    }
    return next(err);
  }
});

// --- ME endpoint ---
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