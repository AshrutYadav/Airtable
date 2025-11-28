import express from "express";
import { authRequired } from "../middleware/auth.js";
import { Form } from "../models/Form.js";
import { Response } from "../models/Response.js";
import { createAirtableRecord } from "../services/airtableService.js";
import { shouldShowQuestion } from "../utils/conditionalLogic.js";

export const formRouter = express.Router();

// form make
formRouter.post("/", authRequired, async (req, res, next) => {
  try {
    const { name, description, airtableBaseId, airtableTableId, questions } = req.body;
    if (!name || !airtableBaseId || !airtableTableId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const form = await Form.create({
      owner: req.user._id,
      name,
      description,
      airtableBaseId,
      airtableTableId,
      questions: questions || []
    });
    res.status(201).json({ form });
  } catch (err) {
    next(err);
  }
});

// list of form
formRouter.get("/", authRequired, async (req, res, next) => {
  try {
    const forms = await Form.find({ owner: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json({ forms });
  } catch (err) {
    next(err);
  }
});

// search for any form(id)
formRouter.get("/:formId/public", async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.formId).lean();
    if (!form) return res.status(404).json({ error: "Form not found" });
    res.json({ form });
  } catch (err) {
    next(err);
  }
});

// response
formRouter.post("/:formId/responses", async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.formId).populate("owner");
    if (!form) return res.status(404).json({ error: "Form not found" });
    if (!form.owner?.accessToken) {
      return res.status(400).json({ error: "Form owner is missing Airtable credentials" });
    }

    const answers = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
    const filteredAnswers = {};
    const airtableFields = {};

    for (const q of form.questions) {
      const visible = shouldShowQuestion(q.conditionalRules, answers);
      if (!visible) {
        continue;
      }
      const value = answers[q.questionKey];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);

      if (q.required && isEmpty) {
        return res.status(400).json({ error: `Missing required field: ${q.label}` });
      }

      if (value === undefined) {
        continue;
      }

      if (q.type === "singleSelect" && value != null && q.options?.length) {
        if (!q.options.includes(value)) {
          return res.status(400).json({ error: `Invalid option for: ${q.label}` });
        }
      }
      if (q.type === "multiSelect" && Array.isArray(value) && q.options?.length) {
        const invalid = value.filter((v) => !q.options.includes(v));
        if (invalid.length) {
          return res.status(400).json({ error: `Invalid options for: ${q.label}` });
        }
      }
      filteredAnswers[q.questionKey] = value;
      airtableFields[q.airtableFieldId] = value;
    }

    if (Object.keys(airtableFields).length === 0) {
      return res.status(400).json({ error: "No visible answers were provided" });
    }

    const airtableResult = await createAirtableRecord(
      form.owner.accessToken,
      form.airtableBaseId,
      form.airtableTableId,
      airtableFields
    );

    const airtableRecordId =
      airtableResult?.id ||
      airtableResult?.record?.id ||
      airtableResult?.records?.[0]?.id;

    if (!airtableRecordId) {
      return res.status(502).json({ error: "Failed to save response to Airtable" });
    }

    const responseDoc = await Response.create({
      form: form._id,
      airtableRecordId,
      answers: filteredAnswers,
      status: "active"
    });

    res.status(201).json({ response: responseDoc });
  } catch (err) {
    next(err);
  }
});

// database
formRouter.get("/:formId/responses", authRequired, async (req, res, next) => {
  try {
    const form = await Form.findById(req.params.formId);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }
    if (!form.owner.equals(req.user._id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const responses = await Response.find({ form: form._id }).sort({ createdAt: -1 }).lean();
    res.json({ responses });
  } catch (err) {
    next(err);
  }
});


