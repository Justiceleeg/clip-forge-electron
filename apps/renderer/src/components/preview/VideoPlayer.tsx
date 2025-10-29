import {
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
    const preloadVideoRef = useRef<HTMLVideoElement>(null); // Hidden video for preloading next clip
    const isUpdatingFromVideo = useRef(false);
    const isChangingClips = useRef(false); // Track when we're in the middle of a clip change
    const clipTransitionTimeoutId = useRef<number | null>(null); // Track timeout for cancellation
    const [currentClip, setCurrentClip] = useState<TimelineClip | null>(null);
    const [currentVideoClip, setCurrentVideoClip] = useState<VideoClip | null>(
      null
    );
    const previousClipId = useRef<string | null>(null); // Track clip changes
    const previousVideoSrc = useRef<string | null>(null); // Track video source changes
    const shouldResumePlayback = useRef(false); // Track if we should resume after load
    const preloadedClipId = useRef<string | null>(null); // Track which clip is preloaded

    const { clips } = useProjectStore();
    const { timeline, setPlayheadPosition } = useTimelineStore();
    const { updatePreview, preview } = usePreviewStore();

    // Helper function to find active clip
    const findActiveClip = (
      position: number,
      clips: TimelineClip[]
    ): TimelineClip | null => {
      return (
        clips.find(
          (clip) => position >= clip.startTime && position < clip.endTime
        ) || null
      );
    };

    // Create timeline sequence from timeline tracks
    const timelineSequence = useMemo(() => {
      const allClips = timeline.tracks.flatMap((track) => track.clips);
      const activeClip = findActiveClip(timeline.playheadPosition, allClips);

      return {
        clips: allClips,
        totalDuration: timeline.duration,
        currentPosition: timeline.playheadPosition,
        activeClip,
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

    // Convert file path to file URL for Electron
    const getVideoSrc = () => {
      if (!currentVideoClip?.filePath) return "";

      // In Electron, convert file path to file:// URL
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        return `file://${currentVideoClip.filePath}`;
      }

      return currentVideoClip.filePath;
    };

    // Find the active clip and corresponding video clip
    useEffect(() => {
      const activeClip = timelineSequence.activeClip;

      if (activeClip) {
        const clipChanged = previousClipId.current !== activeClip.id;

        // Always update current clip state
        setCurrentClip(activeClip);
        const videoClip = clips.find(
          (clip) => clip.id === activeClip.videoClipId
        );
        setCurrentVideoClip(videoClip || null);

        // When clip actually changes, force seek to correct position
        if (clipChanged && videoRef.current) {
          previousClipId.current = activeClip.id;
          isChangingClips.current = true; // Mark that we're changing clips

          // Calculate video time based on where we are in this clip
          const offsetInClip = timeline.playheadPosition - activeClip.startTime;
          const videoTime = activeClip.trimStart + offsetInClip;

          // Force seek even if same source file (important for sequential unedited clips)
          videoRef.current.currentTime = videoTime;

          // If playing, ensure video continues playing after seek
          // Only call play() if video is ready (readyState >= HAVE_CURRENT_DATA)
          // Otherwise, let the loadeddata handler resume playback
          if (preview.isPlaying && videoRef.current.paused) {
            // Check if video is ready to play (has loaded enough data)
            if (videoRef.current.readyState >= 2) {
              videoRef.current.play().catch((error) => {
                console.error(
                  "Error resuming playback after clip change:",
                  error
                );
              });
            } else {
              // Video not ready yet, mark that we should resume when it loads
              shouldResumePlayback.current = true;
            }
          }

          // Set a timeout to clear the flag (will be cancelled if video source changes)
          if (clipTransitionTimeoutId.current) {
            clearTimeout(clipTransitionTimeoutId.current);
          }
          clipTransitionTimeoutId.current = window.setTimeout(() => {
            isChangingClips.current = false;
            clipTransitionTimeoutId.current = null;
          }, 100);
        }
      } else {
        setCurrentClip(null);
        setCurrentVideoClip(null);
        previousClipId.current = null;
      }
      // Only depend on activeClip changing (via timelineSequence.activeClip)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timelineSequence.activeClip, clips, preview.isPlaying]);

    // Handle video source changes and resume playback
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !currentVideoClip) return;

      const videoSrc = getVideoSrc();
      const srcChanged = previousVideoSrc.current !== videoSrc;

      if (srcChanged) {
        previousVideoSrc.current = videoSrc;

        // If we're currently playing, mark that we should resume after load
        if (preview.isPlaying) {
          // Cancel any pending same-video timeout since we're changing videos
          if (clipTransitionTimeoutId.current) {
            clearTimeout(clipTransitionTimeoutId.current);
            clipTransitionTimeoutId.current = null;
          }

          isChangingClips.current = true; // Keep the flag set during video load
          shouldResumePlayback.current = true;
        }
      }
    }, [currentVideoClip, preview.isPlaying]);

    // Auto-resume playback when new video loads
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadedData = () => {
        if (shouldResumePlayback.current && currentClip) {
          shouldResumePlayback.current = false;

          // Seek to correct position for new clip
          const offsetInClip =
            timeline.playheadPosition - currentClip.startTime;
          const videoTime = currentClip.trimStart + offsetInClip;
          video.currentTime = videoTime;

          // Resume playback
          video.play().catch((error) => {
            console.error("❌ Failed to resume playback:", error);
          });

          // Clear the changing clips flag after a delay to allow playback to stabilize
          setTimeout(() => {
            isChangingClips.current = false;
          }, 100);
        }
      };

      video.addEventListener("loadeddata", handleLoadedData);
      return () => {
        video.removeEventListener("loadeddata", handleLoadedData);
      };
    }, [currentClip, timeline.playheadPosition]);

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

    // Preload next clip when approaching end of current clip
    useEffect(() => {
      const video = videoRef.current;
      const preloadVideo = preloadVideoRef.current;
      if (!video || !currentClip || !preloadVideo) return;

      const checkAndPreload = () => {
        if (video.paused) return;

        const videoTime = video.currentTime;
        const timeUntilEnd = currentClip.trimEnd - videoTime;

        // Start preloading when 2 seconds left in current clip
        if (timeUntilEnd > 0 && timeUntilEnd < 2) {
          const nextClip = timelineSequence.clips.find(
            (clip) => clip.startTime >= currentClip.endTime
          );

          if (nextClip && preloadedClipId.current !== nextClip.id) {
            const nextVideoClip = clips.find(
              (c) => c.id === nextClip.videoClipId
            );

            if (nextVideoClip) {
              const nextSrc = `file://${nextVideoClip.filePath}`;

              preloadVideo.src = nextSrc;
              preloadVideo.currentTime = nextClip.trimStart;
              preloadVideo.load();
              preloadedClipId.current = nextClip.id;
            }
          }
        }
      };

      // Check every 100ms during playback
      const intervalId = setInterval(checkAndPreload, 100);

      return () => {
        clearInterval(intervalId);
      };
    }, [currentClip, timelineSequence.clips, clips]);

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

    // Handle video time updates
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      let animationFrameId: number;

      const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (!video || video.paused || isChangingClips.current) {
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
        if (video && !video.paused && currentClip && !isChangingClips.current) {
          const videoTime = video.currentTime;
          const timelineTime = getTimelineTimeFromVideoTime(videoTime);

          // Check if we've reached the end of the current clip's trim range
          if (videoTime >= currentClip.trimEnd - 0.05) {
            // Find next clip
            const nextClip = timelineSequence.clips.find(
              (clip) => clip.startTime >= currentClip.endTime
            );

            if (nextClip) {
              // Move to start of next clip
              setPlayheadPosition(nextClip.startTime);
              // Video time will be set by the clip change effect
            } else {
              // No more clips, pause at end
              video.pause();
              updatePreview({ isPlaying: false });
            }
          } else {
            // Normal playback - update timeline position
            updatePreview({ currentTime: timelineTime });
            isUpdatingFromVideo.current = true;
            setPlayheadPosition(timelineTime);
            setTimeout(() => {
              isUpdatingFromVideo.current = false;
            }, 50);
          }
        }
        animationFrameId = requestAnimationFrame(smoothUpdate);
      };

      const handleLoadedMetadata = () => {
        updatePreview({ duration: timelineSequence.totalDuration });
      };

      const handleEnded = () => {
        // Video file ended - this handles when video physically ends
        if (currentClip) {
          const nextClip = timelineSequence.clips.find(
            (clip) => clip.startTime >= currentClip.endTime
          );

          if (nextClip) {
            // Move to next clip
            setPlayheadPosition(nextClip.startTime);
          } else {
            // No more clips, stop playback
            updatePreview({ isPlaying: false });
          }
        }
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
          preload="auto"
          onError={(e) => {
            console.error("Video error:", e);
            console.error("Video src:", getVideoSrc());
            console.error("Original file path:", currentVideoClip.filePath);
          }}
        />

        {/* Hidden preload video for next clip */}
        <video ref={preloadVideoRef} className="hidden" preload="auto" muted />

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
