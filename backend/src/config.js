import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/airtable-form-builder",
  jwtSecret: process.env.JWT_SECRET || "dev_jwt_secret_change_me",
  clientBaseUrl: process.env.CLIENT_BASE_URL || "http://localhost:5173",
  airtable: {
    clientId: process.env.AIRTABLE_CLIENT_ID || "",
    clientSecret: process.env.AIRTABLE_CLIENT_SECRET || "",
    redirectUri: process.env.AIRTABLE_REDIRECT_URI || "http://localhost:4000/auth/airtable/callback",
    apiBaseUrl: process.env.AIRTABLE_API_BASE_URL || "https://api.airtable.com/v0",
    oauthAuthorizeUrl: process.env.AIRTABLE_OAUTH_AUTHORIZE_URL || "https://airtable.com/oauth2/v1/authorize",
    oauthTokenUrl: process.env.AIRTABLE_OAUTH_TOKEN_URL || "https://airtable.com/oauth2/v1/token"
  },
  webhook: {
    airtableVerificationToken: process.env.AIRTABLE_WEBHOOK_VERIFICATION_TOKEN || ""
  }
};


