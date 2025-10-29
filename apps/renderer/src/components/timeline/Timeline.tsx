import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useTimelineStore } from "../../stores/timelineStore";
import { VideoClip } from "@clipforge/shared";
import { TimelineTrack } from "./TimelineTrack";
import { Playhead } from "./Playhead";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineContextMenu } from "./TimelineContextMenu";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Scissors,
  Trash2,
  TableColumnsSplit,
} from "lucide-react";
import { getTimeIntervals } from "@shared/utils/timeUtils";

interface TimelineProps {
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const rulerHeight = 32; // Height for the timeline ruler

  const {
    clips,
    selectClip: selectProjectClip,
    addClip: addProjectClip,
  } = useProjectStore();

  const {
    timeline,
    setPlayheadPosition,
    selectClip,
    updateTimeline,
    setZoomLevel,
    trimClip,
    trimMode,
    startTrimMode,
    updateTrimMode,
    applyTrimMode,
    addClipToTrack,
    reorderClip,
    reorderClipRelative,
    splitClip,
    deleteClips,
    getClipAtPlayhead,
    moveClipToTrack,
  } = useTimelineStore();

  // Calculate timeline data using useMemo to prevent unnecessary recalculations
  const timelineData = useMemo(() => {
    // Only calculate duration based on existing timeline clips, not project clips
    const allTimelineClips = timeline.tracks.flatMap((track) => track.clips);
    const duration =
      allTimelineClips.length > 0
        ? Math.max(...allTimelineClips.map((c) => c.endTime)) + 2
        : 60; // Default 1 minute when empty

    return { duration };
  }, [timeline.tracks]);

  // Update timeline duration when it changes
  useEffect(() => {
    if (timelineData.duration !== timeline.duration) {
      updateTimeline({
        duration: timelineData.duration,
      });
    }
  }, [timelineData.duration, timeline.duration, updateTimeline]);

  // Get timeline tracks
  const tracks = timeline.tracks;

  // Debug: Log track count
  useEffect(() => {
    console.log(
      `📊 Timeline has ${tracks.length} tracks:`,
      tracks.map((t) => t.name)
    );
  }, [tracks.length]);

  // Find the currently selected clip
  const selectedClip = useMemo(() => {
    return (
      tracks.flatMap((track) => track.clips).find((clip) => clip.selected) ||
      null
    );
  }, [tracks]);

