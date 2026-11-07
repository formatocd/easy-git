use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::models::{Branch, Commit, CommitWithGraph, FileChange, RepoSummary};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn create_git_command(repo_path: &str) -> Command {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(repo_path);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

pub fn is_git_repo(path: &str) -> bool {
    let output = create_git_command(path)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output();

    match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

pub fn get_repo_summary(path: &str) -> Result<RepoSummary, String> {
    if !is_git_repo(path) {
        return Err(format!("The path '{}' is not a valid Git repository.", path));
    }

    let p = Path::new(path);
    let name = p
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());

    // Current branch
    let branch_output = create_git_command(path)
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    let current_branch = if branch_output.status.success() {
        let branch = String::from_utf8_lossy(&branch_output.stdout).trim().to_string();
        if branch == "HEAD" {
            None // Detached HEAD
        } else {
            Some(branch)
        }
    } else {
        None
    };

    // Check status (clean or dirty)
    let status_output = create_git_command(path)
        .args(["status", "--porcelain"])
        .output()
        .map_err(|e| format!("Failed to get repo status: {}", e))?;

    let is_clean = status_output.status.success() && status_output.stdout.is_empty();

    Ok(RepoSummary {
        path: path.to_string(),
        name,
        current_branch,
        is_clean,
    })
}

pub fn get_commits(path: &str, limit: Option<usize>) -> Result<Vec<Commit>, String> {
    if !is_git_repo(path) {
        return Err(format!("'{}' is not a Git repository", path));
    }

    let mut cmd = create_git_command(path);
    // Format: Hash, Parents, AuthorName, AuthorEmail, UnixTimestamp, Subject, Body, Refs
    // Fields separated by NULL byte (%x00), commits separated by SOH byte (%x01)
    let format_str = "format:%H%x00%P%x00%an%x00%ae%x00%at%x00%s%x00%b%x00%D%x01";

    cmd.args(["log", "--all", "--topo-order", &format!("--format={}", format_str)]);

    if let Some(n) = limit {
        cmd.args(["-n", &n.to_string()]);
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute git log: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Handle empty repository with no commits yet
        if stderr.contains("does not have any commits yet") || stderr.contains("unknown revision") {
            return Ok(Vec::new());
        }
        return Err(format!("Git log error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut commits = Vec::new();

    for record in stdout.split('\x01') {
        let record = record.trim();
        if record.is_empty() {
            continue;
        }

        let parts: Vec<&str> = record.split('\x00').collect();
        if parts.len() < 8 {
            continue;
        }

        let hash = parts[0].trim().to_string();
        let short_hash = if hash.len() >= 7 {
            hash[..7].to_string()
        } else {
            hash.clone()
        };

        let parents: Vec<String> = parts[1]
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        let author_name = parts[2].trim().to_string();
        let author_email = parts[3].trim().to_string();
        let timestamp: i64 = parts[4].trim().parse().unwrap_or(0);
        let summary = parts[5].trim().to_string();
        let body = parts[6].trim().to_string();

        let refs: Vec<String> = parts[7]
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        commits.push(Commit {
            hash,
            short_hash,
            parents,
            author_name,
            author_email,
            timestamp,
            summary,
            body,
            refs,
        });
    }

    Ok(commits)
}

pub fn get_branches(path: &str) -> Result<Vec<Branch>, String> {
    if !is_git_repo(path) {
        return Err(format!("'{}' is not a Git repository", path));
    }

    let output = create_git_command(path)
        .args([
            "branch",
            "-a",
            "--format=%(HEAD)%00%(refname:short)%00%(refname)%00%(objectname)",
        ])
        .output()
        .map_err(|e| format!("Failed to execute git branch: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut branches = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split('\x00').collect();
        if parts.len() < 4 {
            continue;
        }

        let is_current = parts[0].trim() == "*";
        let name = parts[1].trim().to_string();
        let full_ref = parts[2].trim();
        let target_hash = parts[3].trim().to_string();
        let is_remote = full_ref.starts_with("refs/remotes/");

        // Avoid adding HEAD pointer like origin/HEAD
        if name.ends_with("/HEAD") {
            continue;
        }

        branches.push(Branch {
            name,
            is_current,
            is_remote,
            target_hash,
        });
    }

    Ok(branches)
}

pub fn get_commits_with_graph(path: &str, limit: Option<usize>) -> Result<Vec<CommitWithGraph>, String> {
    let commits = get_commits(path, limit)?;
    Ok(crate::graph::compute_graph(commits))
}

pub fn get_commit_files(
    path: &str,
    hash: &str,
    parent_hash: Option<&str>,
) -> Result<Vec<FileChange>, String> {
    if !is_git_repo(path) {
        return Err(format!("'{}' is not a Git repository", path));
    }

    let mut cmd = create_git_command(path);
    if let Some(parent) = parent_hash {
        cmd.args(["diff", "--name-status", "-M", parent, hash]);
    } else {
        cmd.args(["diff-tree", "-r", "--root", "--no-commit-id", "--name-status", "-M", hash]);
    }

    let output = cmd.output().map_err(|e| format!("Failed to get commit files: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut files = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split('\t').collect();
        if parts.is_empty() {
            continue;
        }

        let raw_status = parts[0].trim();
        let status = if raw_status.starts_with('R') {
            "R".to_string()
        } else {
            raw_status.to_string()
        };

        if status == "R" && parts.len() >= 3 {
            files.push(FileChange {
                old_path: Some(parts[1].trim().to_string()),
                path: parts[2].trim().to_string(),
                status,
            });
        } else if parts.len() >= 2 {
            files.push(FileChange {
                old_path: None,
                path: parts[1].trim().to_string(),
                status,
            });
        }
    }

    Ok(files)
}

pub fn get_commit_file_diff(
    path: &str,
    hash: &str,
    parent_hash: Option<&str>,
    file_path: &str,
) -> Result<String, String> {
    if !is_git_repo(path) {
        return Err(format!("'{}' is not a Git repository", path));
    }

    let mut cmd = create_git_command(path);
    if let Some(parent) = parent_hash {
        cmd.args(["diff", "-U3", parent, hash, "--", file_path]);
    } else {
        cmd.args(["show", "-U3", "--format=", hash, "--", file_path]);
    }

    let output = cmd.output().map_err(|e| format!("Failed to get file diff: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
