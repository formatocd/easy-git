import { invoke } from "@tauri-apps/api/core";

export interface Commit {
  hash: string;
  short_hash: string;
  parents: string[];
  author_name: string;
  author_email: string;
  timestamp: number;
  summary: string;
  body: string;
  refs: string[];
}

export interface GraphSegment {
  from_col: number;
  from_y: number; // 0 = Top, 1 = Center, 2 = Bottom
  to_col: number;
  to_y: number;   // 0 = Top, 1 = Center, 2 = Bottom
  color_index: number;
}

export interface CommitWithGraph {
  hash: string;
  short_hash: string;
  parents: string[];
  author_name: string;
  author_email: string;
  timestamp: number;
  summary: string;
  body: string;
  refs: string[];
  node_col: number;
  color_index: number;
  max_col: number;
  segments: GraphSegment[];
}

export interface Branch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  target_hash: string;
}

export interface RepoSummary {
  path: string;
  name: string;
  current_branch: string | null;
  is_clean: boolean;
}

export interface FileChange {
  path: string;
  status: string; // "M" | "A" | "D" | "R"
  old_path?: string | null;
}

export interface WorkingFile {
  path: string;
  status: string; // "M" | "A" | "D" | "R" | "?"
  is_staged: boolean;
  old_path?: string | null;
}

export interface WorkingTreeStatus {
  staged: WorkingFile[];
  unstaged: WorkingFile[];
}

export async function isGitRepo(path: string): Promise<boolean> {
  return invoke<boolean>("is_git_repo", { path });
}

export async function openRepository(path: string): Promise<RepoSummary> {
  return invoke<RepoSummary>("open_repository", { path });
}

export async function getCommits(path: string, limit?: number): Promise<Commit[]> {
  return invoke<Commit[]>("get_commits", { path, limit });
}

export async function getCommitGraph(path: string, limit?: number): Promise<CommitWithGraph[]> {
  return invoke<CommitWithGraph[]>("get_commit_graph", { path, limit });
}

export async function getBranches(path: string): Promise<Branch[]> {
  return invoke<Branch[]>("get_branches", { path });
}

export async function getCommitFiles(
  path: string,
  hash: string,
  parentHash?: string | null,
): Promise<FileChange[]> {
  return invoke<FileChange[]>("get_commit_files", {
    path,
    hash,
    parentHash: parentHash || null,
  });
}

export async function getCommitFileDiff(
  path: string,
  hash: string,
  filePath: string,
  parentHash?: string | null,
): Promise<string> {
  return invoke<string>("get_commit_file_diff", {
    path,
    hash,
    filePath,
    parentHash: parentHash || null,
  });
}

export async function getWorkingTreeStatus(path: string): Promise<WorkingTreeStatus> {
  return invoke<WorkingTreeStatus>("get_working_tree_status", { path });
}

export async function getWorkingFileDiff(
  path: string,
  filePath: string,
  isStaged: boolean,
): Promise<string> {
  return invoke<string>("get_working_file_diff", {
    path,
    filePath,
    isStaged,
  });
}

export async function stageFile(path: string, filePath: string): Promise<void> {
  return invoke<void>("stage_file", { path, filePath });
}

export async function unstageFile(path: string, filePath: string): Promise<void> {
  return invoke<void>("unstage_file", { path, filePath });
}

export async function stageAll(path: string): Promise<void> {
  return invoke<void>("stage_all", { path });
}

export async function unstageAll(path: string): Promise<void> {
  return invoke<void>("unstage_all", { path });
}

export async function stageFiles(path: string, filePaths: string[]): Promise<void> {
  return invoke<void>("stage_files", { path, filePaths });
}

export async function unstageFiles(path: string, filePaths: string[]): Promise<void> {
  return invoke<void>("unstage_files", { path, filePaths });
}

export async function discardFileChanges(path: string, filePath: string): Promise<void> {
  return invoke<void>("discard_file_changes", { path, filePath });
}

export async function commitChanges(
  path: string,
  message: string,
  amend: boolean,
): Promise<string> {
  return invoke<string>("commit_changes", { path, message, amend });
}
