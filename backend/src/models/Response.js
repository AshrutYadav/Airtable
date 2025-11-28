import mongoose from "mongoose";

const responseSchema = new mongoose.Schema(
  {
    form: { type: mongoose.Schema.Types.ObjectId, ref: "Form", required: true, index: true },
    airtableRecordId: { type: String, required: true, index: true },
    answers: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["active", "updated", "deletedInAirtable"], default: "active" }
  },
  { timestamps: true }
);

export const Response = mongoose.model("Response", responseSchema);


