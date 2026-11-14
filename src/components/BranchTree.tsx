import React, { useState, useMemo, useEffect } from "react";
import { Branch } from "../api/git";
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitPullRequest,
  Cloud,
  Server,
  Trash2,
} from "./Icons";

interface BranchTreeProps {
  branches: Branch[];
  currentBranch?: string | null;
  onSelectBranch: (branch: Branch) => void;
  onCheckoutBranch?: (branch: Branch) => void;
  onCheckoutRemoteBranch?: (branch: Branch) => void;
  onDeleteBranch?: (branch: Branch) => void;
  onDeleteRemoteBranch?: (branch: Branch) => void;
  onMergeBranch?: (branch: Branch) => void;
  isRemote?: boolean;
  configuredRemotes?: string[];
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  branch?: Branch;
  children: Map<string, TreeNode>;
}

interface ContextMenuState {
  x: number;
  y: number;
  branch: Branch;
}

export const BranchTree: React.FC<BranchTreeProps> = ({
  branches,
  currentBranch,
  onSelectBranch,
  onCheckoutBranch,
  onCheckoutRemoteBranch,
  onDeleteBranch,
  onDeleteRemoteBranch,
  onMergeBranch,
  isRemote = false,
  configuredRemotes,
}) => {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Close context menu on outside click or scroll
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener("click", handleClose);
    window.addEventListener("contextmenu", handleClose);
    window.addEventListener("scroll", handleClose, true);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("contextmenu", handleClose);
      window.removeEventListener("scroll", handleClose, true);
    };
  }, []);

  // Build hierarchical tree from branch names containing '/'
  const treeRoot = useMemo(() => {
    const root: TreeNode = {
      name: "",
      fullPath: "",
      isFolder: true,
      children: new Map(),
    };

    for (const branch of branches) {
      const parts = branch.name.split("/");
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join("/");

        if (isLast) {
          const existing = current.children.get(part);
          if (existing) {
            existing.branch = branch;
          } else {
            current.children.set(part, {
              name: part,
              fullPath: branch.name,
              isFolder: false,
              branch,
              children: new Map(),
            });
          }
        } else {
          if (!current.children.has(part)) {
            current.children.set(part, {
              name: part,
              fullPath: currentPath,
              isFolder: true,
              children: new Map(),
            });
          } else {
            current.children.get(part)!.isFolder = true;
          }
          current = current.children.get(part)!;
        }
      }
    }

    // If configured remotes exist, ensure each configured remote is present as a root folder
    if (isRemote && configuredRemotes) {
      for (const remName of configuredRemotes) {
        if (!root.children.has(remName)) {
          root.children.set(remName, {
            name: remName,
            fullPath: remName,
            isFolder: true,
            children: new Map(),
          });
        }
      }
    }

    return root;
  }, [branches, isRemote, configuredRemotes]);

  function countBranchesUnder(node: TreeNode): number {
    if (!node.isFolder) return 1;
    let count = 0;
    for (const child of node.children.values()) {
      count += countBranchesUnder(child);
    }
    return count;
  }

  function hasCurrentBranch(node: TreeNode): boolean {
    if (!node.isFolder) return !!node.branch?.is_current;
    for (const child of node.children.values()) {
      if (hasCurrentBranch(child)) return true;
    }
    return false;
  }

  const toggleFolder = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  function renderTreeNode(node: TreeNode, depth: number = 0): React.ReactNode {
    const sorted = Array.from(node.children.values()).sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

    return sorted.map((child) => {
      if (child.isFolder) {
        const isCollapsed = collapsedPaths.has(child.fullPath);
        const totalCount = countBranchesUnder(child);
        const containsHead = hasCurrentBranch(child);

        return (
          <div key={child.fullPath}>
            <div
              onClick={(e) => toggleFolder(child.fullPath, e)}
              className="flex items-center space-x-1 px-1.5 py-1 hover:bg-zinc-800/60 rounded cursor-pointer text-zinc-400 hover:text-zinc-200 text-xs select-none transition"
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
            >
              {isCollapsed ? (
                <ChevronRight size={12} className="text-zinc-500 shrink-0" />
              ) : (
                <ChevronDown size={12} className="text-zinc-500 shrink-0" />
              )}
              {isRemote && depth === 0 ? (
                <Server size={13} className="text-sky-400 shrink-0" />
              ) : isCollapsed ? (
                <Folder size={13} className="text-amber-400/80 shrink-0" />
              ) : (
                <FolderOpen size={13} className="text-amber-400/80 shrink-0" />
              )}
              <span className="font-medium text-zinc-300 truncate text-[11px]">{child.name}</span>
              <span className="text-[10px] text-zinc-500">({totalCount})</span>
              {containsHead && isCollapsed && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 ml-auto mr-1"
                  title="Contains HEAD branch"
                />
              )}
            </div>

            {!isCollapsed && child.children.size > 0 && renderTreeNode(child, depth + 1)}
            {!isCollapsed && child.children.size === 0 && (
              <div
                className="text-zinc-500 italic text-[10px] py-0.5 select-none"
                style={{ paddingLeft: `${(depth + 1) * 12 + 16}px` }}
              >
                No branches fetched
              </div>
            )}
          </div>
        );
      } else {
        const branch = child.branch!;
        const isCurrent = branch.is_current;

        return (
          <div
            key={branch.name}
            onClick={() => onSelectBranch(branch)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (isRemote) {
                onCheckoutRemoteBranch?.(branch);
              } else {
                if (!isCurrent) {
                  onCheckoutBranch?.(branch);
                }
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const menuWidth = 220;
              const menuHeight = 110;
              const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
              const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
              setContextMenu({ x, y, branch });
            }}
            className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition text-xs select-none ${
              isCurrent
                ? "bg-purple-600/20 text-purple-300 font-semibold border-l-2 border-purple-400"
                : isRemote
                ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70"
                : "text-zinc-300 hover:text-white hover:bg-zinc-800/70"
            }`}
            style={{ paddingLeft: `${depth * 12 + 16}px` }}
            title={
              isRemote
                ? `Double-click to checkout remote branch '${branch.name}'`
                : isCurrent
                ? `Current active branch: ${branch.name}`
                : `Double-click to checkout '${branch.name}'`
            }
          >
            <div className="flex items-center space-x-1.5 truncate">
              {isRemote ? (
                <Cloud size={12} className="text-sky-400/80 shrink-0" />
              ) : (
                <GitBranch
                  size={12}
                  className={isCurrent ? "text-purple-400 shrink-0" : "text-zinc-500 shrink-0"}
                />
              )}
              <span className="truncate text-[11px]">{child.name}</span>
            </div>

            {isCurrent && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold shrink-0 border border-purple-500/40 ml-1">
                HEAD
              </span>
            )}
          </div>
        );
      }
    });
  }

  return (
    <div className="space-y-0.5 relative">
      {renderTreeNode(treeRoot)}

      {/* Floating Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[200px] max-w-[280px] bg-[#222226] border border-zinc-700/80 rounded-md shadow-2xl py-1 text-xs text-zinc-200"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 font-semibold text-[10px] text-zinc-400 border-b border-zinc-800 truncate">
            {contextMenu.branch.name}
          </div>

          {isRemote ? (
            <>
              {/* Remote branch menu */}
              <button
                onClick={() => {
                  const target = contextMenu.branch;
                  setContextMenu(null);
                  onCheckoutRemoteBranch?.(target);
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 text-left text-zinc-200 hover:bg-sky-600/20 hover:text-sky-300 transition cursor-pointer"
              >
                <GitBranch size={13} className="text-sky-400 shrink-0" />
                <span>Checkout...</span>
              </button>

              <button
                onClick={() => {
                  const target = contextMenu.branch;
                  setContextMenu(null);
                  onMergeBranch?.(target);
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 text-left text-zinc-200 hover:bg-pink-600/20 hover:text-pink-300 transition cursor-pointer"
              >
                <GitPullRequest size={13} className="text-pink-400 shrink-0" />
                <span className="truncate">Merge &apos;{contextMenu.branch.name}&apos; into {currentBranch || "HEAD"}...</span>
              </button>

              <div className="my-1 border-t border-zinc-800" />

              <button
                onClick={() => {
                  const target = contextMenu.branch;
                  setContextMenu(null);
                  onDeleteRemoteBranch?.(target);
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 text-left text-red-400 hover:bg-red-950/40 hover:text-red-300 transition cursor-pointer"
              >
                <Trash2 size={13} className="text-red-400 shrink-0" />
                <span>Delete on remote...</span>
              </button>
            </>
          ) : (
            <>
              {/* Local branch menu */}
              <button
                disabled={contextMenu.branch.is_current}
                onClick={() => {
                  if (!contextMenu.branch.is_current) {
                    const target = contextMenu.branch;
                    setContextMenu(null);
                    onCheckoutBranch?.(target);
                  }
                }}
                className={`w-full flex items-center space-x-2 px-3 py-1.5 text-left transition ${
                  contextMenu.branch.is_current
                    ? "text-zinc-500 cursor-not-allowed opacity-50"
                    : "text-zinc-200 hover:bg-purple-600/20 hover:text-purple-300 cursor-pointer"
                }`}
                title={contextMenu.branch.is_current ? "Already the current branch" : undefined}
              >
                <GitBranch
                  size={13}
                  className={contextMenu.branch.is_current ? "text-zinc-500 shrink-0" : "text-purple-400 shrink-0"}
                />
                <span className="truncate">
                  {contextMenu.branch.is_current
                    ? "Current active branch"
                    : `Checkout '${contextMenu.branch.name}'`}
                </span>
              </button>

              {!contextMenu.branch.is_current && (
                <button
                  onClick={() => {
                    const target = contextMenu.branch;
                    setContextMenu(null);
                    onMergeBranch?.(target);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-1.5 text-left text-zinc-200 hover:bg-pink-600/20 hover:text-pink-300 transition cursor-pointer"
                >
                  <GitPullRequest size={13} className="text-pink-400 shrink-0" />
                  <span className="truncate">Merge into {currentBranch || "HEAD"}...</span>
                </button>
              )}

              <div className="my-1 border-t border-zinc-800" />

              <button
                disabled={contextMenu.branch.is_current}
                onClick={() => {
                  if (!contextMenu.branch.is_current) {
                    const target = contextMenu.branch;
                    setContextMenu(null);
                    onDeleteBranch?.(target);
                  }
                }}
                className={`w-full flex items-center space-x-2 px-3 py-1.5 text-left transition ${
                  contextMenu.branch.is_current
                    ? "text-zinc-500 cursor-not-allowed opacity-50"
                    : "text-red-400 hover:bg-red-950/40 hover:text-red-300 cursor-pointer"
                }`}
                title={contextMenu.branch.is_current ? "Cannot delete active branch" : undefined}
              >
                <Trash2
                  size={13}
                  className={contextMenu.branch.is_current ? "text-zinc-500 shrink-0" : "text-red-400 shrink-0"}
                />
                <span className="truncate">Delete &apos;{contextMenu.branch.name}&apos;</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
