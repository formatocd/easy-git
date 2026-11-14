import React, { useState, useEffect } from "react";
import {
  WorkingTreeStatus,
  WorkingFile,
  getWorkingTreeStatus,
  getWorkingFileDiff,
  stageFile,
  unstageFile,
  stageFiles,
  unstageFiles,
  stageAll,
  unstageAll,
  discardFileChanges,
  discardFiles,
  commitChanges,
  getMergeMessage,
} from "../api/git";
import { DiffViewer } from "./DiffViewer";
import { WorkingFilesSection } from "./WorkingFilesSection";
import {
  GitCommit,
  CheckCircle2,
} from "./Icons";
import { ask } from "@tauri-apps/plugin-dialog";

interface WorkingCopyViewProps {
  repoPath: string;
  refreshKey?: number;
  onCommitSuccess: () => void;
  onStatusChange?: () => void;
}

export const WorkingCopyView: React.FC<WorkingCopyViewProps> = ({
  repoPath,
  refreshKey,
  onCommitSuccess,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<WorkingTreeStatus>({ staged: [], unstaged: [] });
  const [selectedFile, setSelectedFile] = useState<WorkingFile | null>(null);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const [commitMessage, setCommitMessage] = useState("");
  const [isAmend, setIsAmend] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Width of files column
  const [filesColWidth, setFilesColWidth] = useState(380);

  // Load status
  async function refreshStatus(preferredFile?: WorkingFile) {
    try {
      setErrorMsg(null);
      const res = await getWorkingTreeStatus(repoPath);
      setStatus(res);
      onStatusChange?.();

      // Select file: preferred > previous > first available
      const allFiles = [...res.staged, ...res.unstaged];
      if (allFiles.length === 0) {
        setSelectedFile(null);
        setDiffText(null);
        return;
      }

      if (
        preferredFile &&
        allFiles.some((f) => f.path === preferredFile.path && f.is_staged === preferredFile.is_staged)
      ) {
        setSelectedFile(preferredFile);
      } else if (
        selectedFile &&
        allFiles.some((f) => f.path === selectedFile.path && f.is_staged === selectedFile.is_staged)
      ) {
        // Keep selected
      } else {
        setSelectedFile(res.staged[0] || res.unstaged[0]);
      }
    } catch (err: unknown) {
      setErrorMsg(typeof err === "string" ? err : String(err));
    }
  }

  useEffect(() => {
    refreshStatus();
    if (repoPath) {
      getMergeMessage(repoPath)
        .then((msg) => {
          if (msg) {
            setCommitMessage((prev) => (prev.trim() ? prev : msg));
          }
        })
        .catch(() => {});
    }
  }, [repoPath, refreshKey]);

  // Auto-refresh when window regains focus
  useEffect(() => {
    const onFocus = () => {
      refreshStatus();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [repoPath]);

  // Load diff when selected file changes
  useEffect(() => {
    if (!selectedFile) {
      setDiffText(null);
      return;
    }

    let isCancelled = false;
    async function fetchDiff() {
      setLoadingDiff(true);
      try {
        const diff = await getWorkingFileDiff(repoPath, selectedFile!.path, selectedFile!.is_staged);
        if (!isCancelled) {
          setDiffText(diff);
        }
      } catch (err) {
        if (!isCancelled) {
          setDiffText("Error loading diff.");
        }
      } finally {
        if (!isCancelled) setLoadingDiff(false);
      }
    }

    fetchDiff();
    return () => {
      isCancelled = true;
    };
  }, [selectedFile?.path, selectedFile?.is_staged, repoPath]);

  // Batch actions
  async function handleStageBatch(paths: string[]) {
    try {
      await stageFiles(repoPath, paths);
      await refreshStatus();
    } catch (err: unknown) {
      setErrorMsg(String(err));
    }
  }

  async function handleUnstageBatch(paths: string[]) {
    try {
      await unstageFiles(repoPath, paths);
      await refreshStatus();
    } catch (err: unknown) {
      setErrorMsg(String(err));
    }
  }

  // Single file actions
  async function handleStage(file: WorkingFile, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await stageFile(repoPath, file.path);
      await refreshStatus({ ...file, is_staged: true });
    } catch (err: unknown) {
      setErrorMsg(String(err));
    }
  }

  async function handleUnstage(file: WorkingFile, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await unstageFile(repoPath, file.path);
      await refreshStatus({ ...file, is_staged: false });
    } catch (err: unknown) {
      setErrorMsg(String(err));
    }
  }

  async function handleStageAll() {
    try {
      await stageAll(repoPath);
      await refreshStatus();
    } catch (err: unknown) {
      setErrorMsg(String(err));
    }
  }

  async function handleUnstageAll() {
    try {
      await unstageAll(repoPath);
      await refreshStatus();
    } catch (err: unknown) {
      setErrorMsg(String(err));
    }
  }

  async function handleDiscardBatch(paths: string[]) {
    if (paths.length === 0) return;

    const count = paths.length;
    const message =
      count === 1
        ? `Are you sure you want to discard all changes in '${paths[0]}'?\n\nThis action cannot be undone.`
        : `Are you sure you want to discard all uncommitted changes in ${count} files?\n\nThis action cannot be undone.`;

    let confirmed = false;
    try {
      confirmed = await ask(message, {
        title: "Discard Changes",
        kind: "warning",
        okLabel: count === 1 ? "Discard file changes" : `Discard ${count} files`,
        cancelLabel: "Cancel",
      });
    } catch (dialogErr) {
      console.warn("Fallback dialog check:", dialogErr);
      confirmed = false;
    }

    if (!confirmed) {
      return;
    }

    try {
      await discardFiles(repoPath, paths);
      await refreshStatus();
      onStatusChange?.();
    } catch (err: unknown) {
      setErrorMsg(String(err));
    }
  }

  async function handleDiscard(file: WorkingFile, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await handleDiscardBatch([file.path]);
  }

  async function handleCommit() {
    if (!commitMessage.trim()) {
      setErrorMsg("Commit message cannot be empty.");
      return;
    }

    if (status.staged.length === 0 && !isAmend) {
      setErrorMsg("No staged files for commit.");
      return;
    }

    setIsCommitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await commitChanges(repoPath, commitMessage, isAmend);
      setCommitMessage("");
      setIsAmend(false);
      setSuccessMsg("Commit created successfully!");
      await refreshStatus();
      onCommitSuccess();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(String(err));
    } finally {
      setIsCommitting(false);
    }
  }

  const handleHorizontalResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = filesColWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setFilesColWidth(Math.max(280, Math.min(650, startWidth + deltaX)));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-[#141416]">
      {/* LEFT / MIDDLE: STAGING PANELS & COMMIT BOX */}
      <div
        style={{ width: `${filesColWidth}px` }}
        className="flex flex-col border-r border-zinc-800 bg-[#19191c] shrink-0 overflow-hidden"
      >
        {/* Messages */}
        {errorMsg && (
          <div className="p-2 bg-rose-950/40 border-b border-rose-800 text-rose-300 text-[11px] flex items-center justify-between">
            <span className="truncate">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-zinc-400 hover:text-white ml-2">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="p-2 bg-emerald-950/40 border-b border-emerald-800 text-emerald-300 text-[11px] flex items-center space-x-1">
            <CheckCircle2 size={12} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. STAGED FILES SECTION */}
        <WorkingFilesSection
          title="Staged Files"
          colorDotClass="bg-emerald-400"
          files={status.staged}
          isStaged={true}
          selectedFile={selectedFile}
          onSelectFile={(f) => setSelectedFile(f)}
          onUnstageSingle={handleUnstage}
          onDiscardBatch={handleDiscardBatch}
          onBatchAction={handleUnstageBatch}
          batchActionLabel="Unstage"
          onAllAction={handleUnstageAll}
          allActionLabel="Unstage all"
        />

        {/* 2. UNSTAGED FILES SECTION */}
        <WorkingFilesSection
          title="Unstaged Files"
          colorDotClass="bg-amber-400"
          files={status.unstaged}
          isStaged={false}
          selectedFile={selectedFile}
          onSelectFile={(f) => setSelectedFile(f)}
          onStageSingle={handleStage}
          onDiscardSingle={handleDiscard}
          onDiscardBatch={handleDiscardBatch}
          onBatchAction={handleStageBatch}
          batchActionLabel="Stage"
          onAllAction={handleStageAll}
          allActionLabel="Stage all"
        />

        {/* 3. COMMIT MESSAGE & SUBMIT BOX */}
        <div className="p-3 bg-[#1d1d21] flex flex-col space-y-2 shrink-0 border-t border-zinc-800">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message (title and optional description)..."
            rows={3}
            className="w-full bg-[#141416] border border-zinc-800 rounded p-2 text-xs text-zinc-100 placeholder-zinc-500 resize-none outline-none focus:border-sky-500 transition"
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAmend}
                onChange={(e) => setIsAmend(e.target.checked)}
                className="rounded bg-zinc-800 border-zinc-700 text-sky-500 focus:ring-0"
              />
              <span>Amend last commit</span>
            </label>

            <button
              onClick={handleCommit}
              disabled={isCommitting || (status.staged.length === 0 && !isAmend)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                status.staged.length > 0 || isAmend
                  ? "bg-sky-600 hover:bg-sky-500 text-white shadow-sm"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }`}
            >
              <GitCommit size={14} />
              <span>
                {isCommitting
                  ? "Committing..."
                  : isAmend
                  ? "Amend Commit"
                  : `Commit (${status.staged.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* RESIZER HANDLE */}
      <div
        onMouseDown={handleHorizontalResize}
        className="w-1.5 h-full bg-zinc-800 hover:bg-sky-500 active:bg-sky-400 cursor-col-resize shrink-0 transition-colors z-20"
        title="Drag to resize panel"
      />

      {/* RIGHT: LIVE DIFF VIEWER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DiffViewer
          diffText={diffText}
          loading={loadingDiff}
          filePath={
            selectedFile
              ? `${selectedFile.path} (${selectedFile.is_staged ? "Staged" : "Unstaged"})`
              : null
          }
        />
      </div>
    </div>
  );
};
