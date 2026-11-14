import React, { useState, useEffect } from "react";
import { stashSave } from "../api/git";
import { Archive, X, AlertCircle, RefreshCw } from "./Icons";

interface StashModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  currentBranch: string | null;
  onSuccess: () => void;
}

export const StashModal: React.FC<StashModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  currentBranch,
  onSuccess,
}) => {
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [keepIndex, setKeepIndex] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setMessage("");
      setIncludeUntracked(false);
      setKeepIndex(false);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const msg = message.trim() ? message.trim() : undefined;
      await stashSave(repoPath, msg, includeUntracked, keepIndex);
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
            <Archive size={16} className="text-orange-400" />
            <span>Stash Changes</span>
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
        <form onSubmit={handleSave} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 rounded text-xs flex items-start space-x-2">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {/* Message input */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300 flex items-center justify-between">
              <span>Message (Optional):</span>
              {currentBranch && (
                <span className="text-zinc-500 text-[10px] font-mono">On {currentBranch}</span>
              )}
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              placeholder="e.g. WIP: feature work before switching branch"
              className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-hidden focus:border-orange-500"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="p-3 bg-[#18181b]/60 rounded border border-zinc-800 space-y-2.5">
            <span className="text-zinc-400 font-semibold text-[10px] uppercase tracking-wider block">
              Stash Options
            </span>

            <label className="flex items-start space-x-2 cursor-pointer select-none text-zinc-300">
              <input
                type="checkbox"
                checked={includeUntracked}
                onChange={(e) => setIncludeUntracked(e.target.checked)}
                disabled={loading}
                className="rounded border-zinc-700 bg-zinc-900 text-orange-500 focus:ring-0 cursor-pointer mt-0.5"
              />
              <div className="text-[11px] leading-tight">
                <span className="font-medium text-zinc-200">
                  Include untracked files (<code>-u</code>)
                </span>
                <p className="text-zinc-500 text-[10px]">
                  Also save newly created files that are not yet tracked by Git.
                </p>
              </div>
            </label>

            <label className="flex items-start space-x-2 cursor-pointer select-none text-zinc-300">
              <input
                type="checkbox"
                checked={keepIndex}
                onChange={(e) => setKeepIndex(e.target.checked)}
                disabled={loading}
                className="rounded border-zinc-700 bg-zinc-900 text-orange-500 focus:ring-0 cursor-pointer mt-0.5"
              />
              <div className="text-[11px] leading-tight">
                <span className="font-medium text-zinc-200">
                  Keep staged changes (<code>--keep-index</code>)
                </span>
                <p className="text-zinc-500 text-[10px]">
                  Leave changes already added to the staging area intact.
                </p>
              </div>
            </label>
          </div>

          {/* Footer buttons */}
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
              disabled={loading}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-orange-600 hover:bg-orange-500 disabled:bg-orange-900/40 disabled:text-zinc-500 text-white font-semibold transition cursor-pointer shadow"
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-white" />
                  <span>Stashing...</span>
                </>
              ) : (
                <>
                  <Archive size={14} />
                  <span>Stash Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
