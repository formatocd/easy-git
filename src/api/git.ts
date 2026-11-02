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

export async function getBranches(path: string): Promise<Branch[]> {
  return invoke<Branch[]>("get_branches", { path });
}
