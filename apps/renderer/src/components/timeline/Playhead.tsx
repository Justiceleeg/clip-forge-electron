import React, { useState, useRef } from "react";

interface PlayheadProps {
  position: number;
  duration: number;
  canvasWidth: number;
  canvasHeight: number;
  trackHeaderWidth: number;
  rulerHeight?: number;
  zoomLevel?: number;
  onPositionChange?: (position: number) => void;
}

export const Playhead: React.FC<PlayheadProps> = ({
  position,
  duration,
  canvasWidth,
  canvasHeight,
  trackHeaderWidth,
  rulerHeight = 32,
  zoomLevel = 1,
  onPositionChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const playheadRef = useRef<HTMLDivElement>(null);
  // Calculate playhead position accounting for zoom
  const timelineWidth = canvasWidth - trackHeaderWidth;
  // When zoomed in, the same time takes up more visual space
  const playheadX =
    trackHeaderWidth + (position / (duration / zoomLevel)) * timelineWidth;

  // Handle drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !onPositionChange) return;

    const rect = playheadRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const newPosition = Math.max(
      0,
      Math.min(duration, (x / timelineWidth) * (duration / zoomLevel))
    );
    onPositionChange(newPosition);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global event listeners for dragging
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, onPositionChange]);

  // Don't render if position is invalid
  if (position < 0 || position > duration || duration <= 0) {
    return null;
  }

  return (
    <div ref={playheadRef}>
      {/* Playhead line */}
      <div
        className="absolute w-px bg-red-500 pointer-events-none z-40"
        style={{
          left: `${playheadX}px`,
          top: `-${rulerHeight}px`, // Start above the ruler
          height: `${canvasHeight + rulerHeight}px`, // Include ruler height
          boxShadow: "0 0 4px rgba(239, 68, 68, 0.5)",
        }}
      />

      {/* Playhead handle - thin red triangle pointing down */}
      <div
        className="absolute w-6 h-2 bg-red-500 transform -translate-x-1/2 cursor-pointer z-50 hover:bg-red-400 transition-colors"
        style={{
          left: `${playheadX}px`,
          top: `0px`, // Flush with top of ruler
          clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)", // Triangle pointing down
          boxShadow: "0 0 4px rgba(239, 68, 68, 0.6)",
        }}
        onMouseDown={handleMouseDown}
        title="Drag to scrub video"
      />
    </div>
  );
};
