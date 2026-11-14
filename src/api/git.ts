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
  is_merging: boolean;
}

export interface MergeResult {
  status: "success" | "already_up_to_date" | "conflict";
  message: string;
  conflicts: string[];
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

export interface RemoteInfo {
  name: string;
  url: string | null;
}

export interface AheadBehind {
  ahead: number;
  behind: number;
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

export async function discardFiles(path: string, filePaths: string[]): Promise<void> {
  return invoke<void>("discard_files", { path, filePaths });
}

export async function discardAllChanges(path: string): Promise<void> {
  return invoke<void>("discard_all_changes", { path });
}

export async function commitChanges(
  path: string,
  message: string,
  amend: boolean,
): Promise<string> {
  return invoke<string>("commit_changes", { path, message, amend });
}

export async function getRemotes(path: string): Promise<RemoteInfo[]> {
  return invoke<RemoteInfo[]>("get_remotes", { path });
}

export async function getAheadBehind(path: string): Promise<AheadBehind> {
  return invoke<AheadBehind>("get_ahead_behind", { path });
}

export async function fetchRemote(
  path: string,
  remote?: string,
  prune: boolean = true,
): Promise<string> {
  return invoke<string>("fetch_remote", { path, remote: remote || null, prune });
}

export async function pullChanges(
  path: string,
  remote: string,
  branch: string,
  rebase: boolean = false,
): Promise<string> {
  return invoke<string>("pull_changes", { path, remote, branch, rebase });
}

export async function pushChanges(
  path: string,
  remote: string,
  branch: string,
  forceWithLease: boolean = false,
  setUpstream: boolean = false,
): Promise<string> {
  return invoke<string>("push_changes", {
    path,
    remote,
    branch,
    forceWithLease,
    setUpstream,
  });
}

export async function addRemote(
  path: string,
  name: string,
  url: string,
): Promise<void> {
  return invoke<void>("add_remote", { path, name, url });
}

export async function removeRemote(
  path: string,
  name: string,
): Promise<void> {
  return invoke<void>("remove_remote", { path, name });
}

export async function updateRemoteUrl(
  path: string,
  name: string,
  newUrl: string,
): Promise<void> {
  return invoke<void>("update_remote_url", { path, name, newUrl });
}

export async function checkoutBranch(
  path: string,
  branch: string,
): Promise<string> {
  return invoke<string>("checkout_branch", { path, branch });
}

export async function checkoutRemoteBranch(
  path: string,
  localBranch: string,
  remoteBranch: string,
  track: boolean = true,
): Promise<string> {
  return invoke<string>("checkout_remote_branch", {
    path,
    localBranch,
    remoteBranch,
    track,
  });
}

export async function createBranch(
  path: string,
  name: string,
  targetHash?: string,
  checkout: boolean = true,
): Promise<string> {
  return invoke<string>("create_branch", {
    path,
    name,
    targetHash: targetHash || null,
    checkout,
  });
}

export async function deleteBranch(
  path: string,
  name: string,
  force: boolean = false,
): Promise<string> {
  return invoke<string>("delete_branch", { path, name, force });
}

export async function deleteRemoteBranch(
  path: string,
  remote: string,
  branch: string,
): Promise<string> {
  return invoke<string>("delete_remote_branch", { path, remote, branch });
}

export async function mergeBranch(
  path: string,
  branch: string,
  noFf: boolean = false,
  squash: boolean = false,
  message?: string,
): Promise<MergeResult> {
  return invoke<MergeResult>("merge_branch", {
    path,
    branch,
    noFf,
    squash,
    message: message || null,
  });
}

export async function abortMerge(path: string): Promise<string> {
  return invoke<string>("abort_merge", { path });
}

export async function isMerging(path: string): Promise<boolean> {
  return invoke<boolean>("is_merging", { path });
}

export async function getMergeMessage(path: string): Promise<string | null> {
  return invoke<string | null>("get_merge_message", { path });
}
