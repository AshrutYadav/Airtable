import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client.js";
import { shouldShowQuestion } from "../utils/conditionalLogic.js";

function FormViewer() {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/api/forms/${formId}/public`);
        setForm(res.data.form);
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, [formId]);

  const handleChange = (questionKey, value) => {
    setAnswers((prev) => ({ ...prev, [questionKey]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form) return;

    // basic required validation in UI
    for (const q of form.questions) {
      const visible = shouldShowQuestion(q.conditionalRules, answers);
      if (!visible) continue;
      const value = answers[q.questionKey];
      if (
        q.required &&
        (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))
      ) {
        setMessage(`Please fill required field: ${q.label}`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setMessage("");
      await api.post(`/api/forms/${formId}/responses`, { answers });
      setMessage("Submitted successfully!");
      setAnswers({});
    } catch (e) {
      console.error(e);
      setMessage("Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!form) {
    return <div>Loading form...</div>;
  }

  return (
    <div>
      <h2>{form.name}</h2>
      {form.description && <p>{form.description}</p>}
      <form onSubmit={handleSubmit}>
        {form.questions.map((q) => {
          const visible = shouldShowQuestion(q.conditionalRules, answers);
          if (!visible) return null;
          const value = answers[q.questionKey] ?? (q.type === "multiSelect" ? [] : "");
          return (
            <div key={q.questionKey} style={{ marginBottom: 12 }}>
              <label>
                {q.label}
                {q.required && " *"}
              </label>
              <div>
                {q.type === "shortText" && (
                  <input
                    value={value}
                    onChange={(e) => handleChange(q.questionKey, e.target.value)}
                    style={{ width: 300 }}
                  />
                )}
                {q.type === "longText" && (
                  <textarea
                    value={value}
                    onChange={(e) => handleChange(q.questionKey, e.target.value)}
                    style={{ width: 300, minHeight: 80 }}
                  />
                )}
                {q.type === "singleSelect" && (
                  <select value={value} onChange={(e) => handleChange(q.questionKey, e.target.value)}>
                    <option value="">Select</option>
                    {q.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
                {q.type === "multiSelect" && (
                  <select
                    multiple
                    value={value}
                    onChange={(e) =>
                      handleChange(
                        q.questionKey,
                        Array.from(e.target.selectedOptions).map((o) => o.value)
                      )
                    }
                    style={{ minWidth: 200, minHeight: 80 }}
                  >
                    {q.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
                {q.type === "attachment" && (
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []).map((f) => f.name);
                      handleChange(q.questionKey, files);
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
        <button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </form>
      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}

export default FormViewer;


