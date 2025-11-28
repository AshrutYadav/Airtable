import React, { useEffect, useState } from "react";
import api from "../api/client.js";

function FormBuilder({ user, onRequireAuth }) {
  const [bases, setBases] = useState([]);
  const [tables, setTables] = useState([]);
  const [fields, setFields] = useState([]);

  const [selectedBase, setSelectedBase] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    async function fetchBases() {
      try {
        const res = await api.get("/api/airtable/bases");
        setBases(res.data.bases || []);
      } catch (e) {
        console.error("Failed to fetch bases:", e);
        if (e.response?.data?.error) {
          alert("Error fetching bases: " + e.response.data.error);
        } else {
          alert("Failed to fetch Airtable bases. Check console for details.");
        }
      }
    }
    fetchBases();
  }, [user, onRequireAuth]);

  useEffect(() => {
    if (!selectedBase) return;
    async function fetchTables() {
      try {
        const res = await api.get(`/api/airtable/bases/${selectedBase}/tables`);
        setTables(res.data.tables || []);
      } catch (e) {
        console.error(e);
      }
    }
    fetchTables();
  }, [selectedBase]);

  useEffect(() => {
    if (!selectedBase || !selectedTable) return;
    async function fetchFields() {
      try {
        const res = await api.get(`/api/airtable/bases/${selectedBase}/tables/${selectedTable}/fields`);
        const f = res.data.fields || [];
        setFields(f);
        setQuestions(
          f.map((field) => ({
            questionKey: field.id,
            airtableFieldId: field.id,
            label: field.name,
            type: field.type,
            required: false,
            options: field.options || [],
            conditionalRules: null
          }))
        );
      } catch (e) {
        console.error(e);
      }
    }
    fetchFields();
  }, [selectedBase, selectedTable]);

  const updateQuestion = (index, updates) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  };

  const handleSave = async () => {
    try {
      const res = await api.post("/api/forms", {
        name,
        description,
        airtableBaseId: selectedBase,
        airtableTableId: selectedTable,
        questions
      });
      alert("Form saved. ID: " + res.data.form._id);
    } catch (e) {
      console.error(e);
      alert("Failed to save form");
    }
  };

  if (!user) {
    return <p>Please log in to build forms.</p>;
  }

  return (
    <div>
      <h2>Form Builder</h2>
      <div
  style={{
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  }}
>
  <label style={{ fontWeight: 600, color: "#1e293b", fontSize: "15px" }}>
    Form name:
  </label>

  <input placeholder="Enter form name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    style={{
      padding: "10px 12px",
      borderRadius: "8px",
      border: "1.5px solid #cbd5e1",
      fontSize: "15px",
      outline: "none",
      transition: "0.3s",
      boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
    }}
    onFocus={(e) => (e.target.style.border = "1.5px solid #2563eb")}
    onBlur={(e) => (e.target.style.border = "1.5px solid #cbd5e1")}
  />
</div>

<div
  style={{
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  }}
>
  <label style={{ fontWeight: 600, color: "#1e293b", fontSize: "15px" }}>
    Description:
  </label>

  <input placeholder="Enter form description"
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    style={{
      padding: "10px 12px",
      width: 300,
      borderRadius: "8px",
      border: "1.5px solid #cbd5e1",
      fontSize: "15px",
      outline: "none",
      transition: "0.3s",
      boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
    }}
    onFocus={(e) => (e.target.style.border = "1.5px solid #2563eb")}
    onBlur={(e) => (e.target.style.border = "1.5px solid #cbd5e1")}
  />
</div>

<div style={{ marginBottom: 16 }}>
  <label style={{ fontWeight: 600, color: "#2d3748" }}>Select Base :</label>

  <select
    value={selectedBase}
    onChange={(e) => setSelectedBase(e.target.value)}
    style={{marginLeft: "10px",marginTop: "20px",
      padding: "10px 16px",
      borderRadius: "12px",
      background: "#e0e5ec",
      border: "none",
      fontSize: "15px",
      color: "#333",
      cursor: "pointer",
      boxShadow:
        "6px 6px 14px rgba(0,0,0,0.15), -6px -6px 14px rgba(255,255,255,0.7)",
      outline: "rgb(158, 171, 190)",
    }}
  >
    <option value="">Select base</option>
    {bases.map((b) => (
      <option key={b.id} value={b.id}>
        {b.name}
      </option>
    ))}
  </select>
</div>

      {selectedBase && (
        <div style={{ marginBottom: 16 }}>
          <label style={{fontWeight: 600, color: "#2d3748"}}>
            Select Table :
            <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} style={{ marginLeft: "10px",marginTop: "20px",
            padding: "10px 16px",
            borderRadius: "12px",
            background: "#e0e5ec",
            border: "none",
            fontSize: "15px",
            color: "#333",
            cursor: "pointer",
            boxShadow:
              "6px 6px 14px rgba(0,0,0,0.15), -6px -6px 14px rgba(255,255,255,0.7)",
            outline: "rgb(158, 171, 190)", }}>
              <option value="">Select table</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {questions.length > 0 && (
        <div>
          <h3>Questions</h3>
          {questions.map((q, index) => (
            <div key={q.questionKey} style={{ border: "1px solid #ddd", padding: 8, marginBottom: 8 }}>
              <div>
                <strong>{q.label}</strong> ({q.type})
              </div>
              <div>
                <label>
                  Label :
                  <input 
                    value={q.label}
                    onChange={(e) => updateQuestion(index, { label: e.target.value })}
                    style={{ marginLeft: 8, borderRadius: "3px" }}
                  />
                </label>
              </div>
              <div>
                <label>
                  Required:
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                    style={{ marginLeft: 8 }}
                  />
                </label>
              </div>
              <div>
                <label>
                  Conditional logic JSON (optional):
                  <textarea
                    rows={3}
                    style={{ width: "100%", marginTop: 4 }}
                    value={q.conditionalRules ? JSON.stringify(q.conditionalRules) : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        updateQuestion(index, { conditionalRules: null });
                        return;
                      }
                      try {
                        const parsed = JSON.parse(val);
                        updateQuestion(index, { conditionalRules: parsed });
                      } catch {
                        // ignore parse errors, keep previous
                      }
                    }}
                    
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={handleSave} disabled={!name || !selectedBase || !selectedTable} style={{marginTop: "100px", padding: "12px 26px", borderRadius: "14px", background: "rgb(140, 91, 95)", color: "black", border: "1px solid rgb(89, 79, 176)", fontWeight: "200", fontSize: "16px", cursor: "pointer", boxShadow: "6px 6px 14px rgba(0,0,0,0.15), 6px 6px 4px rgba(72, 58, 101, 0.9)", transition: "0.3s"}} >
        Save Form
      </button>
    </div>
  );
}

export default FormBuilder;


