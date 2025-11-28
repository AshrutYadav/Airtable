import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,

  mongoUri: process.env.MONGODB_URI,

  jwtSecret: process.env.JWT_SECRET,


  clientBaseUrl: process.env.CLIENT_BASE_URL,

  airtable: {
    clientId: process.env.AIRTABLE_CLIENT_ID,
    clientSecret: process.env.AIRTABLE_CLIENT_SECRET,
    redirectUri: process.env.AIRTABLE_REDIRECT_URI,

    apiBaseUrl: process.env.AIRTABLE_API_BASE_URL,

    oauthAuthorizeUrl: process.env.AIRTABLE_OAUTH_AUTHORIZE_URL,
    oauthTokenUrl: process.env.AIRTABLE_OAUTH_TOKEN_URL
  },

  webhook: {
    airtableVerificationToken: process.env.AIRTABLE_WEBHOOK_VERIFICATION_TOKEN
  }
};
