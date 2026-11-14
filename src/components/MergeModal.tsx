import React, { useState, useEffect } from "react";
import { Branch, mergeBranch, MergeResult } from "../api/git";
import { GitPullRequest, GitBranch, Cloud, X, AlertCircle, RefreshCw } from "./Icons";

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  currentBranch: string | null;
  localBranches: Branch[];
  remoteBranches: Branch[];
  initialSourceBranch?: string | null;
  onSuccess: (result: MergeResult) => void;
}

export const MergeModal: React.FC<MergeModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  currentBranch,
  localBranches,
  remoteBranches,
  initialSourceBranch,
  onSuccess,
}) => {
  const [selectedSource, setSelectedSource] = useState("");
  const [noFf, setNoFf] = useState(false);
  const [squash, setSquash] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available branches excluding current HEAD
  const availableLocal = localBranches.filter((b) => b.name !== currentBranch);
  const availableRemote = remoteBranches.filter((b) => b.name !== currentBranch);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setLoading(false);
      return;
    }

    // Determine initial source branch
    let defaultSource = "";
    if (initialSourceBranch && initialSourceBranch !== currentBranch) {
      defaultSource = initialSourceBranch;
    } else if (availableLocal.length > 0) {
      // Prefer main/master if available and not current
      const main = availableLocal.find((b) => b.name === "main" || b.name === "master");
      defaultSource = main ? main.name : availableLocal[0].name;
    } else if (availableRemote.length > 0) {
      defaultSource = availableRemote[0].name;
    }

    setSelectedSource(defaultSource);
    setNoFf(false);
    setSquash(false);
    setCustomMessage(
      defaultSource && currentBranch ? `Merge branch '${defaultSource}' into ${currentBranch}` : ""
    );
  }, [isOpen, initialSourceBranch, currentBranch]);

  // Update default message when source branch changes
  const handleSourceChange = (src: string) => {
    setSelectedSource(src);
    if (!squash) {
      setCustomMessage(src && currentBranch ? `Merge branch '${src}' into ${currentBranch}` : "");
    }
  };

  const handleSquashToggle = (checked: boolean) => {
    setSquash(checked);
    if (checked) {
      setNoFf(false);
    }
  };

  const handleNoFfToggle = (checked: boolean) => {
    setNoFf(checked);
    if (checked) {
      setSquash(false);
    }
  };

  if (!isOpen) return null;

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource) {
      setError("Please select a branch to merge.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const msg = customMessage.trim() ? customMessage.trim() : undefined;
      const res = await mergeBranch(repoPath, selectedSource, noFf, squash, msg);
      onSuccess(res);
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
            <GitPullRequest size={16} className="text-pink-400" />
            <span>Merge Branches</span>
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
        <form onSubmit={handleMerge} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 rounded text-xs flex items-start space-x-2">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {/* Merge summary banner (Destination HEAD) */}
          <div className="bg-[#18181b] p-3 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Target (Merge into):</span>
            <span className="font-semibold text-pink-400 flex items-center space-x-1.5 bg-pink-500/10 px-2.5 py-1 rounded border border-pink-500/30">
              <GitBranch size={13} />
              <span>{currentBranch || "HEAD"}</span>
            </span>
          </div>

          {/* Source branch selector */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300">Source branch to merge:</label>
            <div className="relative">
              <select
                value={selectedSource}
                onChange={(e) => handleSourceChange(e.target.value)}
                disabled={loading}
                className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-hidden focus:border-pink-500 cursor-pointer font-mono"
              >
                {availableLocal.length > 0 && (
                  <optgroup label="Local Branches">
                    {availableLocal.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {availableRemote.length > 0 && (
                  <optgroup label="Remote Branches">
                    {availableRemote.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Merge Options */}
          <div className="p-3 bg-[#18181b]/60 rounded border border-zinc-800 space-y-2.5">
            <span className="text-zinc-400 font-semibold text-[10px] uppercase tracking-wider block">
              Merge Strategy Options
            </span>

            {/* No fast-forward */}
            <label className="flex items-start space-x-2 cursor-pointer select-none text-zinc-300">
              <input
                type="checkbox"
                checked={noFf}
                onChange={(e) => handleNoFfToggle(e.target.checked)}
                disabled={loading || squash}
                className="rounded border-zinc-700 bg-zinc-900 text-pink-500 focus:ring-0 cursor-pointer mt-0.5"
              />
              <div className="text-[11px] leading-tight">
                <span className="font-medium text-zinc-200">
                  Create a commit even if merge resolved via fast-forward (<code>--no-ff</code>)
                </span>
                <p className="text-zinc-500 text-[10px]">
                  Preserves the branch history by always generating a merge commit.
                </p>
              </div>
            </label>

            {/* Squash */}
            <label className="flex items-start space-x-2 cursor-pointer select-none text-zinc-300">
              <input
                type="checkbox"
                checked={squash}
                onChange={(e) => handleSquashToggle(e.target.checked)}
                disabled={loading || noFf}
                className="rounded border-zinc-700 bg-zinc-900 text-pink-500 focus:ring-0 cursor-pointer mt-0.5"
              />
              <div className="text-[11px] leading-tight">
                <span className="font-medium text-zinc-200">
                  Squash commits into single commit (<code>--squash</code>)
                </span>
                <p className="text-zinc-500 text-[10px]">
                  Combines all incoming changes into the working copy without creating a commit automatically.
                </p>
              </div>
            </label>
          </div>

          {/* Custom Commit Message */}
          {!squash && (
            <div className="space-y-1.5">
              <label className="font-medium text-zinc-300 flex items-center justify-between">
                <span>Commit Message (Optional):</span>
                <span className="text-zinc-500 text-[10px]">Leave blank for default Git message</span>
              </label>
              <input
                type="text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                disabled={loading}
                placeholder={`Merge branch '${selectedSource}' into ${currentBranch}`}
                className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-hidden focus:border-pink-500"
              />
            </div>
          )}

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
              disabled={loading || !selectedSource}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-pink-600 hover:bg-pink-500 disabled:bg-pink-900/40 disabled:text-zinc-500 text-white font-semibold transition cursor-pointer shadow"
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-white" />
                  <span>Merging...</span>
                </>
              ) : (
                <>
                  <GitPullRequest size={14} />
                  <span>Merge into {currentBranch || "HEAD"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
