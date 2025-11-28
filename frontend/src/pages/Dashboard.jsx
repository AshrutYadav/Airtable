import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client.js";

function Dashboard({ user, onLogin }) {
  const [forms, setForms] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadForms() {
      if (!user) return;
      try {
        const res = await api.get("/api/forms");
        setForms(res.data.forms || []);
      } catch (e) {
        console.error(e);
      }
    }
    loadForms();
  }, [user]);

  const handleCreate = () => {
    if (!user) {
      onLogin?.();
      return;
    }
    navigate("/builder");
  };

  return (
    <div>
      <h2 style={{display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "14px 28px",
    border: "2px solid rgb(158, 171, 190)",
    borderRadius: "14px",
    background: "rgba(158, 48, 103, 0.15)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    color: "darkblue",
    fontFamily: "Arial, sans-serif",
    fontSize: "28px",
    fontWeight: "700",
    letterSpacing: "1px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    }}>DASHBOARD</h2>
      
      <button
  onClick={handleCreate}
  style={{
    marginTop: "20px",
    marginBottom: 16,
    padding: "12px 26px",
    borderRadius: "14px",
    background: "#e0e5ec",
    color: "black",
    border: "2px solid rgb(158, 171, 190)",
    fontWeight: "600",
    fontSize: "16px",
    cursor: "pointer",
    boxShadow:
      "6px 6px 14px rgba(0,0,0,0.15), 6px 6px 4px rgba(101, 58, 58, 0.9)",
    transition: "0.3s",
  }}
>
  Create New Form
</button>


      {!user && <p style={{color: "darkblue", fontSize: "16px", fontWeight: "600", marginTop: "20px"}}>Please log in with Airtable to create and manage forms.</p>}
      <ul>
        {forms.map((f) => (
          <li
          key={f._id}
          style={{
            listStyle: "none",
            padding: "12px 0",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <strong style={{ fontSize: "15px", color: "#0f172a", fontWeight: 600 }}>
            {f.name}
          </strong>
        
          <div style={{ display: "flex", gap: "16px" }}>
            <Link
              to={`/form/${f._id}`}
              style={{
                color: "#2563eb",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 500,
                padding: "2px 4px",
                transition: "0.2s ease",
              }}
              onMouseEnter={(e) => (e.target.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.target.style.textDecoration = "none")}
            >
              Fill
            </Link>
        
            <Link
              to={`/forms/${f._id}/responses`}
              style={{
                color: "#475569",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 500,
                padding: "2px 4px",
                transition: "0.2s ease",
              }}
              onMouseEnter={(e) => (e.target.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.target.style.textDecoration = "none")}
            >
              Responses
            </Link>
          </div>
        </li>
        
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;


