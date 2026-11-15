import React, { useEffect } from "react";
import { RefreshCw, CheckCircle2, X } from "./Icons";

export interface OperationModalState {
  status: "running" | "success";
  title: string;
  message: string;
  output?: string;
}

interface OperationModalProps {
  state: OperationModalState | null;
  onClose: () => void;
}

export const OperationModal: React.FC<OperationModalProps> = ({
  state,
  onClose,
}) => {
  useEffect(() => {
    if (!state || state.status !== "success") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, onClose]);

  if (!state) return null;

  const isRunning = state.status === "running";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div
        className={`w-full max-w-md bg-[#1f1f23] rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-zinc-200 border ${
          isRunning ? "border-sky-700/70" : "border-emerald-700/70"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b ${
            isRunning
              ? "bg-[#1e242b] border-sky-900/50"
              : "bg-[#1d2823] border-emerald-900/50"
          }`}
        >
          <div
            className={`flex items-center space-x-2 font-semibold text-sm ${
              isRunning ? "text-sky-300" : "text-emerald-300"
            }`}
          >
            {isRunning ? (
              <RefreshCw size={16} className="text-sky-400 animate-spin shrink-0" />
            ) : (
              <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
            )}
            <span>{state.title}</span>
          </div>

          {!isRunning && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-700/50 transition cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-zinc-200 leading-relaxed text-xs">
            {state.message}
          </p>

          {!isRunning && state.output && state.output.trim() && (
            <div className="bg-[#141416] border border-zinc-800 rounded p-3 text-zinc-300 text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto select-text shadow-inner">
              {state.output.trim()}
            </div>
          )}
        </div>

        {/* Footer (only when completed with important output) */}
        {!isRunning && (
          <div className="flex items-center justify-end px-4 py-2.5 bg-[#1c2220] border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-semibold text-xs transition cursor-pointer shadow"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
