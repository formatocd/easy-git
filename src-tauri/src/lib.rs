mod git;
mod graph;
mod models;

use models::{
    Branch, Commit, CommitWithGraph, FileChange, RepoSummary, WorkingTreeStatus,
};

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

#[tauri::command]
fn get_working_tree_status(path: String) -> Result<WorkingTreeStatus, String> {
    git::get_working_tree_status(&path)
}

#[tauri::command]
fn get_working_file_diff(
    path: String,
    file_path: String,
    is_staged: bool,
) -> Result<String, String> {
    git::get_working_file_diff(&path, &file_path, is_staged)
}

#[tauri::command]
fn stage_file(path: String, file_path: String) -> Result<(), String> {
    git::stage_file(&path, &file_path)
}

#[tauri::command]
fn unstage_file(path: String, file_path: String) -> Result<(), String> {
    git::unstage_file(&path, &file_path)
}

#[tauri::command]
fn stage_all(path: String) -> Result<(), String> {
    git::stage_all(&path)
}

#[tauri::command]
fn unstage_all(path: String) -> Result<(), String> {
    git::unstage_all(&path)
}

#[tauri::command]
fn stage_files(path: String, file_paths: Vec<String>) -> Result<(), String> {
    git::stage_files(&path, file_paths)
}

#[tauri::command]
fn unstage_files(path: String, file_paths: Vec<String>) -> Result<(), String> {
    git::unstage_files(&path, file_paths)
}

#[tauri::command]
fn discard_file_changes(path: String, file_path: String) -> Result<(), String> {
    git::discard_file_changes(&path, &file_path)
}

#[tauri::command]
fn commit_changes(path: String, message: String, amend: bool) -> Result<String, String> {
    git::commit_changes(&path, &message, amend)
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
            get_commit_file_diff,
            get_working_tree_status,
            get_working_file_diff,
            stage_file,
            unstage_file,
            stage_all,
            unstage_all,
            stage_files,
            unstage_files,
            discard_file_changes,
            commit_changes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
