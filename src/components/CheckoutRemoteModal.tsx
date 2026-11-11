import React, { useState, useEffect } from "react";
import { checkoutRemoteBranch } from "../api/git";
import { GitBranch, Cloud, X, AlertCircle, RefreshCw } from "./Icons";

interface CheckoutRemoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  remoteBranchName: string;
  existingLocalBranches: string[];
  onSuccess: () => void;
}

export const CheckoutRemoteModal: React.FC<CheckoutRemoteModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  remoteBranchName,
  existingLocalBranches,
  onSuccess,
}) => {
  const [localName, setLocalName] = useState("");
  const [track, setTrack] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setLoading(false);
      return;
    }

    // Default local branch name: strip remote prefix (e.g. "origin/main" -> "main")
    let suggested = remoteBranchName;
    const slashIdx = remoteBranchName.indexOf("/");
    if (slashIdx !== -1) {
      suggested = remoteBranchName.substring(slashIdx + 1);
    }
    setLocalName(suggested);
    setTrack(true);
  }, [isOpen, remoteBranchName]);

  if (!isOpen) return null;

  const branchExists = existingLocalBranches.includes(localName.trim());

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = localName.trim();
    if (!name) {
      setError("Please specify a local branch name.");
      return;
    }
    if (name.includes(" ")) {
      setError("Branch name cannot contain spaces.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await checkoutRemoteBranch(repoPath, name, remoteBranchName, track);
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
            <GitBranch size={16} className="text-sky-400" />
            <span>Checkout Remote Branch</span>
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
        <form onSubmit={handleCheckout} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 rounded text-xs flex items-start space-x-2">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {/* Remote source branch */}
          <div className="bg-[#18181b] p-2.5 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Remote branch:</span>
            <span className="font-semibold text-sky-400 flex items-center space-x-1.5 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              <Cloud size={12} />
              <span>{remoteBranchName}</span>
            </span>
          </div>

          {/* Editable local destination branch */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300">Local Destination Branch:</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              disabled={loading}
              placeholder="e.g. main or feature/my-feature"
              className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-sky-500"
              autoFocus
            />
            {branchExists && (
              <p className="text-[11px] text-amber-400/90 pt-0.5">
                Note: Local branch &apos;{localName.trim()}&apos; already exists. It will be checked out.
              </p>
            )}
          </div>

          {/* Tracking option */}
          <div className="pt-1">
            <label className="flex items-center space-x-2 cursor-pointer select-none text-zinc-300">
              <input
                type="checkbox"
                checked={track}
                onChange={(e) => setTrack(e.target.checked)}
                disabled={loading}
                className="rounded border-zinc-700 bg-zinc-900 text-sky-500 focus:ring-0 cursor-pointer"
              />
              <span>Track remote branch (<code>--track</code>)</span>
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
              disabled={loading || !localName.trim()}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-sky-900/40 disabled:text-zinc-500 text-white font-semibold transition cursor-pointer shadow"
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-white" />
                  <span>Checking out...</span>
                </>
              ) : (
                <>
                  <GitBranch size={14} />
                  <span>Checkout Branch</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
