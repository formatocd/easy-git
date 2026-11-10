import React, { useMemo } from "react";

interface DiffViewerProps {
  diffText: string | null;
  loading?: boolean;
  filePath?: string | null;
}

interface ParsedLine {
  type: "chunk" | "add" | "delete" | "context" | "comment";
  oldLine: number | null;
  newLine: number | null;
  content: string;
  lineLabel?: string;
}

function parseDiff(rawDiff: string): ParsedLine[] {
  const rawLines = rawDiff.split("\n");
  const result: ParsedLine[] = [];

  let curOldLine = 0;
  let curNewLine = 0;
  let insideHunks = false;

  const hunkRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)/;

  for (const line of rawLines) {
    const hunkMatch = line.match(hunkRegex);
    if (hunkMatch) {
      insideHunks = true;
      const oldStart = parseInt(hunkMatch[1], 10);
      const oldCount = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
      const newStart = parseInt(hunkMatch[3], 10);
      const newCount = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;

      curOldLine = oldStart;
      curNewLine = newStart;

      let startLine: number;
      let endLine: number;

      if (newCount > 0) {
        startLine = newStart;
        endLine = newStart + newCount - 1;
      } else if (oldCount > 0) {
        startLine = oldStart;
        endLine = oldStart + oldCount - 1;
      } else {
        startLine = newStart;
        endLine = newStart;
      }

      const lineLabel = `Lines ${startLine} - ${endLine}`;

      result.push({
        type: "chunk",
        oldLine: oldStart,
        newLine: newStart,
        content: line,
        lineLabel,
      });
      continue;
    }

    // Omit raw headers before the first hunk (diff --git, index, ---, +++)
    if (!insideHunks) {
      continue;
    }

    if (line.startsWith("+")) {
      result.push({
        type: "add",
        oldLine: null,
        newLine: curNewLine++,
        content: line.slice(1),
      });
    } else if (line.startsWith("-")) {
      result.push({
        type: "delete",
        oldLine: curOldLine++,
        newLine: null,
        content: line.slice(1),
      });
    } else if (line.startsWith("\\")) {
      result.push({
        type: "comment",
        oldLine: null,
        newLine: null,
        content: line,
      });
    } else {
      // Context line
      const content = line.startsWith(" ") ? line.slice(1) : line;
      result.push({
        type: "context",
        oldLine: curOldLine++,
        newLine: curNewLine++,
        content,
      });
    }
  }

  return result;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText, loading, filePath }) => {
  const parsedLines = useMemo(() => {
    if (!diffText) return [];
    return parseDiff(diffText);
  }, [diffText]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
        <span>Loading diff...</span>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
        <span>Select a modified file from the list to view its changes.</span>
      </div>
    );
  }

  if (!diffText || parsedLines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
        <span>No text differences or file is binary.</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#121214] font-mono text-[11px]">
      <div className="flex items-center justify-between px-3 py-1 bg-[#18181b] border-b border-zinc-800 text-[11px] text-zinc-400 shrink-0">
        <span className="font-medium text-zinc-200 truncate">{filePath}</span>
        <span className="text-[10px] text-zinc-500">{parsedLines.length} lines</span>
      </div>

      <div className="flex-1 overflow-auto select-text font-mono">
        {parsedLines.map((line, idx) => {
          if (line.type === "chunk") {
            return (
              <div
                key={idx}
                className="flex items-center leading-[22px] bg-[#161d2a] text-zinc-300 border-y border-sky-900/40 my-1 select-none font-mono text-[11px]"
              >
                {/* Dual Line number gutter continuation */}
                <div className="w-10 shrink-0 text-center text-zinc-600 select-none text-[10px] border-r border-zinc-800/80 bg-[#141416]/70">
                  ···
                </div>
                <div className="w-10 shrink-0 text-center text-zinc-600 select-none text-[10px] border-r border-zinc-800/80 bg-[#141416]/70">
                  ···
                </div>

                {/* Section indicator spacer */}
                <div className="w-4 shrink-0 text-center text-sky-400 font-bold text-[10px] select-none">
                  §
                </div>

                {/* Simplified Chunk Content: ONLY "Lines {startLine} - {endLine}" with no bounding box */}
                <div className="flex-1 flex items-center pl-1.5 py-0.5 overflow-hidden">
                  <span
                    className="text-sky-400 font-semibold text-[11px] select-none cursor-help"
                    title={`Original Git header:\n${line.content}`}
                  >
                    {line.lineLabel}
                  </span>
                </div>
              </div>
            );
          }

          let bgClass = "hover:bg-zinc-800/30";
          let textClass = "text-zinc-300";
          let symbol = " ";
          let symbolClass = "text-zinc-600";

          if (line.type === "add") {
            bgClass = "bg-emerald-950/35 hover:bg-emerald-950/50";
            textClass = "text-emerald-300";
            symbol = "+";
            symbolClass = "text-emerald-400 font-bold";
          } else if (line.type === "delete") {
            bgClass = "bg-rose-950/35 hover:bg-rose-950/50";
            textClass = "text-rose-300";
            symbol = "-";
            symbolClass = "text-rose-400 font-bold";
          } else if (line.type === "comment") {
            bgClass = "bg-zinc-900/40";
            textClass = "text-zinc-500 italic";
          }

          return (
            <div
              key={idx}
              className={`flex items-start leading-[17px] ${bgClass} ${textClass}`}
            >
              {/* Dual Line Numbers (Old vs New) */}
              <div className="w-10 shrink-0 text-right pr-2 text-zinc-600 select-none text-[10px] border-r border-zinc-800/80 bg-[#141416]/50">
                {line.oldLine ?? ""}
              </div>
              <div className="w-10 shrink-0 text-right pr-2 text-zinc-600 select-none text-[10px] border-r border-zinc-800/80 bg-[#141416]/50">
                {line.newLine ?? ""}
              </div>

              {/* Indicator (+ / - / ' ') */}
              <div className={`w-4 shrink-0 text-center select-none text-[11px] ${symbolClass}`}>
                {symbol}
              </div>

              {/* Line Code Content */}
              <div className="flex-1 whitespace-pre pl-1 overflow-x-visible">
                {line.content || " "}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
