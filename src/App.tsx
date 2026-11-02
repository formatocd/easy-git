import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  openRepository,
  getCommits,
  getBranches,
  RepoSummary,
  Commit,
  Branch,
} from "./api/git";
import "./App.css";

function App() {
  const [repoPath, setRepoPath] = useState("");
  const [summary, setSummary] = useState<RepoSummary | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRepository(path: string) {
    if (!path.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const repoSummary = await openRepository(path);
      const [repoBranches, repoCommits] = await Promise.all([
        getBranches(path),
        getCommits(path, 50),
      ]);

      setSummary(repoSummary);
      setBranches(repoBranches);
      setCommits(repoCommits);
      setRepoPath(path);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : String(err));
      setSummary(null);
      setBranches([]);
      setCommits([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Selecciona un repositorio Git",
      });

      if (selected && typeof selected === "string") {
        await loadRepository(selected);
      }
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : String(err));
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", textAlign: "left" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>🦀 easy-git <span style={{ fontSize: "14px", fontWeight: "normal", color: "#888" }}>(Core Git Engine)</span></h2>
        <button onClick={handleSelectFolder} style={{ backgroundColor: "#0284c7", color: "white" }}>
          📂 Abrir Repositorio...
        </button>
      </header>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          style={{ flex: 1, padding: "8px 12px" }}
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          placeholder="O introduce una ruta manual (ej: D:\Usuarios\Carlos\Proyectos\Rust\git_client)"
        />
        <button onClick={() => loadRepository(repoPath)} disabled={loading}>
          {loading ? "Cargando..." : "Cargar"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px", background: "#f8717133", border: "1px solid #ef4444", borderRadius: "6px", color: "#f87171", marginBottom: "20px" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "20px" }}>
          {/* Panel Lateral: Info del repo y ramas */}
          <aside style={{ background: "rgba(255,255,255,0.05)", padding: "15px", borderRadius: "8px" }}>
            <h3 style={{ marginTop: 0 }}>{summary.name}</h3>
            <p style={{ fontSize: "13px", color: "#888", wordBreak: "break-all" }}>{summary.path}</p>
            <div style={{ marginBottom: "15px" }}>
              <span style={{ fontSize: "12px", background: "#3b82f6", color: "white", padding: "2px 8px", borderRadius: "12px" }}>
                Rama: {summary.current_branch || "HEAD desacoplado"}
              </span>
              <span style={{ fontSize: "12px", marginLeft: "6px", background: summary.is_clean ? "#22c55e" : "#f59e0b", color: "white", padding: "2px 8px", borderRadius: "12px" }}>
                {summary.is_clean ? "Limpio" : "Cambios pendientes"}
              </span>
            </div>

            <h4 style={{ marginBottom: "8px" }}>🌿 Ramas ({branches.length})</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "13px" }}>
              {branches.map((b) => (
                <li key={b.name} style={{ padding: "4px 0", fontWeight: b.is_current ? "bold" : "normal", color: b.is_remote ? "#93c5fd" : "inherit" }}>
                  {b.is_current ? "● " : "  "}{b.name}
                </li>
              ))}
            </ul>
          </aside>

          {/* Panel Central: Commits (DAG data preview) */}
          <main style={{ background: "rgba(255,255,255,0.05)", padding: "15px", borderRadius: "8px", overflowX: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Historial de Commits ({commits.length})</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>Hash</th>
                  <th style={{ padding: "8px" }}>Refs</th>
                  <th style={{ padding: "8px" }}>Mensaje</th>
                  <th style={{ padding: "8px" }}>Autor</th>
                  <th style={{ padding: "8px" }}>Padres</th>
                </tr>
              </thead>
              <tbody>
                {commits.map((c) => (
                  <tr key={c.hash} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "8px", fontFamily: "monospace", color: "#f59e0b" }}>{c.short_hash}</td>
                    <td style={{ padding: "8px" }}>
                      {c.refs.map((r) => (
                        <span key={r} style={{ background: "#6366f1", color: "white", padding: "1px 6px", borderRadius: "10px", fontSize: "11px", marginRight: "4px" }}>
                          {r}
                        </span>
                      ))}
                    </td>
                    <td style={{ padding: "8px", fontWeight: "500" }}>{c.summary}</td>
                    <td style={{ padding: "8px", color: "#9ca3af" }}>{c.author_name}</td>
                    <td style={{ padding: "8px", fontFamily: "monospace", fontSize: "11px", color: "#6b7280" }}>
                      {c.parents.map((p) => p.substring(0, 7)).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
