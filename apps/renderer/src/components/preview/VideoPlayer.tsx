import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useTimelineStore } from "../../stores/timelineStore";
import { usePreviewStore } from "../../stores/previewStore";

interface VideoPlayerProps {
  className?: string;
}

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ className }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const isUpdatingFromVideo = useRef(false);
    const { selectedClip } = useProjectStore();
    const { timeline, setPlayheadPosition } = useTimelineStore();
    const { updatePreview } = usePreviewStore();

    // Expose video controls to parent component
    useImperativeHandle(ref, () => ({
      play: () => {
        const video = videoRef.current;
        if (video) {
          video.play();
          updatePreview({ isPlaying: true });
        }
      },
      pause: () => {
        const video = videoRef.current;
        if (video) {
          video.pause();
          updatePreview({ isPlaying: false });
        }
      },
      seekTo: (time: number) => {
        const video = videoRef.current;
        if (video) {
          video.currentTime = time;
          setPlayheadPosition(time);
        }
      },
      getCurrentTime: () => {
        const video = videoRef.current;
        return video ? video.currentTime : 0;
      },
      getDuration: () => {
        const video = videoRef.current;
        return video ? video.duration : 0;
      },
    }));

    // Convert file path to file URL for Electron
    const getVideoSrc = () => {
      if (!selectedClip?.filePath) return "";

      // In Electron, convert file path to file:// URL
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        return `file://${selectedClip.filePath}`;
      }

      return selectedClip.filePath;
    };

    // Handle video time updates
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      let animationFrameId: number;

      const handleTimeUpdate = () => {
        const time = video.currentTime;
        updatePreview({ currentTime: time });
        isUpdatingFromVideo.current = true;
        setPlayheadPosition(time);
        // Reset flag after a short delay
        setTimeout(() => {
          isUpdatingFromVideo.current = false;
        }, 50);
      };

      // Smooth playhead updates using requestAnimationFrame
      const smoothUpdate = () => {
        if (video && !video.paused) {
          const time = video.currentTime;
          updatePreview({ currentTime: time });
          isUpdatingFromVideo.current = true;
          setPlayheadPosition(time);
          setTimeout(() => {
            isUpdatingFromVideo.current = false;
          }, 50);
        }
        animationFrameId = requestAnimationFrame(smoothUpdate);
      };

      const handleLoadedMetadata = () => {
        updatePreview({ duration: video.duration });
      };

      const handleEnded = () => {
        // Video ended - no action needed since controls are external
      };

      const handlePlay = () => {
        animationFrameId = requestAnimationFrame(smoothUpdate);
      };

      const handlePause = () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };

      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);

      return () => {
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    }, [selectedClip, setPlayheadPosition, updatePreview]);

    // Sync with timeline playhead position
    useEffect(() => {
      const video = videoRef.current;
      if (!video || isUpdatingFromVideo.current) return;

      const timeDiff = Math.abs(video.currentTime - timeline.playheadPosition);
      if (timeDiff > 0.1) {
        video.currentTime = timeline.playheadPosition;
      }
    }, [timeline.playheadPosition]);

    if (!selectedClip) {
      return (
        <div
          className={`bg-gray-900 rounded-lg flex items-center justify-center ${className}`}
        >
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-2">🎬</div>
            <p>No video selected</p>
            <p className="text-sm">
              Select a clip from the timeline to preview
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
        {/* Video Element Only */}
        <video
          ref={videoRef}
          src={getVideoSrc()}
          className="w-full h-auto max-h-96"
          preload="metadata"
          onError={(e) => {
            console.error("Video error:", e);
            console.error("Video src:", getVideoSrc());
            console.error("Original file path:", selectedClip.filePath);
          }}
        />
      </div>
    );
  }
);
