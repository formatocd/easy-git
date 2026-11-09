import React, { useState, useMemo, useCallback } from "react";
import { WorkingFile } from "../api/git";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  List,
  TreeViewSolid,
  Plus,
  Minus,
  Trash2,
} from "./Icons";

interface WorkingFilesSectionProps {
  title: string;
  colorDotClass: string;
  files: WorkingFile[];
  isStaged: boolean;
  selectedFile: WorkingFile | null;
  onSelectFile: (file: WorkingFile) => void;
  onStageSingle?: (file: WorkingFile, e: React.MouseEvent) => void;
  onUnstageSingle?: (file: WorkingFile, e: React.MouseEvent) => void;
  onDiscardSingle?: (file: WorkingFile, e: React.MouseEvent) => void;
  onBatchAction: (paths: string[]) => void;
  batchActionLabel: string;
  onAllAction: () => void;
  allActionLabel: string;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  file?: WorkingFile;
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
    case "?":
      return <span className="text-[9px] px-1 bg-zinc-500/20 text-zinc-400 font-bold rounded">?</span>;
    default:
      return <span className="text-[9px] px-1 bg-amber-500/20 text-amber-400 font-bold rounded">M</span>;
  }
}

export const WorkingFilesSection: React.FC<WorkingFilesSectionProps> = ({
  title,
  colorDotClass,
  files,
  isStaged,
  selectedFile,
  onSelectFile,
  onStageSingle,
  onUnstageSingle,
  onDiscardSingle,
  onBatchAction,
  batchActionLabel,
  onAllAction,
  allActionLabel,
}) => {
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  // Multi-selection state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastClickedPath, setLastClickedPath] = useState<string | null>(null);

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

  // Order of files on screen (for Shift+click range selection in both tree & list)
  const orderedFiles = useMemo(() => {
    if (viewMode === "list") {
      return [...files].sort((a, b) => a.path.localeCompare(b.path));
    }

    const list: WorkingFile[] = [];
    function traverse(node: TreeNode) {
      const sorted = Array.from(node.children.values()).sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const child of sorted) {
        if (child.isFolder) {
          traverse(child);
        } else if (child.file) {
          list.push(child.file);
        }
      }
    }
    traverse(treeRoot);
    return list;
  }, [files, viewMode, treeRoot]);

  // Collect all files under a tree node
  function getFilesUnderNode(node: TreeNode): WorkingFile[] {
    const result: WorkingFile[] = [];
    function collect(n: TreeNode) {
      if (!n.isFolder && n.file) {
        result.push(n.file);
      } else {
        for (const child of n.children.values()) {
          collect(child);
        }
      }
    }
    collect(node);
    return result;
  }

  // Row selection handler: Normal click, Ctrl+click, Shift+click
  const handleRowClick = useCallback(
    (file: WorkingFile, e: React.MouseEvent) => {
      onSelectFile(file);

      if (e.ctrlKey || e.metaKey) {
        // Toggle individual file
        setSelectedPaths((prev) => {
          const next = new Set(prev);
          if (next.has(file.path)) {
            next.delete(file.path);
          } else {
            next.add(file.path);
          }
          return next;
        });
        setLastClickedPath(file.path);
      } else if (e.shiftKey && lastClickedPath) {
        // Range selection between lastClickedPath and current file
        const lastIdx = orderedFiles.findIndex((f) => f.path === lastClickedPath);
        const currIdx = orderedFiles.findIndex((f) => f.path === file.path);

        if (lastIdx !== -1 && currIdx !== -1) {
          const start = Math.min(lastIdx, currIdx);
          const end = Math.max(lastIdx, currIdx);
          const rangePaths = orderedFiles.slice(start, end + 1).map((f) => f.path);

          setSelectedPaths((prev) => {
            const next = new Set(prev);
            for (const p of rangePaths) {
              next.add(p);
            }
            return next;
          });
        }
      } else {
        // Regular single click selects only this file
        setSelectedPaths(new Set([file.path]));
        setLastClickedPath(file.path);
      }
    },
    [lastClickedPath, orderedFiles, onSelectFile]
  );

  // Checkbox toggle
  const handleCheckboxToggle = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    setLastClickedPath(path);
  };

  // Folder checkbox toggle (selects / deselects all files in folder)
  const handleFolderCheckboxToggle = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const folderFiles = getFilesUnderNode(node);
    const allSelected = folderFiles.every((f) => selectedPaths.has(f.path));

    setSelectedPaths((prev) => {
      const next = new Set(prev);
      for (const f of folderFiles) {
        if (allSelected) {
          next.delete(f.path);
        } else {
          next.add(f.path);
        }
      }
      return next;
    });
  };

  // Master header checkbox
  const handleMasterCheckboxToggle = () => {
    if (selectedPaths.size === files.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(files.map((f) => f.path)));
    }
  };

  const toggleFolder = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Spacebar triggers batch action
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " && selectedPaths.size > 0) {
      e.preventDefault();
      onBatchAction(Array.from(selectedPaths));
      setSelectedPaths(new Set());
    }
  };

  // Render tree node recursively
  function renderTreeNode(node: TreeNode, depth: number = 0): React.ReactNode {
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return sortedChildren.map((child) => {
      if (child.isFolder) {
        const isCollapsed = collapsedPaths.has(child.fullPath);
        const folderFiles = getFilesUnderNode(child);
        const selectedCount = folderFiles.filter((f) => selectedPaths.has(f.path)).length;
        const isAllSelected = folderFiles.length > 0 && selectedCount === folderFiles.length;
        const isIndeterminate = selectedCount > 0 && selectedCount < folderFiles.length;

        return (
          <div key={child.fullPath}>
            <div
              onClick={() => toggleFolder(child.fullPath)}
              className="group flex items-center justify-between px-1.5 py-0.5 hover:bg-zinc-800/60 rounded cursor-pointer text-zinc-300 text-[11px] select-none"
              style={{ paddingLeft: `${depth * 14 + 6}px` }}
            >
              <div className="flex items-center space-x-1.5 truncate flex-1">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onClick={(e) => handleFolderCheckboxToggle(child, e)}
                  onChange={() => {}}
                  className="rounded bg-zinc-800 border-zinc-700 text-sky-500 cursor-pointer"
                />

                {isCollapsed ? (
                  <ChevronRight size={12} className="text-zinc-500 shrink-0" />
                ) : (
                  <ChevronDown size={12} className="text-zinc-500 shrink-0" />
                )}
                {isCollapsed ? (
                  <Folder size={13} className="text-sky-400 shrink-0" />
                ) : (
                  <FolderOpen size={13} className="text-sky-400 shrink-0" />
                )}
                <span className="font-semibold text-zinc-300 truncate">{child.name}</span>
                <span className="text-[10px] text-zinc-500">({folderFiles.length})</span>
              </div>

              {/* Quick Folder Action (+ / -) */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 pr-1">
                {isStaged ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onBatchAction(folderFiles.map((f) => f.path));
                    }}
                    title="Despreparar carpeta completa"
                    className="p-0.5 rounded text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                  >
                    <Minus size={11} />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onBatchAction(folderFiles.map((f) => f.path));
                    }}
                    title="Preparar carpeta completa"
                    className="p-0.5 rounded text-zinc-400 hover:text-emerald-300 hover:bg-emerald-950/40 cursor-pointer"
                  >
                    <Plus size={11} />
                  </button>
                )}
              </div>
            </div>

            {!isCollapsed && renderTreeNode(child, depth + 1)}
          </div>
        );
      } else {
        if (!child.file) return null;
        const file = child.file;
        const isCurrentActive = selectedFile?.path === file.path && selectedFile?.is_staged === isStaged;
        const isChecked = selectedPaths.has(file.path);

        return (
          <div
            key={child.fullPath}
            onClick={(e) => handleRowClick(file, e)}
            className={`group flex items-center justify-between px-1.5 py-0.5 rounded cursor-pointer text-[11px] select-none transition ${
              isChecked
                ? "bg-blue-600/35 text-sky-100 font-medium"
                : isCurrentActive
                ? "bg-zinc-800/80 text-zinc-100 font-medium"
                : "hover:bg-zinc-800/60 text-zinc-300"
            }`}
            style={{ paddingLeft: `${depth * 14 + 18}px` }}
          >
            <div className="flex items-center space-x-1.5 truncate flex-1 mr-2">
              <input
                type="checkbox"
                checked={isChecked}
                onClick={(e) => handleCheckboxToggle(file.path, e)}
                onChange={() => {}}
                className="rounded bg-zinc-800 border-zinc-700 text-sky-500 cursor-pointer"
              />
              {getStatusBadge(file.status)}
              <FileText size={12} className="text-zinc-400 shrink-0" />
              <span className="truncate font-mono">{child.name}</span>
            </div>

            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
              {onDiscardSingle && (
                <button
                  onClick={(e) => onDiscardSingle(file, e)}
                  title="Descartar cambios"
                  className="p-0.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              )}
              {isStaged && onUnstageSingle && (
                <button
                  onClick={(e) => onUnstageSingle(file, e)}
                  title="Despreparar archivo"
                  className="p-0.5 rounded text-zinc-500 hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                >
                  <Minus size={11} />
                </button>
              )}
              {!isStaged && onStageSingle && (
                <button
                  onClick={(e) => onStageSingle(file, e)}
                  title="Preparar archivo (Stage)"
                  className="p-0.5 rounded text-zinc-500 hover:text-emerald-300 hover:bg-emerald-950/40 cursor-pointer"
                >
                  <Plus size={11} />
                </button>
              )}
            </div>
          </div>
        );
      }
    });
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex-1 flex flex-col border-b border-zinc-800 overflow-hidden outline-none"
    >
      {/* Header with Title, Mode Toggle & Action Buttons */}
      <div className="px-3 py-1.5 bg-[#202024] border-b border-zinc-800/80 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center space-x-2">
          {files.length > 0 && (
            <input
              type="checkbox"
              checked={selectedPaths.size > 0 && selectedPaths.size === files.length}
              onChange={handleMasterCheckboxToggle}
              title="Seleccionar/Deseleccionar todos"
              className="rounded bg-zinc-800 border-zinc-700 text-sky-500 cursor-pointer"
            />
          )}
          <span className="font-semibold text-zinc-300 flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${colorDotClass}`} />
            <span>
              {title} ({files.length})
            </span>
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Tree / List view toggle */}
          <div className="flex items-center bg-zinc-800/80 rounded p-0.5 border border-zinc-700/50 mr-1">
            <button
              onClick={() => setViewMode("tree")}
              title="Vista de árbol jerárquico"
              className={`p-0.5 rounded cursor-pointer transition ${
                viewMode === "tree" ? "bg-zinc-700 text-sky-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <TreeViewSolid size={12} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="Vista de lista plana"
              className={`p-0.5 rounded cursor-pointer transition ${
                viewMode === "list" ? "bg-zinc-700 text-sky-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <List size={12} />
            </button>
          </div>

          {/* Batch Action Button */}
          {selectedPaths.size > 0 && (
            <button
              onClick={() => {
                onBatchAction(Array.from(selectedPaths));
                setSelectedPaths(new Set());
              }}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition cursor-pointer shadow-sm ${
                isStaged
                  ? "bg-rose-600/90 hover:bg-rose-500 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {batchActionLabel} ({selectedPaths.size})
            </button>
          )}

          {/* All Action Button */}
          {files.length > 0 && (
            <button
              onClick={onAllAction}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60 px-2 py-0.5 rounded transition cursor-pointer"
            >
              {allActionLabel}
            </button>
          )}
        </div>
      </div>

      {/* Files List / Tree Content */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {files.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-[11px]">
            {isStaged ? "Ningún archivo preparado para el commit." : "Árbol de trabajo limpio."}
          </div>
        ) : viewMode === "tree" ? (
          renderTreeNode(treeRoot)
        ) : (
          orderedFiles.map((file) => {
            const isCurrentActive = selectedFile?.path === file.path && selectedFile?.is_staged === isStaged;
            const isChecked = selectedPaths.has(file.path);

            return (
              <div
                key={file.path}
                onClick={(e) => handleRowClick(file, e)}
                className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer text-[11px] select-none transition ${
                  isChecked
                    ? "bg-blue-600/35 text-sky-100 font-medium"
                    : isCurrentActive
                    ? "bg-zinc-800/80 text-zinc-100 font-medium"
                    : "hover:bg-zinc-800/60 text-zinc-300"
                }`}
              >
                <div className="flex items-center space-x-2 truncate flex-1 mr-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={(e) => handleCheckboxToggle(file.path, e)}
                    onChange={() => {}}
                    className="rounded bg-zinc-800 border-zinc-700 text-sky-500 cursor-pointer"
                  />
                  {getStatusBadge(file.status)}
                  <FileText size={12} className="text-zinc-400 shrink-0" />
                  <span className="truncate font-mono">{file.path}</span>
                </div>

                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
                  {onDiscardSingle && (
                    <button
                      onClick={(e) => onDiscardSingle(file, e)}
                      title="Descartar cambios"
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  {isStaged && onUnstageSingle && (
                    <button
                      onClick={(e) => onUnstageSingle(file, e)}
                      title="Despreparar archivo"
                      className="p-1 rounded text-zinc-500 hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Minus size={12} />
                    </button>
                  )}
                  {!isStaged && onStageSingle && (
                    <button
                      onClick={(e) => onStageSingle(file, e)}
                      title="Preparar archivo (Stage)"
                      className="p-1 rounded text-zinc-500 hover:text-emerald-300 hover:bg-emerald-950/40 cursor-pointer"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
