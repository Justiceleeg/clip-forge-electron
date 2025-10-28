import React, { useRef, useEffect, useState, useMemo } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useTimelineStore } from "../../stores/timelineStore";
import { TimelineTrack } from "./TimelineTrack";
import { Playhead } from "./Playhead";
import { TimelineRuler } from "./TimelineRuler";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { getTimeIntervals } from "@shared/utils/timeUtils";

interface TimelineProps {
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 200 });
  const rulerHeight = 32; // Height for the timeline ruler

  const { clips } = useProjectStore();

  const {
    timeline,
    calculateTimelineDuration,
    createTimelineTracks,
    setPlayheadPosition,
    selectClip,
    updateTimeline,
    setZoomLevel,
  } = useTimelineStore();

  // Calculate timeline data using useMemo to prevent unnecessary recalculations
  const timelineData = useMemo(() => {
    const duration = calculateTimelineDuration(clips);
    const tracks = createTimelineTracks(clips);
    return { duration, tracks };
  }, [clips, calculateTimelineDuration, createTimelineTracks]);

  // Update timeline when clips change
  useEffect(() => {
    updateTimeline({
      duration: timelineData.duration,
      tracks: timelineData.tracks,
    });
  }, [timelineData, updateTimeline]);

  // Handle canvas resize
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: rect.width,
          height: Math.max(200, timeline.tracks.length * 60 + 40 + rulerHeight), // Dynamic height based on tracks + ruler
        });
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [timeline.tracks.length]);

  // Handle playhead click-to-seek
  const handleTimelineClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const trackHeaderWidth = 100;
    const timelineWidth = canvasSize.width - trackHeaderWidth;

    // Calculate time position accounting for zoom
    // When zoomed in, the same pixel represents less time
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
        target.closest(".timeline-ruler")
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

  // Get current time interval for display
  const currentTimeInterval = getTimeIntervals(
    timeline.duration,
    timeline.zoomLevel
  );

  return (
    <div className={`bg-gray-800 rounded-lg ${className}`}>
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
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: `${canvasSize.height}px` }}
      >
        {/* Timeline Ruler */}
        <div className="timeline-ruler">
          <TimelineRuler
            duration={timeline.duration}
            canvasWidth={canvasSize.width}
            trackHeaderWidth={100}
            zoomLevel={timeline.zoomLevel}
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
          className="absolute left-24 top-0 cursor-pointer timeline-canvas"
          onClick={handleTimelineClick}
        />

        {/* Playhead */}
        <Playhead
          position={timeline.playheadPosition}
          duration={timeline.duration}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          trackHeaderWidth={100}
          rulerHeight={rulerHeight}
          zoomLevel={timeline.zoomLevel}
        />

        {/* Timeline Tracks */}
        <div
          className="absolute left-24 w-full h-full pointer-events-none"
          style={{ top: `${rulerHeight}px` }}
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
                selectClip(clipId);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
