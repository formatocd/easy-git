import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  openRepository,
  getCommitGraph,
  getBranches,
  getCommitFiles,
  getCommitFileDiff,
  RepoSummary,
  CommitWithGraph,
  Branch,
  FileChange,
} from "./api/git";
import { GraphCell } from "./components/GraphCell";
import { DiffViewer } from "./components/DiffViewer";
import { FileTree } from "./components/FileTree";
import { WorkingCopyView } from "./components/WorkingCopyView";
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
  FileDiff,
  Layers,
} from "./components/Icons";
import "./App.css";

function App() {
  const [repoPath, setRepoPath] = useState("");
  const [summary, setSummary] = useState<RepoSummary | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<CommitWithGraph[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitWithGraph | null>(null);

  // Active view: "history" (Commit DAG) or "working_copy" (Staging & Commit)
  const [activeView, setActiveView] = useState<"history" | "working_copy">("history");

  // File changes & Diff state for History View
  const [commitFiles, setCommitFiles] = useState<FileChange[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Resizable panel sizes
  const [bottomHeight, setBottomHeight] = useState(280);
  const [fileListWidth, setFileListWidth] = useState(280);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      } else {
        setSelectedCommit(null);
        setCommitFiles([]);
        setSelectedFile(null);
        setDiffText(null);
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

  // When a commit is selected in History, load its changed files
  useEffect(() => {
    if (!selectedCommit || !repoPath) {
      setCommitFiles([]);
      setSelectedFile(null);
      setDiffText(null);
      return;
    }

    let isCancelled = false;
    async function fetchFiles() {
      setLoadingFiles(true);
      try {
        const parent = selectedCommit?.parents[0] || null;
        const files = await getCommitFiles(repoPath, selectedCommit!.hash, parent);
        if (!isCancelled) {
          setCommitFiles(files);
          if (files.length > 0) {
            setSelectedFile(files[0]);
          } else {
            setSelectedFile(null);
            setDiffText(null);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error loading commit files:", err);
          setCommitFiles([]);
          setSelectedFile(null);
          setDiffText(null);
        }
      } finally {
        if (!isCancelled) setLoadingFiles(false);
      }
    }

    fetchFiles();
    return () => {
      isCancelled = true;
    };
  }, [selectedCommit?.hash, repoPath]);

  // When a file is selected in History, load its diff
  useEffect(() => {
    if (!selectedCommit || !selectedFile || !repoPath) {
      setDiffText(null);
      return;
    }

    let isCancelled = false;
    async function fetchDiff() {
      setLoadingDiff(true);
      try {
        const parent = selectedCommit?.parents[0] || null;
        const diff = await getCommitFileDiff(
          repoPath,
          selectedCommit!.hash,
          selectedFile!.path,
          parent,
        );
        if (!isCancelled) {
          setDiffText(diff);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error loading diff:", err);
          setDiffText("Error al cargar las diferencias del archivo.");
        }
      } finally {
        if (!isCancelled) setLoadingDiff(false);
      }
    }

    fetchDiff();
    return () => {
      isCancelled = true;
    };
  }, [selectedCommit?.hash, selectedFile?.path, repoPath]);

  // Load current repository initially
  useEffect(() => {
    loadRepository("D:\\Usuarios\\Carlos\\Proyectos\\Rust\\git_client");
  }, []);

  // When a commit finishes in WorkingCopyView, reload repo and show the graph
  const handleCommitSuccess = () => {
    loadRepository(repoPath);
    setActiveView("history");
  };

  // Drag handlers for resizable panels in History view
  const handleVerticalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(120, Math.min(window.innerHeight * 0.75, startHeight + deltaY));
      setBottomHeight(newHeight);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [bottomHeight]);

  const handleHorizontalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = fileListWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(160, Math.min(600, startWidth + deltaX));
      setFileListWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [fileListWidth]);

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#18181b] text-zinc-100 select-none overflow-hidden font-sans">
      {/* 1. TOP TOOLBAR */}
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
          <button
            onClick={() => setActiveView("working_copy")}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded text-xs transition cursor-pointer ${
              activeView === "working_copy"
                ? "bg-emerald-600/30 text-emerald-300 font-semibold border border-emerald-500/50"
                : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
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
            <div
              onClick={() => setActiveView("working_copy")}
              className="flex items-center space-x-1 cursor-pointer"
              title="Haz clic para ver los cambios y preparar commit"
            >
              {summary.is_clean ? (
                <span className="flex items-center text-emerald-400 text-[11px] bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                  <CheckCircle2 size={11} className="mr-1" /> Limpio
                </span>
              ) : (
                <span className="flex items-center text-amber-400 text-[11px] bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded hover:bg-amber-900/60 transition">
                  <AlertCircle size={11} className="mr-1" /> Cambios pendientes
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 2. MAIN BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR (SourceTree Style) */}
        <aside className="w-56 bg-[#1b1b1e] border-r border-zinc-800 flex flex-col shrink-0 text-xs">
          <div className="p-3 border-b border-zinc-800/80 font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
            Explorador
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* WORKSPACE SECTION (SourceTree File Status vs History) */}
            <div>
              <div className="text-zinc-500 font-semibold px-2 py-1 text-[10px] uppercase tracking-wider">
                Espacio de Trabajo
              </div>
              <ul className="mt-0.5 space-y-0.5">
                <li
                  onClick={() => setActiveView("working_copy")}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition ${
                    activeView === "working_copy"
                      ? "bg-sky-600/20 text-sky-300 font-semibold border-l-2 border-sky-400"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <FileDiff size={14} className="text-amber-400" />
                    <span>Estado archivos</span>
                  </span>
                  {summary && !summary.is_clean && (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </li>

                <li
                  onClick={() => setActiveView("history")}
                  className={`flex items-center space-x-2 px-2 py-1.5 rounded cursor-pointer transition ${
                    activeView === "history"
                      ? "bg-sky-600/20 text-sky-300 font-semibold border-l-2 border-sky-400"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <Layers size={14} className="text-sky-400" />
                  <span>Historial</span>
                </li>
              </ul>
            </div>

            {/* LOCAL BRANCHES */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 font-medium px-2 py-1">
                <span className="flex items-center space-x-1.5">
                  <GitBranch size={13} className="text-purple-400" />
                  <span>Ramas Locales ({localBranches.length})</span>
                </span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {localBranches.map((b) => (
                  <li
                    key={b.name}
                    onClick={() => setActiveView("history")}
                    className={`flex items-center px-2 py-1 rounded cursor-pointer transition ${
                      b.is_current
                        ? "bg-purple-600/20 text-purple-300 font-semibold border-l-2 border-purple-400"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <span className="truncate">{b.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* REMOTE BRANCHES */}
            {remoteBranches.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-zinc-400 font-medium px-2 py-1">
                  <span className="flex items-center space-x-1.5">
                    <Tag size={13} className="text-zinc-400" />
                    <span>Remotas ({remoteBranches.length})</span>
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {remoteBranches.map((b) => (
                    <li
                      key={b.name}
                      onClick={() => setActiveView("history")}
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

        {/* RIGHT AREA: CONDITIONAL VIEW */}
        {activeView === "working_copy" ? (
          <WorkingCopyView
            repoPath={repoPath}
            onCommitSuccess={handleCommitSuccess}
          />
        ) : (
          /* HISTORY GRAPH VIEW */
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

            {/* VERTICAL RESIZER HANDLE */}
            {selectedCommit && (
              <div
                onMouseDown={handleVerticalResize}
                className="h-1.5 w-full bg-zinc-800 hover:bg-sky-500 active:bg-sky-400 cursor-row-resize shrink-0 transition-colors z-20"
                title="Arrastra para redimensionar el panel"
              />
            )}

            {/* BOTTOM COMMIT INSPECTION PANEL */}
            {selectedCommit && (
              <div
                style={{ height: `${bottomHeight}px` }}
                className="bg-[#1c1c1f] flex shrink-0 text-xs overflow-hidden"
              >
                {/* Left Column: Commit Summary & Changed Files */}
                <div
                  style={{ width: `${fileListWidth}px` }}
                  className="flex flex-col shrink-0 overflow-hidden"
                >
                  <div className="p-2.5 border-b border-zinc-800/80 bg-[#1e1e22] shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-amber-400 font-semibold text-[11px]">
                        {selectedCommit.short_hash}
                      </span>
                      <div className="flex items-center text-zinc-400 text-[10px] space-x-1">
                        <Clock size={11} />
                        <span>{formatDate(selectedCommit.timestamp)}</span>
                      </div>
                    </div>
                    <div className="mt-0.5 flex items-center text-zinc-300 text-[10px] space-x-1">
                      <User size={10} className="text-zinc-400" />
                      <span className="font-medium truncate">{selectedCommit.author_name}</span>
                    </div>
                    <p className="mt-1 text-zinc-200 font-medium text-[11px] line-clamp-1">
                      {selectedCommit.summary}
                    </p>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <FileTree
                      files={commitFiles}
                      selectedFile={selectedFile}
                      onSelectFile={(f) => setSelectedFile(f)}
                      loading={loadingFiles}
                    />
                  </div>
                </div>

                {/* HORIZONTAL RESIZER HANDLE */}
                <div
                  onMouseDown={handleHorizontalResize}
                  className="w-1.5 h-full bg-zinc-800 hover:bg-sky-500 active:bg-sky-400 cursor-col-resize shrink-0 transition-colors z-20"
                  title="Arrastra para redimensionar el ancho de archivos"
                />

                {/* Right Column: Unified Diff Viewer */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <DiffViewer
                    diffText={diffText}
                    loading={loadingDiff}
                    filePath={selectedFile?.path}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
