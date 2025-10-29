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
import { ZoomIn, ZoomOut, RotateCcw, Scissors } from "lucide-react";
import { getTimeIntervals } from "@shared/utils/timeUtils";

interface TimelineProps {
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
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

  // Initialize empty track on mount if none exist
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
        setCanvasSize({
          width: rect.width,
          height: rect.height, // Use container's actual height
        });
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [timeline.tracks.length]);

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

        // Get or create the first track
        let track = timeline.tracks[0];
        if (!track) {
          // Create track if it doesn't exist
          const newTrack = {
            id: "track-1",
            name: "Video Track 1",
            type: "video" as const,
            clips: [],
            muted: false,
            volume: 1.0,
          };
          updateTimeline({
            tracks: [newTrack],
          });
          track = newTrack;
        }

        // Calculate position at the end of existing clips
        const existingClips = track.clips;
        const lastClipEnd =
          existingClips.length > 0
            ? Math.max(...existingClips.map((c) => c.endTime))
            : 0;

        // Add clip to timeline at the end
        addClipToTrack(track.id, {
          videoClipId: clip.id,
          trackId: track.id,
          startTime: lastClipEnd,
          endTime: lastClipEnd + clip.duration,
          trimStart: 0,
          trimEnd: clip.duration,
          originalDuration: clip.duration,
          selected: false,
        });

        console.log(
          `Added clip "${clip.name}" to timeline at position ${lastClipEnd}s`
        );
      } catch (err) {
        console.error("Error handling clip drop:", err);
      }
    },
    [clips, timeline.tracks, addProjectClip, addClipToTrack, updateTimeline]
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

  // Keyboard shortcuts and wheel zoom
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
    const trackHeight = 60;
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

  const tracks = timeline.tracks;

  // Find the currently selected clip
  const selectedClip = useMemo(() => {
    return (
      tracks.flatMap((track) => track.clips).find((clip) => clip.selected) ||
      null
    );
  }, [tracks]);

  // Get current time interval for display
  const currentTimeInterval = getTimeIntervals(
    timeline.duration,
    timeline.zoomLevel
  );

  return (
    <div className={`bg-gray-800 rounded-lg flex flex-col h-full ${className}`}>
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Timeline</h2>
            <div className="text-sm text-gray-400 mt-1">
              Duration: {timeline.duration.toFixed(1)}s | Clips: {clips.length}{" "}
              | Interval: {currentTimeInterval.format}
            </div>
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
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : selectedClip
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-gray-500 cursor-not-allowed text-gray-300"
                }`}
                title={trimMode.isActive ? "Apply Trim" : "Start Trim"}
              >
                <Scissors size={16} />
              </button>
              {trimMode.isActive && (
                <span className="text-sm text-red-400">Trim Mode Active</span>
              )}
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
              className="h-15 border-b border-gray-600 flex items-center px-2"
              style={{ height: "60px" }}
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
          style={{ top: `${rulerHeight + 2}px` }}
        >
          {tracks.map((track) => (
            <TimelineTrack
              key={track.id}
              track={track}
              clips={track.clips}
              trackIndex={tracks.indexOf(track)}
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
            />
          ))}
        </div>
      </div>
    </div>
  );
};
