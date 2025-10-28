import React from "react";

interface PlayheadProps {
  position: number;
  duration: number;
  canvasWidth: number;
  canvasHeight: number;
  trackHeaderWidth: number;
  rulerHeight?: number;
  zoomLevel?: number;
}

export const Playhead: React.FC<PlayheadProps> = ({
  position,
  duration,
  canvasWidth,
  canvasHeight,
  trackHeaderWidth,
  rulerHeight = 32,
  zoomLevel = 1,
}) => {
  // Calculate playhead position accounting for zoom
  const timelineWidth = canvasWidth - trackHeaderWidth;
  // When zoomed in, the same time takes up more visual space
  const playheadX =
    trackHeaderWidth + (position / (duration / zoomLevel)) * timelineWidth;

  // Don't render if position is invalid
  if (position < 0 || position > duration || duration <= 0) {
    return null;
  }

  return (
    <>
      {/* Playhead line */}
      <div
        className="absolute w-0.5 bg-red-500 pointer-events-none z-10"
        style={{
          left: `${playheadX}px`,
          top: `${rulerHeight}px`,
          height: `${canvasHeight - rulerHeight}px`,
          boxShadow: "0 0 4px rgba(239, 68, 68, 0.5)",
        }}
      />

      {/* Playhead head */}
      <div
        className="absolute w-3 h-3 bg-red-500 transform -translate-x-1/2 -translate-y-1 pointer-events-none z-20"
        style={{
          left: `${playheadX}px`,
          top: `${rulerHeight}px`,
          clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
        }}
      />

      {/* Time indicator */}
      <div
        className="absolute bg-red-500 text-white text-xs px-1 py-0.5 rounded transform -translate-x-1/2 pointer-events-none z-20"
        style={{
          left: `${playheadX}px`,
          top: `${rulerHeight - 20}px`,
          fontSize: "10px",
          whiteSpace: "nowrap",
        }}
      >
        {position.toFixed(1)}s
      </div>
    </>
  );
};
