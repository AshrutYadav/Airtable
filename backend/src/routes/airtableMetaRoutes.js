import express from "express";
import { authRequired } from "../middleware/auth.js";
import { listBases, listTables, listFields, isSupportedField, mapAirtableTypeToQuestionType } from "../services/airtableService.js";

export const airtableMetaRouter = express.Router();

airtableMetaRouter.use(authRequired);

airtableMetaRouter.get("/bases", async (req, res, next) => {
  try {
    if (!req.user?.accessToken) {
      return res.status(401).json({ error: "No access token found. Please log in again." });
    }
    console.log("Fetching bases for user:", req.user._id);
    const bases = await listBases(req.user.accessToken);
    console.log("Found bases:", bases.length);
    res.json({ bases });
  } catch (err) {
    console.error("Error fetching bases:", err.message);
    if (err.response?.data) {
      console.error("Airtable API error:", err.response.data);
    }
    next(err);
  }
});

airtableMetaRouter.get("/bases/:baseId/tables", async (req, res, next) => {
  try {
    const tables = await listTables(req.user.accessToken, req.params.baseId);
    res.json({ tables });
  } catch (err) {
    next(err);
  }
});

airtableMetaRouter.get("/bases/:baseId/tables/:tableId/fields", async (req, res, next) => {
  try {
    const fields = await listFields(req.user.accessToken, req.params.baseId, req.params.tableId);
    const filtered = fields
      .filter(isSupportedField)
      .map((f) => ({
        id: f.id,
        name: f.name,
        type: mapAirtableTypeToQuestionType(f),
        options: f.options?.choices?.map((c) => c.name) || []
      }))
      .filter((f) => f.type);
    res.json({ fields: filtered });
  } catch (err) {
    next(err);
  }
});


