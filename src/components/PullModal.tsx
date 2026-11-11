import React, { useState, useEffect } from "react";
import { RemoteInfo, Branch, pullChanges } from "../api/git";
import { ArrowDown, X, AlertCircle, RefreshCw } from "./Icons";

interface PullModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  currentBranch: string | null;
  remotes: RemoteInfo[];
  remoteBranches: Branch[];
  onSuccess: () => void;
}

export const PullModal: React.FC<PullModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  currentBranch,
  remotes,
  remoteBranches,
  onSuccess,
}) => {
  const [selectedRemote, setSelectedRemote] = useState<string>("origin");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [rebase, setRebase] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected remote and branch when opened
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setLoading(false);
      return;
    }

    const initialRemote = remotes.length > 0 ? remotes[0].name : "origin";
    setSelectedRemote(initialRemote);

    // Find remote branch candidates for this remote
    const prefix = `${initialRemote}/`;
    const candidates = remoteBranches
      .map((b) => b.name)
      .filter((n) => n.startsWith(prefix) && !n.endsWith("/HEAD"))
      .map((n) => n.substring(prefix.length));

    // Try matching current local branch
    if (currentBranch && candidates.includes(currentBranch)) {
      setSelectedBranch(currentBranch);
    } else if (candidates.includes("main")) {
      setSelectedBranch("main");
    } else if (candidates.length > 0) {
      setSelectedBranch(candidates[0]);
    } else {
      setSelectedBranch(currentBranch || "main");
    }
  }, [isOpen, remotes, remoteBranches, currentBranch]);

  // When selectedRemote changes, update branch candidates
  const handleRemoteChange = (remName: string) => {
    setSelectedRemote(remName);
    const prefix = `${remName}/`;
    const candidates = remoteBranches
      .map((b) => b.name)
      .filter((n) => n.startsWith(prefix) && !n.endsWith("/HEAD"))
      .map((n) => n.substring(prefix.length));

    if (currentBranch && candidates.includes(currentBranch)) {
      setSelectedBranch(currentBranch);
    } else if (candidates.includes("main")) {
      setSelectedBranch("main");
    } else if (candidates.length > 0) {
      setSelectedBranch(candidates[0]);
    }
  };

  if (!isOpen) return null;

  const prefix = `${selectedRemote}/`;
  const branchOptions = remoteBranches
    .map((b) => b.name)
    .filter((n) => n.startsWith(prefix) && !n.endsWith("/HEAD"))
    .map((n) => n.substring(prefix.length));

  // If candidate list doesn't include selectedBranch, add it
  if (selectedBranch && !branchOptions.includes(selectedBranch)) {
    branchOptions.unshift(selectedBranch);
  }

  const handlePull = async () => {
    if (!selectedRemote || !selectedBranch) return;
    setLoading(true);
    setError(null);

    try {
      await pullChanges(repoPath, selectedRemote, selectedBranch, rebase);
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
        className="w-full max-w-lg bg-[#1f1f23] border border-zinc-700/80 rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#27272b] border-b border-zinc-700/80">
          <div className="flex items-center space-x-2 font-semibold text-sm text-zinc-100">
            <ArrowDown size={16} className="text-blue-400" />
            <span>Pull Changes from Remote</span>
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
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 rounded text-xs flex items-start space-x-2">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-36 overflow-y-auto">
                {error}
              </div>
            </div>
          )}

          {/* Destination info */}
          <div className="bg-[#18181b] p-2.5 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Target local branch:</span>
            <span className="font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              {currentBranch || "HEAD"}
            </span>
          </div>

          {/* Remote selector */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300">Remote Repository:</label>
            <select
              value={selectedRemote}
              onChange={(e) => handleRemoteChange(e.target.value)}
              disabled={loading}
              className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-hidden focus:border-blue-500 text-xs"
            >
              {remotes.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name} {r.url ? `(${r.url})` : ""}
                </option>
              ))}
              {remotes.length === 0 && <option value="origin">origin</option>}
            </select>
          </div>

          {/* Remote branch selector */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300">Remote Branch to Pull:</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={loading}
              className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-hidden focus:border-blue-500 text-xs"
            >
              {branchOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              {branchOptions.length === 0 && (
                <option value={currentBranch || "main"}>
                  {currentBranch || "main"}
                </option>
              )}
            </select>
          </div>

          {/* Pull options */}
          <div className="space-y-2 pt-1 border-t border-zinc-800 text-zinc-300">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rebase}
                onChange={(e) => setRebase(e.target.checked)}
                disabled={loading}
                className="rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-0 cursor-pointer"
              />
              <span>Rebase local commits instead of merging (<code>--rebase</code>)</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 bg-[#242428] border-t border-zinc-700/80">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePull}
            disabled={loading || !selectedBranch}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 disabled:text-zinc-500 text-white font-semibold transition cursor-pointer shadow"
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin text-white" />
                <span>Pulling...</span>
              </>
            ) : (
              <>
                <ArrowDown size={14} />
                <span>Pull</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
