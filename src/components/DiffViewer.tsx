import React from "react";

interface DiffViewerProps {
  diffText: string | null;
  loading?: boolean;
  filePath?: string | null;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText, loading, filePath }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
        <span>Cargando diferencias...</span>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
        <span>Selecciona un archivo modificado de la lista para ver sus cambios.</span>
      </div>
    );
  }

  if (!diffText || diffText.trim().length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
        <span>Este archivo no contiene diferencias de texto (puede ser binario o estar vacío).</span>
      </div>
    );
  }

  const lines = diffText.split("\n");

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#121214] font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#18181b] border-b border-zinc-800 text-[11px] text-zinc-400 shrink-0">
        <span className="font-medium text-zinc-200 truncate">{filePath}</span>
        <span>{lines.length} líneas</span>
      </div>

      <div className="flex-1 overflow-auto p-2 leading-5 select-text">
        {lines.map((line, idx) => {
          let lineClass = "text-zinc-300";
          let bgClass = "hover:bg-zinc-800/30";

          if (line.startsWith("@@")) {
            lineClass = "text-sky-400 font-semibold italic";
            bgClass = "bg-sky-950/30 border-y border-sky-900/40 my-1";
          } else if (line.startsWith("+") && !line.startsWith("+++")) {
            lineClass = "text-emerald-300";
            bgClass = "bg-emerald-950/40";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineClass = "text-rose-300";
            bgClass = "bg-rose-950/40";
          } else if (
            line.startsWith("diff --git") ||
            line.startsWith("index ") ||
            line.startsWith("--- ") ||
            line.startsWith("+++ ")
          ) {
            lineClass = "text-zinc-500 text-[11px]";
          }

          return (
            <div
              key={idx}
              className={`flex items-start px-2 py-0.5 rounded-sm whitespace-pre ${bgClass} ${lineClass}`}
            >
              <span className="w-8 shrink-0 text-zinc-600 text-right pr-3 select-none text-[10px]">
                {idx + 1}
              </span>
              <span className="flex-1">{line || " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
