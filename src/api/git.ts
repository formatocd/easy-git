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
