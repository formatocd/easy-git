mod git;
mod graph;
mod models;

use models::{
    AheadBehind, Branch, Commit, CommitWithGraph, FileChange, RemoteInfo, RepoSummary,
    WorkingTreeStatus,
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
fn discard_files(path: String, file_paths: Vec<String>) -> Result<(), String> {
    git::discard_files(&path, file_paths)
}

#[tauri::command]
fn commit_changes(path: String, message: String, amend: bool) -> Result<String, String> {
    git::commit_changes(&path, &message, amend)
}

#[tauri::command]
fn get_remotes(path: String) -> Result<Vec<RemoteInfo>, String> {
    git::get_remotes(&path)
}

#[tauri::command]
fn get_ahead_behind(path: String) -> Result<AheadBehind, String> {
    git::get_ahead_behind(&path)
}

#[tauri::command]
fn fetch_remote(path: String, remote: Option<String>, prune: bool) -> Result<String, String> {
    git::fetch_remote(&path, remote.as_deref(), prune)
}

#[tauri::command]
fn pull_changes(
    path: String,
    remote: String,
    branch: String,
    rebase: bool,
) -> Result<String, String> {
    git::pull_changes(&path, &remote, &branch, rebase)
}

#[tauri::command]
fn push_changes(
    path: String,
    remote: String,
    branch: String,
    force_with_lease: bool,
    set_upstream: bool,
) -> Result<String, String> {
    git::push_changes(&path, &remote, &branch, force_with_lease, set_upstream)
}

#[tauri::command]
fn add_remote(path: String, name: String, url: String) -> Result<(), String> {
    git::add_remote(&path, &name, &url)
}

#[tauri::command]
fn remove_remote(path: String, name: String) -> Result<(), String> {
    git::remove_remote(&path, &name)
}

#[tauri::command]
fn update_remote_url(path: String, name: String, new_url: String) -> Result<(), String> {
    git::update_remote_url(&path, &name, &new_url)
}

#[tauri::command]
fn checkout_branch(path: String, branch: String) -> Result<String, String> {
    git::checkout_branch(&path, &branch)
}

#[tauri::command]
fn checkout_remote_branch(
    path: String,
    local_branch: String,
    remote_branch: String,
    track: bool,
) -> Result<String, String> {
    git::checkout_remote_branch(&path, &local_branch, &remote_branch, track)
}

#[tauri::command]
fn create_branch(
    path: String,
    name: String,
    target_hash: Option<String>,
    checkout: bool,
) -> Result<String, String> {
    git::create_branch(&path, &name, target_hash.as_deref(), checkout)
}

#[tauri::command]
fn delete_branch(path: String, name: String, force: bool) -> Result<String, String> {
    git::delete_branch(&path, &name, force)
}

#[tauri::command]
fn delete_remote_branch(path: String, remote: String, branch: String) -> Result<String, String> {
    git::delete_remote_branch(&path, &remote, &branch)
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
            discard_files,
            commit_changes,
            get_remotes,
            get_ahead_behind,
            fetch_remote,
            pull_changes,
            push_changes,
            add_remote,
            remove_remote,
            update_remote_url,
            checkout_branch,
            checkout_remote_branch,
            create_branch,
            delete_branch,
            delete_remote_branch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
