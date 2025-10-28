import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useMemo,
} from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useTimelineStore } from "../../stores/timelineStore";
import { usePreviewStore } from "../../stores/previewStore";
import { TimelineClip, VideoClip } from "@clipforge/shared";

interface VideoPlayerProps {
  className?: string;
}

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getCurrentClip: () => TimelineClip | null;
  getSequenceDuration: () => number;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ className }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const isUpdatingFromVideo = useRef(false);
    const [currentClip, setCurrentClip] = useState<TimelineClip | null>(null);
    const [currentVideoClip, setCurrentVideoClip] = useState<VideoClip | null>(
      null
    );

    const { clips } = useProjectStore();
    const { timeline, setPlayheadPosition } = useTimelineStore();
    const { updatePreview } = usePreviewStore();

    // Helper function to find active clip
    const findActiveClip = (
      position: number,
      clips: TimelineClip[]
    ): TimelineClip | null => {
      return (
        clips.find(
          (clip) => position >= clip.startTime && position <= clip.endTime
        ) || null
      );
    };

    // Create timeline sequence from timeline tracks
    const timelineSequence = useMemo(() => {
      const allClips = timeline.tracks.flatMap((track) => track.clips);

      return {
        clips: allClips,
        totalDuration: timeline.duration,
        currentPosition: timeline.playheadPosition,
        activeClip: findActiveClip(timeline.playheadPosition, allClips),
      };
    }, [timeline.tracks, timeline.duration, timeline.playheadPosition]);

    // Helper functions for time conversion
    const getVideoTimeFromTimelineTime = (timelineTime: number): number => {
      if (!currentClip) return 0;

      // Calculate the offset within the current clip
      const clipOffset = timelineTime - currentClip.startTime;

      // Convert to video time considering trim points
      return currentClip.trimStart + clipOffset;
    };

    const getTimelineTimeFromVideoTime = (videoTime: number): number => {
      if (!currentClip) return 0;

      // Convert video time to timeline time considering trim points
      const clipOffset = videoTime - currentClip.trimStart;
      return currentClip.startTime + clipOffset;
    };

    // Find the active clip and corresponding video clip
    useEffect(() => {
      const activeClip = timelineSequence.activeClip;
      if (activeClip) {
        setCurrentClip(activeClip);
        const videoClip = clips.find(
          (clip) => clip.id === activeClip.videoClipId
        );
        setCurrentVideoClip(videoClip || null);
      } else {
        setCurrentClip(null);
        setCurrentVideoClip(null);
      }
    }, [timelineSequence.activeClip, clips]);

    // Seek to correct time when clip changes
    useEffect(() => {
      const video = videoRef.current;
      if (
        video &&
        currentClip &&
        timeline.playheadPosition >= currentClip.startTime &&
        !isUpdatingFromVideo.current
      ) {
        const videoTime = getVideoTimeFromTimelineTime(
          timeline.playheadPosition
        );
        const timeDiff = Math.abs(video.currentTime - videoTime);
        if (timeDiff > 0.1) {
          video.currentTime = videoTime;
        }
      }
    }, [currentClip, timeline.playheadPosition, getVideoTimeFromTimelineTime]);

    // Expose video controls to parent component
    useImperativeHandle(ref, () => ({
      play: () => {
        const video = videoRef.current;

        if (video) {
          console.log("▶️ Calling video.play()");
          video
            .play()
            .then(() => {
              console.log("✅ Video started playing successfully");
              console.log("Video state after play:", {
                paused: video.paused,
                currentTime: video.currentTime,
                duration: video.duration,
                readyState: video.readyState,
                muted: video.muted,
                volume: video.volume,
              });

              // Simple test - check video state after a short delay
              setTimeout(() => {
                console.log("🔍 Video check after 500ms:", {
                  paused: video.paused,
                  currentTime: video.currentTime,
                });
              }, 500);

              updatePreview({ isPlaying: true });
            })
            .catch((error) => {
              console.error("❌ Video play failed:", error);
            });
        } else {
          console.error("❌ Video element is null!");
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
          // Convert timeline time to video time based on current clip
          const videoTime = getVideoTimeFromTimelineTime(time);
          video.currentTime = videoTime;
          setPlayheadPosition(time);
        }
      },
      getCurrentTime: () => {
        const video = videoRef.current;
        return video ? getTimelineTimeFromVideoTime(video.currentTime) : 0;
      },
      getDuration: () => {
        return timelineSequence.totalDuration;
      },
      getCurrentClip: () => {
        return currentClip;
      },
      getSequenceDuration: () => {
        return timelineSequence.totalDuration;
      },
    }));

    // Convert file path to file URL for Electron
    const getVideoSrc = () => {
      if (!currentVideoClip?.filePath) return "";

      // In Electron, convert file path to file:// URL
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        return `file://${currentVideoClip.filePath}`;
      }

      return currentVideoClip.filePath;
    };

    // Handle video time updates
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      let animationFrameId: number;

      const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (!video || video.paused) {
          return;
        }

        const videoTime = video.currentTime;
        const timelineTime = getTimelineTimeFromVideoTime(videoTime);

        updatePreview({ currentTime: timelineTime });
        isUpdatingFromVideo.current = true;
        setPlayheadPosition(timelineTime);

        // Reset flag after a short delay
        setTimeout(() => {
          isUpdatingFromVideo.current = false;
        }, 50);
      };

      // Smooth playhead updates using requestAnimationFrame
      const smoothUpdate = () => {
        if (video && !video.paused) {
          const videoTime = video.currentTime;
          const timelineTime = getTimelineTimeFromVideoTime(videoTime);

          updatePreview({ currentTime: timelineTime });
          isUpdatingFromVideo.current = true;
          setPlayheadPosition(timelineTime);
          setTimeout(() => {
            isUpdatingFromVideo.current = false;
          }, 50);
        }
        animationFrameId = requestAnimationFrame(smoothUpdate);
      };

      const handleLoadedMetadata = () => {
        updatePreview({ duration: timelineSequence.totalDuration });
      };

      const handleEnded = () => {
        // Video ended - check if we need to move to next clip
        if (currentClip) {
          const nextClip = timelineSequence.clips.find(
            (clip) => clip.startTime > currentClip.endTime
          );
          if (nextClip) {
            // Move to next clip
            setPlayheadPosition(nextClip.startTime);
          }
        }
      };

      const handlePlay = () => {
        animationFrameId = requestAnimationFrame(smoothUpdate);
      };

      const handlePause = () => {
        console.log("⏸️ Video paused event fired");
        console.trace("Pause call stack:");
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
    }, [currentClip, timelineSequence, setPlayheadPosition, updatePreview]);

    // Sync with timeline playhead position (only when video is paused)
    useEffect(() => {
      const video = videoRef.current;
      if (!video || isUpdatingFromVideo.current) return;

      const videoTime = getVideoTimeFromTimelineTime(timeline.playheadPosition);
      const timeDiff = Math.abs(video.currentTime - videoTime);
      if (timeDiff > 0.1) {
        video.currentTime = videoTime;
      }
    }, [timeline.playheadPosition, currentClip]);

    if (!currentVideoClip) {
      return (
        <div
          className={`bg-gray-900 rounded-lg flex items-center justify-center ${className}`}
        >
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-2">🎬</div>
            <p>No video in timeline</p>
            <p className="text-sm">Add clips to the timeline to preview</p>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`bg-gray-900 rounded-lg overflow-hidden relative ${className}`}
      >
        {/* Video Element Only */}
        <video
          ref={videoRef}
          src={getVideoSrc()}
          className="w-full h-auto max-h-96"
          preload="metadata"
          onError={(e) => {
            console.error("Video error:", e);
            console.error("Video src:", getVideoSrc());
            console.error("Original file path:", currentVideoClip.filePath);
          }}
        />

        {/* Current clip info overlay */}
        {currentClip && (
          <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
            {currentVideoClip.name} - {currentClip.trimStart.toFixed(1)}s to{" "}
            {currentClip.trimEnd.toFixed(1)}s
          </div>
        )}
      </div>
    );
  }
);
