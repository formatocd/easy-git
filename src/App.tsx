import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  openRepository,
  getCommitGraph,
  getBranches,
  RepoSummary,
  CommitWithGraph,
  Branch,
} from "./api/git";
import { GraphCell } from "./components/GraphCell";
import {
  FolderOpen,
  GitBranch,
  GitCommit,
  GitPullRequest,
  ArrowDown,
  ArrowUp,
  Archive,
  CheckCircle2,
  AlertCircle,
  Tag,
  Clock,
  User,
  Hash,
} from "./components/Icons";
import "./App.css";

function App() {
  const [repoPath, setRepoPath] = useState("");
  const [summary, setSummary] = useState<RepoSummary | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<CommitWithGraph[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitWithGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format relative or friendly date
  function formatDate(timestamp: number) {
    if (!timestamp) return "—";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function loadRepository(path: string) {
    if (!path.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const repoSummary = await openRepository(path);
      const [repoBranches, repoCommits] = await Promise.all([
        getBranches(path),
        getCommitGraph(path, 100),
      ]);

      setSummary(repoSummary);
      setBranches(repoBranches);
      setCommits(repoCommits);
      setRepoPath(path);
      if (repoCommits.length > 0) {
        setSelectedCommit(repoCommits[0]);
      }
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : String(err));
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

  // Load current repository initially if path is set
  useEffect(() => {
    loadRepository("D:\\Usuarios\\Carlos\\Proyectos\\Rust\\git_client");
  }, []);

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#18181b] text-zinc-100 select-none overflow-hidden font-sans">
      {/* 1. TOP TOOLBAR (SourceTree Style) */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#202023] border-b border-zinc-800 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 mr-4">
            <span className="text-xl">🦀</span>
            <span className="font-bold text-base tracking-tight text-white">easy-git</span>
          </div>

          <button
            onClick={handleSelectFolder}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded transition cursor-pointer"
          >
            <FolderOpen size={15} className="text-sky-400" />
            <span>Abrir Repo</span>
          </button>

          <div className="h-4 w-px bg-zinc-700 mx-1" />

          {/* Action buttons */}
          <button className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer">
            <GitCommit size={14} className="text-emerald-400" />
            <span>Commit</span>
          </button>
          <button className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer">
            <ArrowDown size={14} className="text-blue-400" />
            <span>Pull</span>
          </button>
          <button className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer">
            <ArrowUp size={14} className="text-amber-400" />
            <span>Push</span>
          </button>
          <button className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer">
            <GitBranch size={14} className="text-purple-400" />
            <span>Rama</span>
          </button>
          <button className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer">
            <GitPullRequest size={14} className="text-pink-400" />
            <span>Merge</span>
          </button>
          <button className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer">
            <Archive size={14} className="text-orange-400" />
            <span>Stash</span>
          </button>
        </div>

        {summary && (
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5 text-zinc-400">
              <span className="font-semibold text-zinc-200">{summary.name}</span>
            </div>
            <div className="flex items-center space-x-1 bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-700">
              <GitBranch size={13} className="text-sky-400" />
              <span className="text-sky-300 font-medium">{summary.current_branch || "HEAD"}</span>
            </div>
            <div className="flex items-center space-x-1">
              {summary.is_clean ? (
                <span className="flex items-center text-emerald-400 text-[11px] bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                  <CheckCircle2 size={11} className="mr-1" /> Limpio
                </span>
              ) : (
                <span className="flex items-center text-amber-400 text-[11px] bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded">
                  <AlertCircle size={11} className="mr-1" /> Cambios
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 2. MAIN BODY (Sidebar + Graph Table + Commit Details) */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR (SourceTree Style) */}
        <aside className="w-56 bg-[#1b1b1e] border-r border-zinc-800 flex flex-col shrink-0 text-xs">
          <div className="p-3 border-b border-zinc-800/80 font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
            Explorador
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* Local Branches */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 font-medium px-2 py-1">
                <span className="flex items-center space-x-1.5">
                  <GitBranch size={13} className="text-sky-400" />
                  <span>Ramas Locales ({localBranches.length})</span>
                </span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {localBranches.map((b) => (
                  <li
                    key={b.name}
                    className={`flex items-center px-2 py-1 rounded cursor-pointer transition ${
                      b.is_current
                        ? "bg-sky-600/20 text-sky-300 font-semibold border-l-2 border-sky-400"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <span className="truncate">{b.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Remote Branches */}
            {remoteBranches.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-zinc-400 font-medium px-2 py-1">
                  <span className="flex items-center space-x-1.5">
                    <Tag size={13} className="text-purple-400" />
                    <span>Remotas ({remoteBranches.length})</span>
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {remoteBranches.map((b) => (
                    <li
                      key={b.name}
                      className="flex items-center px-2 py-1 text-zinc-400 hover:bg-zinc-800 rounded cursor-pointer transition"
                    >
                      <span className="truncate">{b.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT AREA: GRAPH TABLE + COMMIT DETAIL */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#141416]">
          {error && (
            <div className="m-3 p-3 bg-red-950/40 border border-red-800 text-red-300 rounded text-xs">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* COMMIT GRAPH TABLE */}
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-xs table-fixed">
              <thead className="sticky top-0 bg-[#1e1e22] text-zinc-400 border-b border-zinc-800 z-10 text-[11px]">
                <tr>
                  <th className="py-2 px-3 font-semibold w-24">Grafo</th>
                  <th className="py-2 px-3 font-semibold">Descripción</th>
                  <th className="py-2 px-3 font-semibold w-20">Hash</th>
                  <th className="py-2 px-3 font-semibold w-36">Autor</th>
                  <th className="py-2 px-3 font-semibold w-36">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 font-normal">
                {commits.map((c) => {
                  const isSelected = selectedCommit?.hash === c.hash;
                  return (
                    <tr
                      key={c.hash}
                      onClick={() => setSelectedCommit(c)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-600/20 text-white"
                          : "hover:bg-zinc-800/50 text-zinc-300"
                      }`}
                      style={{ height: "32px" }}
                    >
                      {/* Grafo SVG */}
                      <td className="p-0 align-middle">
                        <GraphCell
                          node_col={c.node_col}
                          color_index={c.color_index}
                          max_col={c.max_col}
                          segments={c.segments}
                          isSelected={isSelected}
                        />
                      </td>

                      {/* Mensaje + Badges de Ramas */}
                      <td className="py-1.5 px-3 truncate font-medium">
                        <div className="flex items-center space-x-1.5 overflow-hidden">
                          {c.refs.map((ref) => (
                            <span
                              key={ref}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                                ref.includes("HEAD")
                                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                                  : ref.includes("origin/")
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              }`}
                            >
                              {ref}
                            </span>
                          ))}
                          <span className="truncate">{c.summary}</span>
                        </div>
                      </td>

                      {/* Hash */}
                      <td className="py-1.5 px-3 font-mono text-zinc-400 text-[11px]">
                        {c.short_hash}
                      </td>

                      {/* Autor */}
                      <td className="py-1.5 px-3 truncate text-zinc-400">
                        {c.author_name}
                      </td>

                      {/* Fecha */}
                      <td className="py-1.5 px-3 text-zinc-500 text-[11px] truncate">
                        {formatDate(c.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BOTTOM COMMIT DETAIL PANEL */}
          {selectedCommit && (
            <div className="h-44 border-t border-zinc-800 bg-[#1c1c1f] p-3 flex flex-col shrink-0 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-amber-400 font-semibold">
                    {selectedCommit.hash}
                  </span>
                  <div className="flex items-center text-zinc-400 text-[11px] space-x-1">
                    <User size={12} />
                    <span>{selectedCommit.author_name}</span>
                    <span className="text-zinc-500">&lt;{selectedCommit.author_email}&gt;</span>
                  </div>
                </div>
                <div className="flex items-center text-zinc-400 text-[11px] space-x-1">
                  <Clock size={12} />
                  <span>{formatDate(selectedCommit.timestamp)}</span>
                </div>
              </div>

              <div className="flex-1 py-2 overflow-y-auto">
                <p className="font-semibold text-zinc-100">{selectedCommit.summary}</p>
                {selectedCommit.body && (
                  <pre className="mt-1 text-zinc-400 font-sans whitespace-pre-wrap text-[11px]">
                    {selectedCommit.body}
                  </pre>
                )}
              </div>

              {selectedCommit.parents.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/80 flex items-center space-x-2 text-[11px] text-zinc-400">
                  <Hash size={12} className="text-zinc-500" />
                  <span>Padres:</span>
                  {selectedCommit.parents.map((p) => (
                    <span
                      key={p}
                      className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300"
                    >
                      {p.substring(0, 7)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
