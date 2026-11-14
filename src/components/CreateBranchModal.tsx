import React, { useState, useEffect, useMemo } from "react";
import { createBranch, CommitWithGraph } from "../api/git";
import { GitBranch, X, AlertCircle, RefreshCw, GitCommit, List, Search } from "./Icons";

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  currentBranch?: string | null;
  currentCommit: CommitWithGraph | null;
  commits?: CommitWithGraph[];
  existingLocalBranches: string[];
  onSuccess: () => void;
}

export const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  currentBranch,
  currentCommit,
  commits = [],
  existingLocalBranches,
  onSuccess,
}) => {
  const [branchName, setBranchName] = useState("");
  const [baseOption, setBaseOption] = useState<"head" | "commit">("head");
  const [customCommitHash, setCustomCommitHash] = useState("");
  const [commitSummary, setCommitSummary] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkout, setCheckout] = useState(true); // Default to true as requested
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setBranchName("");
      setBaseOption("head");
      setCustomCommitHash("");
      setCommitSummary("");
      setIsPickerOpen(false);
      setSearchQuery("");
      setCheckout(true);
      setError(null);
      setLoading(false);
      return;
    }

    // Initialize commit input with currentCommit if available, or most recent commit
    if (currentCommit && currentCommit.hash !== "uncommitted") {
      setCustomCommitHash(currentCommit.short_hash);
      setCommitSummary(currentCommit.summary);
    } else if (commits.length > 0) {
      const firstValid = commits.find((c) => c.hash !== "uncommitted");
      if (firstValid) {
        setCustomCommitHash(firstValid.short_hash);
        setCommitSummary(firstValid.summary);
      }
    }
  }, [isOpen, currentCommit, commits]);

  const filteredCommits = useMemo(() => {
    const list = commits.filter((c) => c.hash !== "uncommitted");
    if (!searchQuery.trim()) return list.slice(0, 50);
    const q = searchQuery.toLowerCase().trim();
    return list
      .filter(
        (c) =>
          c.short_hash.toLowerCase().includes(q) ||
          c.hash.toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q) ||
          c.author_name.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [commits, searchQuery]);

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

    if (baseOption === "commit" && !customCommitHash.trim()) {
      setError("Please enter or select a commit hash.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const targetHash = baseOption === "commit" ? customCommitHash.trim() : undefined;
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

          {/* Base branch/commit selection */}
          <div className="bg-[#18181b] p-3 rounded border border-zinc-800 space-y-2.5">
            <span className="text-zinc-400 font-semibold text-[10px] uppercase tracking-wider block">
              Branch Base (Start point)
            </span>

            {/* Option 1: Current HEAD (active branch) */}
            <label className="flex items-center space-x-2 cursor-pointer select-none text-zinc-300">
              <input
                type="radio"
                name="baseOption"
                checked={baseOption === "head"}
                onChange={() => setBaseOption("head")}
                disabled={loading}
                className="text-purple-500 focus:ring-0 cursor-pointer"
              />
              <div className="flex items-center space-x-1.5 truncate">
                <GitBranch size={13} className="text-purple-400 shrink-0" />
                <span className="font-semibold text-zinc-200">Current HEAD:</span>
                <span className="text-purple-300 font-mono truncate">{currentBranch || "HEAD"}</span>
              </div>
            </label>

            {/* Option 2: Specific commit */}
            <div className="space-y-1.5 pt-1.5 border-t border-zinc-800/80">
              <label className="flex items-center space-x-2 cursor-pointer select-none text-zinc-300">
                <input
                  type="radio"
                  name="baseOption"
                  checked={baseOption === "commit"}
                  onChange={() => setBaseOption("commit")}
                  disabled={loading}
                  className="text-purple-500 focus:ring-0 cursor-pointer"
                />
                <div className="flex items-center space-x-1.5">
                  <GitCommit size={13} className="text-purple-400 shrink-0" />
                  <span className="font-semibold text-zinc-200">Specific commit</span>
                </div>
              </label>

              {/* Input & Picker button */}
              <div className="pl-6 space-y-1.5">
                <div className="flex items-center space-x-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={customCommitHash}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomCommitHash(val);
                        setBaseOption("commit");
                        const match = commits.find(
                          (c) => c.short_hash === val || c.hash === val || c.hash.startsWith(val)
                        );
                        setCommitSummary(match ? match.summary : "");
                      }}
                      onFocus={() => setBaseOption("commit")}
                      placeholder="Commit hash (e.g. 92c4952)..."
                      className="w-full bg-[#141416] border border-zinc-700 focus:border-purple-500 rounded px-2.5 py-1.5 text-zinc-100 font-mono text-xs outline-hidden"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setBaseOption("commit");
                      setIsPickerOpen(!isPickerOpen);
                    }}
                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded border text-xs font-medium cursor-pointer transition shrink-0 ${
                      isPickerOpen
                        ? "bg-purple-900/40 border-purple-500 text-purple-200"
                        : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200"
                    }`}
                    title="Select commit from history list"
                  >
                    <List size={13} className="text-purple-400" />
                    <span>Select...</span>
                  </button>
                </div>

                {commitSummary && (
                  <div className="text-[11px] text-zinc-400 font-mono truncate pl-1 flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                    <span className="truncate">{commitSummary}</span>
                  </div>
                )}

                {/* Commit Picker Dropdown Panel */}
                {isPickerOpen && (
                  <div className="bg-[#141416] border border-zinc-700 rounded-md p-2 mt-1 shadow-2xl space-y-2">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-2 text-zinc-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search hash, message, author..."
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded pl-8 pr-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-purple-500"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-1 font-mono text-xs pr-1">
                      {filteredCommits.length === 0 ? (
                        <div className="text-center text-zinc-500 py-3 text-[11px]">
                          No matching commits found.
                        </div>
                      ) : (
                        filteredCommits.map((c) => {
                          const isSelected =
                            c.short_hash === customCommitHash || c.hash === customCommitHash;
                          return (
                            <div
                              key={c.hash}
                              onClick={() => {
                                setCustomCommitHash(c.short_hash);
                                setCommitSummary(c.summary);
                                setIsPickerOpen(false);
                                setBaseOption("commit");
                              }}
                              className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition select-none text-[11px] ${
                                isSelected
                                  ? "bg-purple-600/25 border border-purple-500/50 text-purple-200"
                                  : "hover:bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              <div className="flex items-center space-x-2 min-w-0 mr-2">
                                <GitCommit
                                  size={12}
                                  className={isSelected ? "text-purple-400 shrink-0" : "text-zinc-500 shrink-0"}
                                />
                                <span className="text-purple-300 font-bold shrink-0">
                                  {c.short_hash}
                                </span>
                                <span className="truncate text-zinc-300">{c.summary}</span>
                              </div>
                              <span className="text-zinc-500 text-[10px] shrink-0">{c.author_name}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
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
