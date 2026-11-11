import React, { useState } from "react";
import { RemoteInfo, addRemote, removeRemote, updateRemoteUrl, fetchRemote } from "../api/git";
import { Server, Plus, Trash2, Pencil, X, AlertCircle, RefreshCw, CheckCircle2 } from "./Icons";
import { ask } from "@tauri-apps/plugin-dialog";

interface ManageRemotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  remotes: RemoteInfo[];
  onRefresh: () => void;
}

export const ManageRemotesModal: React.FC<ManageRemotesModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  remotes,
  onRefresh,
}) => {
  // Add Remote Form State
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [fetchImmediately, setFetchImmediately] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Edit Remote URL State
  const [editingRemote, setEditingRemote] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Per-remote action loading state
  const [fetchingRemoteName, setFetchingRemoteName] = useState<string | null>(null);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    const url = newUrl.trim();

    if (!name) {
      setError("Please specify a remote name.");
      return;
    }
    if (!url) {
      setError("Please specify a remote URL.");
      return;
    }
    if (name.includes(" ") || name.includes("/")) {
      setError("Remote name cannot contain spaces or slashes.");
      return;
    }
    if (remotes.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      setError(`A remote named '${name}' already exists.`);
      return;
    }

    setIsAdding(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await addRemote(repoPath, name, url);
      if (fetchImmediately) {
        try {
          await fetchRemote(repoPath, name);
        } catch {
          // If fetch fails (e.g. empty repo or offline), remote is still added
        }
      }
      setNewName("");
      setNewUrl("");
      setSuccessMsg(`Remote '${name}' added successfully.`);
      onRefresh();
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : String(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (remote: RemoteInfo) => {
    setEditingRemote(remote.name);
    setEditingUrl(remote.url || "");
    setError(null);
    setSuccessMsg(null);
  };

  const handleSaveEdit = async (name: string) => {
    const url = editingUrl.trim();
    if (!url) {
      setError("Remote URL cannot be empty.");
      return;
    }

    setIsUpdating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await updateRemoteUrl(repoPath, name, url);
      setEditingRemote(null);
      setSuccessMsg(`Remote '${name}' URL updated successfully.`);
      onRefresh();
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveRemote = async (name: string) => {
    try {
      const confirmed = await ask(
        `Are you sure you want to remove remote '${name}'?\n\nThis will remove tracking references to this remote. Local commits and branches won't be deleted.`,
        {
          title: "Remove Remote Repository",
          kind: "warning",
          okLabel: "Remove Remote",
          cancelLabel: "Cancel",
        }
      );

      if (!confirmed) return;

      setError(null);
      setSuccessMsg(null);
      await removeRemote(repoPath, name);
      setSuccessMsg(`Remote '${name}' removed.`);
      onRefresh();
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : String(err));
    }
  };

  const handleFetchSingle = async (name: string) => {
    setFetchingRemoteName(name);
    setError(null);
    setSuccessMsg(null);

    try {
      await fetchRemote(repoPath, name);
      setSuccessMsg(`Fetched remote '${name}' successfully.`);
      onRefresh();
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : String(err));
    } finally {
      setFetchingRemoteName(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-2xl bg-[#1f1f23] border border-zinc-700/80 rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-zinc-200 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#27272b] border-b border-zinc-700/80 shrink-0">
          <div className="flex items-center space-x-2 font-semibold text-sm text-zinc-100">
            <Server size={16} className="text-sky-400" />
            <span>Manage Remote Repositories</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-700/50 transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 rounded text-xs flex items-start space-x-2">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-950/50 border border-emerald-800 text-emerald-200 rounded text-xs flex items-center space-x-2">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Configured Remotes List */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Configured Remotes ({remotes.length})
            </div>

            {remotes.length === 0 ? (
              <div className="p-4 rounded border border-dashed border-zinc-800 text-center text-zinc-500 italic">
                No remote repositories configured yet. Add one below to push, pull, or fetch.
              </div>
            ) : (
              <div className="space-y-2">
                {remotes.map((r) => {
                  const isEditing = editingRemote === r.name;
                  const isFetchingThis = fetchingRemoteName === r.name;

                  return (
                    <div
                      key={r.name}
                      className="p-3 bg-[#18181b] border border-zinc-800 rounded-md flex flex-col space-y-2 transition hover:border-zinc-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Server size={14} className="text-sky-400 shrink-0" />
                          <span className="font-bold text-zinc-100 text-sm">{r.name}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleFetchSingle(r.name)}
                            disabled={isFetchingThis}
                            className="flex items-center space-x-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer text-[11px]"
                            title={`Fetch branches from ${r.name}`}
                          >
                            <RefreshCw
                              size={12}
                              className={`text-sky-400 ${isFetchingThis ? "animate-spin" : ""}`}
                            />
                            <span>Fetch</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(r)}
                            disabled={isEditing}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                            title="Edit URL"
                          >
                            <Pencil size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveRemote(r.name)}
                            className="p-1 rounded bg-zinc-800 hover:bg-red-900/40 text-zinc-400 hover:text-red-400 transition cursor-pointer"
                            title={`Remove remote '${r.name}'`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* URL Display or Inline Edit */}
                      {isEditing ? (
                        <div className="flex items-center space-x-2 pt-1 border-t border-zinc-800/80">
                          <input
                            type="text"
                            value={editingUrl}
                            onChange={(e) => setEditingUrl(e.target.value)}
                            disabled={isUpdating}
                            placeholder="Remote URL (e.g. https://... or git@...)"
                            className="flex-1 bg-[#121214] border border-zinc-700 rounded px-2.5 py-1 text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-sky-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(r.name)}
                            disabled={isUpdating}
                            className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition cursor-pointer"
                          >
                            {isUpdating ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRemote(null)}
                            disabled={isUpdating}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="text-zinc-400 font-mono text-[11px] truncate select-all">
                          {r.url || <span className="text-zinc-600 italic">No URL configured</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Add New Remote Form */}
          <div className="pt-3 border-t border-zinc-800">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Add New Remote
            </div>

            <form
              onSubmit={handleAddRemote}
              className="p-3 bg-[#18181b] border border-zinc-800 rounded-md space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Remote Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Remote Name:</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={isAdding}
                    placeholder="e.g. origin, upstream"
                    className="w-full bg-[#121214] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-sky-500"
                  />
                </div>

                {/* Remote URL */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Remote URL:</label>
                  <input
                    type="text"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    disabled={isAdding}
                    placeholder="https://github.com/user/repo.git or git@github.com:user/repo.git"
                    className="w-full bg-[#121214] border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 font-mono text-xs focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fetchImmediately}
                    onChange={(e) => setFetchImmediately(e.target.checked)}
                    disabled={isAdding}
                    className="rounded border-zinc-700 bg-zinc-900 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Fetch branches immediately after adding</span>
                </label>

                <button
                  type="submit"
                  disabled={isAdding || !newName.trim() || !newUrl.trim()}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-sky-900/40 disabled:text-zinc-500 text-white font-semibold transition cursor-pointer shadow"
                >
                  {isAdding ? (
                    <>
                      <RefreshCw size={13} className="animate-spin text-white" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Add Remote</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-3 bg-[#242428] border-t border-zinc-700/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
