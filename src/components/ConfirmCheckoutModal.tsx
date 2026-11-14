import React, { useState, useEffect } from "react";
import { AlertTriangle, X } from "./Icons";

interface ConfirmCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBranchName: string;
  onConfirm: (discardChanges: boolean) => void;
}

export const ConfirmCheckoutModal: React.FC<ConfirmCheckoutModalProps> = ({
  isOpen,
  onClose,
  targetBranchName,
  onConfirm,
}) => {
  const [discardChanges, setDiscardChanges] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDiscardChanges(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAccept = () => {
    onConfirm(discardChanges);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-md bg-[#1f1f23] border border-amber-700/80 rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#272522] border-b border-amber-700/60">
          <div className="flex items-center space-x-2 font-semibold text-sm text-amber-200">
            <AlertTriangle size={17} className="text-amber-400 shrink-0" />
            <span>Switch Branch with Uncommitted Changes</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-700/50 transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-zinc-200 leading-relaxed text-xs">
            You have uncommitted changes in your working tree. Are you sure you want to switch to branch{" "}
            <strong className="text-purple-300 font-mono">'{targetBranchName}'</strong>?
          </p>

          {/* Checkbox to discard uncommitted changes */}
          <div className="p-3 bg-[#18181b] border border-zinc-800 rounded-md">
            <label className="flex items-start space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={discardChanges}
                onChange={(e) => setDiscardChanges(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0 cursor-pointer mt-0.5"
              />
              <div className="text-[11px] leading-tight space-y-1">
                <span className="font-semibold text-zinc-100 block">
                  Discard all uncommitted changes before switching
                </span>
                <span className="text-zinc-400 text-[10px] block leading-normal">
                  Permanently discards all uncommitted modifications (hard reset to HEAD and clean untracked files).
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 bg-[#242428] border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer font-medium text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition cursor-pointer shadow"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
