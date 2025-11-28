import React, { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import api from "./api/client.js";
import Dashboard from "./pages/Dashboard.jsx";
import FormBuilder from "./pages/FormBuilder.jsx";
import FormViewer from "./pages/FormViewer.jsx";
import ResponsesPage from "./pages/ResponsesPage.jsx";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchMe();
  }, []);

  const handleLogin = () => {
    window.location.href = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000") + "/auth/airtable/login";
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: 16, borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
        <div>
          <Link to="/" style={{ textDecoration: "none", fontWeight: "bold" }}>
            Airtable Form Builder
          </Link>
        </div>
        <div>
          {user ? (
            <span>Signed in as {user.name || "Airtable User"}</span>
          ) : (
            <button onClick={handleLogin}>Log in with Airtable</button>
          )}
        </div>
      </header>
      <main style={{ padding: 24 }}>
        <Routes>
          <Route path="/" element={<Dashboard user={user} onLogin={handleLogin} />} />
          <Route path="/builder" element={<FormBuilder user={user} onRequireAuth={handleLogin} />} />
          <Route path="/form/:formId" element={<FormViewer />} />
          <Route path="/forms/:formId/responses" element={<ResponsesPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;


