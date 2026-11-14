use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::models::{
    AheadBehind, Branch, Commit, CommitWithGraph, FileChange, MergeResult, RemoteInfo, RepoSummary,
    WorkingFile, WorkingTreeStatus,
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

    let is_merging = is_repo_merging(path);
    let is_clean = !is_merging && status_output.status.success() && status_output.stdout.is_empty();

    Ok(RepoSummary {
        path: path.to_string(),
        name,
        current_branch,
        is_clean,
        is_merging,
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
        return Err(stderr.to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut commits = Vec::new();

    for record in stdout.split('\x01') {
        let record = record.trim();
        if record.is_empty() {
            continue;
        }

        let fields: Vec<&str> = record.split('\x00').collect();
        if fields.len() < 7 {
            continue;
        }

        let hash = fields[0].trim().to_string();
        let short_hash = if hash.len() >= 7 { hash[..7].to_string() } else { hash.clone() };

        let parents_str = fields[1].trim();
        let parents = if parents_str.is_empty() {
            Vec::new()
        } else {
            parents_str.split_whitespace().map(|s| s.to_string()).collect()
        };

        let author_name = fields[2].trim().to_string();
        let author_email = fields[3].trim().to_string();
        let timestamp = fields[4].trim().parse::<i64>().unwrap_or(0);
        let summary = fields[5].trim().to_string();
        let body = fields[6].trim().to_string();

        let refs = if fields.len() > 7 {
            let ref_str = fields[7].trim();
            if ref_str.is_empty() {
                Vec::new()
            } else {
                ref_str
                    .split(',')
                    .map(|r| r.trim().to_string())
                    .filter(|r| !r.is_empty())
                    .collect()
            }
        } else {
            Vec::new()
        };

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

    let mut cmd = create_git_command(path);
    let args = [
        "branch",
        "-a",
        "--format=%(HEAD)%00%(refname:short)%00%(refname)%00%(objectname)",
    ];
    let output = cmd
        .args(args)
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
        let mut name = parts[1].trim().to_string();
        let full_ref = parts[2].trim();
        let target_hash = parts[3].trim().to_string();
        let is_remote = full_ref.starts_with("refs/remotes/");

        if is_remote {
            if let Some(stripped) = full_ref.strip_prefix("refs/remotes/") {
                name = stripped.to_string();
            }
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

pub fn get_head_hash(path: &str) -> Result<String, String> {
    let output = create_git_command(path)
        .args(["rev-parse", "HEAD"])
        .output()
        .map_err(|e| format!("Failed to get HEAD hash: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

pub fn get_commits_with_graph(path: &str, limit: Option<usize>) -> Result<Vec<CommitWithGraph>, String> {
    let mut commits = get_commits(path, limit)?;

    if !commits.is_empty() {
        if let Ok(summary) = get_repo_summary(path) {
            if !summary.is_clean {
                if let Ok(head_hash) = get_head_hash(path) {
                    let uncommitted = Commit {
                        hash: "uncommitted".to_string(),
                        short_hash: "—".to_string(),
                        parents: vec![head_hash],
                        author_name: "—".to_string(),
                        author_email: "".to_string(),
                        timestamp: 0,
                        summary: "Uncommitted changes".to_string(),
                        body: "".to_string(),
                        refs: vec![],
                    };
                    commits.insert(0, uncommitted);
                }
            }
        }
    }

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

    if hash == "uncommitted" {
        return Ok(Vec::new());
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

        let raw_status = parts[0];
        let status_code = raw_status.chars().next().unwrap_or('M').to_string();

        let status = match status_code.as_str() {
            "A" => "A",
            "D" => "D",
            "R" => "R",
            _ => "M",
        }
        .to_string();

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

    if hash == "uncommitted" {
        return Ok(String::new());
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

        // Unmerged / Conflicted files (DD, AU, UD, UA, DU, AA, UU)
        let is_unmerged = x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D');
        if is_unmerged {
            unstaged.push(WorkingFile {
                path: file_path,
                status: "C".to_string(), // 'C' for Conflict
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

    // Check if the file on disk has unresolved merge conflict markers
    let full_path = Path::new(repo_path).join(file_path);
    if let Ok(content) = fs::read_to_string(&full_path) {
        if content.contains("<<<<<<<") && content.contains("=======") && content.contains(">>>>>>>") {
            let lines: Vec<&str> = content.lines().collect();
            let mut diff = format!("@@ -1,{} +1,{} @@ [CONFLICT MARKERS]\n", lines.len(), lines.len());
            for line in lines {
                if line.starts_with("<<<<<<<") || line.starts_with("=======") || line.starts_with(">>>>>>>") {
                    diff.push('!');
                } else {
                    diff.push(' ');
                }
                diff.push_str(line);
                diff.push('\n');
            }
            return Ok(diff);
        }
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
            Err(_) => Ok("New or binary file without text preview.".to_string()),
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
    let mut cmd = create_git_command(repo_path);
    cmd.args(["restore", "--staged", "--", file_path]);

    let output = cmd.output().map_err(|e| format!("Failed to unstage file: {}", e))?;
    if !output.status.success() {
        let mut fallback = create_git_command(repo_path);
        fallback.args(["reset", "HEAD", "--", file_path]);
        let fb_output = fallback.output().map_err(|e| format!("Failed to reset file: {}", e))?;
        if !fb_output.status.success() {
            return Err(String::from_utf8_lossy(&fb_output.stderr).to_string());
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
    let mut cmd = create_git_command(repo_path);
    cmd.args(["restore", "--staged", "."]);

    let output = cmd.output().map_err(|e| format!("Failed to unstage all files: {}", e))?;
    if !output.status.success() {
        let mut fallback = create_git_command(repo_path);
        fallback.args(["reset", "HEAD"]);
        let fb_output = fallback.output().map_err(|e| format!("Failed to reset HEAD: {}", e))?;
        if !fb_output.status.success() {
            return Err(String::from_utf8_lossy(&fb_output.stderr).to_string());
        }
    }
    Ok(())
}

pub fn stage_files(repo_path: &str, file_paths: Vec<String>) -> Result<(), String> {
    if file_paths.is_empty() {
        return Ok(());
    }
    let mut cmd = create_git_command(repo_path);
    cmd.args(["add", "--"]);
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
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let full_path = Path::new(repo_path).join(file_path);

    // Check if file exists in HEAD
    let in_head = create_git_command(repo_path)
        .args(["cat-file", "-e", &format!("HEAD:{}", file_path)])
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false);

    if in_head {
        // First try to restore staged and worktree to HEAD
        let res = create_git_command(repo_path)
            .args(["checkout", "HEAD", "--", file_path])
            .output();

        if let Ok(out) = res {
            if out.status.success() {
                return Ok(());
            }
        }

        // Fallback: restore staged then restore worktree
        let _ = create_git_command(repo_path)
            .args(["restore", "--staged", "--", file_path])
            .output();

        let output = create_git_command(repo_path)
            .args(["restore", "--", file_path])
            .output()
            .map_err(|e| format!("Failed to restore file: {}", e))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
    } else {
        // Does not exist in HEAD (untracked or newly added staged file)
        let _ = create_git_command(repo_path)
            .args(["rm", "-f", "--cached", "--", file_path])
            .output();

        if full_path.is_file() {
            let _ = fs::remove_file(&full_path);
        } else if full_path.is_dir() {
            let _ = fs::remove_dir_all(&full_path);
        }
    }

    Ok(())
}

pub fn discard_files(repo_path: &str, file_paths: Vec<String>) -> Result<(), String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    for path in file_paths {
        discard_file_changes(repo_path, &path)?;
    }

    Ok(())
}

pub fn discard_all_changes(repo_path: &str) -> Result<(), String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    if is_repo_merging(repo_path) {
        let _ = abort_merge(repo_path);
    }

    let output_reset = create_git_command(repo_path)
        .args(["reset", "--hard", "HEAD"])
        .output()
        .map_err(|e| format!("Failed to reset repository: {}", e))?;

    if !output_reset.status.success() {
        return Err(String::from_utf8_lossy(&output_reset.stderr).to_string());
    }

    let _ = create_git_command(repo_path)
        .args(["clean", "-fd"])
        .output();

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

// ---------------------------------------------------------
// Remote Operations
// ---------------------------------------------------------

pub fn get_remotes(repo_path: &str) -> Result<Vec<RemoteInfo>, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.args(["remote", "-v"]);

    let output = cmd.output().map_err(|e| format!("Failed to get remotes: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut remotes_map = std::collections::BTreeMap::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let name = parts[0].to_string();
            let url = parts[1].to_string();
            remotes_map.entry(name).or_insert(url);
        }
    }

    let remotes = remotes_map
        .into_iter()
        .map(|(name, url)| RemoteInfo {
            name,
            url: Some(url),
        })
        .collect();

    Ok(remotes)
}

pub fn get_ahead_behind(repo_path: &str) -> Result<AheadBehind, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    // Try against upstream
    let mut cmd = create_git_command(repo_path);
    cmd.args(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);

    let output = cmd.output().map_err(|e| format!("Failed to get ahead/behind count: {}", e))?;
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let counts: Vec<&str> = stdout.split_whitespace().collect();
        if counts.len() >= 2 {
            let ahead = counts[0].parse::<usize>().unwrap_or(0);
            let behind = counts[1].parse::<usize>().unwrap_or(0);
            return Ok(AheadBehind { ahead, behind });
        }
    }

    // Fallback: check if remote branch with same name exists (e.g. origin/<branch>)
    if let Ok(summary) = get_repo_summary(repo_path) {
        if let Some(branch) = summary.current_branch {
            let target = format!("origin/{}", branch);
            let mut fallback_cmd = create_git_command(repo_path);
            fallback_cmd.args(["rev-list", "--left-right", "--count", &format!("HEAD...{}", target)]);
            if let Ok(fb_output) = fallback_cmd.output() {
                if fb_output.status.success() {
                    let stdout = String::from_utf8_lossy(&fb_output.stdout);
                    let counts: Vec<&str> = stdout.split_whitespace().collect();
                    if counts.len() >= 2 {
                        let ahead = counts[0].parse::<usize>().unwrap_or(0);
                        let behind = counts[1].parse::<usize>().unwrap_or(0);
                        return Ok(AheadBehind { ahead, behind });
                    }
                }
            }
        }
    }

    Ok(AheadBehind { ahead: 0, behind: 0 })
}

pub fn fetch_remote(repo_path: &str, remote: Option<&str>, prune: bool) -> Result<String, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.arg("fetch");

    if prune {
        cmd.arg("--prune");
    }

    match remote {
        Some(r) if !r.is_empty() && r != "all" => {
            cmd.arg(r);
        }
        _ => {
            cmd.arg("--all");
        }
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute fetch: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(if err.trim().is_empty() {
            String::from_utf8_lossy(&output.stdout).to_string()
        } else {
            err.to_string()
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout.trim(), stderr.trim());
    Ok(combined.trim().to_string())
}

pub fn pull_changes(
    repo_path: &str,
    remote: &str,
    branch: &str,
    rebase: bool,
) -> Result<String, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.arg("pull");

    if rebase {
        cmd.arg("--rebase");
    }

    if !remote.trim().is_empty() {
        cmd.arg(remote.trim());
    }

    if !branch.trim().is_empty() {
        cmd.arg(branch.trim());
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute pull: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let out = String::from_utf8_lossy(&output.stdout);
        let msg = if !err.trim().is_empty() { err.to_string() } else { out.to_string() };
        return Err(msg);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout.trim(), stderr.trim());
    Ok(combined.trim().to_string())
}

pub fn push_changes(
    repo_path: &str,
    remote: &str,
    branch: &str,
    force_with_lease: bool,
    set_upstream: bool,
) -> Result<String, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.arg("push");

    if set_upstream {
        cmd.arg("-u");
    }

    if force_with_lease {
        cmd.arg("--force-with-lease");
    }

    if !remote.trim().is_empty() {
        cmd.arg(remote.trim());
    }

    if !branch.trim().is_empty() {
        cmd.arg(branch.trim());
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute push: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let out = String::from_utf8_lossy(&output.stdout);
        let msg = if !err.trim().is_empty() { err.to_string() } else { out.to_string() };
        return Err(msg);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout.trim(), stderr.trim());
    Ok(combined.trim().to_string())
}

pub fn add_remote(repo_path: &str, name: &str, url: &str) -> Result<(), String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let name = name.trim();
    let url = url.trim();

    if name.is_empty() {
        return Err("Remote name cannot be empty.".to_string());
    }
    if url.is_empty() {
        return Err("Remote URL cannot be empty.".to_string());
    }

    let mut cmd = create_git_command(repo_path);
    cmd.args(["remote", "add", name, url]);

    let output = cmd.output().map_err(|e| format!("Failed to add remote: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(if err.trim().is_empty() {
            String::from_utf8_lossy(&output.stdout).to_string()
        } else {
            err.to_string()
        });
    }

    Ok(())
}

pub fn remove_remote(repo_path: &str, name: &str) -> Result<(), String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.args(["remote", "remove", name.trim()]);

    let output = cmd.output().map_err(|e| format!("Failed to remove remote: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(if err.trim().is_empty() {
            String::from_utf8_lossy(&output.stdout).to_string()
        } else {
            err.to_string()
        });
    }

    Ok(())
}

pub fn update_remote_url(repo_path: &str, name: &str, new_url: &str) -> Result<(), String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.args(["remote", "set-url", name.trim(), new_url.trim()]);

    let output = cmd.output().map_err(|e| format!("Failed to update remote URL: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(if err.trim().is_empty() {
            String::from_utf8_lossy(&output.stdout).to_string()
        } else {
            err.to_string()
        });
    }

    Ok(())
}

// ---------------------------------------------------------
// Branch Checkout & Management Operations
// ---------------------------------------------------------

pub fn checkout_branch(repo_path: &str, branch: &str) -> Result<String, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.args(["checkout", branch.trim()]);

    let output = cmd.output().map_err(|e| format!("Failed to checkout branch: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let out = String::from_utf8_lossy(&output.stdout);
        let msg = if !err.trim().is_empty() { err.to_string() } else { out.to_string() };
        return Err(msg);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout.trim(), stderr.trim());
    Ok(combined.trim().to_string())
}

pub fn checkout_remote_branch(
    repo_path: &str,
    local_branch: &str,
    remote_branch: &str,
    track: bool,
) -> Result<String, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let local_name = local_branch.trim();
    let remote_name = remote_branch.trim();

    // Check if local branch already exists
    let check_cmd = create_git_command(repo_path)
        .args(["show-ref", "--verify", "--quiet", &format!("refs/heads/{}", local_name)])
        .output();

    let local_exists = match check_cmd {
        Ok(out) => out.status.success(),
        Err(_) => false,
    };

    let mut cmd = create_git_command(repo_path);
    if local_exists {
        cmd.args(["checkout", local_name]);
    } else {
        if track {
            cmd.args(["checkout", "-b", local_name, "--track", remote_name]);
        } else {
            cmd.args(["checkout", "-b", local_name, remote_name]);
        }
    }

    let output = cmd.output().map_err(|e| format!("Failed to checkout remote branch: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let out = String::from_utf8_lossy(&output.stdout);
        let msg = if !err.trim().is_empty() { err.to_string() } else { out.to_string() };
        return Err(msg);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout.trim(), stderr.trim());
    Ok(combined.trim().to_string())
}

pub fn create_branch(
    repo_path: &str,
    name: &str,
    target_hash: Option<&str>,
    checkout: bool,
) -> Result<String, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let name = name.trim();
    if name.is_empty() {
        return Err("Branch name cannot be empty.".to_string());
    }

    let mut cmd = create_git_command(repo_path);
    if checkout {
        cmd.args(["checkout", "-b", name]);
        if let Some(hash) = target_hash {
            if !hash.trim().is_empty() && hash != "uncommitted" {
                cmd.arg(hash.trim());
            }
        }
    } else {
        cmd.args(["branch", name]);
        if let Some(hash) = target_hash {
            if !hash.trim().is_empty() && hash != "uncommitted" {
                cmd.arg(hash.trim());
            }
        }
    }

    let output = cmd.output().map_err(|e| format!("Failed to create branch: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let out = String::from_utf8_lossy(&output.stdout);
        let msg = if !err.trim().is_empty() { err.to_string() } else { out.to_string() };
        return Err(msg);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout.trim(), stderr.trim());
    Ok(combined.trim().to_string())
}

pub fn delete_branch(repo_path: &str, name: &str, force: bool) -> Result<String, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.arg("branch");
    if force {
        cmd.arg("-D");
    } else {
        cmd.arg("-d");
    }
    cmd.arg(name.trim());

    let output = cmd.output().map_err(|e| format!("Failed to delete branch: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let out = String::from_utf8_lossy(&output.stdout);
        let msg = if !err.trim().is_empty() { err.to_string() } else { out.to_string() };
        return Err(msg);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout.trim(), stderr.trim());
    Ok(combined.trim().to_string())
}

pub fn delete_remote_branch(
    repo_path: &str,
    remote: &str,
    branch: &str,
) -> Result<String, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.args(["push", remote.trim(), "--delete", branch.trim()]);

    let output = cmd.output().map_err(|e| format!("Failed to delete remote branch: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let out = String::from_utf8_lossy(&output.stdout);
        let msg = if !err.trim().is_empty() { err.to_string() } else { out.to_string() };
        return Err(msg);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout.trim(), stderr.trim());
    Ok(combined.trim().to_string())
}

// ---------------------------------------------------------
// Merge Operations
// ---------------------------------------------------------

pub fn is_repo_merging(repo_path: &str) -> bool {
    let git_dir_output = create_git_command(repo_path)
        .args(["rev-parse", "--git-dir"])
        .output();

    if let Ok(out) = git_dir_output {
        if out.status.success() {
            let git_dir = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let p = Path::new(repo_path);
            let merge_head = if Path::new(&git_dir).is_absolute() {
                PathBuf::from(git_dir).join("MERGE_HEAD")
            } else {
                p.join(git_dir).join("MERGE_HEAD")
            };
            return merge_head.exists();
        }
    }

    Path::new(repo_path).join(".git").join("MERGE_HEAD").exists()
}

pub fn get_merge_message(repo_path: &str) -> Option<String> {
    let git_dir_output = create_git_command(repo_path)
        .args(["rev-parse", "--git-dir"])
        .output();

    let git_dir = if let Ok(out) = git_dir_output {
        if out.status.success() {
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        } else {
            ".git".to_string()
        }
    } else {
        ".git".to_string()
    };

    let p = Path::new(repo_path);
    let merge_msg = if Path::new(&git_dir).is_absolute() {
        PathBuf::from(git_dir).join("MERGE_MSG")
    } else {
        p.join(git_dir).join("MERGE_MSG")
    };

    if let Ok(content) = fs::read_to_string(merge_msg) {
        let trimmed = content.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }
    None
}

pub fn merge_branch(
    repo_path: &str,
    branch: &str,
    no_ff: bool,
    squash: bool,
    message: Option<&str>,
) -> Result<MergeResult, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.arg("merge");

    if squash {
        cmd.arg("--squash");
    } else if no_ff {
        cmd.arg("--no-ff");
    }

    if let Some(msg) = message {
        if !msg.trim().is_empty() {
            cmd.args(["-m", msg.trim()]);
        }
    }

    cmd.arg(branch.trim());

    let output = cmd.output().map_err(|e| format!("Failed to execute git merge: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}\n{}", stdout.trim(), stderr.trim()).trim().to_string();

    let merging = is_repo_merging(repo_path);

    if !output.status.success() || merging {
        let mut conflicts = Vec::new();
        for line in combined.lines() {
            if line.contains("CONFLICT (content): Merge conflict in ") {
                let file = line.replace("CONFLICT (content): Merge conflict in ", "").trim().to_string();
                conflicts.push(file);
            } else if line.contains("Merge conflict in ") {
                if let Some(idx) = line.find("Merge conflict in ") {
                    let file = line[idx + "Merge conflict in ".len()..].trim().to_string();
                    conflicts.push(file);
                }
            }
        }

        // Also check git diff --name-only --diff-filter=U to ensure all conflict files are captured
        if let Ok(unmerged_output) = create_git_command(repo_path)
            .args(["diff", "--name-only", "--diff-filter=U"])
            .output()
        {
            if unmerged_output.status.success() {
                let unmerged_stdout = String::from_utf8_lossy(&unmerged_output.stdout);
                for line in unmerged_stdout.lines() {
                    let f = line.trim().to_string();
                    if !f.is_empty() && !conflicts.contains(&f) {
                        conflicts.push(f);
                    }
                }
            }
        }

        if !conflicts.is_empty() || merging {
            return Ok(MergeResult {
                status: "conflict".to_string(),
                message: combined,
                conflicts,
            });
        }

        return Err(if !stderr.trim().is_empty() { stderr } else { stdout });
    }

    if stdout.contains("Already up to date") || stdout.contains("Already up-to-date") {
        return Ok(MergeResult {
            status: "already_up_to_date".to_string(),
            message: combined,
            conflicts: vec![],
        });
    }

    Ok(MergeResult {
        status: "success".to_string(),
        message: combined,
        conflicts: vec![],
    })
}

pub fn abort_merge(repo_path: &str) -> Result<String, String> {
    if !is_git_repo(repo_path) {
        return Err(format!("'{}' is not a Git repository", repo_path));
    }

    let mut cmd = create_git_command(repo_path);
    cmd.args(["merge", "--abort"]);

    let output = cmd.output().map_err(|e| format!("Failed to abort merge: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(if !err.trim().is_empty() { err.to_string() } else { "Failed to abort merge".to_string() });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().to_string())
}
