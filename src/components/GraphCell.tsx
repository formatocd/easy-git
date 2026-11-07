import React from "react";
import { GraphSegment } from "../api/git";

export const GRAPH_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#ef4444", // Red
  "#14b8a6", // Teal
];

interface GraphCellProps {
  node_col: number;
  color_index: number;
  max_col: number;
  segments: GraphSegment[];
  isSelected?: boolean;
}

const LANE_WIDTH = 16;
const ROW_HEIGHT = 32;
const OFFSET_X = 12;

export const GraphCell: React.FC<GraphCellProps> = ({
  node_col,
  color_index,
  max_col,
  segments,
  isSelected,
}) => {
  const width = Math.max(48, (max_col + 2) * LANE_WIDTH + OFFSET_X);
  const midY = ROW_HEIGHT / 2;

  const getY = (yType: number) => {
    switch (yType) {
      case 0:
        return 0;
      case 1:
        return midY;
      case 2:
        return ROW_HEIGHT;
      default:
        return midY;
    }
  };

  const nodeColor = GRAPH_COLORS[color_index % GRAPH_COLORS.length];
  const nodeX = OFFSET_X + node_col * LANE_WIDTH;

  return (
    <svg
      width={width}
      height={ROW_HEIGHT}
      className="shrink-0 overflow-visible"
      style={{ display: "block" }}
    >
      {/* 1. Draw connection segments and passing lines */}
      {segments.map((seg, idx) => {
        const x1 = OFFSET_X + seg.from_col * LANE_WIDTH;
        const y1 = getY(seg.from_y);
        const x2 = OFFSET_X + seg.to_col * LANE_WIDTH;
        const y2 = getY(seg.to_y);
        const strokeColor = GRAPH_COLORS[seg.color_index % GRAPH_COLORS.length];

        if (x1 === x2) {
          // Straight line
          return (
            <line
              key={idx}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        } else {
          // Smooth Bezier curve for branch/merge
          const cpY = (y1 + y2) / 2;
          const d = `M ${x1} ${y1} C ${x1} ${cpY}, ${x2} ${cpY}, ${x2} ${y2}`;
          return (
            <path
              key={idx}
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        }
      })}

      {/* 2. Draw Commit Node (circle) */}
      <circle
        cx={nodeX}
        cy={midY}
        r={isSelected ? 5.5 : 4.5}
        fill={nodeColor}
        stroke="#18181b"
        strokeWidth={isSelected ? 2.5 : 2}
      />
    </svg>
  );
};
