import { useState, useEffect, useCallback, useRef } from "react";
import { open, ask } from "@tauri-apps/plugin-dialog";
import {
  openRepository,
  getCommitGraph,
  getBranches,
  getCommitFiles,
  getCommitFileDiff,
  getRemotes,
  getAheadBehind,
  fetchRemote,
  checkoutBranch,
  deleteBranch,
  deleteRemoteBranch,
  RepoSummary,
  CommitWithGraph,
  Branch,
  FileChange,
  RemoteInfo,
  AheadBehind,
} from "./api/git";
import { GraphCell } from "./components/GraphCell";
import { DiffViewer } from "./components/DiffViewer";
import { FileTree } from "./components/FileTree";
import { WorkingCopyView } from "./components/WorkingCopyView";
import { BranchTree } from "./components/BranchTree";
import { PullModal } from "./components/PullModal";
import { PushModal } from "./components/PushModal";
import { ManageRemotesModal } from "./components/ManageRemotesModal";
import { CreateBranchModal } from "./components/CreateBranchModal";
import { CheckoutRemoteModal } from "./components/CheckoutRemoteModal";
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
  Copy,
  Cloud,
  RefreshCw,
  Plus,
} from "./components/Icons";
import "./App.css";

function App() {
  const [repoPath, setRepoPath] = useState("");
  const [summary, setSummary] = useState<RepoSummary | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<CommitWithGraph[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitWithGraph | null>(null);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [aheadBehind, setAheadBehind] = useState<AheadBehind>({ ahead: 0, behind: 0 });

  // Modals & Remote Operations State
  const [isPullOpen, setIsPullOpen] = useState(false);
  const [isPushOpen, setIsPushOpen] = useState(false);
  const [isManageRemotesOpen, setIsManageRemotesOpen] = useState(false);
  const [isCreateBranchOpen, setIsCreateBranchOpen] = useState(false);
  const [checkoutRemoteTarget, setCheckoutRemoteTarget] = useState<Branch | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchToast, setFetchToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const isRefreshingRef = useRef(false);

  // Active view: "history" (Commit DAG) or "working_copy" (Staging & Commit)
  const [activeView, setActiveView] = useState<"history" | "working_copy">("history");

  // File changes & Diff state for History View
  const [commitFiles, setCommitFiles] = useState<FileChange[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Resizable panel sizes configured to match the user's layout by default:
  // - bottomHeightPercent: 50% (50/50 vertical split between commits table and bottom panels)
  // - fileListPercent: 42% (horizontal split: left column for commit info/files vs right for diff viewer)
  // - commitInfoPercent: 40% (vertical split inside left column: commit info vs file tree)
  const [bottomHeightPercent, setBottomHeightPercent] = useState<number>(50);
  const [fileListPercent, setFileListPercent] = useState<number>(42);
  const [commitInfoPercent, setCommitInfoPercent] = useState<number>(40);
  const [copiedHash, setCopiedHash] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function formatDate(timestamp: number) {
    if (!timestamp) return "—";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", {
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
      const [repoBranches, repoCommits, repoRemotes, ab] = await Promise.all([
        getBranches(path),
        getCommitGraph(path, 100),
        getRemotes(path).catch(() => []),
        getAheadBehind(path).catch(() => ({ ahead: 0, behind: 0 })),
      ]);

      setSummary(repoSummary);
      setBranches(repoBranches);
      setCommits(repoCommits);
      setRemotes(repoRemotes);
      setAheadBehind(ab);
      setRepoPath(path);

      if (repoCommits.length > 0) {
        const firstRealCommit = repoCommits.find((c) => c.hash !== "uncommitted") || null;
        setSelectedCommit(firstRealCommit);
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
        title: "Select a Git repository",
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
          setDiffText("Error loading file diff.");
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

  const refreshAll = useCallback(async () => {
    if (!repoPath || isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const [repoSummary, repoBranches, repoCommits, repoRemotes, ab] = await Promise.all([
        openRepository(repoPath),
        getBranches(repoPath),
        getCommitGraph(repoPath, 100),
        getRemotes(repoPath).catch(() => []),
        getAheadBehind(repoPath).catch(() => ({ ahead: 0, behind: 0 })),
      ]);

      setSummary(repoSummary);
      setBranches(repoBranches);
      setCommits(repoCommits);
      setRemotes(repoRemotes);
      setAheadBehind(ab);
      setRefreshKey((k) => k + 1);

      setSelectedCommit((prev) => {
        if (!prev) {
          return repoCommits.find((c) => c.hash !== "uncommitted") || null;
        }
        const matching = repoCommits.find((c) => c.hash === prev.hash);
        return matching || repoCommits.find((c) => c.hash !== "uncommitted") || null;
      });
    } catch (err) {
      console.error("Auto-refresh error:", err);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [repoPath]);

  // Auto-refresh when window regains focus, becomes visible, or periodically every 5 seconds
  useEffect(() => {
    if (!repoPath) return;

    const handleFocus = () => {
      refreshAll();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshAll();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(() => {
      refreshAll();
    }, 5000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [repoPath, refreshAll]);

  // When a commit finishes in WorkingCopyView, reload repo and show the graph
  const handleCommitSuccess = () => {
    refreshAll();
    setActiveView("history");
  };

  const handleSwitchToHistory = useCallback(() => {
    setActiveView("history");
    refreshAll();
  }, [refreshAll]);

  const handleFetch = async () => {
    if (!repoPath || isFetching) return;
    setIsFetching(true);
    setFetchToast(null);

    try {
      await fetchRemote(repoPath);
      await refreshAll();
      setFetchToast({ message: "Fetch completed successfully.", type: "success" });
      setTimeout(() => setFetchToast(null), 3000);
    } catch (err: unknown) {
      await refreshAll();
      const msg = typeof err === "string" ? err : String(err);
      setFetchToast({ message: `Fetch failed: ${msg}`, type: "error" });
      setTimeout(() => setFetchToast(null), 5000);
    } finally {
      setIsFetching(false);
    }
  };

  const handleCheckoutLocalBranch = async (branch: Branch) => {
    if (branch.is_current || !repoPath) return;
    try {
      await checkoutBranch(repoPath, branch.name);
      await refreshAll();
      setFetchToast({ message: `Switched to branch '${branch.name}'.`, type: "success" });
      setTimeout(() => setFetchToast(null), 3000);
    } catch (err: unknown) {
      await refreshAll();
      const msg = typeof err === "string" ? err : String(err);
      setFetchToast({ message: `Checkout failed: ${msg}`, type: "error" });
      setTimeout(() => setFetchToast(null), 6000);
    }
  };

  const handleCheckoutRemoteBranch = (branch: Branch) => {
    setCheckoutRemoteTarget(branch);
  };

  const handleDeleteLocalBranch = async (branch: Branch) => {
    if (branch.is_current || !repoPath) return;
    try {
      const confirmed = await ask(
        `Are you sure you want to delete local branch '${branch.name}'?`,
        {
          title: "Delete Local Branch",
          kind: "warning",
          okLabel: "Delete Branch",
          cancelLabel: "Cancel",
        }
      );
      if (!confirmed) return;

      try {
        await deleteBranch(repoPath, branch.name, false);
      } catch (err: unknown) {
        const errMsg = typeof err === "string" ? err : String(err);
        if (errMsg.toLowerCase().includes("not fully merged") || errMsg.toLowerCase().includes("-d")) {
          const forceConfirmed = await ask(
            `Branch '${branch.name}' is not fully merged.\n\nDo you want to force delete it (git branch -D)?`,
            {
              title: "Force Delete Branch",
              kind: "warning",
              okLabel: "Force Delete",
              cancelLabel: "Cancel",
            }
          );
          if (forceConfirmed) {
            await deleteBranch(repoPath, branch.name, true);
          } else {
            return;
          }
        } else {
          throw err;
        }
      }

      await refreshAll();
      setFetchToast({ message: `Branch '${branch.name}' deleted.`, type: "success" });
      setTimeout(() => setFetchToast(null), 3000);
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setFetchToast({ message: `Failed to delete branch: ${msg}`, type: "error" });
      setTimeout(() => setFetchToast(null), 5000);
    }
  };

  const handleDeleteRemoteBranch = async (branch: Branch) => {
    if (!repoPath) return;
    try {
      const slashIdx = branch.name.indexOf("/");
      if (slashIdx === -1) {
        throw new Error(`Invalid remote branch format: ${branch.name}`);
      }
      const remoteName = branch.name.slice(0, slashIdx);
      const remoteBranchName = branch.name.slice(slashIdx + 1);

      const confirmed = await ask(
        `Are you sure you want to delete remote branch '${remoteBranchName}' from remote '${remoteName}'?\n\nThis will permanently delete the branch from the remote server.`,
        {
          title: "Delete Remote Branch",
          kind: "warning",
          okLabel: "Delete on Remote",
          cancelLabel: "Cancel",
        }
      );
      if (!confirmed) return;

      await deleteRemoteBranch(repoPath, remoteName, remoteBranchName);
      await refreshAll();
      setFetchToast({
        message: `Remote branch '${remoteBranchName}' deleted from '${remoteName}'.`,
        type: "success",
      });
      setTimeout(() => setFetchToast(null), 3000);
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setFetchToast({ message: `Failed to delete remote branch: ${msg}`, type: "error" });
      setTimeout(() => setFetchToast(null), 5000);
    }
  };

  // Drag handlers for resizable panels in History view
  const handleVerticalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startPercent = bottomHeightPercent;
    const parentEl = (e.currentTarget.parentElement as HTMLElement);
    const totalHeight = parentEl ? parentEl.clientHeight : (window.innerHeight - 50);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const deltaPercent = (deltaY / totalHeight) * 100;
      const newPercent = Math.max(15, Math.min(85, startPercent + deltaPercent));
      setBottomHeightPercent(newPercent);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [bottomHeightPercent]);

  const handleHorizontalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPercent = fileListPercent;
    const parentEl = (e.currentTarget.parentElement as HTMLElement);
    const totalWidth = parentEl ? parentEl.clientWidth : (window.innerWidth - 224);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / totalWidth) * 100;
      const newPercent = Math.max(20, Math.min(75, startPercent + deltaPercent));
      setFileListPercent(newPercent);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [fileListPercent]);

  const handleCommitInfoResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startPercent = commitInfoPercent;
    const parentEl = (e.currentTarget.parentElement as HTMLElement);
    const totalHeight = parentEl ? parentEl.clientHeight : 300;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaPercent = (deltaY / totalHeight) * 100;
      const newPercent = Math.max(15, Math.min(85, startPercent + deltaPercent));
      setCommitInfoPercent(newPercent);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [commitInfoPercent]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleSelectBranch = useCallback(
    (branch: Branch) => {
      setActiveView("history");
      if (branch.target_hash) {
        const matchingCommit = commits.find(
          (c) =>
            c.hash === branch.target_hash ||
            c.hash.startsWith(branch.target_hash) ||
            branch.target_hash.startsWith(c.hash)
        );
        if (matchingCommit) {
          setSelectedCommit(matchingCommit);
        }
      }
    },
    [commits]
  );

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
            <span>Open Repo</span>
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

          {/* Pull */}
          <button
            onClick={() => setIsPullOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer"
            title="Pull changes from remote"
          >
            <ArrowDown size={14} className="text-blue-400" />
            <span>Pull</span>
            {aheadBehind.behind > 0 && (
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {aheadBehind.behind}
              </span>
            )}
          </button>

          {/* Push */}
          <button
            onClick={() => setIsPushOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer"
            title="Push changes to remote"
          >
            <ArrowUp size={14} className="text-amber-400" />
            <span>Push</span>
            {aheadBehind.ahead > 0 && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {aheadBehind.ahead}
              </span>
            )}
          </button>

          {/* Fetch */}
          <button
            onClick={handleFetch}
            disabled={isFetching}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer disabled:opacity-60"
            title="Fetch all branches and tags from remotes"
          >
            <RefreshCw size={13} className={`text-sky-400 ${isFetching ? "animate-spin" : ""}`} />
            <span>Fetch</span>
          </button>
          <button
            onClick={() => setIsCreateBranchOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded text-xs transition cursor-pointer"
            title="Create new branch"
          >
            <GitBranch size={14} className="text-purple-400" />
            <span>Branch</span>
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
              title="Click to view changes and stage commit"
            >
              {summary.is_clean ? (
                <span className="flex items-center text-emerald-400 text-[11px] bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                  <CheckCircle2 size={11} className="mr-1" /> Clean
                </span>
              ) : (
                <span className="flex items-center text-amber-400 text-[11px] bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded hover:bg-amber-900/60 transition">
                  <AlertCircle size={11} className="mr-1" /> Pending changes
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
            Explorer
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* WORKSPACE SECTION (SourceTree File Status vs History) */}
            <div>
              <div className="text-zinc-500 font-semibold px-2 py-1 text-[10px] uppercase tracking-wider">
                Workspace
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
                    <span>File Status</span>
                  </span>
                  {summary && !summary.is_clean && (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </li>

                <li
                  onClick={handleSwitchToHistory}
                  className={`flex items-center space-x-2 px-2 py-1.5 rounded cursor-pointer transition ${
                    activeView === "history"
                      ? "bg-sky-600/20 text-sky-300 font-semibold border-l-2 border-sky-400"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <Layers size={14} className="text-sky-400" />
                  <span>History</span>
                </li>
              </ul>
            </div>

            {/* LOCAL BRANCHES */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 font-medium px-2 py-1">
                <span className="flex items-center space-x-1.5">
                  <GitBranch size={13} className="text-purple-400" />
                  <span>Local Branches ({localBranches.length})</span>
                </span>
              </div>
              <div className="mt-1">
                <BranchTree
                  branches={localBranches}
                  onSelectBranch={handleSelectBranch}
                  onCheckoutBranch={handleCheckoutLocalBranch}
                  onDeleteBranch={handleDeleteLocalBranch}
                />
              </div>
            </div>

            {/* REMOTE BRANCHES & REPOSITORIES */}
            <div>
              <div className="flex items-center justify-between text-zinc-400 font-medium px-2 py-1 group">
                <span className="flex items-center space-x-1.5">
                  <Cloud size={13} className="text-sky-400" />
                  <span>Remote ({remotes.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsManageRemotesOpen(true)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 transition cursor-pointer"
                  title="Manage / Add Remotes"
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className="mt-1">
                {remotes.length === 0 ? (
                  <div
                    onClick={() => setIsManageRemotesOpen(true)}
                    className="mx-2 my-1 p-2.5 rounded border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-800/40 text-center cursor-pointer transition text-zinc-500 hover:text-sky-400"
                  >
                    <p className="text-[11px] font-medium flex items-center justify-center space-x-1">
                      <Plus size={12} />
                      <span>Add Remote</span>
                    </p>
                  </div>
                ) : (
                  <BranchTree
                    branches={remoteBranches}
                    onSelectBranch={handleSelectBranch}
                    onCheckoutRemoteBranch={handleCheckoutRemoteBranch}
                    onDeleteRemoteBranch={handleDeleteRemoteBranch}
                    isRemote={true}
                    configuredRemotes={remotes.map((r) => r.name)}
                  />
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT AREA: CONDITIONAL VIEW */}
        {activeView === "working_copy" ? (
          <WorkingCopyView
            repoPath={repoPath}
            refreshKey={refreshKey}
            onCommitSuccess={handleCommitSuccess}
            onStatusChange={refreshAll}
          />
        ) : (
          /* HISTORY GRAPH VIEW */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#141416]">
            {error && (
              <div className="m-3 p-3 bg-red-950/40 border border-red-800 text-red-300 rounded text-xs">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* COMMIT GRAPH TABLE (Occupies remaining vertical space, 50% by default) */}
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full border-collapse text-left text-xs table-fixed">
                <thead className="sticky top-0 bg-[#1e1e22] text-zinc-400 border-b border-zinc-800 z-10 text-[11px]">
                  <tr>
                    <th className="py-1 px-3 font-semibold w-24">Graph</th>
                    <th className="py-1 px-3 font-semibold">Description</th>
                    <th className="py-1 px-3 font-semibold w-20">Hash</th>
                    <th className="py-1 px-3 font-semibold w-36">Author</th>
                    <th className="py-1 px-3 font-semibold w-36">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 font-normal">
                  {commits.map((c) => {
                    const isUncommitted = c.hash === "uncommitted";
                    const isSelected = selectedCommit?.hash === c.hash;
                    return (
                      <tr
                        key={c.hash}
                        onClick={() => {
                          if (isUncommitted) {
                            setActiveView("working_copy");
                          } else {
                            setSelectedCommit(c);
                          }
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-600/20 text-white"
                            : isUncommitted
                            ? "hover:bg-amber-950/20 text-amber-300"
                            : "hover:bg-zinc-800/50 text-zinc-300"
                        }`}
                        style={{ height: "26px" }}
                      >
                        {/* Grafo SVG */}
                        <td className="p-0 align-middle">
                          <GraphCell
                            node_col={c.node_col}
                            color_index={c.color_index}
                            max_col={c.max_col}
                            segments={c.segments}
                            isSelected={isSelected}
                            isUncommitted={isUncommitted}
                          />
                        </td>

                        {/* Mensaje + Badges de Ramas */}
                        <td className="py-0.5 px-3 truncate font-medium">
                          <div className="flex items-center space-x-1.5 overflow-hidden">
                            {isUncommitted ? (
                              <span className="font-semibold text-amber-400 italic flex items-center space-x-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                                <span>Uncommitted changes</span>
                              </span>
                            ) : (
                              <>
                                {c.refs.map((ref) => (
                                  <span
                                    key={ref}
                                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold shrink-0 ${
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
                              </>
                            )}
                          </div>
                        </td>

                        {/* Hash */}
                        <td className="py-0.5 px-3 font-mono text-zinc-400 text-[11px]">
                          {isUncommitted ? "—" : c.short_hash}
                        </td>

                        {/* Autor */}
                        <td className="py-0.5 px-3 truncate text-zinc-400 text-[11px]">
                          {isUncommitted ? "—" : c.author_name}
                        </td>

                        {/* Fecha */}
                        <td className="py-0.5 px-3 text-zinc-500 text-[11px] truncate">
                          {isUncommitted ? "—" : formatDate(c.timestamp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VERTICAL RESIZER HANDLE (between commits table and bottom panel) */}
            {selectedCommit && (
              <div
                onMouseDown={handleVerticalResize}
                className="h-1.5 w-full bg-zinc-800 hover:bg-sky-500 active:bg-sky-400 cursor-row-resize shrink-0 transition-colors z-20"
                title="Drag to resize bottom panel"
              />
            )}

            {/* BOTTOM COMMIT INSPECTION PANEL (Default 50% vertical space, adjustable) */}
            {selectedCommit && (
              <div
                style={{ height: `${bottomHeightPercent}%` }}
                className="bg-[#1c1c1f] flex shrink-0 text-xs overflow-hidden"
              >
                {/* Left Column: Commit Detailed Info & Changed Files (~42% default width) */}
                <div
                  style={{ width: `${fileListPercent}%` }}
                  className="flex flex-col h-full shrink-0 overflow-hidden"
                >
                  {/* TOP SUB-PANEL: COMMIT DETAILED INFORMATION (~40% default height) */}
                  <div
                    style={{ height: `${commitInfoPercent}%` }}
                    className="flex flex-col shrink-0 overflow-y-auto min-h-0 bg-[#1e1e22] p-2.5 space-y-2 select-text border-b border-zinc-800/80"
                  >
                    {/* Header row: Full hash & Date */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                        <span
                          onClick={() => handleCopyHash(selectedCommit.hash)}
                          className="font-mono text-amber-400 font-semibold text-[11px] truncate cursor-pointer hover:underline hover:text-amber-300 transition"
                          title="Click to copy full Hash"
                        >
                          {selectedCommit.hash}
                        </span>
                        {copiedHash ? (
                          <span className="text-[9px] text-emerald-400 font-sans font-medium px-1 rounded bg-emerald-950/60 border border-emerald-800/60 shrink-0">
                            Copied!
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCopyHash(selectedCommit.hash)}
                            className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer shrink-0"
                            title="Copy Hash"
                          >
                            <Copy size={11} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center text-zinc-400 text-[10px] space-x-1 shrink-0">
                        <Clock size={11} className="text-zinc-500" />
                        <span>{formatDate(selectedCommit.timestamp)}</span>
                      </div>
                    </div>

                    {/* Author row: Name & Email */}
                    <div className="flex items-center space-x-1.5 text-[11px]">
                      <User size={12} className="text-zinc-400 shrink-0" />
                      <span className="font-semibold text-zinc-200">{selectedCommit.author_name}</span>
                      {selectedCommit.author_email && (
                        <span className="text-zinc-400 font-mono text-[10px] truncate">
                          &lt;{selectedCommit.author_email}&gt;
                        </span>
                      )}
                    </div>

                    {/* Parent commits row (if any) - without surrounding box */}
                    {selectedCommit.parents.length > 0 && (
                      <div className="flex items-center space-x-1 text-[10px]">
                        <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">
                          # Parents:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {selectedCommit.parents.map((parentHash) => {
                            const shortP = parentHash.length >= 7 ? parentHash.slice(0, 7) : parentHash;
                            const parentCommit = commits.find((c) => c.hash.startsWith(shortP) || parentHash.startsWith(c.hash));
                            return (
                              <button
                                key={parentHash}
                                onClick={() => {
                                  if (parentCommit) setSelectedCommit(parentCommit);
                                }}
                                className="text-sky-400 hover:text-sky-300 hover:underline font-mono text-[10px] cursor-pointer transition mr-1.5"
                                title={parentCommit ? `Jump to parent commit: ${parentCommit.summary}` : parentHash}
                              >
                                {shortP}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Commit Subject / Summary */}
                    <div className="font-semibold text-zinc-100 text-[11px] leading-snug">
                      {selectedCommit.summary}
                    </div>

                    {/* Commit Description / Body (if present) */}
                    {selectedCommit.body && (
                      <div className="text-zinc-300 text-[11px] font-normal leading-relaxed whitespace-pre-wrap pt-1 border-t border-zinc-800/60">
                        {selectedCommit.body}
                      </div>
                    )}
                  </div>

                  {/* HORIZONTAL RESIZER BETWEEN COMMIT INFO & FILE TREE */}
                  <div
                    onMouseDown={handleCommitInfoResize}
                    className="h-1.5 w-full bg-zinc-800 hover:bg-sky-500 active:bg-sky-400 cursor-row-resize shrink-0 transition-colors z-10"
                    title="Drag to resize commit info and files"
                  />

                  {/* BOTTOM SUB-PANEL: FILE TREE (~60% default height) */}
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <FileTree
                      files={commitFiles}
                      selectedFile={selectedFile}
                      onSelectFile={(f) => setSelectedFile(f)}
                      loading={loadingFiles}
                    />
                  </div>
                </div>

                {/* HORIZONTAL RESIZER HANDLE (between Left Column and Diff Viewer) */}
                <div
                  onMouseDown={handleHorizontalResize}
                  className="w-1.5 h-full bg-zinc-800 hover:bg-sky-500 active:bg-sky-400 cursor-col-resize shrink-0 transition-colors z-20"
                  title="Drag to resize files width"
                />

                {/* Right Column: Unified Diff Viewer */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
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

      {/* PULL MODAL */}
      <PullModal
        isOpen={isPullOpen}
        onClose={() => setIsPullOpen(false)}
        repoPath={repoPath}
        currentBranch={summary?.current_branch || null}
        remotes={remotes}
        remoteBranches={remoteBranches}
        onSuccess={() => {
          refreshAll();
        }}
      />

      {/* PUSH MODAL */}
      <PushModal
        isOpen={isPushOpen}
        onClose={() => setIsPushOpen(false)}
        repoPath={repoPath}
        currentBranch={summary?.current_branch || null}
        localBranches={localBranches}
        remotes={remotes}
        aheadCount={aheadBehind.ahead}
        onSuccess={() => {
          refreshAll();
        }}
      />

      {/* MANAGE REMOTES MODAL */}
      <ManageRemotesModal
        isOpen={isManageRemotesOpen}
        onClose={() => setIsManageRemotesOpen(false)}
        repoPath={repoPath}
        remotes={remotes}
        onRefresh={() => {
          refreshAll();
        }}
      />

      {/* CREATE BRANCH MODAL */}
      <CreateBranchModal
        isOpen={isCreateBranchOpen}
        onClose={() => setIsCreateBranchOpen(false)}
        repoPath={repoPath}
        currentCommit={selectedCommit}
        existingLocalBranches={localBranches.map((b) => b.name)}
        onSuccess={() => {
          refreshAll();
        }}
      />

      {/* CHECKOUT REMOTE BRANCH MODAL */}
      {checkoutRemoteTarget && (
        <CheckoutRemoteModal
          isOpen={!!checkoutRemoteTarget}
          onClose={() => setCheckoutRemoteTarget(null)}
          repoPath={repoPath}
          remoteBranchName={checkoutRemoteTarget.name}
          existingLocalBranches={localBranches.map((b) => b.name)}
          onSuccess={() => {
            refreshAll();
          }}
        />
      )}

      {/* FETCH NOTIFICATION TOAST */}
      {fetchToast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center space-x-2 px-3.5 py-2 rounded shadow-xl text-xs border transition-all ${
            fetchToast.type === "success"
              ? "bg-emerald-950/90 border-emerald-700 text-emerald-200"
              : "bg-red-950/90 border-red-700 text-red-200"
          }`}
        >
          {fetchToast.type === "success" ? (
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={15} className="text-red-400 shrink-0" />
          )}
          <span>{fetchToast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
