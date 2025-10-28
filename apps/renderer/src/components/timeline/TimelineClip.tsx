import React, { useState } from "react";
import { TimelineClip as TimelineClipType } from "@clipforge/shared";

interface TimelineClipProps {
  clip: TimelineClipType;
  trackId: string;
  left: number;
  width: number;
  top: number;
  height: number;
  isSelected: boolean;
  onSelect: () => void;
}

export const TimelineClip: React.FC<TimelineClipProps> = ({
  clip,
  left,
  width,
  top,
  height,
  isSelected,
  onSelect,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate clip duration for display
  const clipDuration = clip.endTime - clip.startTime;

  // Determine clip color based on selection and hover state
  const getClipColor = () => {
    if (isSelected) return "bg-blue-500";
    if (isHovered) return "bg-blue-400";
    return "bg-blue-600";
  };

  const getBorderColor = () => {
    if (isSelected) return "outline outline-2 outline-white";
    if (isHovered) return "border border-blue-200";
    return "border border-blue-700";
  };

  return (
    <div
      className={`absolute cursor-pointer rounded transition-all duration-200 ${getClipColor()} ${getBorderColor()}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: `${top}px`,
        height: `${height}px`,
        minWidth: "20px", // Ensure minimum width for visibility
      }}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`Clip: ${clipDuration.toFixed(1)}s (${clip.startTime.toFixed(
        1
      )}s - ${clip.endTime.toFixed(1)}s)`}
    >
      {/* Clip content */}
      <div className="h-full flex items-center justify-between px-2">
        {/* Clip duration text */}
        <div className="text-xs text-white font-medium truncate">
          {clipDuration.toFixed(1)}s
        </div>

        {/* Trim handles (only show on hover or selection) */}
        {(isHovered || isSelected) && width > 40 && (
          <>
            {/* Left trim handle */}
            <div
              className="absolute left-0 top-0 w-2 h-full bg-blue-300 cursor-ew-resize hover:bg-blue-200"
              style={{
                borderTopLeftRadius: "4px",
                borderBottomLeftRadius: "4px",
              }}
              title="Trim start"
            />

            {/* Right trim handle */}
            <div
              className="absolute right-0 top-0 w-2 h-full bg-blue-300 cursor-ew-resize hover:bg-blue-200"
              style={{
                borderTopRightRadius: "4px",
                borderBottomRightRadius: "4px",
              }}
              title="Trim end"
            />
          </>
        )}
      </div>
    </div>
  );
};
