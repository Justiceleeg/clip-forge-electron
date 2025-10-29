import React, { useState, useRef, useCallback, useMemo } from "react";
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
  onTrim?: (clipId: string, trimStart: number, trimEnd: number) => void;
  onReorder?: (clipId: string, newStartTime: number) => void;
  onReorderRelative?: (
    clipId: string,
    targetClipId: string,
    position: "before" | "after"
  ) => void;
  allClips?: TimelineClipType[]; // All clips in the track for hover detection
  pixelsPerSecond: number; // For calculating time from pixel drag
}

export const TimelineClip: React.FC<TimelineClipProps> = ({
  clip,
  left,
  width,
  height,
  top,
  isSelected,
  onSelect,
  onTrim,
  onReorder,
  onReorderRelative,
  allClips,
  pixelsPerSecond,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [trimZone, setTrimZone] = useState<"none" | "start" | "end" | "body">(
    "none"
  );
  const [activeTrim, setActiveTrim] = useState<{
    trimStart: number;
    trimEnd: number;
  } | null>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const pendingTrim = useRef<{ trimStart: number; trimEnd: number } | null>(
    null
  );

  // Use active trim during drag, otherwise use actual clip trim
  const displayTrimStart = activeTrim ? activeTrim.trimStart : clip.trimStart;
  const displayTrimEnd = activeTrim ? activeTrim.trimEnd : clip.trimEnd;
  const trimmedDuration = displayTrimEnd - displayTrimStart;

  // Calculate display width based on trimmed duration
  // The width prop is based on the actual clip duration, so we need to adjust for visual feedback
  const displayWidth = useMemo(() => {
    const actualTrimmedDuration = clip.trimEnd - clip.trimStart;
    return actualTrimmedDuration > 0
      ? width * (trimmedDuration / actualTrimmedDuration)
      : width;
  }, [width, trimmedDuration, clip.trimStart, clip.trimEnd]);

  // Detect which zone the mouse is in (trim edges or body for reordering)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging.current || !clipRef.current) return;

    const rect = clipRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const edgeThreshold = 20; // 20px from edge for easier targeting

    if (relativeX <= edgeThreshold) {
      setTrimZone("start");
    } else if (relativeX >= rect.width - edgeThreshold) {
      setTrimZone("end");
    } else {
      // Middle of clip - body drag for reordering
      setTrimZone("body");
    }
  }, []);

  // Get cursor style based on trim zone
  const getCursor = () => {
    if (trimZone === "start" || trimZone === "end") return "ew-resize";
    if (trimZone === "body") return "move";
    return "pointer";
  };

  // Handle trim operations - store in pendingTrim instead of calling onTrim
  // deltaX is a change in pixels from drag start
  const handleTrimStart = useCallback(
    (deltaX: number) => {
      if (!pendingTrim.current) return;

      // Prevent invalid calculations
      if (width <= 0 || clip.trimEnd <= 0) {
        console.warn("Invalid width or trim end:", {
          width,
          trimEnd: clip.trimEnd,
        });
        return;
      }

      // Convert pixel delta to time delta
      const trimmedDuration = clip.trimEnd - clip.trimStart;
      const pixelsPerSecond = width / trimmedDuration;
      const timeDelta = deltaX / pixelsPerSecond;

      // Calculate new trim start
      const newTrimStart = Math.max(
        0,
        Math.min(clip.trimEnd - 0.1, clip.trimStart + timeDelta)
      );

      pendingTrim.current.trimStart = newTrimStart;
    },
    [width, clip.trimStart, clip.trimEnd]
  );

  const handleTrimEnd = useCallback(
    (deltaX: number) => {
      if (!pendingTrim.current) return;

      // Prevent division by zero
      const trimmedDuration = clip.trimEnd - clip.trimStart;
      if (trimmedDuration <= 0) {
        console.warn("Invalid trim duration:", trimmedDuration);
        return;
      }

      // Convert pixel delta to time delta
      const pixelsPerSecond = width / trimmedDuration;
      const timeDelta = deltaX / pixelsPerSecond;

      // Calculate new trim end
      const newTrimEnd = Math.max(
        clip.trimStart + 0.1,
        Math.min(clip.originalDuration, clip.trimEnd + timeDelta)
      );

      pendingTrim.current.trimEnd = newTrimEnd;
    },
    [width, clip.trimStart, clip.trimEnd, clip.originalDuration]
  );

  // Handle mouse down to start trim drag or body drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Always select the clip when clicked
      onSelect();
      
      if (trimZone === "none") {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;

      const startX = e.clientX;

      // Body drag for reordering
      if (trimZone === "body" && (onReorder || onReorderRelative)) {
        const handleMouseMove = (_e: MouseEvent) => {
          // Visual feedback could be added here
        };

        const handleMouseUp = (e: MouseEvent) => {
          isDragging.current = false;
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);

          // Find which element is under the mouse
          const elementUnderMouse = document.elementFromPoint(
            e.clientX,
            e.clientY
          );
          const clipElement = elementUnderMouse?.closest(
            "[data-clip-id]"
          ) as HTMLElement;

          if (clipElement && onReorderRelative && allClips) {
            const targetClipId = clipElement.getAttribute("data-clip-id");

            if (targetClipId && targetClipId !== clip.id) {
              // Determine which half of the clip we're over
              const rect = clipElement.getBoundingClientRect();
              const relativeX = e.clientX - rect.left;
              const position = relativeX < rect.width / 2 ? "before" : "after";

              console.log(
                `Drop on clip ${targetClipId}, position: ${position}`
              );
              onReorderRelative(clip.id, targetClipId, position);
              return;
            }
          }

          // Fallback to time-based reordering if available
          if (onReorder) {
            const deltaX = e.clientX - startX;
            const timeDelta = deltaX / pixelsPerSecond;
            const newStartTime = Math.max(0, clip.startTime + timeDelta);
            onReorder(clip.id, newStartTime);
          }
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return;
      }

      // Trim drag (existing logic)
      // Initialize pending trim and active trim with current values
      const initialTrim = {
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
      };
      pendingTrim.current = initialTrim;
      setActiveTrim(initialTrim);

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;

        if (trimZone === "start") {
          handleTrimStart(deltaX);
        } else if (trimZone === "end") {
          handleTrimEnd(deltaX);
        }

        // Update visual feedback during drag
        if (pendingTrim.current) {
          setActiveTrim({ ...pendingTrim.current });
        }
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Apply the pending trim only after drag is complete
        if (pendingTrim.current && onTrim) {
          onTrim(
            clip.id,
            pendingTrim.current.trimStart,
            pendingTrim.current.trimEnd
          );
          pendingTrim.current = null;
        }

        // Clear active trim visual feedback
        setActiveTrim(null);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      trimZone,
      onSelect,
      clip.id,
      clip.startTime,
      clip.trimStart,
      clip.trimEnd,
      onTrim,
      onReorder,
      pixelsPerSecond,
      handleTrimStart,
      handleTrimEnd,
    ]
  );

  // Determine clip color based on selection and hover state
  const getClipColor = () => {
    if (isSelected) return "bg-blue-500";
    if (isHovered) return "bg-blue-400";
    return "bg-blue-600";
  };

  const getBorderColor = () => {
    // Only show border when selected (white border for selection)
    if (isSelected) return "border-white border-2";
    // No border for unselected clips
    return "border-transparent border";
  };

  // Check if clip is trimmed from original source video
  // Compare against originalDuration to see if this clip has been trimmed
  const isTrimmed = clip.trimStart > 0 || clip.trimEnd < clip.originalDuration;

  return (
    <div
      ref={clipRef}
      data-clip-id={clip.id}
      className={`absolute rounded ${
        activeTrim ? "" : "transition-all duration-200"
      } ${getClipColor()} ${getBorderColor()}`}
      style={{
        left: `${left}px`,
        width: `${displayWidth}px`,
        top: `${top}px`,
        height: `${height}px`,
        minWidth: "20px",
        cursor: getCursor(),
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setTrimZone("none");
      }}
      title={`Clip: ${trimmedDuration.toFixed(1)}s${
        isTrimmed ? " (trimmed)" : ""
      }`}
    >
      {/* Clip content */}
      <div className="h-full flex items-center justify-between px-2 pointer-events-none">
        {/* Clip duration text */}
        <div className="text-xs text-white font-medium truncate">
          {trimmedDuration.toFixed(1)}s
          {isTrimmed && <span className="text-gray-300 ml-1">✂️</span>}
        </div>
      </div>

      {/* Visual trim zone indicators on hover */}
      {isHovered && (trimZone === "start" || trimZone === "end") && (
        <div
          className={`absolute top-0 ${
            trimZone === "start" ? "left-0" : "right-0"
          } w-1 h-full bg-white opacity-80 pointer-events-none`}
        />
      )}

      {/* Wider hover zone indicator for better visibility */}
      {isHovered && trimZone === "start" && (
        <div className="absolute top-0 left-0 w-5 h-full bg-white opacity-10 pointer-events-none" />
      )}
      {isHovered && trimZone === "end" && (
        <div className="absolute top-0 right-0 w-5 h-full bg-white opacity-10 pointer-events-none" />
      )}
    </div>
  );
};
