import { spawn, ChildProcess } from "child_process";
import { join } from "path";
import { app } from "electron";
import { promises as fs, accessSync } from "fs";
import {
  ExportSettings,
  VideoClip,
  Timeline,
  TimelineClip,
  TimelineTrack,
} from "@clipforge/shared";

export class FFmpegService {
  private ffmpegPath: string;
  private ffprobePath: string;
  private activeProcess: ChildProcess | null = null;

  constructor() {
    // Set FFmpeg binary paths
    const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

    if (isDev) {
      // Development: use binaries from bin directory
      this.ffmpegPath = join(__dirname, "../../bin/ffmpeg");
      this.ffprobePath = join(__dirname, "../../bin/ffprobe");
    } else {
      // Production: use bundled binaries
      this.ffmpegPath = join(process.resourcesPath, "bin/ffmpeg");
      this.ffprobePath = join(process.resourcesPath, "bin/ffprobe");
    }
  }

  /**
   * Check if FFmpeg binaries are accessible
   */
  async checkFFmpegAvailability(): Promise<boolean> {
    try {
      await this.runCommand(this.ffmpegPath, ["-version"]);
      await this.runCommand(this.ffprobePath, ["-version"]);
      return true;
    } catch (error) {
      console.error("FFmpeg not available:", error);
      return false;
    }
  }

  /**
   * Extract video metadata using FFprobe
   */
  async extractVideoMetadata(videoPath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    fps: number;
    bitrate?: number;
    codec?: string;
    hasAudio: boolean;
  }> {
    const args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      videoPath,
    ];

