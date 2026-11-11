import React, { useState, useEffect } from "react";
import { RemoteInfo, Branch, pushChanges } from "../api/git";
import { ArrowUp, X, AlertCircle, RefreshCw, AlertTriangle } from "./Icons";

interface PushModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  currentBranch: string | null;
  localBranches: Branch[];
  remotes: RemoteInfo[];
  aheadCount: number;
  onSuccess: () => void;
}

export const PushModal: React.FC<PushModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  currentBranch,
  localBranches,
  remotes,
  aheadCount,
  onSuccess,
}) => {
  const [selectedRemote, setSelectedRemote] = useState<string>("origin");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [targetBranch, setTargetBranch] = useState<string>("");
  const [setUpstream, setSetUpstream] = useState<boolean>(true);
  const [forceWithLease, setForceWithLease] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setLoading(false);
      setForceWithLease(false);
      return;
    }

    const initialRemote = remotes.length > 0 ? remotes[0].name : "origin";
    setSelectedRemote(initialRemote);

    const initialBranch = currentBranch || (localBranches.length > 0 ? localBranches[0].name : "main");
    setSelectedBranch(initialBranch);
    setTargetBranch(initialBranch);
  }, [isOpen, remotes, currentBranch, localBranches]);

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    setTargetBranch(branch);
  };

  if (!isOpen) return null;

  const handlePush = async () => {
    if (!selectedRemote || !selectedBranch || !targetBranch) return;
    setLoading(true);
    setError(null);

    try {
      await pushChanges(repoPath, selectedRemote, selectedBranch, forceWithLease, setUpstream);
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
            <ArrowUp size={16} className="text-amber-400" />
            <span>Push Changes to Remote</span>
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

          {/* Ahead commits notification */}
          {aheadCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded flex items-center space-x-2 text-amber-300">
              <ArrowUp size={14} className="shrink-0" />
              <span>
                <strong>{aheadCount}</strong> commit{aheadCount > 1 ? "s" : ""} pending to push to {selectedRemote}/{targetBranch}
              </span>
            </div>
          )}

          {/* Remote selector */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300">Destination Remote:</label>
            <select
              value={selectedRemote}
              onChange={(e) => setSelectedRemote(e.target.value)}
              disabled={loading}
              className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-hidden focus:border-amber-500 text-xs"
            >
              {remotes.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name} {r.url ? `(${r.url})` : ""}
                </option>
              ))}
              {remotes.length === 0 && <option value="origin">origin</option>}
            </select>
          </div>

          {/* Local branch to push */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300">Local Branch to Push:</label>
            <select
              value={selectedBranch}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={loading}
              className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-hidden focus:border-amber-500 text-xs"
            >
              {localBranches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} {b.is_current ? "(current HEAD)" : ""}
                </option>
              ))}
              {localBranches.length === 0 && (
                <option value={currentBranch || "main"}>{currentBranch || "main"}</option>
              )}
            </select>
          </div>

          {/* Target remote branch */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300">Remote Destination Branch:</label>
            <input
              type="text"
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              disabled={loading}
              placeholder="e.g. main"
              className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-hidden focus:border-amber-500 text-xs font-mono"
            />
          </div>

          {/* Options */}
          <div className="space-y-2 pt-1 border-t border-zinc-800 text-zinc-300">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={setUpstream}
                onChange={(e) => setSetUpstream(e.target.checked)}
                disabled={loading}
                className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0 cursor-pointer"
              />
              <span>Set tracking reference (<code>-u</code> / <code>--set-upstream</code>)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceWithLease}
                onChange={(e) => setForceWithLease(e.target.checked)}
                disabled={loading}
                className="rounded border-zinc-700 bg-zinc-900 text-red-500 focus:ring-0 cursor-pointer"
              />
              <span className="flex items-center space-x-1.5">
                <span>Force push safely (<code>--force-with-lease</code>)</span>
                {forceWithLease && (
                  <span className="flex items-center space-x-1 text-[10px] text-amber-400 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/40">
                    <AlertTriangle size={11} />
                    <span>Caution</span>
                  </span>
                )}
              </span>
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
            onClick={handlePush}
            disabled={loading || !selectedBranch || !targetBranch}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800/50 disabled:text-zinc-500 text-white font-semibold transition cursor-pointer shadow"
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin text-white" />
                <span>Pushing...</span>
              </>
            ) : (
              <>
                <ArrowUp size={14} />
                <span>Push</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
