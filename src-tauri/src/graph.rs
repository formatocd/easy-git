use crate::models::{Commit, CommitWithGraph, GraphSegment};

pub const NUM_COLORS: usize = 8;

pub fn compute_graph(commits: Vec<Commit>) -> Vec<CommitWithGraph> {
    let mut active_lanes: Vec<Option<String>> = Vec::new();
    let mut lane_colors: Vec<usize> = Vec::new();
    let mut next_color: usize = 0;

    let mut result = Vec::with_capacity(commits.len());

    for commit in commits {
        let mut segments = Vec::new();

        // 1. Identify which column the current commit sits in
        let node_col = if let Some(idx) = active_lanes.iter().position(|l| l.as_deref() == Some(&commit.hash)) {
            idx
        } else {
            let col = active_lanes.iter().position(|l| l.is_none()).unwrap_or_else(|| {
                active_lanes.push(None);
                lane_colors.push(next_color % NUM_COLORS);
                next_color += 1;
                active_lanes.len() - 1
            });
            col
        };

        let node_color = lane_colors[node_col];

        // 2. Incoming lines from top (y = 0)
        for col in 0..active_lanes.len() {
            if active_lanes[col].is_some() {
                let color = lane_colors[col];
                if col == node_col {
                    // Line terminates at this commit's node (from Top to Center)
                    segments.push(GraphSegment {
                        from_col: col,
                        from_y: 0,
                        to_col: col,
                        to_y: 1,
                        color_index: color,
                    });
                } else {
                    // Passing branch continues straight through (from Top to Bottom)
                    segments.push(GraphSegment {
                        from_col: col,
                        from_y: 0,
                        to_col: col,
                        to_y: 2,
                        color_index: color,
                    });
                }
            }
        }

        // Current commit is resolved, clear its slot in active_lanes
        active_lanes[node_col] = None;

        // 3. Connect to parents towards bottom (y = 2)
        if !commit.parents.is_empty() {
            let p0 = &commit.parents[0];
            if let Some(existing) = active_lanes.iter().position(|l| l.as_deref() == Some(p0)) {
                segments.push(GraphSegment {
                    from_col: node_col,
                    from_y: 1,
                    to_col: existing,
                    to_y: 2,
                    color_index: node_color,
                });
            } else {
                active_lanes[node_col] = Some(p0.clone());
                segments.push(GraphSegment {
                    from_col: node_col,
                    from_y: 1,
                    to_col: node_col,
                    to_y: 2,
                    color_index: node_color,
                });
            }

            // Subsequent parents (merge commit)
            for p in &commit.parents[1..] {
                if let Some(existing) = active_lanes.iter().position(|l| l.as_deref() == Some(p)) {
                    segments.push(GraphSegment {
                        from_col: node_col,
                        from_y: 1,
                        to_col: existing,
                        to_y: 2,
                        color_index: lane_colors[existing],
                    });
                } else {
                    let new_col = active_lanes.iter().position(|l| l.is_none()).unwrap_or_else(|| {
                        active_lanes.push(None);
                        lane_colors.push(next_color % NUM_COLORS);
                        next_color += 1;
                        active_lanes.len() - 1
                    });
                    active_lanes[new_col] = Some(p.clone());
                    let p_color = lane_colors[new_col];
                    segments.push(GraphSegment {
                        from_col: node_col,
                        from_y: 1,
                        to_col: new_col,
                        to_y: 2,
                        color_index: p_color,
                    });
                }
            }
        }

        // Clean up trailing None values from active_lanes
        while active_lanes.last() == Some(&None) {
            active_lanes.pop();
            lane_colors.pop();
        }

        // Calculate max_col in this row for SVG bounding box width
        let mut max_col = node_col;
        for s in &segments {
            max_col = max_col.max(s.from_col).max(s.to_col);
        }

        result.push(CommitWithGraph {
            commit,
            node_col,
            color_index: node_color,
            max_col,
            segments,
        });
    }

    result
}
