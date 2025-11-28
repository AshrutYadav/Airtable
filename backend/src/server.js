// backend/index.js
import "express-async-errors";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { authRouter } from "./routes/authRoutes.js";
import { airtableMetaRouter } from "./routes/airtableMetaRoutes.js";
import { formRouter } from "./routes/formRoutes.js";
import { webhookRouter } from "./routes/webhookRoutes.js";

const app = express();

// CORS - allow local dev + your deployed frontend(s)
// IMPORTANT: replace "https://airtable-6cem.vercel.app" and any "your-frontend..." with your actual Vercel domain(s)
app.use(
  cors({
    origin: [
      "http://localhost:5173",               // local dev
      "https://airtable-6cem.vercel.app",    // deployed frontend - replace if different
      // "https://your-frontend.vercel.app"  // add additional production domains if needed
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Root & health routes
app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Debug helpers (non-sensitive summaries)
app.get("/debug/oauth-config", (req, res) => {
  const clientId = config.airtable.clientId || "";
  const clientSecret = config.airtable.clientSecret || "";

  res.json({
    hasClientId: !!clientId,
    clientIdLength: clientId.length,
    clientIdPrefix: clientId ? clientId.substring(0, 12) + "..." : "missing",
    clientIdSuffix: clientId ? "..." + clientId.substring(clientId.length - 8) : "missing",
    hasClientSecret: !!clientSecret,
    clientSecretLength: clientSecret.length,
    clientSecretPrefix: clientSecret ? clientSecret.substring(0, 12) + "..." : "missing",
    redirectUri: config.airtable.redirectUri,
    oauthTokenUrl: config.airtable.oauthTokenUrl,
    issues: {
      clientIdHasSpaces: clientId.includes(" "),
      clientSecretHasSpaces: clientSecret.includes(" "),
      clientIdHasQuotes: clientId.startsWith('"') || clientId.startsWith("'"),
      clientSecretHasQuotes: clientSecret.startsWith('"') || clientSecret.startsWith("'"),
      clientIdEmpty: clientId.length === 0,
      clientSecretEmpty: clientSecret.length === 0
    }
  });
});

app.get("/debug/user-token", async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.json({
      error: "No token provided",
      hint: "Make sure you're logged in. The token is stored in a cookie, so access this from the same browser where you logged in."
    });
  }
  try {
    const jwt = await import("jsonwebtoken");
    const payload = jwt.default.verify(token, config.jwtSecret);
    const { User } = await import("./models/User.js");
    const user = await User.findById(payload.userId).lean();
    if (!user) {
      return res.json({ error: "User not found" });
    }
    res.json({
      userId: user._id,
      hasAccessToken: !!user.accessToken,
      accessTokenLength: user.accessToken?.length || 0,
      accessTokenPrefix: user.accessToken ? user.accessToken.substring(0, 20) + "..." : "missing",
      userName: user.name || "Unknown"
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// API routers
app.use("/auth", authRouter);
app.use("/api/airtable", airtableMetaRouter);
app.use("/api/forms", formRouter);
app.use("/webhooks", webhookRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err?.message || err);
  if (err?.stack) {
    console.error(err.stack);
  }

  // redirect for the Airtable OAuth callback if that route errors
  if (req.path === "/auth/airtable/callback") {
    return res.redirect(`${config.clientBaseUrl}?error=${encodeURIComponent(err.message || "Authentication failed")}`);
  }

  res.status(err?.status || 500).json({ error: err?.message || "Internal Server Error" });
});

// Start function with safe connect practices
async function start() {
  // Connect to MongoDB
  if (!config.mongoUri) {
    throw new Error("Missing MONGODB_URI in environment - cannot connect to database");
  }
  await mongoose.connect(config.mongoUri, {
    // recommended options can be added if needed
    // useNewUrlParser: true,
    // useUnifiedTopology: true
  });
  console.log("Connected to MongoDB");

  const port = config.port;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
}

export default app;
