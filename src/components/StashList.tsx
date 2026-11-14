import React, { useState, useEffect } from "react";
import { StashEntry } from "../api/git";
import { Archive, Play, CheckCircle2, Trash2 } from "./Icons";

interface StashListProps {
  stashes: StashEntry[];
  selectedStash: StashEntry | null;
  onSelectStash: (stash: StashEntry) => void;
  onApplyStash: (stash: StashEntry) => void;
  onPopStash: (stash: StashEntry) => void;
  onDropStash: (stash: StashEntry) => void;
}

export const StashList: React.FC<StashListProps> = ({
  stashes,
  selectedStash,
  onSelectStash,
  onApplyStash,
  onPopStash,
  onDropStash,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    stash: StashEntry;
  } | null>(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (stashes.length === 0) {
    return (
      <div className="px-3 py-2 text-[11px] text-zinc-500 italic">
        No stashes saved
      </div>
    );
  }

  return (
    <div className="space-y-0.5 select-none">
      {stashes.map((stash) => {
        const isSelected = selectedStash?.reference === stash.reference;
        return (
          <div
            key={stash.reference}
            onClick={() => onSelectStash(stash)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                stash,
              });
            }}
            className={`group flex items-center space-x-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
              isSelected
                ? "bg-orange-500/20 text-orange-200 border border-orange-500/40"
                : "text-zinc-300 hover:bg-zinc-800/80 border border-transparent"
            }`}
            title={`${stash.reference} (${stash.branch || "detached"}): ${stash.message}`}
          >
            <Archive
              size={13}
              className={
                isSelected
                  ? "text-orange-400 shrink-0"
                  : "text-orange-400/70 group-hover:text-orange-400 shrink-0"
              }
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium leading-tight">
                {stash.message || stash.reference}
              </div>
              <div className="flex items-center space-x-1.5 text-[10px] text-zinc-500 truncate">
                <span className="font-mono text-zinc-400">{stash.reference}</span>
                {stash.branch && (
                  <>
                    <span>•</span>
                    <span className="truncate">{stash.branch}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-44 bg-zinc-900 border border-zinc-700 rounded-md shadow-2xl py-1 text-xs text-zinc-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] text-zinc-500 border-b border-zinc-800 font-mono truncate">
            {contextMenu.stash.reference}
          </div>
          <button
            onClick={() => {
              const target = contextMenu.stash;
              setContextMenu(null);
              onApplyStash(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Play size={13} className="text-emerald-400" />
            <span>Apply Stash</span>
          </button>
          <button
            onClick={() => {
              const target = contextMenu.stash;
              setContextMenu(null);
              onPopStash(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <CheckCircle2 size={13} className="text-blue-400" />
            <span>Pop Stash</span>
          </button>
          <div className="my-1 border-t border-zinc-800" />
          <button
            onClick={() => {
              const target = contextMenu.stash;
              setContextMenu(null);
              onDropStash(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-950/50 text-red-400 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Trash2 size={13} className="text-red-400" />
            <span>Delete Stash...</span>
          </button>
        </div>
      )}
    </div>
  );
};
