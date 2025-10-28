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
export const getTimeIntervals = (
  duration: number,
  zoomLevel: number = 1,
  timelineWidth: number = 1000,
  targetTickCount: number = 20
) => {
  // When zoomed in, we want smaller intervals (more detail)
  // When zoomed out, we want larger intervals (less detail)
  // Calculate the "visible duration" based on zoom level
  const visibleDuration = duration / zoomLevel;

  // Calculate ideal tick interval to fit targetTickCount ticks in visible area
  const idealInterval = visibleDuration / targetTickCount;

  // Round to "nice" numbers for better readability
  // Minimum interval is 1 second
  const niceIntervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

  // Find the closest nice interval that's >= idealInterval
  let selectedInterval = niceIntervals.find(
    (interval) => interval >= idealInterval
  );

  // If no nice interval is large enough, use the largest one
  // If ideal interval is less than 1 second, use 1 second
  if (!selectedInterval) {
    selectedInterval =
      idealInterval < 1 ? 1 : niceIntervals[niceIntervals.length - 1];
  }

  // Calculate minor interval (usually 1/2 or 1/5 of major interval)
  let minorInterval = selectedInterval / 2;
  if (selectedInterval >= 60) {
    minorInterval = selectedInterval / 5; // For minute+ intervals, use 1/5
  }

  // Format the interval for display
  let format = "";
  if (selectedInterval < 60) {
    format = `${selectedInterval}s`;
  } else if (selectedInterval < 3600) {
    format = `${selectedInterval / 60}m`;
  } else {
    format = `${selectedInterval / 3600}h`;
  }

  return {
    interval: selectedInterval,
    format,
    minorInterval,
    actualTickCount: Math.ceil(duration / selectedInterval),
  };
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
