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
  onClipSelect: (clipId: string) => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  track,
  clips,
  trackIndex,
  timelineDuration,
  canvasWidth,
  onClipSelect,
}) => {
  const trackHeight = 60;
  const trackTop = trackIndex * trackHeight;

  // Calculate clip positions and widths
  const renderClips = () => {
    return clips.map((clip) => {
      const clipDuration = clip.endTime - clip.startTime;
      const clipWidth = (clipDuration / timelineDuration) * canvasWidth;
      const clipLeft = (clip.startTime / timelineDuration) * canvasWidth;

      return (
        <TimelineClipComponent
          key={clip.id}
          clip={clip}
          trackId={track.id}
          left={clipLeft}
          width={clipWidth}
          top={trackTop}
          height={trackHeight - 4} // Small margin
          isSelected={clip.selected}
          onSelect={() => onClipSelect(clip.id)}
        />
      );
    });
  };

  return (
    <div
      className="absolute w-full"
      style={{
        top: trackTop,
        height: trackHeight,
        left: 0,
      }}
    >
      {/* Track background */}
      <div
        className="absolute w-full h-full bg-gray-800/50"
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
