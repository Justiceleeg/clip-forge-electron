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
    const videoRef2 = useRef<HTMLVideoElement>(null); // Second video for track 2
    const canvasRef = useRef<HTMLCanvasElement>(null); // Canvas for compositing
    const overlayRef = useRef<HTMLDivElement>(null); // Overlay container for interactions
    const preloadVideoRef = useRef<HTMLVideoElement>(null); // Hidden video for preloading next clip
    const isUpdatingFromVideo = useRef(false);
    const isChangingClips = useRef(false); // Track when we're in the middle of a clip change
    const clipTransitionTimeoutId = useRef<number | null>(null); // Track timeout for cancellation
    const animationFrameId = useRef<number | null>(null); // Track animation frame for smoothUpdate
    const canvasAnimationFrameId = useRef<number | null>(null); // Track animation frame for canvas rendering
    const [currentClip, setCurrentClip] = useState<TimelineClip | null>(null);
    const [currentClip2, setCurrentClip2] = useState<TimelineClip | null>(null); // Track 2 clip
    const [currentVideoClip, setCurrentVideoClip] = useState<VideoClip | null>(
      null
    );
    const [currentVideoClip2, setCurrentVideoClip2] =
      useState<VideoClip | null>(null); // Track 2 video clip
    const previousClipId = useRef<string | null>(null); // Track clip changes
    const previousClipId2 = useRef<string | null>(null); // Track clip 2 changes
    const previousVideoSrc = useRef<string | null>(null); // Track video source changes
    const shouldResumePlayback = useRef(false); // Track if we should resume after load
    const preloadedClipId = useRef<string | null>(null); // Track which clip is preloaded

    // Track 2 overlay interaction state
    const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
    const [isResizingOverlay, setIsResizingOverlay] = useState(false);
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    const overlayStartPos = useRef<{
      x: number;
      y: number;
      scale: number;
    } | null>(null);

    const { clips } = useProjectStore();
    const { timeline, setPlayheadPosition, updateTrack } = useTimelineStore();
    const { updatePreview, preview } = usePreviewStore();

    // Helper function to find active clips from all tracks at current position
    const findActiveClips = (
      position: number,
      tracks: any[]
    ): TimelineClip[] => {
      const activeClips: TimelineClip[] = [];

      // Check each track for active clips at this position
      for (const track of tracks) {
        const activeClip = track.clips.find(
          (clip: TimelineClip) =>
            position >= clip.startTime && position < clip.endTime
        );
        if (activeClip) {
          activeClips.push(activeClip);
        }
      }

      return activeClips;
    };

    // Create timeline sequence from timeline tracks
    const timelineSequence = useMemo(() => {
      const allClips = timeline.tracks.flatMap((track) => track.clips);
      const activeClips = findActiveClips(
        timeline.playheadPosition,
        timeline.tracks
      );

      return {
        clips: allClips,
        totalDuration: timeline.duration,
        currentPosition: timeline.playheadPosition,
        activeClip: activeClips.length > 0 ? activeClips[0] : null, // Keep for backwards compatibility
        activeClips, // All active clips for multi-track
      };
    }, [timeline.tracks, timeline.duration, timeline.playheadPosition]);

    // Get Track 2 overlay position (for interactive positioning)
    const track2 = timeline.tracks.find((t) => t.id === "track-2");
    const overlayPosition = track2?.overlayPosition || {
      x: 0.5,
      y: 0.5,
      scale: 0.25,
    };

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
        // Add track identifier to force separate video instances for same source
        return `file://${currentVideoClip.filePath}#track1`;
      }

      return currentVideoClip.filePath;
    };

    const getVideoSrc2 = () => {
      if (!currentVideoClip2?.filePath) return "";
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        // Add track identifier to force separate video instances for same source
        return `file://${currentVideoClip2.filePath}#track2`;
      }
      return currentVideoClip2.filePath;
    };

    // Find the active clips and corresponding video clips (one per track)
    useEffect(() => {
      const activeClips = timelineSequence.activeClips || [];

      // Handle Track 1 (index 0) - bottom layer
      const track1Clip = activeClips[0] || null;
      if (track1Clip) {
        const clipChanged = previousClipId.current !== track1Clip.id;
        setCurrentClip(track1Clip);
        const videoClip = clips.find(
          (clip) => clip.id === track1Clip.videoClipId
        );
        setCurrentVideoClip(videoClip || null);

        if (clipChanged && videoRef.current) {
          previousClipId.current = track1Clip.id;
          isChangingClips.current = true;

          const offsetInClip = timeline.playheadPosition - track1Clip.startTime;
          const videoTime = track1Clip.trimStart + offsetInClip;
          videoRef.current.currentTime = videoTime;

          if (preview.isPlaying && videoRef.current.paused) {
            if (videoRef.current.readyState >= 2) {
              videoRef.current.play().catch((error) => {
                console.error("Error resuming playback track 1:", error);
              });
            } else {
              shouldResumePlayback.current = true;
            }
          }

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

      // Handle Track 2 (index 1) - top layer (overlay)
      const track2Clip = activeClips[1] || null;
      if (track2Clip) {
        const clipChanged2 = previousClipId2.current !== track2Clip.id;
        setCurrentClip2(track2Clip);
        const videoClip2 = clips.find(
          (clip) => clip.id === track2Clip.videoClipId
        );
        setCurrentVideoClip2(videoClip2 || null);

        if (clipChanged2 && videoRef2.current) {
          previousClipId2.current = track2Clip.id;

          const offsetInClip2 =
            timeline.playheadPosition - track2Clip.startTime;
          const videoTime2 = track2Clip.trimStart + offsetInClip2;
          videoRef2.current.currentTime = videoTime2;

          if (preview.isPlaying && videoRef2.current.paused) {
            if (videoRef2.current.readyState >= 2) {
              videoRef2.current.play().catch((error) => {
                console.error("Error resuming playback track 2:", error);
              });
            }
          }
        }
      } else {
        // No active clip on track 2 - pause and clear the video
        if (videoRef2.current && !videoRef2.current.paused) {
          videoRef2.current.pause();
        }
        setCurrentClip2(null);
        setCurrentVideoClip2(null);
        previousClipId2.current = null;
      }
    }, [
      timelineSequence.activeClips,
      clips,
      preview.isPlaying,
      timeline.playheadPosition,
    ]);

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

          const offsetInClip =
            timeline.playheadPosition - currentClip.startTime;
          const videoTime = currentClip.trimStart + offsetInClip;
          video.currentTime = videoTime;

          video.play().catch((error) => {
            console.error("Failed to resume playback:", error);
          });

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
        const video2 = videoRef2.current;

        // Play Track 1 video if available
        if (video && currentVideoClip) {
          video
            .play()
            .then(() => {
              updatePreview({ isPlaying: true });
            })
            .catch((error) => {
              console.error("❌ Video play failed:", error);
            });
        }

        // Play Track 2 video if available
        if (video2 && currentVideoClip2) {
          video2.play().catch((error) => {
            console.error("❌ Video 2 play failed:", error);
          });
        }

        // If no Track 1 video but Track 2 exists, still mark as playing
        if (!currentVideoClip && currentVideoClip2) {
          updatePreview({ isPlaying: true });
        }
      },
      pause: () => {
        const video = videoRef.current;
        const video2 = videoRef2.current;

        if (video) {
          video.pause();
        }
        if (video2) {
          video2.pause();
        }
        updatePreview({ isPlaying: false });
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

      // No local animationFrameId - use the ref instead

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

        setTimeout(() => {
          isUpdatingFromVideo.current = false;
        }, 50);
      };

      // Smooth playhead updates using requestAnimationFrame
      const smoothUpdate = () => {
        // OPTION A: Track 1 drives playback. Only use Track 1 video for playhead updates.
        // Track 2 is overlay-only and doesn't drive playhead.
        if (video && currentClip && !video.paused && !isChangingClips.current) {
          const videoTime = video.currentTime;
          const timelineTime = getTimelineTimeFromVideoTime(videoTime);

          // Normal playback - update timeline position
          updatePreview({ currentTime: timelineTime });
          isUpdatingFromVideo.current = true;
          setPlayheadPosition(timelineTime);
          setTimeout(() => {
            isUpdatingFromVideo.current = false;
          }, 50);
        }
        
        // Check if track 2 video has reached its trim end point or if playhead moved past clip
        const video2 = videoRef2.current;
        if (video2 && currentClip2 && !video2.paused) {
          const video2Time = video2.currentTime;
          const timelineTime = timeline.playheadPosition;
          
          // Pause if video has reached trimEnd OR if playhead has moved past the clip's endTime
          const shouldPause = 
            video2Time >= currentClip2.trimEnd || 
            timelineTime >= currentClip2.endTime;
            
          if (shouldPause) {
            video2.pause();
            // Set to trimEnd to prevent audio bleed
            video2.currentTime = currentClip2.trimEnd;
          }
        }

        animationFrameId.current = requestAnimationFrame(smoothUpdate);
      };

      const handleLoadedMetadata = () => {
        updatePreview({ duration: timelineSequence.totalDuration });
      };

      const handleEnded = () => {
        if (!currentClip || !video) {
          return;
        }

        const track1 = timeline.tracks.find((t) => t.id === "track-1");
        const nextClip = track1?.clips.find(
          (clip) => clip.startTime >= currentClip.endTime
        );

        if (
          nextClip &&
          Math.abs(nextClip.startTime - currentClip.endTime) < 0.1
        ) {
          // Next clip is immediately following - continue playback
          setPlayheadPosition(nextClip.startTime);
          updatePreview({ currentTime: nextClip.startTime });
        } else {
          // Gap detected or no next clip - stop playback
          updatePreview({ isPlaying: false });
        }
      };

      const handlePlay = () => {
        animationFrameId.current = requestAnimationFrame(smoothUpdate);
      };

      const handlePlaying = () => {
        if (!animationFrameId.current) {
          animationFrameId.current = requestAnimationFrame(smoothUpdate);
        }

        // Restart canvas rendering loop when video becomes ready
        // The canvas rendering might have stopped when readyState was < 2

        // Cancel any existing canvas animation frame
        if (canvasAnimationFrameId.current) {
          cancelAnimationFrame(canvasAnimationFrameId.current);
        }

        // Restart the canvas rendering loop
        const renderLoop = () => {
          if (!canvasRef.current) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const video1 = videoRef.current;
          const video2 = videoRef2.current;

          // Set canvas size
          const targetWidth =
            video1 && video1.videoWidth ? video1.videoWidth : 1920;
          const targetHeight =
            video1 && video1.videoHeight ? video1.videoHeight : 1080;
          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
          }

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw track 1 video
          if (video1 && currentVideoClip && video1.readyState >= 2) {
            ctx.drawImage(video1, 0, 0, canvas.width, canvas.height);
          } else {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          // Draw track 2 overlay if exists
          if (video2 && currentVideoClip2 && video2.readyState >= 2) {
            const baseWidth = canvas.width;
            const baseHeight = canvas.height;
            const track2 = timeline.tracks.find((t) => t.id === "track-2");
            const overlayPos = track2?.overlayPosition || {
              x: 0.5,
              y: 0.5,
              scale: 0.25,
            };
            const overlayScale = overlayPos.scale;
            const overlayWidth = baseWidth * overlayScale;
            const overlayAspectRatio = video2.videoWidth / video2.videoHeight;
            const overlayHeight = overlayWidth / overlayAspectRatio;
            const centerX = baseWidth * overlayPos.x;
            const centerY = baseHeight * overlayPos.y;
            const overlayX = centerX - overlayWidth / 2;
            const overlayY = centerY - overlayHeight / 2;
            const constrainedX = Math.max(
              0,
              Math.min(overlayX, baseWidth - overlayWidth)
            );
            const constrainedY = Math.max(
              0,
              Math.min(overlayY, baseHeight - overlayHeight)
            );
            ctx.drawImage(
              video2,
              constrainedX,
              constrainedY,
              overlayWidth,
              overlayHeight
            );
          }

          // Continue rendering while video is playing
          if (
            !video1?.paused ||
            (video2 && !video2.paused) ||
            (!currentVideoClip && preview.isPlaying)
          ) {
            canvasAnimationFrameId.current = requestAnimationFrame(renderLoop);
          }
        };

        // Start the loop
        canvasAnimationFrameId.current = requestAnimationFrame(renderLoop);
      };

      const handlePause = () => {
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
      };

      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("play", handlePlay);
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("pause", handlePause);

      return () => {
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("playing", handlePlaying);
        video.removeEventListener("pause", handlePause);

        // Clean up animation frame
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
      };
    }, [currentClip, setPlayheadPosition, updatePreview, preview.isPlaying]);

    // Canvas composite rendering - draws video 1 then video 2 on top
    useEffect(() => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const renderComposite = () => {
        if (!canvas || !ctx) return;

        const video1 = videoRef.current;
        const video2 = videoRef2.current;

        // Set canvas size (use video1 dimensions if available, otherwise default)
        const targetWidth =
          video1 && video1.videoWidth ? video1.videoWidth : 1920;
        const targetHeight =
          video1 && video1.videoHeight ? video1.videoHeight : 1080;

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // If we have track 1 video, draw it (bottom layer)
        if (video1 && currentVideoClip && video1.readyState >= 2) {
          ctx.drawImage(video1, 0, 0, canvas.width, canvas.height);
        } else {
          // No video on track 1 - draw black screen
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // If we have track 2 video, draw it on top (overlay) using position from track
        if (video2 && currentVideoClip2 && video2.readyState >= 2) {
          const baseWidth = canvas.width;
          const baseHeight = canvas.height;

          // Calculate overlay dimensions maintaining aspect ratio
          const overlayScale = overlayPosition.scale;
          const overlayWidth = baseWidth * overlayScale;
          const overlayAspectRatio = video2.videoWidth / video2.videoHeight;
          const overlayHeight = overlayWidth / overlayAspectRatio;

          // Calculate position (x, y are center points as fraction 0-1)
          const centerX = baseWidth * overlayPosition.x;
          const centerY = baseHeight * overlayPosition.y;
          const overlayX = centerX - overlayWidth / 2;
          const overlayY = centerY - overlayHeight / 2;

          // Constrain to canvas bounds
          const constrainedX = Math.max(
            0,
            Math.min(overlayX, baseWidth - overlayWidth)
          );
          const constrainedY = Math.max(
            0,
            Math.min(overlayY, baseHeight - overlayHeight)
          );

          // Draw video 2 overlay
          ctx.drawImage(
            video2,
            constrainedX,
            constrainedY,
            overlayWidth,
            overlayHeight
          );
        }

        // Continue rendering if:
        // - Track 1 video is playing, OR
        // - Track 2 video is playing (even if Track 1 is empty), OR
        // - We need to show black screen (no Track 1 video but need visual feedback)
        const shouldContinueRendering =
          !video1?.paused || // Track 1 playing
          (video2 && !video2.paused) || // Track 2 playing
          (!currentVideoClip && preview.isPlaying); // No Track 1 but marked as playing

        if (shouldContinueRendering) {
          canvasAnimationFrameId.current =
            requestAnimationFrame(renderComposite);
        }
      };

      // Start composite rendering
      renderComposite();

      return () => {
        if (canvasAnimationFrameId.current) {
          cancelAnimationFrame(canvasAnimationFrameId.current);
        }
      };
    }, [
      currentVideoClip,
      currentVideoClip2,
      preview.isPlaying,
      overlayPosition,
    ]);

    // Force canvas redraw when paused and playhead moves
    useEffect(() => {
      // Only trigger manual render when paused
      if (preview.isPlaying) return;

      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const video1 = videoRef.current;
      const video2 = videoRef2.current;

      // Manual render when paused
      const renderFrame = () => {
        if (!canvas || !ctx) return;

        // Set canvas size
        const targetWidth =
          video1 && video1.videoWidth ? video1.videoWidth : 1920;
        const targetHeight =
          video1 && video1.videoHeight ? video1.videoHeight : 1080;

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw track 1 video or black screen
        if (video1 && currentVideoClip && video1.readyState >= 2) {
          ctx.drawImage(video1, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw track 2 overlay if exists
        if (video2 && currentVideoClip2 && video2.readyState >= 2) {
          const baseWidth = canvas.width;
          const baseHeight = canvas.height;

          const overlayScale = overlayPosition.scale;
          const overlayWidth = baseWidth * overlayScale;
          const overlayAspectRatio = video2.videoWidth / video2.videoHeight;
          const overlayHeight = overlayWidth / overlayAspectRatio;

          const centerX = baseWidth * overlayPosition.x;
          const centerY = baseHeight * overlayPosition.y;
          const overlayX = centerX - overlayWidth / 2;
          const overlayY = centerY - overlayHeight / 2;

          const constrainedX = Math.max(
            0,
            Math.min(overlayX, baseWidth - overlayWidth)
          );
          const constrainedY = Math.max(
            0,
            Math.min(overlayY, baseHeight - overlayHeight)
          );

          ctx.drawImage(
            video2,
            constrainedX,
            constrainedY,
            overlayWidth,
            overlayHeight
          );
        }
      };

      // Use seeked event to know when videos are ready
      let video1Seeked = !currentVideoClip; // If no clip, consider it "ready"
      let video2Seeked = !currentVideoClip2; // If no clip, consider it "ready"

      const handleVideo1Seeked = () => {
        video1Seeked = true;
        if (video2Seeked) {
          renderFrame();
        }
      };

      const handleVideo2Seeked = () => {
        video2Seeked = true;
        if (video1Seeked) {
          renderFrame();
        }
      };

      // Attach seeked listeners
      if (video1 && currentVideoClip) {
        video1.addEventListener("seeked", handleVideo1Seeked);
      }
      if (video2 && currentVideoClip2) {
        video2.addEventListener("seeked", handleVideo2Seeked);
      }

      // Also use timeout as fallback in case seeked doesn't fire
      const timeoutId = setTimeout(renderFrame, 150);

      return () => {
        if (video1) video1.removeEventListener("seeked", handleVideo1Seeked);
        if (video2) video2.removeEventListener("seeked", handleVideo2Seeked);
        clearTimeout(timeoutId);
      };
    }, [
      timeline.playheadPosition,
      preview.isPlaying,
      currentVideoClip,
      currentVideoClip2,
      overlayPosition,
    ]);

    // Sync video 2 with playhead (if exists)
    useEffect(() => {
      const video2 = videoRef2.current;
      if (!video2 || !currentClip2 || isUpdatingFromVideo.current) return;

      const videoTime2 =
        currentClip2.trimStart +
        (timeline.playheadPosition - currentClip2.startTime);
      const timeDiff = Math.abs(video2.currentTime - videoTime2);
      if (timeDiff > 0.1) {
        video2.currentTime = videoTime2;
      }
    }, [timeline.playheadPosition, currentClip2]);

    // Sync playback state for video 2
    useEffect(() => {
      const video2 = videoRef2.current;
      if (!video2 || !currentVideoClip2) return;

      if (preview.isPlaying && video2.paused) {
        video2.play().catch((error) => {
          console.error("Error playing video 2:", error);
        });
      } else if (!preview.isPlaying && !video2.paused) {
        video2.pause();
      }
    }, [preview.isPlaying, currentVideoClip2]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video || isUpdatingFromVideo.current) return;

      const videoTime = getVideoTimeFromTimelineTime(timeline.playheadPosition);
      const timeDiff = Math.abs(video.currentTime - videoTime);
      if (timeDiff > 0.1) {
        video.currentTime = videoTime;
      }
    }, [timeline.playheadPosition, currentClip]);

    // Handle overlay drag
    const handleOverlayMouseDown = (e: React.MouseEvent) => {
      if (!canvasRef.current || !track2) return;

      e.preventDefault();
      e.stopPropagation();

      setIsDraggingOverlay(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      overlayStartPos.current = { ...overlayPosition };
    };

    // Handle resize corner drag
    const handleResizeMouseDown = (e: React.MouseEvent, _corner: string) => {
      if (!track2) return;

      e.preventDefault();
      e.stopPropagation();

      setIsResizingOverlay(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      overlayStartPos.current = { ...overlayPosition };
    };

    // Handle mouse move for drag/resize
    useEffect(() => {
      if (!isDraggingOverlay && !isResizingOverlay) return;

      const handleMouseMove = (e: MouseEvent) => {
        if (
          !canvasRef.current ||
          !dragStartPos.current ||
          !overlayStartPos.current ||
          !track2
        )
          return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        if (isDraggingOverlay) {
          // Calculate delta in canvas space
          const deltaX = (e.clientX - dragStartPos.current.x) / rect.width;
          const deltaY = (e.clientY - dragStartPos.current.y) / rect.height;

          // Update position (clamped to keep overlay within bounds)
          const newX = Math.max(
            overlayStartPos.current.scale / 2,
            Math.min(
              1 - overlayStartPos.current.scale / 2,
              overlayStartPos.current.x + deltaX
            )
          );
          const newY = Math.max(
            overlayStartPos.current.scale / 2,
            Math.min(
              1 - overlayStartPos.current.scale / 2,
              overlayStartPos.current.y + deltaY
            )
          );

          updateTrack(track2.id, {
            overlayPosition: {
              ...overlayStartPos.current,
              x: newX,
              y: newY,
            },
          });
        } else if (isResizingOverlay) {
          // Calculate resize delta
          const deltaX = (e.clientX - dragStartPos.current.x) / rect.width;
          const deltaY = (e.clientY - dragStartPos.current.y) / rect.height;

          // Use the larger delta for uniform scaling
          const delta =
            Math.max(Math.abs(deltaX), Math.abs(deltaY)) *
            (deltaX + deltaY > 0 ? 1 : -1);

          // Update scale (clamped between 0.1 and 1.0)
          const newScale = Math.max(
            0.1,
            Math.min(1.0, overlayStartPos.current.scale + delta)
          );

          // Recalculate position to keep within bounds with new scale
          const newX = Math.max(
            newScale / 2,
            Math.min(1 - newScale / 2, overlayStartPos.current.x)
          );
          const newY = Math.max(
            newScale / 2,
            Math.min(1 - newScale / 2, overlayStartPos.current.y)
          );

          updateTrack(track2.id, {
            overlayPosition: {
              x: newX,
              y: newY,
              scale: newScale,
            },
          });
        }
      };

      const handleMouseUp = () => {
        setIsDraggingOverlay(false);
        setIsResizingOverlay(false);
        dragStartPos.current = null;
        overlayStartPos.current = null;
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, [
      isDraggingOverlay,
      isResizingOverlay,
      track2,
      updateTrack,
      overlayPosition,
    ]);

    // Calculate overlay position for interactive UI
    // Always show overlay controls if Track 2 exists (even without active clip)
    const getOverlayStyle = () => {
      if (!canvasRef.current) return {};

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();

      // Use aspect ratio from active clip or default 16:9
      const aspectRatio = currentVideoClip2
        ? currentVideoClip2.width / currentVideoClip2.height
        : 16 / 9;

      const overlayWidth = rect.width * overlayPosition.scale;
      const overlayHeight = overlayWidth / aspectRatio;

      const centerX = rect.width * overlayPosition.x;
      const centerY = rect.height * overlayPosition.y;

      return {
        position: "absolute" as const,
        left: `${centerX - overlayWidth / 2}px`,
        top: `${centerY - overlayHeight / 2}px`,
        width: `${overlayWidth}px`,
        height: `${overlayHeight}px`,
        border: "2px solid #3b82f6",
        cursor: isDraggingOverlay ? "grabbing" : "grab",
        pointerEvents: "auto" as const,
        backgroundColor: currentVideoClip2
          ? "transparent"
          : "rgba(59, 130, 246, 0.1)", // Slight tint when no clip
      };
    };

    return (
      <div
        className={`bg-gray-900 rounded-lg overflow-hidden relative ${className}`}
      >
        {/* Canvas for composite rendering - always shown */}
        <canvas
          ref={canvasRef}
          className="w-full h-auto max-h-96"
          style={{ display: "block" }}
        />

        {/* Interactive overlay box - always visible when Track 2 exists */}
        {track2 && (
          <div
            ref={overlayRef}
            style={getOverlayStyle()}
            onMouseDown={handleOverlayMouseDown}
            className="transition-opacity hover:opacity-100 opacity-70"
          >
            {/* Resize handles in corners */}
            <div
              className="absolute w-3 h-3 bg-blue-500 rounded-full cursor-nwse-resize"
              style={{ top: "-6px", left: "-6px" }}
              onMouseDown={(e) => handleResizeMouseDown(e, "nw")}
            />
            <div
              className="absolute w-3 h-3 bg-blue-500 rounded-full cursor-nesw-resize"
              style={{ top: "-6px", right: "-6px" }}
              onMouseDown={(e) => handleResizeMouseDown(e, "ne")}
            />
            <div
              className="absolute w-3 h-3 bg-blue-500 rounded-full cursor-nesw-resize"
              style={{ bottom: "-6px", left: "-6px" }}
              onMouseDown={(e) => handleResizeMouseDown(e, "sw")}
            />
            <div
              className="absolute w-3 h-3 bg-blue-500 rounded-full cursor-nwse-resize"
              style={{ bottom: "-6px", right: "-6px" }}
              onMouseDown={(e) => handleResizeMouseDown(e, "se")}
            />

            {/* Label showing this is Track 2 overlay area */}
            {!currentVideoClip2 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-blue-400 text-xs font-medium bg-gray-900 bg-opacity-75 px-2 py-1 rounded">
                  Track 2 Overlay
                </span>
              </div>
            )}
          </div>
        )}

        {/* Hidden video elements for loading - always render both */}
        <video
          ref={videoRef}
          key="video-track-1"
          src={getVideoSrc()}
          className="hidden"
          preload="auto"
          crossOrigin="anonymous"
          onError={(e) => {
            console.error("Video 1 error:", e);
          }}
        />
        <video
          ref={videoRef2}
          key="video-track-2"
          src={getVideoSrc2()}
          className="hidden"
          preload="auto"
          crossOrigin="anonymous"
          onError={(e) => {
            console.error("Video 2 error:", e);
          }}
        />

        {/* Hidden preload video for next clip */}
        <video ref={preloadVideoRef} className="hidden" preload="auto" muted />

        {/* Current clip info overlay */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          {currentClip && currentVideoClip ? (
            <>
              Track 1: {currentVideoClip.name} -{" "}
              {currentClip.trimStart.toFixed(1)}s to{" "}
              {currentClip.trimEnd.toFixed(1)}s
            </>
          ) : (
            <>Track 1: Black Screen (No Clip)</>
          )}
        </div>

        {/* Track 2 info overlay */}
        {currentClip2 && currentVideoClip2 && (
          <div className="absolute top-10 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
            Track 2 (PiP): {currentVideoClip2.name} -{" "}
            {currentClip2.trimStart.toFixed(1)}s to{" "}
            {currentClip2.trimEnd.toFixed(1)}s
          </div>
        )}
      </div>
    );
  }
);
