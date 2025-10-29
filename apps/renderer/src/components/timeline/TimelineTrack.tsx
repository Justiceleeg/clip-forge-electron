import React from "react";
import {
  TimelineClip,
  TimelineTrack as TimelineTrackType,
} from "@clipforge/shared";
import { TimelineClip as TimelineClipComponent } from "./TimelineClip";
import { Volume2, VolumeX } from "lucide-react";

interface TimelineTrackProps {
  track: TimelineTrackType;
  clips: TimelineClip[];
  trackIndex: number;
  timelineDuration: number;
  canvasWidth: number;
  zoomLevel?: number;
  onClipSelect: (clipId: string) => void;
  onTrim?: (clipId: string, trimStart: number, trimEnd: number) => void;
  onReorder?: (clipId: string, newStartTime: number) => void;
  onReorderRelative?: (
    clipId: string,
    targetClipId: string,
    position: "before" | "after"
  ) => void;
  onMoveToTrack?: (clipId: string, newTrackId: string) => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  track,
  clips,
  trackIndex,
  timelineDuration,
  canvasWidth,
  zoomLevel = 1,
  onClipSelect,
  onTrim,
  onReorder,
  onReorderRelative,
  onMoveToTrack,
}) => {
  const trackHeight = 48;
  const trackTop = trackIndex * trackHeight;

  // Alternating track background colors for visual distinction
  const trackBgColor = trackIndex % 2 === 0 ? "bg-gray-800/50" : "bg-gray-800/70";

  // Calculate clip positions and widths accounting for zoom
  const renderClips = () => {
    const timelineWidth = canvasWidth - 100; // Subtract header width
    const pixelsPerSecond = (timelineWidth / timelineDuration) * zoomLevel;

    return clips.map((clip) => {
      const clipDuration = clip.endTime - clip.startTime;

      // When zoomed in, clips should stretch horizontally but maintain time positions
      // The effective timeline duration for display is reduced by zoom level
      const effectiveDuration = timelineDuration / zoomLevel;

      // Clip width scales with zoom (zoomed in = wider clips)
      const clipWidth = (clipDuration / effectiveDuration) * canvasWidth;

      // Clip position scales with zoom (zoomed in = more spread out)
      const clipLeft = (clip.startTime / effectiveDuration) * canvasWidth;

      return (
        <TimelineClipComponent
          key={clip.id}
          clip={clip}
          trackId={track.id}
          left={clipLeft}
          width={clipWidth}
          top={1} // 1px offset for visual spacing within track
          height={trackHeight - 4} // Small margin
          isSelected={clip.selected}
          onSelect={() => onClipSelect(clip.id)}
          onTrim={onTrim}
          onReorder={onReorder}
          onReorderRelative={onReorderRelative}
          onMoveToTrack={onMoveToTrack}
          allClips={clips}
          pixelsPerSecond={pixelsPerSecond}
        />
      );
    });
  };

  return (
    <div
      className="absolute w-full"
      data-track-id={track.id}
      style={{
        top: trackTop,
        height: trackHeight,
        left: 0,
      }}
    >
      {/* Track background with alternating colors */}
      <div
        className={`absolute w-full h-full ${trackBgColor} border-b border-gray-700`}
        style={{ height: trackHeight }}
      />

      {/* Clips */}
      {renderClips()}

      {/* Track controls overlay */}
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
        {/* Mute button */}
        <button
          className={`w-6 h-6 rounded flex items-center justify-center ${
            track.muted
              ? "bg-red-600 text-white"
              : "bg-gray-600 text-gray-300 hover:bg-gray-500"
          }`}
          onClick={() => {
            // TODO: Implement mute toggle
            console.log("Toggle mute for track:", track.id);
          }}
          title={track.muted ? "Unmute track" : "Mute track"}
        >
          {track.muted ? (
            <VolumeX className="w-3 h-3" />
          ) : (
            <Volume2 className="w-3 h-3" />
          )}
        </button>

        {/* Volume indicator */}
        <div className="w-8 h-2 bg-gray-600 rounded">
          <div
            className="h-full bg-blue-500 rounded"
            style={{ width: `${track.volume * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
