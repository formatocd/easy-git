import React, { useEffect } from "react";
import { AlertCircle, X } from "./Icons";

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  onClose,
  title = "Error",
  message,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-md bg-[#1f1f23] border border-rose-900/70 rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#281f22] border-b border-rose-900/50">
          <div className="flex items-center space-x-2 font-semibold text-sm text-rose-300">
            <AlertCircle size={17} className="text-rose-400 shrink-0" />
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-700/50 transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="bg-[#141416] border border-rose-950 rounded p-3 text-rose-200/90 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto select-text shadow-inner">
            {message}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-2.5 bg-[#251f22] border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="px-4 py-1.5 rounded bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white font-semibold text-xs transition cursor-pointer shadow"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
