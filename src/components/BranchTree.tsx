import React, { useState, useMemo } from "react";
import { Branch } from "../api/git";
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Cloud,
  Server,
} from "./Icons";

interface BranchTreeProps {
  branches: Branch[];
  onSelectBranch: (branch: Branch) => void;
  isRemote?: boolean;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  branch?: Branch;
  children: Map<string, TreeNode>;
}

export const BranchTree: React.FC<BranchTreeProps> = ({
  branches,
  onSelectBranch,
  isRemote = false,
}) => {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

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

    return root;
  }, [branches]);

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

            {!isCollapsed && renderTreeNode(child, depth + 1)}
          </div>
        );
      } else {
        const branch = child.branch!;
        const isCurrent = branch.is_current;

        return (
          <div
            key={branch.name}
            onClick={() => onSelectBranch(branch)}
            className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition text-xs select-none ${
              isCurrent
                ? "bg-purple-600/20 text-purple-300 font-semibold border-l-2 border-purple-400"
                : isRemote
                ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70"
                : "text-zinc-300 hover:text-white hover:bg-zinc-800/70"
            }`}
            style={{ paddingLeft: `${depth * 12 + 16}px` }}
            title={branch.name}
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
    <div className="space-y-0.5">
      {renderTreeNode(treeRoot)}
    </div>
  );
};
