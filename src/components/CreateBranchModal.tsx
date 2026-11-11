import React, { useState, useEffect } from "react";
import { createBranch, CommitWithGraph } from "../api/git";
import { GitBranch, X, AlertCircle, RefreshCw, GitCommit } from "./Icons";

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  currentCommit: CommitWithGraph | null;
  existingLocalBranches: string[];
  onSuccess: () => void;
}

export const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  currentCommit,
  existingLocalBranches,
  onSuccess,
}) => {
  const [branchName, setBranchName] = useState("");
  const [checkout, setCheckout] = useState(true); // Default to true as requested!
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setBranchName("");
      setCheckout(true);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = branchName.trim();

    if (!name) {
      setError("Please specify a branch name.");
      return;
    }
    if (name.includes(" ")) {
      setError("Branch name cannot contain spaces.");
      return;
    }
    if (name.startsWith("/") || name.endsWith("/")) {
      setError("Branch name cannot start or end with a slash.");
      return;
    }
    if (existingLocalBranches.includes(name)) {
      setError(`A local branch named '${name}' already exists.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const targetHash = currentCommit?.hash !== "uncommitted" ? currentCommit?.hash : undefined;
      await createBranch(repoPath, name, targetHash, checkout);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-md bg-[#1f1f23] border border-zinc-700/80 rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#27272b] border-b border-zinc-700/80">
          <div className="flex items-center space-x-2 font-semibold text-sm text-zinc-100">
            <GitBranch size={16} className="text-purple-400" />
            <span>Create New Branch</span>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-700/50 transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleCreate} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 rounded text-xs flex items-start space-x-2">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {/* Base commit */}
          <div className="bg-[#18181b] p-2.5 rounded border border-zinc-800 space-y-1">
            <span className="text-zinc-400 block text-[11px]">Creating from commit:</span>
            <div className="flex items-center space-x-2 font-mono text-[11px] text-zinc-200 truncate">
              <GitCommit size={13} className="text-purple-400 shrink-0" />
              <span className="text-purple-300 font-bold shrink-0">
                {currentCommit ? currentCommit.short_hash : "HEAD"}
              </span>
              <span className="truncate text-zinc-400">
                {currentCommit?.summary || "Current HEAD"}
              </span>
            </div>
          </div>

          {/* Branch name input */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300">New Branch Name:</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              disabled={loading}
              placeholder="e.g. feature/my-feature or bugfix/fix-issue"
              className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-purple-500"
              autoFocus
            />
          </div>

          {/* Checkout option (active by default!) */}
          <div className="pt-1">
            <label className="flex items-center space-x-2 cursor-pointer select-none text-zinc-300">
              <input
                type="checkbox"
                checked={checkout}
                onChange={(e) => setCheckout(e.target.checked)}
                disabled={loading}
                className="rounded border-zinc-700 bg-zinc-900 text-purple-500 focus:ring-0 cursor-pointer"
              />
              <span className="font-medium">Checkout new branch immediately (switch to it)</span>
            </label>
          </div>

          {/* Footer buttons inside form */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !branchName.trim()}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/40 disabled:text-zinc-500 text-white font-semibold transition cursor-pointer shadow"
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-white" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <GitBranch size={14} />
                  <span>Create Branch</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
