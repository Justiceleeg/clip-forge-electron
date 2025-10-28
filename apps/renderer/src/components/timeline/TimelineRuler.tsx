import React from "react";
import { formatTime, getTimeIntervals } from "@shared/utils/timeUtils";

interface TimelineRulerProps {
  duration: number;
  canvasWidth: number;
  trackHeaderWidth: number;
  zoomLevel?: number;
  onRulerClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  duration,
  canvasWidth,
  trackHeaderWidth,
  zoomLevel = 1,
  onRulerClick,
}) => {
  const timelineWidth = canvasWidth - trackHeaderWidth;

  // Calculate appropriate time intervals based on duration and zoom level
  const { interval, minorInterval } = getTimeIntervals(duration, zoomLevel);

  // Generate time markers - when zoomed in, show more markers
  const timeMarkers = [];
  const effectiveDuration = duration / zoomLevel; // Effective duration for display
  for (let time = 0; time <= effectiveDuration; time += interval) {
    const x = (time / effectiveDuration) * timelineWidth; // Start from 0 since ruler is offset
    timeMarkers.push({ time, x });
  }

  return (
    <div
      className="absolute top-0 left-24 w-full h-8 bg-gray-700 border-b border-gray-600 z-30 cursor-pointer"
      onClick={onRulerClick}
    >
      {/* Time markers */}
      {timeMarkers.map((marker, index) => (
        <div key={index}>
          {/* Vertical line */}
          <div
            className="absolute top-0 w-px bg-gray-500"
            style={{
              left: `${marker.x}px`,
              height: "100%",
            }}
          />

          {/* Time label */}
          <div
            className="absolute top-1 text-xs text-gray-300 font-mono transform -translate-x-1/2"
            style={{
              left: `${marker.x}px`,
              fontSize: "10px",
            }}
          >
            {formatTime(marker.time)}
          </div>
        </div>
      ))}

      {/* Minor tick marks for better precision */}
      {interval > 1 && (
        <>
          {timeMarkers.slice(0, -1).map((marker, index) => {
            const minorTime = marker.time + minorInterval;
            if (minorTime >= effectiveDuration) return null;

            const minorX = (minorTime / effectiveDuration) * timelineWidth;

            return (
              <div key={`minor-${index}`}>
                <div
                  className="absolute top-2 w-px bg-gray-600"
                  style={{
                    left: `${minorX}px`,
                    height: "4px",
                  }}
                />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};
