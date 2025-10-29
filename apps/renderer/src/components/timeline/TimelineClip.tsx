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
  onMoveToTrack?: (clipId: string, newTrackId: string) => void;
  allClips?: TimelineClipType[]; // All clips in the track for hover detection
  pixelsPerSecond: number; // For calculating time from pixel drag
}

export const TimelineClip: React.FC<TimelineClipProps> = ({
  clip,
  trackId,
  left,
  width,
  height,
  top,
  isSelected,
  onSelect,
  onTrim,
  onReorder,
  onReorderRelative: _onReorderRelative,
  onMoveToTrack,
  allClips: _allClips,
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
      // Ignore right-clicks (context menu)
      if (e.button !== 0) {
        return;
      }

      // Always select the clip when clicked
      onSelect();
      
      if (trimZone === "none") {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;

      const startX = e.clientX;

      // Body drag for repositioning and cross-track movement
      if (trimZone === "body") {
        let draggedElement: HTMLDivElement | null = null;
        let hasLeftTrack = false; // Track if mouse has left the track row bounds
        const originalY = e.clientY;
        const trackHeight = 48;
        
        // Calculate grab offset: where within the clip (in time) did the user click?
        const clipRect = clipRef.current?.getBoundingClientRect();
        const grabOffsetPixels = clipRect ? (e.clientX - clipRect.left) : 0;
        const grabOffsetTime = grabOffsetPixels / pixelsPerSecond; // Convert pixels to seconds

        const handleMouseMove = (e: MouseEvent) => {
          const verticalMovement = Math.abs(e.clientY - originalY);
          
          // Check if mouse has left the track row bounds (not just moved vertically)
          if (!hasLeftTrack && verticalMovement > trackHeight / 2) {
            hasLeftTrack = true;
          }

          // Create dragged preview only if we've left the track row
          if (hasLeftTrack && !draggedElement && clipRef.current) {
            draggedElement = clipRef.current.cloneNode(true) as HTMLDivElement;
            draggedElement.style.position = 'fixed';
            draggedElement.style.pointerEvents = 'none';
            draggedElement.style.opacity = '0.7';
            draggedElement.style.zIndex = '9999';
            draggedElement.style.width = `${clipRef.current.offsetWidth}px`;
            draggedElement.style.height = `${clipRef.current.offsetHeight}px`;
            document.body.appendChild(draggedElement);
          }

          if (draggedElement) {
            draggedElement.style.left = `${e.clientX - 50}px`;
            draggedElement.style.top = `${e.clientY - 20}px`;
          }

          // Visual feedback during horizontal drag (within same track)
          if (!hasLeftTrack && clipRef.current) {
            const deltaX = e.clientX - startX;
            // Show clip sliding with transform during drag
            clipRef.current.style.transform = `translateX(${deltaX}px)`;
            clipRef.current.style.opacity = '0.9';
          } else if (hasLeftTrack && clipRef.current) {
            // Hide original when dragging to different track
            clipRef.current.style.transform = '';
            clipRef.current.style.opacity = '0.3';
          }
        };

        const handleMouseUp = (e: MouseEvent) => {
          isDragging.current = false;
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);

          // Remove dragged preview
          if (draggedElement) {
            draggedElement.remove();
          }

          // Restore original clip visibility and transform
          if (clipRef.current) {
            clipRef.current.style.opacity = '1';
            clipRef.current.style.transform = '';
          }

          // Calculate new position based on drop location
          const timelineContainer = document.querySelector('.timeline-container');
          if (!timelineContainer) return;

          const containerRect = timelineContainer.getBoundingClientRect();
          const trackHeaderWidth = 100;
          const rulerHeight = 32;
          
          // Calculate time position from X coordinate
          const dropX = e.clientX - containerRect.left - trackHeaderWidth;
          const timelineWidth = containerRect.width - trackHeaderWidth;
          
          // Calculate the time position where the mouse is
          const totalDuration = timelineWidth / pixelsPerSecond;
          const mouseTime = Math.max(0, (dropX / timelineWidth) * totalDuration);
          
          // Subtract the grab offset to get the clip's new start time
          // This ensures the point where you grabbed stays under your mouse
          const newStartTime = Math.max(0, mouseTime - grabOffsetTime);
          
          // Calculate which track was targeted based on Y coordinate
          const dropY = e.clientY - containerRect.top;
          const trackHeight = 48;
          const targetTrackIndex = Math.floor((dropY - rulerHeight) / trackHeight);
          
          // Find the track element to get track ID
          const trackElements = document.querySelectorAll('[data-track-id]');
          let targetTrackId = trackId; // Default to current track
          
          if (trackElements[targetTrackIndex]) {
            const trackElement = trackElements[targetTrackIndex] as HTMLElement;
            targetTrackId = trackElement.getAttribute('data-track-id') || trackId;
          }

          // Check if we're moving to a different track
          const isChangingTracks = targetTrackId !== trackId;

          // If changing tracks, use moveClipToTrack
          if (isChangingTracks && onMoveToTrack) {
            // First move to new track
            onMoveToTrack(clip.id, targetTrackId);
            
            // Then reorder to new position on that track
            if (onReorder) {
              // Small delay to let the track change happen
              setTimeout(() => {
                onReorder(clip.id, newStartTime);
              }, 50);
            }
          } else if (onReorder) {
            // Same track, just reorder
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
      clip.endTime,
      clip.trimStart,
      clip.trimEnd,
      onTrim,
      onReorder,
      onMoveToTrack,
      trackId,
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

  const getOutlineColor = () => {
    // Use outline instead of border so it doesn't take up space
    if (isSelected) return "outline-white outline-2";
    // No outline for unselected clips
    return "outline-none";
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
      } ${getClipColor()} ${getOutlineColor()}`}
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
