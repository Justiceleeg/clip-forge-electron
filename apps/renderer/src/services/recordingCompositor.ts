/**
 * RecordingCompositor - Real-time canvas-based video composition for PiP recording
 * Composites screen video with webcam video in real-time using HTML5 Canvas
 */

import { PipConfig } from '@clipforge/shared';

export interface CompositionConfig {
  screenStream: MediaStream;
  webcamStream: MediaStream;
  pipConfig: PipConfig;
  targetWidth?: number;
  targetHeight?: number;
}

export class RecordingCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private screenVideo: HTMLVideoElement;
  private webcamVideo: HTMLVideoElement;
  private animationFrameId: number | null = null;
  private composedStream: MediaStream | null = null;
  private isComposing = false;

  constructor() {
    // Create offscreen canvas for composition
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true // Hint for better performance
    })!;

    // Create video elements for sources
    this.screenVideo = document.createElement('video');
    this.screenVideo.autoplay = true;
    this.screenVideo.muted = true;

    this.webcamVideo = document.createElement('video');
    this.webcamVideo.autoplay = true;
    this.webcamVideo.muted = true;
  }

  /**
   * Start compositing screen + webcam streams
   */
  async startComposition(config: CompositionConfig): Promise<MediaStream> {
    if (this.isComposing) {
      throw new Error('Already composing');
    }

    // Set video sources
    this.screenVideo.srcObject = config.screenStream;
    this.webcamVideo.srcObject = config.webcamStream;

    // Wait for both videos to be ready
    await Promise.all([
      this.waitForVideoReady(this.screenVideo),
      this.waitForVideoReady(this.webcamVideo),
    ]);

    // Set canvas size based on screen video dimensions
    const width = config.targetWidth || this.screenVideo.videoWidth || 1920;
    const height = config.targetHeight || this.screenVideo.videoHeight || 1080;
    
    this.canvas.width = width;
    this.canvas.height = height;

    console.log(`Canvas composition size: ${width}x${height}`);

    // Start composition loop
    this.isComposing = true;
    this.composeFrame(config.pipConfig);

    // Capture canvas stream at 30fps
    this.composedStream = this.canvas.captureStream(30);

    // Add audio tracks from both streams if available
    const audioTracks: MediaStreamTrack[] = [];
    
    // Add screen audio if available
    config.screenStream.getAudioTracks().forEach(track => {
      audioTracks.push(track);
    });
    
    // Add webcam/mic audio if available
    config.webcamStream.getAudioTracks().forEach(track => {
      audioTracks.push(track);
    });

    // Add audio tracks to composed stream
    audioTracks.forEach(track => {
      this.composedStream!.addTrack(track);
    });

    return this.composedStream;
  }

  /**
   * Compose a single frame with PiP overlay
   */
  private composeFrame(pipConfig: PipConfig): void {
    if (!this.isComposing) return;

    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw screen video as base layer (full canvas)
    if (this.screenVideo.readyState >= 2) {
      this.ctx.drawImage(
        this.screenVideo,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    }

    // Calculate PiP dimensions and position
    const pipDimensions = this.calculatePipDimensions(pipConfig);

    // Draw webcam video as PiP overlay
    if (this.webcamVideo.readyState >= 2) {
      // Optional: Add a border/shadow for the PiP
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      this.ctx.shadowBlur = 10;
      this.ctx.shadowOffsetX = 2;
      this.ctx.shadowOffsetY = 2;

      this.ctx.drawImage(
        this.webcamVideo,
        pipDimensions.x,
        pipDimensions.y,
        pipDimensions.width,
        pipDimensions.height
      );

      // Reset shadow
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
    }

    // Request next frame
    this.animationFrameId = requestAnimationFrame(() => this.composeFrame(pipConfig));
  }

  /**
   * Calculate PiP dimensions and position based on config
   */
  private calculatePipDimensions(pipConfig: PipConfig): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const padding = 20; // Padding from edges

    // Calculate PiP size
    let pipWidth: number;
    let pipHeight: number;

    if (pipConfig.customWidth && pipConfig.customHeight) {
      pipWidth = pipConfig.customWidth;
      pipHeight = pipConfig.customHeight;
    } else {
      // Default sizes as percentage of canvas width
      const sizePercentages = {
        small: 0.20,  // 20% of canvas width
        medium: 0.25, // 25% of canvas width
        large: 0.30,  // 30% of canvas width
      };

      const sizePercent = sizePercentages[pipConfig.size];
      pipWidth = canvasWidth * sizePercent;

      // Maintain webcam aspect ratio (typically 16:9 or 4:3)
      const webcamAspect = this.webcamVideo.videoWidth / this.webcamVideo.videoHeight || 16/9;
      pipHeight = pipWidth / webcamAspect;
    }

    // Calculate position based on corner
    let x: number;
    let y: number;

    switch (pipConfig.position) {
      case 'top-left':
        x = padding;
        y = padding;
        break;
      case 'top-right':
        x = canvasWidth - pipWidth - padding;
        y = padding;
        break;
      case 'bottom-left':
        x = padding;
        y = canvasHeight - pipHeight - padding;
        break;
      case 'bottom-right':
      default:
        x = canvasWidth - pipWidth - padding;
        y = canvasHeight - pipHeight - padding;
        break;
    }

    return { x, y, width: pipWidth, height: pipHeight };
  }

  /**
   * Wait for video element to be ready for playback
   */
  private waitForVideoReady(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }

      const onLoadedData = () => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('error', onError);
        resolve();
      };

      const onError = () => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('error', onError);
        reject(new Error('Failed to load video'));
      };

      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('error', onError);
    });
  }

  /**
   * Update PiP configuration in real-time
   */
  updatePipConfig(_pipConfig: PipConfig): void {
    // The next frame will use the new config
    // No need to restart composition
  }

  /**
   * Stop composition and clean up resources
   */
  stopComposition(): void {
    this.isComposing = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop video elements
    this.screenVideo.srcObject = null;
    this.webcamVideo.srcObject = null;

    // Stop composed stream
    if (this.composedStream) {
      this.composedStream.getTracks().forEach(track => track.stop());
      this.composedStream = null;
    }
  }

  /**
   * Get the canvas element for preview purposes
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get the composed stream
   */
  getComposedStream(): MediaStream | null {
    return this.composedStream;
  }
}

