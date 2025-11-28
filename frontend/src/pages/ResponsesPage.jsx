import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client.js";

function ResponsesPage() {
  const { formId } = useParams();
  const [responses, setResponses] = useState([]);
  const [status, setStatus] = useState({ loading: true, message: "" });

  useEffect(() => {
    async function load() {
      try {
        setStatus({ loading: true, message: "" });
        const res = await api.get(`/api/forms/${formId}/responses`);
        setResponses(res.data.responses || []);
        setStatus({ loading: false, message: "" });
      } catch (e) {
        console.error(e);
        if (e.response?.status === 401) {
          setStatus({ loading: false, message: "Please log in to view responses." });
        } else if (e.response?.status === 403) {
          setStatus({ loading: false, message: "You do not have access to this form's responses." });
        } else if (e.response?.data?.error) {
          setStatus({ loading: false, message: e.response.data.error });
        } else {
          setStatus({ loading: false, message: "Failed to load responses." });
        }
      }
    }
    load();
  }, [formId]);

  return (
    <div>
      <h2>Responses</h2>
      {status.loading && <p>Loading responses...</p>}
      {status.message && !status.loading && <p>{status.message}</p>}
      {!status.loading && !status.message && (
        <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", maxWidth: 900 }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Created</th>
              <th>Status</th>
              <th>Preview</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((r) => (
              <tr key={r._id}>
                <td>{r._id}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.status}</td>
                <td>
                  <code style={{ fontSize: 12 }}>
                    {JSON.stringify(r.answers).slice(0, 80)}
                    {JSON.stringify(r.answers).length > 80 && "..."}
                  </code>
                </td>
              </tr>
            ))}
            {responses.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center" }}>
                  No responses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ResponsesPage;