  // Initialize 2 video tracks on mount if none exist
  useEffect(() => {
    if (timeline.tracks.length === 0) {
      updateTimeline({
        tracks: [
          {
            id: "track-1",
            name: "Video Track 1",
            type: "video" as const,
            clips: [],
            muted: false,
            volume: 1.0,
          },
          {
            id: "track-2",
            name: "Video Track 2",
            type: "video" as const,
            clips: [],
            muted: false,
            volume: 1.0,
            // Default overlay position: centered, 25% scale
            overlayPosition: {
              x: 0.5, // Center X (0.5 = 50% from left)
              y: 0.5, // Center Y (0.5 = 50% from top)
              scale: 0.25, // 25% size
            },
          },
        ],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Update trim mode when playhead moves
  useEffect(() => {
    if (trimMode.isActive) {
      updateTrimMode(timeline.playheadPosition);
    }
  }, [timeline.playheadPosition, trimMode.isActive, updateTrimMode]);

  // Handle canvas resize
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Calculate proper height based on tracks (48px per track + ruler height)
        const trackHeight = 48;
        const calculatedHeight = rulerHeight + tracks.length * trackHeight;

        setCanvasSize({
          width: rect.width,
          height: calculatedHeight,
        });
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [timeline.tracks.length, tracks.length]);

  // Handle playhead click-to-seek (only on ruler area)
  const handleRulerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const trackHeaderWidth = 100;
    const timelineWidth = canvasSize.width - trackHeaderWidth;

    // Calculate time position accounting for zoom
    const timePosition =
      (x / timelineWidth) * (timeline.duration / timeline.zoomLevel);

    setPlayheadPosition(timePosition);
  };

  // Zoom controls with better limits
  const handleZoomIn = () => {
    const newZoomLevel = Math.min(timeline.zoomLevel * 1.5, 20); // Max 20x zoom
    setZoomLevel(newZoomLevel);
  };

  const handleZoomOut = () => {
    const newZoomLevel = Math.max(timeline.zoomLevel / 1.5, 0.05); // Min 0.05x zoom (5%)
    setZoomLevel(newZoomLevel);
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  // Handle drag and drop from media library
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if we're dragging a clip
    if (e.dataTransfer.types.includes("application/x-clipforge-clip")) {
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      try {
        const clipData = e.dataTransfer.getData("application/x-clipforge-clip");
        if (!clipData) return;

        const clip: VideoClip = JSON.parse(clipData);

        // Ensure the clip exists in the project store
        const existingClip = clips.find((c) => c.id === clip.id);
        if (!existingClip) {
          // Add to project store if not already there
          addProjectClip(clip);
        }

        // Calculate which track the drop occurred on
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const dropY = e.clientY - rect.top;
        const trackHeight = 48;
        const trackIndex = Math.floor((dropY - rulerHeight) / trackHeight);

        // Clamp trackIndex to valid range
        const validTrackIndex = Math.max(
          0,
          Math.min(trackIndex, timeline.tracks.length - 1)
        );

        const targetTrack = timeline.tracks[validTrackIndex];

        if (!targetTrack) {
          console.warn("No valid target track found");
          return;
        }

        // Calculate position at the end of existing clips on this track
        const existingClips = targetTrack.clips;
        const lastClipEnd =
          existingClips.length > 0
            ? Math.max(...existingClips.map((c) => c.endTime))
            : 0;

        // Add clip to the calculated track at the end
        addClipToTrack(targetTrack.id, {
          videoClipId: clip.id,
          trackId: targetTrack.id,
          startTime: lastClipEnd,
          endTime: lastClipEnd + clip.duration,
          trimStart: 0,
          trimEnd: clip.duration,
          originalDuration: clip.duration,
          selected: false,
        });

        console.log(
          `Added clip "${clip.name}" to ${targetTrack.name} at position ${lastClipEnd}s`
        );
      } catch (err) {
        console.error("Error handling clip drop:", err);
      }
    },
    [clips, timeline.tracks, addProjectClip, addClipToTrack, rulerHeight]
  );

  // Trim button handlers
  const handleTrimClick = () => {
    if (selectedClip) {
      if (trimMode.isActive) {
        applyTrimMode();
      } else {
        startTrimMode(selectedClip.id);
      }
    }
  };

  // Split handler (keyboard shortcut S)
  const handleSplitShortcut = () => {
    // Prioritize selected clip over clip at playhead
    const clipToSplit = selectedClip || getClipAtPlayhead();
    if (clipToSplit) {
      splitClip(clipToSplit.id, timeline.playheadPosition);
    }
  };

  // Delete handler (keyboard shortcut Delete/Backspace)
  const handleDeleteShortcut = () => {
    const selectedClips = tracks
      .flatMap((track) => track.clips)
      .filter((clip) => clip.selected);

    if (selectedClips.length > 0) {
      deleteClips(selectedClips.map((clip) => clip.id));
    }
  };

  // Context menu handlers
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleContextMenuSplit = () => {
    handleSplitShortcut();
  };

  const handleContextMenuDelete = () => {
    handleDeleteShortcut();
  };

  const handleContextMenuTrim = () => {
    if (selectedClip) {
      if (trimMode.isActive) {
        applyTrimMode();
      } else {
        startTrimMode(selectedClip.id);
      }
    }
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  // Check if trim is available (at least one clip selected)
  const canTrim = useMemo(() => {
    return selectedClip !== null;
  }, [selectedClip]);

  // Check if split is available (playhead within a clip)
  const canSplit = useMemo(() => {
    // Check selected clip first, then clip at playhead
    const clipToCheck = selectedClip || getClipAtPlayhead();
    if (!clipToCheck) return false;

    // Ensure playhead is not too close to clip edges (0.1s minimum on each side)
    const offsetInClip = timeline.playheadPosition - clipToCheck.startTime;
    const clipDuration = clipToCheck.endTime - clipToCheck.startTime;
    return offsetInClip >= 0.1 && offsetInClip <= clipDuration - 0.1;
  }, [timeline.playheadPosition, tracks, selectedClip]);

  // Check if delete is available (at least one clip selected)
  const canDelete = useMemo(() => {
    return tracks.flatMap((track) => track.clips).some((clip) => clip.selected);
  }, [tracks]);

  // Keyboard shortcuts and wheel zoom
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Split shortcut (S key)
      if (event.key === "s" || event.key === "S") {
        if (
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          handleSplitShortcut();
          return;
        }
      }

      // Delete shortcut (Delete or Backspace key)
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handleDeleteShortcut();
        return;
      }

      // Zoom shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case "=":
          case "+":
            event.preventDefault();
            handleZoomIn();
            break;
          case "-":
            event.preventDefault();
            handleZoomOut();
            break;
          case "0":
            event.preventDefault();
            handleResetZoom();
            break;
        }
      }
    };

