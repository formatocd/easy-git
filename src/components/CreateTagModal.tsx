import React, { useState, useEffect } from "react";
import { CommitWithGraph, RemoteInfo, createTag, pushTag } from "../api/git";
import { Tag, X, AlertCircle, RefreshCw, GitCommit, List, Search } from "./Icons";

interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  currentBranch: string | null;
  commits: CommitWithGraph[];
  remotes: RemoteInfo[];
  initialTargetHash?: string | null;
  onSuccess: (tagName: string) => void;
}

export const CreateTagModal: React.FC<CreateTagModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  currentBranch,
  commits,
  remotes,
  initialTargetHash,
  onSuccess,
}) => {
  const [name, setName] = useState("");
  const [targetMode, setTargetMode] = useState<"head" | "specific">("head");
  const [specificHash, setSpecificHash] = useState("");
  const [showCommitPicker, setShowCommitPicker] = useState(false);
  const [commitSearch, setCommitSearch] = useState("");
  const [message, setMessage] = useState("");
  const [pushImmediately, setPushImmediately] = useState(false);
  const [selectedRemote, setSelectedRemote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const realCommits = commits.filter((c) => c.hash !== "uncommitted");

  useEffect(() => {
    if (isOpen) {
      if (initialTargetHash) {
        setTargetMode("specific");
        setSpecificHash(initialTargetHash);
      } else {
        setTargetMode("head");
        setSpecificHash("");
      }
      setSelectedRemote(remotes[0]?.name || "");
      setShowCommitPicker(false);
      setCommitSearch("");
      setError(null);
    } else {
      setName("");
      setMessage("");
      setPushImmediately(false);
      setLoading(false);
      setError(null);
    }
  }, [isOpen, initialTargetHash, remotes]);

  if (!isOpen) return null;

  const filteredCommits = realCommits.filter((c) => {
    const q = commitSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.hash.toLowerCase().includes(q) ||
      c.short_hash.toLowerCase().includes(q) ||
      c.summary.toLowerCase().includes(q) ||
      c.author_name.toLowerCase().includes(q)
    );
  });

  const matchedSpecificCommit = (() => {
    const h = specificHash.trim().toLowerCase();
    if (!h) return null;
    return (
      realCommits.find(
        (c) =>
          c.hash.toLowerCase() === h ||
          c.short_hash.toLowerCase() === h ||
          c.hash.toLowerCase().startsWith(h),
      ) || null
    );
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Tag name is required.");
      return;
    }

    const target = targetMode === "specific" ? specificHash.trim() : undefined;
    if (targetMode === "specific" && !target) {
      setError("Please enter or select a commit hash.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createTag(
        repoPath,
        trimmedName,
        target,
        message.trim() ? message.trim() : undefined,
      );

      if (pushImmediately && selectedRemote) {
        await pushTag(repoPath, selectedRemote, trimmedName);
      }

      onSuccess(trimmedName);
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
            <Tag size={16} className="text-amber-400" />
            <span>Create Tag</span>
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
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 rounded text-xs flex items-start space-x-2">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {/* Tag Name */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300 block">Tag Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder="e.g. v1.0.0"
              className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-hidden focus:border-amber-500 font-mono"
              autoFocus
            />
          </div>

          {/* Target Commit */}
          <div className="p-3 bg-[#18181b]/60 rounded border border-zinc-800 space-y-2.5">
            <span className="text-zinc-400 font-semibold text-[10px] uppercase tracking-wider block">
              Target Commit
            </span>

            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="radio"
                name="tagTarget"
                checked={targetMode === "head"}
                onChange={() => {
                  setTargetMode("head");
                  setShowCommitPicker(false);
                }}
                disabled={loading}
                className="text-amber-500 bg-zinc-900 border-zinc-700 focus:ring-0 cursor-pointer"
              />
              <span className="text-zinc-200">
                Current HEAD{" "}
                {currentBranch && (
                  <span className="font-mono text-amber-300">({currentBranch})</span>
                )}
              </span>
            </label>

            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="tagTarget"
                  checked={targetMode === "specific"}
                  onChange={() => setTargetMode("specific")}
                  disabled={loading}
                  className="text-amber-500 bg-zinc-900 border-zinc-700 focus:ring-0 cursor-pointer"
                />
                <GitCommit size={13} className="text-zinc-400" />
                <span className="text-zinc-200">Specific commit</span>
              </label>

              {targetMode === "specific" && (
                <div className="pl-5 space-y-2">
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={specificHash}
                      onChange={(e) => setSpecificHash(e.target.value)}
                      disabled={loading}
                      placeholder="Commit hash (e.g. a1b2c3d)"
                      className="flex-1 bg-[#141416] border border-zinc-700 rounded px-2 py-1 text-zinc-100 font-mono text-[11px] focus:outline-hidden focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCommitPicker((v) => !v)}
                      disabled={loading}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition cursor-pointer"
                      title="Select from commit list"
                    >
                      <List size={13} />
                    </button>
                  </div>

                  {matchedSpecificCommit && (
                    <div className="px-2.5 py-1.5 bg-[#141416] border border-zinc-800 rounded text-[11px] space-y-0.5">
                      <div className="text-zinc-200 font-medium truncate" title={matchedSpecificCommit.summary}>
                        {matchedSpecificCommit.summary}
                      </div>
                      <div className="text-[10px] text-zinc-500 flex items-center space-x-2">
                        <span className="font-mono text-amber-400/90">{matchedSpecificCommit.short_hash}</span>
                        <span>•</span>
                        <span className="truncate">{matchedSpecificCommit.author_name}</span>
                      </div>
                    </div>
                  )}

                  {showCommitPicker && (
                    <div className="bg-[#141416] border border-zinc-700 rounded-md overflow-hidden">
                      <div className="p-1.5 border-b border-zinc-800 flex items-center space-x-1.5">
                        <Search size={12} className="text-zinc-500 shrink-0" />
                        <input
                          type="text"
                          value={commitSearch}
                          onChange={(e) => setCommitSearch(e.target.value)}
                          placeholder="Search commit..."
                          className="w-full bg-transparent text-[11px] text-zinc-200 focus:outline-hidden"
                        />
                      </div>
                      <div className="max-h-36 overflow-y-auto divide-y divide-zinc-800/50">
                        {filteredCommits.length === 0 ? (
                          <div className="p-2 text-[11px] text-zinc-500 text-center">
                            No commits found
                          </div>
                        ) : (
                          filteredCommits.slice(0, 40).map((c) => (
                            <button
                              key={c.hash}
                              type="button"
                              onClick={() => {
                                setSpecificHash(c.hash);
                                setShowCommitPicker(false);
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-zinc-800/80 flex items-center space-x-2 text-[11px] cursor-pointer"
                            >
                              <span className="font-mono text-amber-400 shrink-0">
                                {c.short_hash}
                              </span>
                              <span className="truncate text-zinc-200 flex-1">
                                {c.summary}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Annotated Message */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-300 flex items-center justify-between">
              <span>Message (Optional):</span>
              <span className="text-[10px] text-zinc-500">
                {message.trim() ? "Annotated tag (-a)" : "Lightweight tag"}
              </span>
            </label>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              placeholder="Leave empty for lightweight tag, or enter annotation message..."
              className="w-full bg-[#18181b] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-hidden focus:border-amber-500 resize-none"
            />
          </div>

          {/* Push option */}
          {remotes.length > 0 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none text-zinc-300">
                <input
                  type="checkbox"
                  checked={pushImmediately}
                  onChange={(e) => setPushImmediately(e.target.checked)}
                  disabled={loading}
                  className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <span>Push tag to remote:</span>
              </label>
              {pushImmediately && (
                <select
                  value={selectedRemote}
                  onChange={(e) => setSelectedRemote(e.target.value)}
                  disabled={loading}
                  className="bg-[#18181b] border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-hidden focus:border-amber-500"
                >
                  {remotes.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Footer */}
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
              disabled={loading || !name.trim()}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900/40 disabled:text-zinc-500 text-white font-semibold transition cursor-pointer shadow"
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-white" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Tag size={14} />
                  <span>Create Tag</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
