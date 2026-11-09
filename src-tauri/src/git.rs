use std::fs;
use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::models::{
    Branch, Commit, CommitWithGraph, FileChange, RepoSummary, WorkingFile, WorkingTreeStatus,
};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn create_git_command(repo_path: &str) -> Command {
    let mut cmd = Command::new("git");
    cmd.arg("-c").arg("core.quotepath=false");
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
    let format_str = "format:%H%x00%P%x00%an%x00%ae%x00%at%x00%s%x00%b%x00%D%x01";

    cmd.args(["log", "--all", "--topo-order", &format!("--format={}", format_str)]);

    if let Some(n) = limit {
        cmd.args(["-n", &n.to_string()]);
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute git log: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
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

// ---------------------------------------------------------
// Working Tree & Staging Operations
// ---------------------------------------------------------

pub fn get_working_tree_status(path: &str) -> Result<WorkingTreeStatus, String> {
    if !is_git_repo(path) {
        return Err(format!("'{}' is not a Git repository", path));
    }

    let output = create_git_command(path)
        .args(["status", "--porcelain=v1", "-uall"])
        .output()
        .map_err(|e| format!("Failed to get working tree status: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();

    for line in stdout.lines() {
        if line.len() < 3 {
            continue;
        }

        let bytes = line.as_bytes();
        let x = bytes[0] as char;
        let y = bytes[1] as char;
        let raw_path = line[3..].trim();

        let (file_path, old_path) = if let Some((old_p, new_p)) = raw_path.split_once(" -> ") {
            (new_p.to_string(), Some(old_p.to_string()))
        } else {
            (raw_path.to_string(), None)
        };

        // Untracked
        if x == '?' && y == '?' {
            unstaged.push(WorkingFile {
                path: file_path,
                status: "?".to_string(),
                is_staged: false,
                old_path: None,
            });
            continue;
        }

        // Staged part (X)
        if x != ' ' && x != '?' {
            staged.push(WorkingFile {
                path: file_path.clone(),
                status: x.to_string(),
                is_staged: true,
                old_path: old_path.clone(),
            });
        }

        // Unstaged part (Y)
        if y != ' ' && y != '?' {
            unstaged.push(WorkingFile {
                path: file_path,
                status: y.to_string(),
                is_staged: false,
                old_path,
            });
        }
    }

    Ok(WorkingTreeStatus { staged, unstaged })
}

pub fn get_working_file_diff(
    repo_path: &str,
    file_path: &str,
    is_staged: bool,
) -> Result<String, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    if is_staged {
        let output = create_git_command(repo_path)
            .args(["diff", "--cached", "-U3", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to get staged diff: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    // For unstaged: check if tracked
    let tracked_check = create_git_command(repo_path)
        .args(["ls-files", "--error-unmatch", "--", file_path])
        .output();

    let is_tracked = match tracked_check {
        Ok(out) => out.status.success(),
        Err(_) => false,
    };

    if is_tracked {
        let output = create_git_command(repo_path)
            .args(["diff", "-U3", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to get unstaged diff: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        // Untracked file: synthesize diff
        let full_path = Path::new(repo_path).join(file_path);
        match fs::read_to_string(&full_path) {
            Ok(content) => {
                let lines: Vec<&str> = content.lines().collect();
                let mut diff = format!("@@ -0,0 +1,{} @@\n", lines.len());
                for line in lines {
                    diff.push('+');
                    diff.push_str(line);
                    diff.push('\n');
                }
                Ok(diff)
            }
            Err(_) => Ok("Archivo nuevo o binario sin vista previa de texto.".to_string()),
        }
    }
}

pub fn stage_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    let output = create_git_command(repo_path)
        .args(["add", "--", file_path])
        .output()
        .map_err(|e| format!("Failed to stage file: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

pub fn unstage_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    // Try restore --staged first, fallback to reset HEAD
    let output = create_git_command(repo_path)
        .args(["restore", "--staged", "--", file_path])
        .output()
        .map_err(|e| format!("Failed to unstage file: {}", e))?;

    if !output.status.success() {
        let fallback = create_git_command(repo_path)
            .args(["reset", "HEAD", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to reset file: {}", e))?;

        if !fallback.status.success() {
            return Err(String::from_utf8_lossy(&fallback.stderr).to_string());
        }
    }
    Ok(())
}

pub fn stage_all(repo_path: &str) -> Result<(), String> {
    let output = create_git_command(repo_path)
        .args(["add", "-A"])
        .output()
        .map_err(|e| format!("Failed to stage all files: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

pub fn unstage_all(repo_path: &str) -> Result<(), String> {
    let output = create_git_command(repo_path)
        .args(["restore", "--staged", "."])
        .output()
        .map_err(|e| format!("Failed to unstage all: {}", e))?;

    if !output.status.success() {
        let fallback = create_git_command(repo_path)
            .args(["reset"])
            .output()
            .map_err(|e| format!("Failed to reset: {}", e))?;

        if !fallback.status.success() {
            return Err(String::from_utf8_lossy(&fallback.stderr).to_string());
        }
    }
    Ok(())
}

pub fn stage_files(repo_path: &str, file_paths: Vec<String>) -> Result<(), String> {
    if file_paths.is_empty() {
        return Ok(());
    }
    let mut cmd = create_git_command(repo_path);
    cmd.arg("add").arg("--");
    for p in &file_paths {
        cmd.arg(p);
    }
    let output = cmd.output().map_err(|e| format!("Failed to stage files: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

pub fn unstage_files(repo_path: &str, file_paths: Vec<String>) -> Result<(), String> {
    if file_paths.is_empty() {
        return Ok(());
    }
    let mut cmd = create_git_command(repo_path);
    cmd.args(["restore", "--staged", "--"]);
    for p in &file_paths {
        cmd.arg(p);
    }
    let output = cmd.output().map_err(|e| format!("Failed to unstage files: {}", e))?;
    if !output.status.success() {
        let mut fallback = create_git_command(repo_path);
        fallback.args(["reset", "HEAD", "--"]);
        for p in file_paths {
            fallback.arg(p);
        }
        let fb_output = fallback.output().map_err(|e| format!("Failed to reset files: {}", e))?;
        if !fb_output.status.success() {
            return Err(String::from_utf8_lossy(&fb_output.stderr).to_string());
        }
    }
    Ok(())
}

pub fn discard_file_changes(repo_path: &str, file_path: &str) -> Result<(), String> {
    let tracked_check = create_git_command(repo_path)
        .args(["ls-files", "--error-unmatch", "--", file_path])
        .output();

    let is_tracked = match tracked_check {
        Ok(out) => out.status.success(),
        Err(_) => false,
    };

    if is_tracked {
        let output = create_git_command(repo_path)
            .args(["restore", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to restore file: {}", e))?;

        if !output.status.success() {
            let fallback = create_git_command(repo_path)
                .args(["checkout", "--", file_path])
                .output()
                .map_err(|e| format!("Failed to checkout file: {}", e))?;

            if !fallback.status.success() {
                return Err(String::from_utf8_lossy(&fallback.stderr).to_string());
            }
        }
    } else {
        // Untracked: remove file from disk
        let full_path = Path::new(repo_path).join(file_path);
        if full_path.is_file() {
            fs::remove_file(&full_path).map_err(|e| format!("Failed to delete file: {}", e))?;
        } else if full_path.is_dir() {
            fs::remove_dir_all(&full_path).map_err(|e| format!("Failed to delete folder: {}", e))?;
        }
    }

    Ok(())
}

pub fn commit_changes(repo_path: &str, message: &str, amend: bool) -> Result<String, String> {
    if message.trim().is_empty() {
        return Err("Commit message cannot be empty.".to_string());
    }

    let mut cmd = create_git_command(repo_path);
    cmd.arg("commit");

    if amend {
        cmd.arg("--amend");
    }

    cmd.args(["-m", message]);

    let output = cmd.output().map_err(|e| format!("Failed to execute commit: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
