/**
 * Time formatting utilities for timeline components
 */

/**
 * Format seconds into a readable time string
 * @param seconds - Time in seconds
 * @param showMilliseconds - Whether to show milliseconds
 * @returns Formatted time string (e.g., "1:23", "1:23.4", "45s")
 */
export const formatTime = (
  seconds: number,
  showMilliseconds: boolean = false
): string => {
  if (seconds < 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    // Format: H:MM:SS or H:MM:SS.sss
    const formattedSecs = showMilliseconds
      ? secs.toFixed(3).padStart(6, "0")
      : Math.floor(secs).toString().padStart(2, "0");
    return `${hours}:${minutes.toString().padStart(2, "0")}:${formattedSecs}`;
  } else if (minutes > 0) {
    // Format: M:SS or M:SS.sss
    const formattedSecs = showMilliseconds
      ? secs.toFixed(3).padStart(6, "0")
      : Math.floor(secs).toString().padStart(2, "0");
    return `${minutes}:${formattedSecs}`;
  } else {
    // Format: SS or SS.sss
    return showMilliseconds ? `${secs.toFixed(3)}s` : `${Math.floor(secs)}s`;
  }
};

/**
 * Parse a time string back to seconds
 * @param timeString - Time string in format "M:SS", "H:MM:SS", or "SSs"
 * @returns Time in seconds
 */
export const parseTime = (timeString: string): number => {
  const cleanString = timeString.trim();

  // Handle seconds only format (e.g., "45s", "45")
  if (!cleanString.includes(":")) {
    const seconds = parseFloat(cleanString.replace("s", ""));
    return isNaN(seconds) ? 0 : seconds;
  }

  // Handle MM:SS or H:MM:SS format
  const parts = cleanString.split(":").map((part) => parseFloat(part));

  if (parts.length === 2) {
    // MM:SS format
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // H:MM:SS format
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
};

/**
 * Calculate appropriate time intervals for timeline ruler
 * @param duration - Total duration in seconds
 * @param zoomLevel - Current zoom level
 * @returns Object with interval and format information
 */
export const getTimeIntervals = (duration: number, zoomLevel: number = 1) => {
  // Progressive interval selection based on zoom level
  // Higher zoom = smaller intervals, Lower zoom = larger intervals

  if (zoomLevel >= 4) {
    // Very high zoom (400%+) - maximum precision
    return { interval: 0.5, format: "0.5s", minorInterval: 0.25 };
  } else if (zoomLevel >= 2) {
    // High zoom (200-400%) - high precision
    return { interval: 1, format: "1s", minorInterval: 0.5 };
  } else if (zoomLevel >= 1.5) {
    // Medium-high zoom (150-200%) - good precision
    return { interval: 2, format: "2s", minorInterval: 0.5 };
  } else if (zoomLevel >= 1) {
    // Normal zoom (100-150%) - balanced
    return { interval: 5, format: "5s", minorInterval: 1 };
  } else if (zoomLevel >= 0.5) {
    // Medium zoom out (50-100%) - overview
    return { interval: 10, format: "10s", minorInterval: 2 };
  } else if (zoomLevel >= 0.25) {
    // Low zoom (25-50%) - wide overview
    return { interval: 30, format: "30s", minorInterval: 5 };
  } else if (zoomLevel >= 0.1) {
    // Very low zoom (10-25%) - very wide overview
    return { interval: 60, format: "1m", minorInterval: 10 };
  } else {
    // Extremely low zoom (under 10%) - maximum overview
    return { interval: 300, format: "5m", minorInterval: 60 };
  }
};

/**
 * Convert timeline position to time
 * @param position - Position in pixels
 * @param timelineWidth - Width of timeline in pixels
 * @param duration - Total duration in seconds
 * @param trackHeaderWidth - Width of track headers
 * @returns Time in seconds
 */
export const positionToTime = (
  position: number,
  timelineWidth: number,
  duration: number,
  trackHeaderWidth: number = 100
): number => {
  const timelineAreaWidth = timelineWidth - trackHeaderWidth;
  const relativePosition = position - trackHeaderWidth;
  return (relativePosition / timelineAreaWidth) * duration;
};

/**
 * Convert time to timeline position
 * @param time - Time in seconds
 * @param timelineWidth - Width of timeline in pixels
 * @param duration - Total duration in seconds
 * @param trackHeaderWidth - Width of track headers
 * @returns Position in pixels
 */
export const timeToPosition = (
  time: number,
  timelineWidth: number,
  duration: number,
  trackHeaderWidth: number = 100
): number => {
  const timelineAreaWidth = timelineWidth - trackHeaderWidth;
  return trackHeaderWidth + (time / duration) * timelineAreaWidth;
};
