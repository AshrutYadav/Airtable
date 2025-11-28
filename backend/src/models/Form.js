import mongoose from "mongoose";

const ConditionSchema = new mongoose.Schema(
  {
    questionKey: { type: String, required: true },
    operator: { type: String, enum: ["equals", "notEquals", "contains"], required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { _id: false }
);

const ConditionalRulesSchema = new mongoose.Schema(
  {
    logic: { type: String, enum: ["AND", "OR"], default: "AND" },
    conditions: { type: [ConditionSchema], default: [] }
  },
  { _id: false }
);

const QuestionSchema = new mongoose.Schema(
  {
    questionKey: { type: String, required: true },
    airtableFieldId: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ["shortText", "longText", "singleSelect", "multiSelect", "attachment"],
      required: true
    },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
    conditionalRules: { type: ConditionalRulesSchema, default: null }
  },
  { _id: false }
);

const formSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    airtableBaseId: { type: String, required: true },
    airtableTableId: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    questions: { type: [QuestionSchema], default: [] }
  },
  { timestamps: true }
);

export const Form = mongoose.model("Form", formSchema);


