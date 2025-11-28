import express from "express";
import { Response } from "../models/Response.js";
import { Form } from "../models/Form.js";
import { config } from "../config.js";

export const webhookRouter = express.Router();

webhookRouter.post("/airtable", async (req, res, next) => {
  try {
    const verification = req.headers["x-airtable-signature"] || "";
    if (config.webhook.airtableVerificationToken && verification !== config.webhook.airtableVerificationToken) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const events = Array.isArray(req.body?.events) ? req.body.events : [];

    for (const event of events) {
      const recordId = event.record_id || event.recordId;
      const baseId = event.base_id || event.baseId;
      const tableId = event.table_id || event.tableId;
      if (!recordId || !baseId || !tableId) continue;

      const forms = await Form.find({ airtableBaseId: baseId, airtableTableId: tableId });
      for (const form of forms) {
        if (event.action === "delete") {
          await Response.findOneAndUpdate(
            { form: form._id, airtableRecordId: recordId },
            { status: "deletedInAirtable" }
          );
          continue;
        }

        const mappedAnswers = mapFieldsToAnswers(form, event.fields || {});
        const update = {
          status: event.action === "update" ? "updated" : "active"
        };
        if (Object.keys(mappedAnswers).length) {
          update.answers = mappedAnswers;
        }

        await Response.findOneAndUpdate(
          { form: form._id, airtableRecordId: recordId },
          update,
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function mapFieldsToAnswers(form, airtableFields) {
  const answers = {};
  for (const question of form.questions) {
    if (Object.prototype.hasOwnProperty.call(airtableFields, question.airtableFieldId)) {
      answers[question.questionKey] = airtableFields[question.airtableFieldId];
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(airtableFields, question.label)) {
      answers[question.questionKey] = airtableFields[question.label];
    }
  }
  return answers;
}