    // Non-passive wheel event listener for proper preventDefault
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(".timeline-canvas") ||
        target.closest(".timeline-ruler") ||
        target.closest(".timeline-container")
      ) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoomLevel = Math.max(
          0.05,
          Math.min(20, timeline.zoomLevel * delta)
        );
        setZoomLevel(newZoomLevel);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [timeline.zoomLevel]);

  // Render timeline background and grid
  const renderTimelineBackground = (ctx: CanvasRenderingContext2D) => {
    const { width, height } = canvasSize;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#1f2937"; // gray-800
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "#374151"; // gray-700
    ctx.lineWidth = 1;

    const trackHeaderWidth = 100;
    const timelineWidth = width - trackHeaderWidth;
    const gridSpacing = timelineWidth / 10; // 10 grid divisions

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = trackHeaderWidth + i * gridSpacing;
      ctx.beginPath();
      ctx.moveTo(x, rulerHeight); // Start below ruler
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal track separators
    const trackHeight = 48;
    for (let i = 1; i < timeline.tracks.length; i++) {
      const y = rulerHeight + i * trackHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // Render timeline on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderTimelineBackground(ctx);
  }, [canvasSize, timeline.tracks.length]);

  // Get current time interval for display
  const currentTimeInterval = getTimeIntervals(
    timeline.duration,
    timeline.zoomLevel
  );

  return (
    <div className={`bg-gray-800 rounded-lg flex flex-col h-full ${className}`}>
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Duration: {timeline.duration.toFixed(1)}s | Clips: {clips.length} |
            Interval: {currentTimeInterval.format}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-300 mr-2">
              Zoom: {(timeline.zoomLevel * 100).toFixed(0)}%
            </div>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
              title="Zoom Out (Ctrl/Cmd + -)"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
              title="Reset Zoom (Ctrl/Cmd + 0)"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
              title="Zoom In (Ctrl/Cmd + +)"
            >
              <ZoomIn size={16} />
            </button>

            {/* Trim Button */}
            <div className="ml-4 flex items-center space-x-2">
              <button
                onClick={handleTrimClick}
                disabled={!selectedClip}
                className={`p-2 rounded transition-colors ${
                  trimMode.isActive
                    ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                    : selectedClip
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-gray-500 cursor-not-allowed text-gray-300"
                }`}
                title={trimMode.isActive ? "Apply Trim (T)" : "Start Trim (T)"}
              >
                <Scissors size={16} />
              </button>

              {/* Split Button */}
              <button
                onClick={handleSplitShortcut}
                disabled={!canSplit}
                className={`p-2 rounded transition-colors ${
                  canSplit
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-gray-500 cursor-not-allowed text-gray-300"
                }`}
                title="Split Clip at Playhead (S)"
              >
                <TableColumnsSplit size={16} />
              </button>

              {/* Delete Button */}
              <button
                onClick={handleDeleteShortcut}
                disabled={!canDelete}
                className={`p-2 rounded transition-colors ${
                  canDelete
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-gray-500 cursor-not-allowed text-gray-300"
                }`}
                title="Delete Selected Clip(s) (Del)"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`relative overflow-hidden flex-1 timeline-container ${
          isDragOver
            ? "bg-blue-900 bg-opacity-10 border-2 border-blue-400 border-dashed"
            : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Timeline Ruler */}
        <div className="timeline-ruler">
          <TimelineRuler
            duration={timeline.duration}
            canvasWidth={canvasSize.width}
            trackHeaderWidth={100}
            zoomLevel={timeline.zoomLevel}
            onRulerClick={handleRulerClick}
          />
        </div>

        {/* Track Headers */}
        <div
          className="absolute left-0 bg-gray-700 border-r border-gray-600"
          style={{
            top: `${rulerHeight}px`,
            width: "100px",
            height: `${canvasSize.height - rulerHeight}px`,
          }}
        >
          {tracks.map((track) => (
            <div
              key={track.id}
              className="border-b border-gray-600 flex items-center px-2"
              style={{ height: "48px" }}
            >
              <div className="text-xs text-gray-300 truncate">{track.name}</div>
            </div>
          ))}
        </div>

        {/* Timeline Canvas */}
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="absolute left-24 top-0 timeline-canvas"
        />

        {/* Playhead */}
        <div className="absolute left-24 top-0 w-full h-full">
          <Playhead
            position={timeline.playheadPosition}
            duration={timeline.duration}
            canvasWidth={canvasSize.width - 100}
            canvasHeight={canvasSize.height}
            trackHeaderWidth={0}
            rulerHeight={rulerHeight}
            zoomLevel={timeline.zoomLevel}
            onPositionChange={setPlayheadPosition}
          />
        </div>

        {/* Timeline Tracks */}
        <div
          className="absolute left-24 w-full h-full"
          style={{ top: `${rulerHeight}px` }}
          onContextMenu={handleContextMenu}
        >
          {tracks.map((track, index) => (
            <TimelineTrack
              key={track.id}
              track={track}
              clips={track.clips}
              trackIndex={index}
              timelineDuration={timeline.duration}
              canvasWidth={canvasSize.width - 100}
              zoomLevel={timeline.zoomLevel}
              onClipSelect={(clipId) => {
                // Select the timeline clip for visual feedback
                selectClip(clipId);

                // Find the timeline clip first
                const timelineClip = tracks
                  .flatMap((t) => t.clips)
                  .find((c) => c.id === clipId);
                if (timelineClip && timelineClip.videoClipId) {
                  // Find the original project clip using videoClipId
                  const clip = clips.find(
                    (c) => c.id === timelineClip.videoClipId
                  );
                  selectProjectClip(clip || null);
                }
              }}
              onTrim={trimClip}
              onReorder={reorderClip}
              onReorderRelative={reorderClipRelative}
              onMoveToTrack={moveClipToTrack}
            />
          ))}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <TimelineContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onTrim={handleContextMenuTrim}
            onSplit={handleContextMenuSplit}
            onDelete={handleContextMenuDelete}
            onClose={handleContextMenuClose}
            canTrim={canTrim}
            canSplit={canSplit}
            canDelete={canDelete}
          />
        )}
      </div>
    </div>
  );
};
