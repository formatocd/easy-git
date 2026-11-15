import React, { useState, useEffect } from "react";
import { TagInfo, RemoteInfo, checkRemoteTag } from "../api/git";
import { AlertTriangle, X, RefreshCw, Trash2 } from "./Icons";

interface DeleteTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  tag: TagInfo | null;
  remotes: RemoteInfo[];
  onConfirm: (tag: TagInfo, remotesToDelete: string[]) => Promise<void>;
}

export const DeleteTagModal: React.FC<DeleteTagModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  tag,
  remotes,
  onConfirm,
}) => {
  const [checkingRemotes, setCheckingRemotes] = useState(false);
  const [remotesWithTag, setRemotesWithTag] = useState<string[]>([]);
  const [selectedRemotes, setSelectedRemotes] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);

  const remotesKey = remotes.map((r) => r.name).join(",");

  useEffect(() => {
    if (!isOpen || !tag || !repoPath) {
      setRemotesWithTag([]);
      setSelectedRemotes({});
      setCheckingRemotes(false);
      setDeleting(false);
      return;
    }

    if (remotes.length === 0) {
      setRemotesWithTag([]);
      return;
    }

    let isCancelled = false;
    setCheckingRemotes(true);

    Promise.all(
      remotes.map(async (r) => {
        try {
          const exists = await checkRemoteTag(repoPath, r.name, tag.name);
          return exists ? r.name : null;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (isCancelled) return;
      const found = results.filter((r): r is string => r !== null);
      setRemotesWithTag(found);
      const initial: Record<string, boolean> = {};
      for (const r of found) {
        initial[r] = false;
      }
      setSelectedRemotes(initial);
      setCheckingRemotes(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, tag?.name, repoPath, remotesKey]);

  if (!isOpen || !tag) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      const remotesToDelete = Object.entries(selectedRemotes)
        .filter(([, checked]) => checked)
        .map(([name]) => name);
      await onConfirm(tag, remotesToDelete);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-md bg-[#1f1f23] border border-red-900/70 rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#281f22] border-b border-red-900/50">
          <div className="flex items-center space-x-2 font-semibold text-sm text-red-300">
            <AlertTriangle size={17} className="text-red-400 shrink-0" />
            <span>Delete Tag</span>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-700/50 transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-zinc-200 leading-relaxed text-xs">
            Are you sure you want to delete local tag{" "}
            <strong className="text-amber-300 font-mono">'{tag.name}'</strong>?
          </p>

          {checkingRemotes && (
            <div className="flex items-center space-x-2 text-[11px] text-zinc-400 p-2.5 bg-[#18181b] border border-zinc-800 rounded-md">
              <RefreshCw size={12} className="animate-spin text-zinc-400 shrink-0" />
              <span>Checking remote repositories for this tag...</span>
            </div>
          )}

          {!checkingRemotes && remotesWithTag.length > 0 && (
            <div className="p-3 bg-[#18181b] border border-zinc-800 rounded-md space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Remote Repositories
              </span>
              {remotesWithTag.map((remoteName) => (
                <label
                  key={remoteName}
                  className="flex items-start space-x-2.5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={!!selectedRemotes[remoteName]}
                    onChange={(e) =>
                      setSelectedRemotes((prev) => ({
                        ...prev,
                        [remoteName]: e.target.checked,
                      }))
                    }
                    disabled={deleting}
                    className="rounded border-zinc-700 bg-zinc-900 text-red-500 focus:ring-0 cursor-pointer mt-0.5"
                  />
                  <div className="text-[11px] leading-tight space-y-0.5">
                    <span className="font-semibold text-zinc-100 block">
                      Also delete tag from remote{" "}
                      <span className="font-mono text-sky-300">'{remoteName}'</span>
                    </span>
                    <span className="text-zinc-400 text-[10px] block">
                      This tag exists on {remoteName} and will be removed remotely as well.
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 bg-[#242428] border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-3.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer font-medium text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting || checkingRemotes}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-red-700 hover:bg-red-600 disabled:bg-red-900/40 disabled:text-zinc-500 text-white font-semibold text-xs transition cursor-pointer shadow"
          >
            {deleting ? (
              <>
                <RefreshCw size={13} className="animate-spin text-white" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={13} />
                <span>Delete Tag</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
