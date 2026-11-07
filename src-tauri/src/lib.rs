mod git;
mod graph;
mod models;

use models::{Branch, Commit, CommitWithGraph, FileChange, RepoSummary};

#[tauri::command]
fn is_git_repo(path: String) -> bool {
    git::is_git_repo(&path)
}

#[tauri::command]
fn open_repository(path: String) -> Result<RepoSummary, String> {
    git::get_repo_summary(&path)
}

#[tauri::command]
fn get_commits(path: String, limit: Option<usize>) -> Result<Vec<Commit>, String> {
    git::get_commits(&path, limit)
}

#[tauri::command]
fn get_commit_graph(path: String, limit: Option<usize>) -> Result<Vec<CommitWithGraph>, String> {
    git::get_commits_with_graph(&path, limit)
}

#[tauri::command]
fn get_branches(path: String) -> Result<Vec<Branch>, String> {
    git::get_branches(&path)
}

#[tauri::command]
fn get_commit_files(
    path: String,
    hash: String,
    parent_hash: Option<String>,
) -> Result<Vec<FileChange>, String> {
    git::get_commit_files(&path, &hash, parent_hash.as_deref())
}

#[tauri::command]
fn get_commit_file_diff(
    path: String,
    hash: String,
    parent_hash: Option<String>,
    file_path: String,
) -> Result<String, String> {
    git::get_commit_file_diff(&path, &hash, parent_hash.as_deref(), &file_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            is_git_repo,
            open_repository,
            get_commits,
            get_commit_graph,
            get_branches,
            get_commit_files,
            get_commit_file_diff
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
