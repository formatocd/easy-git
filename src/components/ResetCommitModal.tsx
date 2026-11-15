import React, { useState, useEffect } from "react";
import { CommitWithGraph } from "../api/git";
import { AlertTriangle, X, Undo2 } from "./Icons";

interface ResetCommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBranch: string | null;
  commit: CommitWithGraph | null;
  onConfirm: (commit: CommitWithGraph, mode: "soft" | "mixed" | "hard") => Promise<void>;
}

export const ResetCommitModal: React.FC<ResetCommitModalProps> = ({
  isOpen,
  onClose,
  currentBranch,
  commit,
  onConfirm,
}) => {
  const [mode, setMode] = useState<"soft" | "mixed" | "hard">("mixed");

  useEffect(() => {
    if (isOpen) {
      setMode("mixed");
    }
  }, [isOpen]);

  if (!isOpen || !commit) return null;

  const handleConfirm = async () => {
    const target = commit;
    const selectedMode = mode;
    onClose();
    await onConfirm(target, selectedMode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-md bg-[#1f1f23] border border-amber-700/80 rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#272522] border-b border-amber-700/60">
          <div className="flex items-center space-x-2 font-semibold text-sm text-amber-200">
            <Undo2 size={16} className="text-amber-400 shrink-0" />
            <span>Reset Current Branch to Commit</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-700/50 transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <p className="text-zinc-300 leading-relaxed">
              Reset{" "}
              <strong className="text-purple-300 font-mono">
                {currentBranch || "HEAD"}
              </strong>{" "}
              to commit{" "}
              <strong className="text-amber-300 font-mono">{commit.short_hash}</strong>:
            </p>
            <div className="px-2.5 py-1.5 bg-[#141416] border border-zinc-800 rounded text-[11px] text-zinc-200 truncate">
              {commit.summary}
            </div>
          </div>

          <div className="p-3 bg-[#18181b] border border-zinc-800 rounded-md space-y-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
              Reset Mode
            </span>

            <label className="flex items-start space-x-2.5 cursor-pointer select-none">
              <input
                type="radio"
                name="resetMode"
                checked={mode === "soft"}
                onChange={() => setMode("soft")}
                className="text-amber-500 bg-zinc-900 border-zinc-700 focus:ring-0 cursor-pointer mt-0.5"
              />
              <div className="text-[11px] leading-tight space-y-0.5">
                <span className="font-semibold text-zinc-100 block">
                  Soft (<span className="font-mono text-emerald-400">--soft</span>)
                </span>
                <span className="text-zinc-400 text-[10px] block">
                  Keep all local changes in the working copy and staging area (index).
                </span>
              </div>
            </label>

            <label className="flex items-start space-x-2.5 cursor-pointer select-none">
              <input
                type="radio"
                name="resetMode"
                checked={mode === "mixed"}
                onChange={() => setMode("mixed")}
                className="text-amber-500 bg-zinc-900 border-zinc-700 focus:ring-0 cursor-pointer mt-0.5"
              />
              <div className="text-[11px] leading-tight space-y-0.5">
                <span className="font-semibold text-zinc-100 block">
                  Mixed (<span className="font-mono text-amber-400">--mixed</span>)
                </span>
                <span className="text-zinc-400 text-[10px] block">
                  Keep working copy changes, but reset the staging area (unstage all).
                </span>
              </div>
            </label>

            <label className="flex items-start space-x-2.5 cursor-pointer select-none">
              <input
                type="radio"
                name="resetMode"
                checked={mode === "hard"}
                onChange={() => setMode("hard")}
                className="text-red-500 bg-zinc-900 border-zinc-700 focus:ring-0 cursor-pointer mt-0.5"
              />
              <div className="text-[11px] leading-tight space-y-0.5">
                <span className="font-semibold text-red-300 block">
                  Hard (<span className="font-mono text-red-400">--hard</span>)
                </span>
                <span className="text-zinc-400 text-[10px] block">
                  Discard all working copy and staged changes permanently.
                </span>
              </div>
            </label>
          </div>

          {mode === "hard" && (
            <div className="p-2.5 bg-red-950/40 border border-red-800/80 rounded flex items-start space-x-2 text-[11px] text-red-200">
              <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <span>
                Warning: Hard reset will permanently destroy all uncommitted local changes.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 bg-[#242428] border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer font-medium text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-1.5 rounded text-white font-semibold text-xs transition cursor-pointer shadow ${
              mode === "hard"
                ? "bg-red-700 hover:bg-red-600"
                : "bg-amber-600 hover:bg-amber-500"
            }`}
          >
            Reset ({mode})
          </button>
        </div>
      </div>
    </div>
  );
};
