import React from 'react';

interface PlayheadProps {
  position: number;
  duration: number;
  canvasWidth: number;
  canvasHeight: number;
  trackHeaderWidth: number;
}

export const Playhead: React.FC<PlayheadProps> = ({
  position,
  duration,
  canvasWidth,
  canvasHeight,
  trackHeaderWidth
}) => {
  // Calculate playhead position
  const timelineWidth = canvasWidth - trackHeaderWidth;
  const playheadX = trackHeaderWidth + (position / duration) * timelineWidth;
  
  // Don't render if position is invalid
  if (position < 0 || position > duration || duration <= 0) {
    return null;
  }

  return (
    <>
      {/* Playhead line */}
      <div
        className="absolute top-0 w-0.5 bg-red-500 pointer-events-none z-10"
        style={{
          left: `${playheadX}px`,
          height: `${canvasHeight}px`,
          boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)'
        }}
      />
      
      {/* Playhead head */}
      <div
        className="absolute w-3 h-3 bg-red-500 transform -translate-x-1/2 -translate-y-1 pointer-events-none z-20"
        style={{
          left: `${playheadX}px`,
          top: '0px',
          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
        }}
      />
      
      {/* Time indicator */}
      <div
        className="absolute bg-red-500 text-white text-xs px-1 py-0.5 rounded transform -translate-x-1/2 pointer-events-none z-20"
        style={{
          left: `${playheadX}px`,
          top: '-20px',
          fontSize: '10px',
          whiteSpace: 'nowrap'
        }}
      >
        {position.toFixed(1)}s
      </div>
    </>
  );
};
