import React, { useState, useMemo } from "react";
import { FileChange } from "../api/git";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  List,
  TreeViewSolid,
} from "./Icons";

interface FileTreeProps {
  files: FileChange[];
  selectedFile: FileChange | null;
  onSelectFile: (file: FileChange) => void;
  loading?: boolean;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  file?: FileChange;
  children: Map<string, TreeNode>;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "A":
      return <span className="text-[9px] px-1 bg-emerald-500/20 text-emerald-400 font-bold rounded">A</span>;
    case "D":
      return <span className="text-[9px] px-1 bg-rose-500/20 text-rose-400 font-bold rounded">D</span>;
    case "R":
      return <span className="text-[9px] px-1 bg-purple-500/20 text-purple-400 font-bold rounded">R</span>;
    default:
      return <span className="text-[9px] px-1 bg-amber-500/20 text-amber-400 font-bold rounded">M</span>;
  }
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  selectedFile,
  onSelectFile,
  loading,
}) => {
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
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

  // Build tree from files
  const treeRoot = useMemo(() => {
    const root: TreeNode = {
      name: "",
      fullPath: "",
      isFolder: true,
      children: new Map(),
    };

    for (const file of files) {
      const parts = file.path.replace(/\\/g, "/").split("/");
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join("/");

        if (isLast) {
          current.children.set(part, {
            name: part,
            fullPath: file.path,
            isFolder: false,
            file,
            children: new Map(),
          });
        } else {
          if (!current.children.has(part)) {
            current.children.set(part, {
              name: part,
              fullPath: currentPath,
              isFolder: true,
              children: new Map(),
            });
          }
          current = current.children.get(part)!;
        }
      }
    }

    return root;
  }, [files]);

  function renderTreeNode(node: TreeNode, depth: number = 0): React.ReactNode {
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return sortedChildren.map((child) => {
      if (child.isFolder) {
        const isCollapsed = collapsedPaths.has(child.fullPath);
        return (
          <div key={child.fullPath}>
            <div
              onClick={() => toggleFolder(child.fullPath)}
              className="flex items-center space-x-1 px-1.5 py-0.5 hover:bg-zinc-800/60 rounded cursor-pointer text-zinc-300 text-[11px] select-none"
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
            >
              {isCollapsed ? (
                <ChevronRight size={12} className="text-zinc-500" />
              ) : (
                <ChevronDown size={12} className="text-zinc-500" />
              )}
              {isCollapsed ? (
                <Folder size={13} className="text-sky-400 shrink-0" />
              ) : (
                <FolderOpen size={13} className="text-sky-400 shrink-0" />
              )}
              <span className="font-medium text-zinc-300 truncate">{child.name}</span>
            </div>
            {!isCollapsed && renderTreeNode(child, depth + 1)}
          </div>
        );
      } else {
        const isSelected = selectedFile?.path === child.fullPath;
        return (
          <div
            key={child.fullPath}
            onClick={() => child.file && onSelectFile(child.file)}
            className={`flex items-center space-x-1.5 px-1.5 py-0.5 rounded cursor-pointer text-[11px] select-none transition ${
              isSelected
                ? "bg-blue-600/30 text-sky-200 font-medium"
                : "hover:bg-zinc-800/60 text-zinc-300"
            }`}
            style={{ paddingLeft: `${depth * 12 + 18}px` }}
          >
            {child.file && getStatusBadge(child.file.status)}
            <FileText size={12} className="text-zinc-400 shrink-0" />
            <span className="truncate flex-1 font-mono">{child.name}</span>
          </div>
        );
      }
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* Subheader with View Toggle */}
      <div className="px-3 py-1 bg-[#18181b] border-b border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
        <span className="font-medium">
          Archivos ({files.length})
        </span>
        <div className="flex items-center space-x-1">
          {loading && <span className="text-zinc-500 text-[10px] mr-2">Cargando...</span>}
          <button
            onClick={() => setViewMode("tree")}
            title="Vista de árbol jerárquico"
            className={`p-1 rounded cursor-pointer transition ${
              viewMode === "tree"
                ? "bg-zinc-700 text-sky-300"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            <TreeViewSolid size={13} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            title="Vista de lista plana"
            className={`p-1 rounded cursor-pointer transition ${
              viewMode === "list"
                ? "bg-zinc-700 text-sky-300"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            <List size={13} />
          </button>
        </div>
      </div>

      {/* Files List / Tree Content */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {files.length === 0 && !loading && (
          <div className="p-3 text-center text-zinc-500 text-[11px]">
            No hay archivos modificados en este commit.
          </div>
        )}

        {viewMode === "tree" ? (
          renderTreeNode(treeRoot)
        ) : (
          files.map((file) => {
            const isSelected = selectedFile?.path === file.path;
            return (
              <div
                key={file.path}
                onClick={() => onSelectFile(file)}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded cursor-pointer text-[11px] select-none transition ${
                  isSelected
                    ? "bg-blue-600/30 text-sky-200 font-medium"
                    : "hover:bg-zinc-800/60 text-zinc-300"
                }`}
              >
                {getStatusBadge(file.status)}
                <span className="truncate flex-1 font-mono text-[11px]">
                  {file.path}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
