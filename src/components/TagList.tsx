import React, { useState, useEffect } from "react";
import { TagInfo, RemoteInfo } from "../api/git";
import { Tag, ArrowUp, Trash2, GitCommit } from "./Icons";

interface TagListProps {
  tags: TagInfo[];
  remotes: RemoteInfo[];
  selectedTagName?: string | null;
  onSelectTag: (tag: TagInfo) => void;
  onPushTag: (tag: TagInfo, remote: string) => void;
  onDeleteTag: (tag: TagInfo) => void;
  onDeleteRemoteTag: (tag: TagInfo, remote: string) => void;
}

export const TagList: React.FC<TagListProps> = ({
  tags,
  remotes,
  selectedTagName,
  onSelectTag,
  onPushTag,
  onDeleteTag,
  onDeleteRemoteTag,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tag: TagInfo;
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

  if (tags.length === 0) {
    return (
      <div className="px-3 py-1.5 text-[11px] text-zinc-500 italic">
        No tags yet
      </div>
    );
  }

  return (
    <div className="space-y-0.5 select-none">
      {tags.map((tag) => {
        const isSelected = selectedTagName === tag.name;
        const shortHash = tag.target_hash ? tag.target_hash.slice(0, 7) : "";
        return (
          <div
            key={tag.name}
            onClick={() => onSelectTag(tag)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const menuWidth = 210;
              const menuHeight = 160;
              const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
              const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
              setContextMenu({ x, y, tag });
            }}
            className={`group flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
              isSelected
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                : "text-zinc-300 hover:bg-zinc-800/80 border border-transparent"
            }`}
            title={
              tag.is_annotated && tag.message
                ? `${tag.name} (${shortHash}): ${tag.message}`
                : `${tag.name} (${shortHash})`
            }
          >
            <div className="flex items-center space-x-1.5 min-w-0 flex-1">
              <Tag
                size={12}
                className={
                  isSelected
                    ? "text-amber-400 shrink-0"
                    : "text-amber-400/75 group-hover:text-amber-400 shrink-0"
                }
              />
              <span className="truncate font-medium">{tag.name}</span>
            </div>
            {shortHash && (
              <span className="font-mono text-[10px] text-zinc-500 ml-2 shrink-0">
                {shortHash}
              </span>
            )}
          </div>
        );
      })}

      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-52 bg-zinc-900 border border-zinc-700 rounded-md shadow-2xl py-1 text-xs text-zinc-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] text-zinc-500 border-b border-zinc-800 font-mono truncate flex items-center justify-between">
            <span className="truncate">{contextMenu.tag.name}</span>
            {contextMenu.tag.is_annotated && (
              <span className="text-amber-400/80 ml-1 shrink-0">annotated</span>
            )}
          </div>

          <button
            onClick={() => {
              const target = contextMenu.tag;
              setContextMenu(null);
              onSelectTag(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <GitCommit size={13} className="text-sky-400" />
            <span>Jump to Commit</span>
          </button>

          {remotes.map((r) => (
            <button
              key={`push-${r.name}`}
              onClick={() => {
                const target = contextMenu.tag;
                setContextMenu(null);
                onPushTag(target, r.name);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer transition-colors"
            >
              <ArrowUp size={13} className="text-emerald-400" />
              <span className="truncate">Push to '{r.name}'</span>
            </button>
          ))}

          <div className="my-1 border-t border-zinc-800" />

          <button
            onClick={() => {
              const target = contextMenu.tag;
              setContextMenu(null);
              onDeleteTag(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-950/50 text-red-400 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Trash2 size={13} className="text-red-400" />
            <span>Delete Local Tag...</span>
          </button>

          {remotes.map((r) => (
            <button
              key={`del-${r.name}`}
              onClick={() => {
                const target = contextMenu.tag;
                setContextMenu(null);
                onDeleteRemoteTag(target, r.name);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-red-950/50 text-red-400 flex items-center space-x-2 cursor-pointer transition-colors"
            >
              <Trash2 size={13} className="text-red-400/80" />
              <span className="truncate">Delete on '{r.name}'...</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
