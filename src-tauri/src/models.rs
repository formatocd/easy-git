use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commit {
    pub hash: String,
    pub short_hash: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub summary: String,
    pub body: String,
    pub refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphSegment {
    pub from_col: usize,
    pub from_y: u8, // 0 = Top, 1 = Center, 2 = Bottom
    pub to_col: usize,
    pub to_y: u8,   // 0 = Top, 1 = Center, 2 = Bottom
    pub color_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitWithGraph {
    #[serde(flatten)]
    pub commit: Commit,
    pub node_col: usize,
    pub color_index: usize,
    pub max_col: usize,
    pub segments: Vec<GraphSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Branch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub target_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoSummary {
    pub path: String,
    pub name: String,
    pub current_branch: Option<String>,
    pub is_clean: bool,
    pub is_merging: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeResult {
    pub status: String, // "success", "already_up_to_date", "conflict"
    pub message: String,
    pub conflicts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub status: String, // "M", "A", "D", "R"
    pub old_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkingFile {
    pub path: String,
    pub status: String, // "M", "A", "D", "R", "?"
    pub is_staged: bool,
    pub old_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkingTreeStatus {
    pub staged: Vec<WorkingFile>,
    pub unstaged: Vec<WorkingFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteInfo {
    pub name: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AheadBehind {
    pub ahead: usize,
    pub behind: usize,
}
