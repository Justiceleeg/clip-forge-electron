import React, { useRef, useEffect, useState, useMemo } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useTimelineStore } from "../../stores/timelineStore";
import { TimelineTrack } from "./TimelineTrack";
import { Playhead } from "./Playhead";

interface TimelineProps {
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 200 });

  const { clips } = useProjectStore();

  const {
    timeline,
    calculateTimelineDuration,
    createTimelineTracks,
    setPlayheadPosition,
    selectClip,
    updateTimeline,
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
          height: Math.max(200, timeline.tracks.length * 60 + 40), // Dynamic height based on tracks
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
    const timelineWidth = canvasSize.width - 100; // Account for track headers
    const timePosition = (x / timelineWidth) * timeline.duration;

    setPlayheadPosition(timePosition);
  };

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
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal track separators
    const trackHeight = 60;
    for (let i = 1; i < timeline.tracks.length; i++) {
      const y = i * trackHeight;
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

  return (
    <div className={`bg-gray-800 rounded-lg ${className}`}>
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">Timeline</h2>
        <div className="text-sm text-gray-400 mt-1">
          Duration: {timeline.duration.toFixed(1)}s | Clips: {clips.length}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: `${canvasSize.height}px` }}
      >
        {/* Track Headers */}
        <div className="absolute left-0 top-0 w-24 h-full bg-gray-700 border-r border-gray-600">
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
          className="absolute left-24 top-0 cursor-pointer"
          onClick={handleTimelineClick}
        />

        {/* Playhead */}
        <Playhead
          position={timeline.playheadPosition}
          duration={timeline.duration}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          trackHeaderWidth={100}
        />

        {/* Timeline Tracks */}
        <div className="absolute left-24 top-0 w-full h-full pointer-events-none">
          {tracks.map((track) => (
            <TimelineTrack
              key={track.id}
              track={track}
              clips={track.clips}
              trackIndex={tracks.indexOf(track)}
              timelineDuration={timeline.duration}
              canvasWidth={canvasSize.width - 100}
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
