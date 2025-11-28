import axios from "axios";
import { config } from "../config.js";

const OAUTH_TOKEN_URL = config.airtable.oauthTokenUrl;
const API_BASE_URL = config.airtable.apiBaseUrl;

export async function exchangeCodeForToken(code, codeVerifier) {

  if (!config.airtable.clientId || !config.airtable.clientSecret) {
    throw new Error("Airtable client credentials are missing. Check your .env file.");
  }

  const clientId = config.airtable.clientId.trim();
  const clientSecret = config.airtable.clientSecret.trim();
  const redirectUri = config.airtable.redirectUri.trim();

  console.log("Token exchange diagnostic:", {
    clientIdLength: clientId.length,
    clientIdStart: clientId.substring(0, 8),
    clientIdEnd: clientId.substring(clientId.length - 4),
    clientSecretLength: clientSecret.length,
    clientSecretStart: clientSecret.substring(0, 8),
    redirectUri: redirectUri
  });

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    console.log("Attempting token exchange with Basic Auth...");
    const res = await axios.post(OAUTH_TOKEN_URL, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`
      }
    });

    return res.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log("Basic Auth failed, trying with client credentials in form data...");
      const paramsWithCredentials = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      });

      try {
        const res = await axios.post(OAUTH_TOKEN_URL, paramsWithCredentials, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        return res.data;
      } catch (error2) {

        if (error2.response?.data) {
          error = error2;
        }
      }
    }

    if (error.response?.data) {
      const errorData = error.response.data;
      console.error("Airtable token exchange error:", {
        error: errorData.error,
        description: errorData.error_description,
        client_id: clientId.substring(0, 8) + "...",
        client_id_length: clientId.length,
        client_secret_length: clientSecret.length,
        redirect_uri: redirectUri
      });
      throw new Error(`Airtable OAuth error: ${errorData.error_description || errorData.error || "Invalid client credentials"}`);
    }
    throw error;
  }
}

export async function getAirtableProfile(accessToken) {
  const res = await axios.get("https://api.airtable.com/v0/meta/bases", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return {
    airtableUserId: "airtable-user",
    name: "Airtable User",
    email: "",
    avatarUrl: ""
  };
}

export async function listBases(accessToken) {
  if (!accessToken) {
    throw new Error("Access token is required");
  }
  try {
    const res = await axios.get("https://api.airtable.com/v0/meta/bases", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return res.data.bases || [];
  } catch (error) {
    if (error.response?.data) {
      console.error("Airtable API error:", error.response.data);
      throw new Error(`Airtable API error: ${error.response.data.error?.message || error.response.statusText}`);
    }
    throw error;
  }
}

export async function listTables(accessToken, baseId) {
  const res = await axios.get(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.data.tables || [];
}

export async function listFields(accessToken, baseId, tableId) {
  const tables = await listTables(accessToken, baseId);
  const table = tables.find((t) => t.id === tableId);
  return table ? table.fields || [] : [];
}

export function isSupportedField(field) {
  const type = field.type;
  const supported = ["singleLineText", "multilineText", "singleSelect", "multipleSelects", "multipleAttachments"];
  return supported.includes(type);
}

export function mapAirtableTypeToQuestionType(field) {
  switch (field.type) {
    case "singleLineText":
      return "shortText";
    case "multilineText":
      return "longText";
    case "singleSelect":
      return "singleSelect";
    case "multipleSelects":
      return "multiSelect";
    case "multipleAttachments":
      return "attachment";
    default:
      return null;
  }
}

export async function createAirtableRecord(accessToken, baseId, tableId, fields) {
  const url = `${API_BASE_URL}/${baseId}/${tableId}`;
  const res = await axios.post(
    url,
    { fields },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );
  return res.data;
}