    try {
      const output = await this.runCommand(this.ffprobePath, args);
      const data = JSON.parse(output);

      const videoStream = data.streams.find(
        (stream: any) => stream.codec_type === "video"
      );
      const audioStream = data.streams.find(
        (stream: any) => stream.codec_type === "audio"
      );

      if (!videoStream) {
        throw new Error("No video stream found in file");
      }

      return {
        duration: parseFloat(data.format.duration) || 0,
        width: parseInt(videoStream.width) || 0,
        height: parseInt(videoStream.height) || 0,
        fps: this.parseFPS(videoStream.r_frame_rate) || 0,
        bitrate: parseInt(data.format.bit_rate) || undefined,
        codec: videoStream.codec_name,
        hasAudio: !!audioStream,
      };
    } catch (error) {
      console.error("Error extracting video metadata:", error);
      throw new Error(`Failed to extract metadata from ${videoPath}: ${error}`);
    }
  }

  /**
   * Generate thumbnail from video
   */
  async generateThumbnail(
    videoPath: string,
    outputPath: string,
    timestamp: number = 1
  ): Promise<void> {
    const args = [
      "-i",
      videoPath,
      "-ss",
      timestamp.toString(),
      "-vframes",
      "1",
      "-q:v",
      "2",
      "-y", // Overwrite output file
      outputPath,
    ];

    try {
      await this.runCommand(this.ffmpegPath, args);
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      throw new Error(`Failed to generate thumbnail: ${error}`);
    }
  }

  /**
   * Trim video file
   */
  async trimVideo(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number
  ): Promise<void> {
    const duration = endTime - startTime;

    const args = [
      "-i",
      inputPath,
      "-ss",
      startTime.toString(),
      "-t",
      duration.toString(),
      "-c",
      "copy", // Copy streams without re-encoding
      "-y", // Overwrite output file
      outputPath,
    ];

    try {
      await this.runCommand(this.ffmpegPath, args);
    } catch (error) {
      console.error("Error trimming video:", error);
      throw new Error(`Failed to trim video: ${error}`);
    }
  }

  /**
   * Export timeline to video file
   * Handles multiple clips arranged on the timeline across multiple tracks
   * Supports multi-track composition with overlays
   */
  async exportTimeline(
    timeline: Timeline,
    clips: VideoClip[],
    outputPath: string,
    settings: ExportSettings,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<void> {
    // Validate timeline before export (Task 9)
    this.validateTimeline(timeline, clips);

    // Get all video tracks
    const videoTracks = timeline.tracks.filter((track) => track.type === "video");
    if (videoTracks.length === 0) {
      throw new Error("No video tracks found on timeline");
    }

    // Check if any track has clips
    const hasClips = videoTracks.some((track) => track.clips.length > 0);
    if (!hasClips) {
      throw new Error("No video clips found on timeline");
    }

    // Calculate timeline duration (max endTime across all clips)
    const timelineDuration = this.calculateTimelineDuration(timeline);

    if (onProgress) {
      onProgress(0, "Preparing export...");
    }

    // Handle single track export (optimized path)
    if (videoTracks.length === 1 && videoTracks[0].clips.length === 1) {
      const timelineClip = videoTracks[0].clips[0];
      const sourceClip = clips.find((c) => c.id === timelineClip.videoClipId);
      if (!sourceClip) {
        throw new Error("Source clip not found");
      }

      return this.exportSingleClip(
        sourceClip,
        timelineClip.trimStart,
        timelineClip.trimEnd,
        outputPath,
        settings,
        onProgress
      );
    }

    // Multi-track or multi-clip export
    return this.exportTimelineWithComposition(
      timeline,
      videoTracks,
      clips,
      outputPath,
      settings,
      timelineDuration,
      onProgress
    );
  }

  /**
   * Validate timeline before export
   */
  private validateTimeline(timeline: Timeline, clips: VideoClip[]): void {
    const videoTracks = timeline.tracks.filter((track) => track.type === "video");
    
    if (videoTracks.length === 0) {
      throw new Error("No video tracks found on timeline");
    }

    // Validate all clip references exist
    for (const track of videoTracks) {
      for (const timelineClip of track.clips) {
        const sourceClip = clips.find((c) => c.id === timelineClip.videoClipId);
        if (!sourceClip) {
          throw new Error(`Source clip ${timelineClip.videoClipId} not found`);
        }

        // Check source file exists
        try {
          accessSync(sourceClip.filePath);
        } catch {
          throw new Error(`Source file not found: ${sourceClip.filePath}`);
        }

        // Validate trim points
        if (timelineClip.trimStart < 0) {
          throw new Error(`Invalid trimStart for clip ${timelineClip.id}`);
        }
        if (timelineClip.trimEnd <= timelineClip.trimStart) {
          throw new Error(`Invalid trimEnd for clip ${timelineClip.id}`);
        }
        if (timelineClip.trimEnd > sourceClip.duration) {
          throw new Error(
            `trimEnd (${timelineClip.trimEnd}) exceeds clip duration (${sourceClip.duration})`
          );
        }
      }
    }
  }

  /**
   * Calculate timeline duration from all tracks
   */
  private calculateTimelineDuration(timeline: Timeline): number {
    const videoTracks = timeline.tracks.filter((track) => track.type === "video");
    if (videoTracks.length === 0) {
      return 0;
    }

    // Use only the base track (first video track) duration
    // Overlay tracks should not extend beyond the base track
    const baseTrack = videoTracks[0];
    const maxEndTime = Math.max(
      ...baseTrack.clips.map((clip) => clip.endTime)
    );

    return maxEndTime || timeline.duration;
  }

  /**
   * Export timeline with multi-track composition support
   */
  private async exportTimelineWithComposition(
    timeline: Timeline,
    videoTracks: TimelineTrack[],
    clips: VideoClip[],
    outputPath: string,
    settings: ExportSettings,
    timelineDuration: number,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<void> {
    const { app } = require("electron");
    const tempDir = app.getPath("temp");
    const tempFiles: string[] = [];
    const timestamp = Date.now();

    try {
      if (onProgress) {
        onProgress(5, "Processing timeline segments...");
      }

      // Determine output resolution
      const outputResolution = this.getOutputResolution(settings, clips);
      
      // Sort tracks: first track is base, others are overlays
      const sortedTracks = [...videoTracks].sort((a, b) => {
        const aIndex = timeline.tracks.indexOf(a);
        const bIndex = timeline.tracks.indexOf(b);
        return aIndex - bIndex;
      });

      // If only one track with multiple clips, use optimized single-track export
      if (sortedTracks.length === 1) {
        return this.exportMultipleClips(
          sortedTracks[0].clips.sort((a, b) => a.startTime - b.startTime),
          clips,
          outputPath,
          settings,
          onProgress
            ? (progress) => {
                const mappedProgress = 5 + (progress * 0.9); // Map 0-100 to 5-95
                onProgress(
                  mappedProgress,
                  `Processing clips... ${Math.round(progress)}%`
                );
              }
            : undefined
        );
      }

      // Multi-track export: build segments and composite
      // Split timeline into time segments based on clip positions and gaps
      const segments = this.buildTimelineSegments(sortedTracks, timelineDuration);
      
      if (onProgress) {
        onProgress(10, `Processing ${segments.length} timeline segments...`);
      }

      // Process each segment
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentProgress = 10 + ((i / segments.length) * 80);
        
        if (onProgress) {
          onProgress(
            segmentProgress,
            `Processing segment ${i + 1}/${segments.length}...`
          );
        }

        const segmentOutput = join(
          tempDir,
          `segment_${i}_${timestamp}.mp4`
        );
        tempFiles.push(segmentOutput);

        await this.processTimelineSegment(
          segment,
          sortedTracks,
          clips,
          segmentOutput,
          outputResolution,
          settings,
          onProgress
            ? (progress) => {
                const overallProgress =
                  segmentProgress +
                  (progress / segments.length) * 80;
                onProgress(overallProgress);
              }
            : undefined
        );
      }

      if (onProgress) {
        onProgress(90, "Finalizing export...");
      }

      // Concatenate all segments
      const concatListPath = join(tempDir, `concat_list_${timestamp}.txt`);
      const concatList = tempFiles.map((file) => `file '${file}'`).join("\n");
      await fs.writeFile(concatListPath, concatList, "utf-8");
      tempFiles.push(concatListPath);

      const concatArgs = [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c",
        "copy",
        "-y",
        outputPath,
      ];

      await this.runCommand(this.ffmpegPath, concatArgs);

      if (onProgress) {
        onProgress(100, "Export complete!");
      }
    } catch (error) {
      console.error("Error exporting timeline:", error);
      
      // Provide user-friendly error messages (Task 11)
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          throw new Error(`Export failed: ${error.message}`);
        }
        if (error.message.includes("Failed to start process")) {
          throw new Error("Export failed: FFmpeg could not be started. Please ensure FFmpeg is properly installed.");
        }
        if (error.message.includes("Command failed")) {
          throw new Error("Export failed: Video processing error. Please check your timeline and try again.");
        }
        throw error;
      }
      throw new Error(`Failed to export timeline: ${error}`);
    } finally {
      // Cleanup temporary files
      for (const tempFile of tempFiles) {
        try {
          await fs.unlink(tempFile);
        } catch (error) {
          console.error(`Failed to delete temp file ${tempFile}:`, error);
        }
      }
    }
  }

  /**
   * Get output resolution for export
   */
  private getOutputResolution(
    settings: ExportSettings,
    clips: VideoClip[]
  ): { width: number; height: number } {
    if (settings.resolution === "source" && clips.length > 0) {
      return { width: clips[0].width, height: clips[0].height };
    }
    
    const resolutionMap: {
      "720p": { width: number; height: number };
      "1080p": { width: number; height: number };
    } = {
      "720p": { width: 1280, height: 720 },
      "1080p": { width: 1920, height: 1080 },
    };
    
    // TypeScript now knows resolution can only be "720p" or "1080p" here
    if (settings.resolution === "720p" || settings.resolution === "1080p") {
      return resolutionMap[settings.resolution];
    }
    
    // Fallback to 1080p
    return resolutionMap["1080p"];
  }

  /**
   * Build timeline segments from tracks
   * Handles gaps by creating segments with black frames
   */
  private buildTimelineSegments(
    tracks: TimelineTrack[],
    timelineDuration: number
  ): Array<{ startTime: number; endTime: number; clips: TimelineClip[] }> {
    // Get all unique time points (clip starts and ends)
    const timePoints = new Set<number>([0]);
    
    for (const track of tracks) {
      for (const clip of track.clips) {
        timePoints.add(clip.startTime);
        // Cap overlay clips at timeline duration (base track length)
        const effectiveEndTime = Math.min(clip.endTime, timelineDuration);
        timePoints.add(effectiveEndTime);
      }
    }
    timePoints.add(timelineDuration);
    
    const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);
    const segments: Array<{ startTime: number; endTime: number; clips: TimelineClip[] }> = [];
    
    // Create segments between each pair of time points
    for (let i = 0; i < sortedTimePoints.length - 1; i++) {
      const startTime = sortedTimePoints[i];
      const endTime = sortedTimePoints[i + 1];
      
      // Find clips active during this segment
      const activeClips: TimelineClip[] = [];
      for (const track of tracks) {
        for (const clip of track.clips) {
          // Clip overlaps with segment if it starts before segment ends and ends after segment starts
          // Cap overlay clips at timeline duration
          const effectiveEndTime = Math.min(clip.endTime, timelineDuration);
          if (clip.startTime < endTime && effectiveEndTime > startTime) {
            activeClips.push(clip);
          }
        }
      }
      
      segments.push({
        startTime,
        endTime,
        clips: activeClips,
      });
    }
    
    return segments;
  }

  /**
   * Process a timeline segment with multi-track composition
   */
  private async processTimelineSegment(
    segment: { startTime: number; endTime: number; clips: TimelineClip[] },
    tracks: TimelineTrack[],
    clips: VideoClip[],
    outputPath: string,
    resolution: { width: number; height: number },
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const segmentDuration = segment.endTime - segment.startTime;
    
    // If no clips in segment, generate black video
    if (segment.clips.length === 0) {
      return this.generateBlackVideo(
        outputPath,
        resolution.width,
        resolution.height,
        segmentDuration,
        settings
      );
    }
    
    // Group clips by track
    const clipsByTrack = new Map<string, TimelineClip[]>();
    for (const clip of segment.clips) {
      if (!clipsByTrack.has(clip.trackId)) {
        clipsByTrack.set(clip.trackId, []);
      }
      clipsByTrack.get(clip.trackId)!.push(clip);
    }
    
    // If only one track, process without overlay
    if (clipsByTrack.size === 1) {
      const trackId = Array.from(clipsByTrack.keys())[0];
      const trackClips = clipsByTrack.get(trackId)!;
      const track = tracks.find((t) => t.id === trackId);
      
      // If single clip, export directly
      if (trackClips.length === 1) {
        const timelineClip = trackClips[0];
        const sourceClip = clips.find((c) => c.id === timelineClip.videoClipId);
        if (!sourceClip) {
          throw new Error(`Source clip not found: ${timelineClip.videoClipId}`);
        }
        
        // Calculate which portion of clip to use
        const clipStartInSegment = Math.max(0, segment.startTime - timelineClip.startTime);
        const clipEndInSegment = Math.min(
          segment.endTime - timelineClip.startTime,
          timelineClip.trimEnd - timelineClip.trimStart
        );
        
        // Cap the clip end to not exceed the segment duration
        const effectiveClipEnd = Math.min(clipEndInSegment, segmentDuration);
        
        return this.exportSingleClipSegment(
          sourceClip,
          timelineClip.trimStart + clipStartInSegment,
          timelineClip.trimStart + effectiveClipEnd,
          outputPath,
          resolution,
          settings,
          onProgress
        );
      }
    }
    
    // Multi-track composition needed
    return this.compositeMultiTrackSegment(
      segment,
      tracks,
      clips,
      clipsByTrack,
      outputPath,
      resolution,
      settings,
      onProgress
    );
  }

  /**
   * Export a single clip segment with resolution scaling
   */
  private async exportSingleClipSegment(
    clip: VideoClip,
    trimStart: number,
    trimEnd: number,
    outputPath: string,
    resolution: { width: number; height: number },
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const duration = trimEnd - trimStart;
    const args = [
      "-i",
      clip.filePath,
      "-ss",
      trimStart.toString(),
      "-t",
      duration.toString(),
    ];

    // Scale to target resolution
    args.push("-vf", `scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=decrease,pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2`);

    const qualityMap = {
      low: { crf: "28", preset: "veryfast" },
      medium: { crf: "23", preset: "medium" },
      high: { crf: "18", preset: "slow" },
    };
    const quality = qualityMap[settings.quality];

    args.push(
      "-c:v",
      "libx264",
      "-crf",
      quality.crf,
      "-preset",
      quality.preset,
      "-c:a",
      "aac",
      "-b:a",
      `${settings.audioBitrate}k`,
      "-r",
      settings.fps.toString(),
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
      "-g",
      (settings.fps * 2).toString(),
      "-keyint_min",
      settings.fps.toString(),
      "-sc_threshold",
      "0",
      "-avoid_negative_ts",
      "make_zero",
      "-fflags",
      "+genpts+igndts",
      "-vsync",
      "cfr",
      "-force_key_frames",
      `expr:gte(t,n_forced*${2/settings.fps})`,
      "-metadata",
      "title=",
      "-metadata",
      "comment=",
      "-metadata",
      "description=",
      "-map_metadata",
      "-1",
      "-y",
      outputPath
    );

    await this.runCommandWithProgress(
      this.ffmpegPath,
      args,
      duration,
      onProgress
    );
  }

  /**
   * Generate black video for gaps
   */
  private async generateBlackVideo(
    outputPath: string,
    width: number,
    height: number,
    duration: number,
    settings: ExportSettings
  ): Promise<void> {
    const args = [
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=${width}x${height}:d=${duration}`,
      "-c:v",
      "libx264",
      "-preset",
      settings.quality === "high" ? "slow" : settings.quality === "medium" ? "medium" : "veryfast",
      "-r",
      settings.fps.toString(),
      "-c:a",
      "aac",
      "-b:a",
      `${settings.audioBitrate}k`,
      "-t",
      duration.toString(),
      "-y",
      outputPath,
    ];

    await this.runCommand(this.ffmpegPath, args);
  }

  /**
   * Composite multiple tracks for a segment using FFmpeg overlay
   */
  private async compositeMultiTrackSegment(
    segment: { startTime: number; endTime: number; clips: TimelineClip[] },
    tracks: TimelineTrack[],
    clips: VideoClip[],
    clipsByTrack: Map<string, TimelineClip[]>,
    outputPath: string,
    resolution: { width: number; height: number },
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const { app } = require("electron");
    const tempDir = app.getPath("temp");
    const tempFiles: string[] = [];
    const timestamp = Date.now();

    try {
      // Process base track (first track)
      const baseTrack = tracks[0];
      const baseTrackClips = clipsByTrack.get(baseTrack.id) || [];
      let baseVideoPath = outputPath;

      // If base track has clips, process them first
      if (baseTrackClips.length > 0) {
        // For now, use first clip on base track (can be enhanced for multiple clips)
        const baseClip = baseTrackClips[0];
        const sourceClip = clips.find((c) => c.id === baseClip.videoClipId);
        if (!sourceClip) {
          throw new Error(`Source clip not found: ${baseClip.videoClipId}`);
        }

        const tempBasePath = join(tempDir, `base_${timestamp}.mp4`);
        tempFiles.push(tempBasePath);

        const clipStartInSegment = Math.max(0, segment.startTime - baseClip.startTime);
        const clipEndInSegment = Math.min(
          segment.endTime - baseClip.startTime,
          baseClip.trimEnd - baseClip.trimStart
        );

        await this.exportSingleClipSegment(
          sourceClip,
          baseClip.trimStart + clipStartInSegment,
          baseClip.trimStart + clipEndInSegment,
          tempBasePath,
          resolution,
          settings
        );
        baseVideoPath = tempBasePath;
      } else {
        // Base track empty, generate black video
        const tempBasePath = join(tempDir, `base_black_${timestamp}.mp4`);
        tempFiles.push(tempBasePath);
        await this.generateBlackVideo(
          tempBasePath,
          resolution.width,
          resolution.height,
          segment.endTime - segment.startTime,
          settings
        );
        baseVideoPath = tempBasePath;
      }

      // Process overlay tracks (tracks 1+)
      let compositePath = baseVideoPath;
      for (let trackIndex = 1; trackIndex < tracks.length; trackIndex++) {
        const overlayTrack = tracks[trackIndex];
        const overlayClips = clipsByTrack.get(overlayTrack.id) || [];

        if (overlayClips.length === 0) {
          continue; // Skip empty overlay tracks
        }

        // Process first overlay clip (can be enhanced for multiple)
        const overlayClip = overlayClips[0];
        const sourceClip = clips.find((c) => c.id === overlayClip.videoClipId);
        if (!sourceClip) {
          throw new Error(`Source clip not found: ${overlayClip.videoClipId}`);
        }

        const tempOverlayPath = join(tempDir, `overlay_${trackIndex}_${timestamp}.mp4`);
        tempFiles.push(tempOverlayPath);

        const clipStartInSegment = Math.max(0, segment.startTime - overlayClip.startTime);
        const clipEndInSegment = Math.min(
          segment.endTime - overlayClip.startTime,
          overlayClip.trimEnd - overlayClip.trimStart
        );

        await this.exportSingleClipSegment(
          sourceClip,
          overlayClip.trimStart + clipStartInSegment,
          overlayClip.trimStart + clipEndInSegment,
          tempOverlayPath,
          resolution,
          settings
        );

        // Composite overlay onto base
        const compositeOutputPath =
          trackIndex === tracks.length - 1
            ? outputPath
            : join(tempDir, `composite_${trackIndex}_${timestamp}.mp4`);
        
        if (trackIndex !== tracks.length - 1) {
          tempFiles.push(compositeOutputPath);
        }

        // Get overlay position from track settings
        const overlayPos = overlayTrack.overlayPosition || {
          x: 0.5,
          y: 0.5,
          scale: 0.25,
        };

        // Calculate overlay size and position
        const overlayWidth = Math.round(resolution.width * overlayPos.scale);
        const overlayHeight = Math.round(resolution.height * overlayPos.scale);
        const overlayX = Math.round((resolution.width - overlayWidth) * overlayPos.x);
        const overlayY = Math.round((resolution.height - overlayHeight) * overlayPos.y);

        // Scale overlay video to the correct size and composite
        // The overlay video is already at full resolution, so we need to scale it down
        const overlayScaleFilter = `[1:v]scale=${overlayWidth}:${overlayHeight}[overlay_scaled]`;
        const overlayFilter = `[0:v][overlay_scaled]overlay=${overlayX}:${overlayY}[v]`;
        
        // Build filter complex: scale overlay then composite
        // For audio: mix both tracks with volume adjustment
        // Add silent audio (anullsrc) as inputs, then conditionally mix real audio or silence
        const baseVolume = baseTrack.volume || 1.0;
        const overlayVolume = overlayTrack.volume || 1.0;
        const segmentDuration = segment.endTime - segment.startTime;
        const sampleRate = 48000; // Standard sample rate
        
        // Video filter: scale and overlay
        const videoFilter = `${overlayScaleFilter};${overlayFilter}`;
        
        // Audio filter: Handle missing audio gracefully
        // First, let's try to detect which inputs have audio by checking the files
        let baseHasAudio = false;
        let overlayHasAudio = false;
        
        try {
          const baseInfo = await this.extractVideoMetadata(compositePath);
          const overlayInfo = await this.extractVideoMetadata(tempOverlayPath);
          baseHasAudio = baseInfo.hasAudio;
          overlayHasAudio = overlayInfo.hasAudio;
          console.log(`Audio detection - Base: ${baseHasAudio}, Overlay: ${overlayHasAudio}`);
        } catch (infoError) {
          console.warn("Could not detect audio streams, assuming both have audio:", infoError);
          baseHasAudio = true;
          overlayHasAudio = true;
        }
        
        // Build audio filter based on what's actually available
        let audioFilter;
        if (baseHasAudio && overlayHasAudio) {
          // Both have audio - mix them
          audioFilter = 
            `[0:a]volume=${baseVolume}[a0];` +
            `[1:a]volume=${overlayVolume}[a1];` +
            `[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[a]`;
        } else if (baseHasAudio && !overlayHasAudio) {
          // Only base has audio
          audioFilter = `[0:a]volume=${baseVolume}[a]`;
        } else if (!baseHasAudio && overlayHasAudio) {
          // Only overlay has audio
          audioFilter = `[1:a]volume=${overlayVolume}[a]`;
        } else {
          // Neither has audio - use silence
          audioFilter = `[2]volume=${baseVolume}[a]`;
        }
        
        // Combine all filters
        const filterComplex = `${videoFilter};${audioFilter}`;

        // Debug: Log audio stream information
        console.log(`Processing segment ${segment.startTime}-${segment.endTime}s`);
        console.log(`Base track: ${baseTrack.name} (${baseTrack.clips.length} clips)`);
        console.log(`Overlay track: ${overlayTrack.name} (${overlayTrack.clips.length} clips)`);
        
        // Get video clip info for webcam detection
        const baseClipInfo = baseTrack.clips.find(clip => 
          segment.startTime >= clip.startTime && segment.endTime <= clip.endTime
        );
        const overlayClipInfo = overlayTrack.clips.find(clip => 
          segment.startTime >= clip.startTime && segment.endTime <= clip.endTime
        );
        
        // Check if this is a webcam recording (common patterns)
        const isWebcamBase = baseClipInfo ? 
          (baseClipInfo.videoClipId.toLowerCase().includes('webcam') || 
           baseClipInfo.videoClipId.toLowerCase().includes('camera')) : false;
        const isWebcamOverlay = overlayClipInfo ? 
          (overlayClipInfo.videoClipId.toLowerCase().includes('webcam') || 
           overlayClipInfo.videoClipId.toLowerCase().includes('camera')) : false;
        
        if (isWebcamBase || isWebcamOverlay) {
          console.log(`Detected webcam recording - Base: ${isWebcamBase}, Overlay: ${isWebcamOverlay}`);
        }
        
        // Try mixing audio first. If it fails (missing audio), handle gracefully
        try {
          // Build args based on what audio we need
          const compositeArgs = [
            "-i", compositePath,
            "-i", tempOverlayPath,
          ];
          
          // Only add anullsrc if we need silence (when neither track has audio)
          if (!baseHasAudio && !overlayHasAudio) {
            compositeArgs.push("-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=${sampleRate}:duration=${segmentDuration}`);
          }
          
          compositeArgs.push(
            "-filter_complex", filterComplex,
            "-map", "[v]",
            "-map", "[a]",
            "-c:a", "aac",
            "-b:a", `${settings.audioBitrate}k`,
            "-c:v", "libx264",
            "-preset", settings.quality === "high" ? "slow" : settings.quality === "medium" ? "medium" : "veryfast",
            "-crf", settings.quality === "high" ? "18" : settings.quality === "medium" ? "23" : "28",
            "-movflags", "+faststart+empty_moov",
            "-pix_fmt", "yuv420p",
            "-r", settings.fps.toString(),
            "-g", (settings.fps * 2).toString(),
            "-keyint_min", settings.fps.toString(),
            "-sc_threshold", "0",
            "-avoid_negative_ts", "make_zero",
            "-fflags", "+genpts+igndts",
            "-vsync", "cfr",
            "-force_key_frames", `expr:gte(t,n_forced*${2/settings.fps})`,
            "-metadata", "title=",
            "-metadata", "comment=",
            "-metadata", "description=",
            "-shortest",
            "-map_metadata", "-1",
            "-y", compositeOutputPath,
          );

          await this.runCommand(this.ffmpegPath, compositeArgs);
        } catch (error) {
          // If audio mixing failed (likely missing audio stream), try fallback
          // Use anullsrc as base, then mix with available audio
          console.warn("Audio mixing failed, attempting fallback with silence:", error);
          
          // Special handling for webcam recordings
          if (isWebcamBase || isWebcamOverlay) {
            console.log("Attempting webcam-specific audio handling...");
            
            // For webcam recordings, try a different approach:
            // Use stream selection with fallback to silence
            const webcamFallbackArgs = [
              "-i", compositePath,
              "-i", tempOverlayPath,
              "-filter_complex",
              `${overlayScaleFilter};${overlayFilter};[1:a]volume=${overlayVolume}[a]`,
              "-map", "[v]",
              "-map", "[a]",
              "-c:a", "aac",
              "-b:a", `${settings.audioBitrate}k`,
              "-c:v", "libx264",
              "-preset", settings.quality === "high" ? "slow" : settings.quality === "medium" ? "medium" : "veryfast",
              "-crf", settings.quality === "high" ? "18" : settings.quality === "medium" ? "23" : "28",
              "-shortest",
              "-y",
              compositeOutputPath,
            ];
            
            try {
              await this.runCommand(this.ffmpegPath, webcamFallbackArgs);
              return; // Success, exit early
            } catch (webcamError) {
              console.warn("Webcam-specific fallback also failed:", webcamError);
            }
          }
          
          const fallbackVideoFilter = `${overlayScaleFilter};${overlayFilter}`;
          
          // Fallback: always use silence as base, try to get real audio if available
          // Map available audio streams explicitly, or use silence
          const fallbackArgs = [
            "-i",
            compositePath,
            "-i",
            tempOverlayPath,
            "-f", "lavfi",
            "-i", `anullsrc=channel_layout=stereo:sample_rate=${sampleRate}:duration=${segmentDuration}`,
            "-filter_complex",
            `${fallbackVideoFilter};[2]volume=${baseVolume}[silence];[silence][0:a]amix=inputs=2:duration=longest:dropout_transition=2[a_base];[a_base][1:a]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[a]`,
            "-map",
            "[v]",
            "-map", "[a]",
            "-c:a", "aac",
            "-b:a", `${settings.audioBitrate}k`,
            "-c:v", "libx264",
            "-preset", settings.quality === "high" ? "slow" : settings.quality === "medium" ? "medium" : "veryfast",
            "-crf", settings.quality === "high" ? "18" : settings.quality === "medium" ? "23" : "28",
            "-movflags", "+faststart+empty_moov",
            "-pix_fmt", "yuv420p",
            "-r", settings.fps.toString(),
            "-g", (settings.fps * 2).toString(),
            "-keyint_min", settings.fps.toString(),
            "-sc_threshold", "0",
            "-avoid_negative_ts", "make_zero",
            "-fflags", "+genpts+igndts",
            "-vsync", "cfr",
            "-force_key_frames", `expr:gte(t,n_forced*${2/settings.fps})`,
            "-metadata", "title=",
            "-metadata", "comment=",
            "-metadata", "description=",
            "-shortest",
            "-map_metadata", "-1",
            "-y", compositeOutputPath,
          ];
          
          // If this also fails, just use video with silent audio
          try {
            await this.runCommand(this.ffmpegPath, fallbackArgs);
          } catch (fallbackError) {
            console.warn("Fallback audio mixing also failed, using video only:", fallbackError);
            // Final fallback: video overlay only, silent audio
            const videoOnlyArgs = [
              "-i", compositePath,
              "-i", tempOverlayPath,
              "-f", "lavfi",
              "-i", `anullsrc=channel_layout=stereo:sample_rate=${sampleRate}:duration=${segmentDuration}`,
              "-filter_complex", `${fallbackVideoFilter}`,
              "-map", "[v]",
              "-map", "2:a",
              "-c:a", "aac",
              "-b:a", `${settings.audioBitrate}k`,
              "-c:v", "libx264",
              "-preset", settings.quality === "high" ? "slow" : settings.quality === "medium" ? "medium" : "veryfast",
              "-crf", settings.quality === "high" ? "18" : settings.quality === "medium" ? "23" : "28",
              "-movflags", "+faststart+empty_moov",
              "-pix_fmt", "yuv420p",
              "-r", settings.fps.toString(),
              "-g", (settings.fps * 2).toString(),
              "-keyint_min", settings.fps.toString(),
              "-sc_threshold", "0",
              "-avoid_negative_ts", "make_zero",
              "-fflags", "+genpts+igndts",
              "-shortest",
              "-y", compositeOutputPath,
            ];
            await this.runCommand(this.ffmpegPath, videoOnlyArgs);
          }
        }
        compositePath = compositeOutputPath;
      }

      // If no overlays, just copy base to output
      if (compositePath !== outputPath) {
        const copyArgs = ["-i", compositePath, "-c", "copy", "-y", outputPath];
        await this.runCommand(this.ffmpegPath, copyArgs);
      }
    } finally {
      // Cleanup temporary files
      for (const tempFile of tempFiles) {
        try {
          await fs.unlink(tempFile);
        } catch (error) {
          console.error(`Failed to delete temp file ${tempFile}:`, error);
        }
      }
    }
  }

  /**
   * Export a single clip with trim points
   */
  private async exportSingleClip(
    clip: VideoClip,
    trimStart: number,
    trimEnd: number,
    outputPath: string,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const duration = trimEnd - trimStart;

    // Build FFmpeg arguments based on settings
    const args = [
      "-i",
      clip.filePath,
      "-ss",
      trimStart.toString(),
      "-t",
      duration.toString(),
    ];

    // Add resolution scaling if needed
    if (settings.resolution !== "source") {
      const resolutionMap = {
        "720p": "1280:720",
        "1080p": "1920:1080",
      };
      args.push("-vf", `scale=${resolutionMap[settings.resolution]}`);
    }

    // Add quality settings - using CRF for quality control
    const qualityMap = {
      low: { crf: "28", preset: "veryfast" },
      medium: { crf: "23", preset: "medium" },
      high: { crf: "18", preset: "slow" },
    };
    const quality = qualityMap[settings.quality];

    args.push(
      "-c:v",
      "libx264",
      "-crf",
      quality.crf,
      "-preset",
      quality.preset,
      "-c:a",
      "aac",
      "-b:a",
      `${settings.audioBitrate}k`,
      "-r",
      settings.fps.toString(),
      "-movflags",
      "+faststart", // Optimize for streaming
      "-y", // Overwrite output file
      outputPath
    );

    try {
      await this.runCommandWithProgress(
        this.ffmpegPath,
        args,
        duration,
        onProgress
      );
    } catch (error) {
      console.error("Error exporting video:", error);
      throw new Error(`Failed to export video: ${error}`);
    }
  }

  /**
   * Export multiple clips as a concatenated video
   */
  private async exportMultipleClips(
    timelineClips: TimelineClip[],
    sourceClips: VideoClip[],
    outputPath: string,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const { app } = require("electron");
    const tempDir = app.getPath("temp");
    const tempFiles: string[] = [];
    const concatListPath = join(tempDir, `concat_list_${Date.now()}.txt`);

    try {
      // Step 1: Process each clip segment
      for (let i = 0; i < timelineClips.length; i++) {
        const timelineClip = timelineClips[i];
        const sourceClip = sourceClips.find(
          (c) => c.id === timelineClip.videoClipId
        );

        if (!sourceClip) {
          throw new Error(`Source clip ${timelineClip.videoClipId} not found`);
        }

        const tempOutput = join(tempDir, `temp_clip_${i}_${Date.now()}.mp4`);
        tempFiles.push(tempOutput);

        // Export each segment with consistent encoding
        await this.exportSingleClip(
          sourceClip,
          timelineClip.trimStart,
          timelineClip.trimEnd,
          tempOutput,
          settings,
          (progress) => {
            // Calculate overall progress (each clip is a fraction of total)
            const overallProgress =
              ((i + progress / 100) / timelineClips.length) * 90; // 90% for processing clips
            if (onProgress) onProgress(overallProgress);
          }
        );
      }

      // Step 2: Create concat list file
      const concatList = tempFiles.map((file) => `file '${file}'`).join("\n");
      await fs.writeFile(concatListPath, concatList, "utf-8");

      // Step 3: Concatenate all clips
      const concatArgs = [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c",
        "copy", // Copy streams without re-encoding
        "-y",
        outputPath,
      ];

      await this.runCommand(this.ffmpegPath, concatArgs);

      if (onProgress) onProgress(100);
    } finally {
      // Cleanup temporary files
      for (const tempFile of tempFiles) {
        try {
          await fs.unlink(tempFile);
        } catch (error) {
          console.error(`Failed to delete temp file ${tempFile}:`, error);
        }
      }

      try {
        await fs.unlink(concatListPath);
      } catch (error) {
        console.error(`Failed to delete concat list:`, error);
      }
    }
  }

  /**
   * Cancel active FFmpeg process
   */
  cancelExport(): void {
    if (this.activeProcess) {
      this.activeProcess.kill("SIGTERM");
      this.activeProcess = null;
    }
  }

  /**
   * Run FFmpeg command and return output
   */
  private async runCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on("error", (error) => {
        reject(new Error(`Failed to start process: ${error.message}`));
      });
    });
  }

  /**
   * Run FFmpeg command with progress tracking
   */
  private async runCommandWithProgress(
    command: string,
    args: string[],
    totalDuration: number,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.activeProcess = spawn(command, args);

      let stdout = "";
      let stderr = "";

      this.activeProcess.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      this.activeProcess.stderr?.on("data", (data) => {
        const output = data.toString();
        stderr += output;

        // Parse FFmpeg progress from stderr (FFmpeg outputs progress to stderr)
        if (onProgress) {
          const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const progress = Math.min(100, (currentTime / totalDuration) * 100);
            onProgress(progress);
          }
        }
      });

      this.activeProcess.on("close", (code) => {
        this.activeProcess = null;
        if (code === 0) {
          if (onProgress) onProgress(100);
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      this.activeProcess.on("error", (error) => {
        this.activeProcess = null;
        reject(new Error(`Failed to start process: ${error.message}`));
      });
    });
  }

  /**
   * Parse FPS from FFprobe output
   */
  private parseFPS(frameRate: string): number {
    if (!frameRate || frameRate === "0/0") {
      return 0;
    }

    const parts = frameRate.split("/");
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      return denominator !== 0 ? numerator / denominator : 0;
    }

    return parseFloat(frameRate) || 0;
  }

  /**
   * Fix WebM duration metadata by re-muxing the file
   * This is needed because browser MediaRecorder doesn't write duration properly
   */
  async fixWebMDuration(inputPath: string, outputPath: string): Promise<void> {
    const args = [
      "-i",
      inputPath,
      "-c",
      "copy", // Copy without re-encoding (fast)
      "-y", // Overwrite output
      outputPath,
    ];

    try {
      await this.runCommand(this.ffmpegPath, args);
    } catch (error) {
      console.error("Error fixing WebM duration:", error);
      throw new Error(`Failed to fix WebM duration: ${error}`);
    }
  }
}

export const ffmpegService = new FFmpegService();
