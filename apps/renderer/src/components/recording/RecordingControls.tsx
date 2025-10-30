import React, { useState, useEffect, useRef } from "react";
import { electronService } from "../../services/electronService";
import { RecordingDialog } from "./RecordingDialog";
import { WebcamRecordingDialog } from "./WebcamRecordingDialog";
import { SimultaneousRecordingDialog } from "./SimultaneousRecordingDialog";
import { RecordingCompositor } from "../../services/recordingCompositor";

interface RecordingControlsProps {
  onRecordingComplete: (filePath: string) => void;
  onRecordingStateChange?: (
    isRecording: boolean, 
    stream: MediaStream | null, 
    mode: 'screen' | 'webcam' | 'simultaneous' | null,
    webcamStream?: MediaStream | null
  ) => void;
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  onRecordingComplete,
  onRecordingStateChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showScreenDialog, setShowScreenDialog] = useState(false);
  const [showWebcamDialog, setShowWebcamDialog] = useState(false);
  const [showSimultaneousDialog, setShowSimultaneousDialog] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'screen' | 'webcam' | 'simultaneous' | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const secondaryMediaRecorderRef = useRef<MediaRecorder | null>(null); // For separate tracks mode
  const chunksRef = useRef<Blob[]>([]);
  const secondaryChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const compositorRef = useRef<RecordingCompositor | null>(null);
  const simultaneousModeRef = useRef<'composited' | 'separate-tracks' | null>(null);

  useEffect(() => {
    // Set up event listeners for recording events
    electronService.onRecordingStarted((data) => {
      if (data.success) {
        console.log("Recording started successfully");
      }
    });

    electronService.onRecordingStopped((data) => {
      console.log("Recording stopped:", data.outputPath, data.secondaryOutputPath);
      // Import the main file
      if (data.outputPath) {
        onRecordingComplete(data.outputPath);
      }
      // Import secondary file if it exists (for simultaneous recordings)
      if (data.secondaryOutputPath) {
        onRecordingComplete(data.secondaryOutputPath);
      }
    });

    electronService.onRecordingError((data) => {
      console.error("Recording error:", data.error);
      setError(data.error);
      handleRecordingError();
    });

    return () => {
      // Clean up listeners
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners("recording-started");
        window.electronAPI.removeAllListeners("recording-stopped");
        window.electronAPI.removeAllListeners("recording-error");
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startTimer = () => {
    setRecordingDuration(0);
    timerRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStartRecordingClick = () => {
    setShowScreenDialog(true);
    setError(null);
  };

  const handleStartWebcamClick = () => {
    setShowWebcamDialog(true);
    setError(null);
  };

  const handleStartSimultaneousClick = () => {
    setShowSimultaneousDialog(true);
    setError(null);
  };

  const handleStartRecording = async (
    sourceId: string,
    includeAudio: boolean,
    microphoneDeviceId?: string
  ) => {
    try {
      setError(null);
      setRecordingMode('screen');
      
      // Start recording in main process
      await electronService.startScreenRecording(sourceId, includeAudio, microphoneDeviceId);
      
      // Get the media stream for the selected source
      // For Electron, we need to use specific constraints format
      const videoConstraints: any = {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: sourceId,
        },
      };

      const videoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints,
      });

      if (!videoStream.active || videoStream.getVideoTracks().length === 0) {
        throw new Error("Failed to get active video stream");
      }

      // If microphone is requested, add audio track
      let finalStream = videoStream;
      if (microphoneDeviceId) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: microphoneDeviceId } },
            video: false,
          });
          
          // Combine video and audio streams
          const combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...audioStream.getAudioTracks(),
          ]);
          finalStream = combinedStream;
        } catch (err) {
          console.error("Failed to get microphone stream, continuing without audio:", err);
          // Continue with video-only recording
        }
      }

      streamRef.current = finalStream;
      chunksRef.current = [];

      // Check available MIME types and use the first supported one
      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      
      let selectedMimeType = "video/webm";
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      // Create MediaRecorder with proper configuration
      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await handleRecorderStop();
      };

      mediaRecorder.onerror = (event: any) => {
        console.error("MediaRecorder error:", event);
        setError("Recording error occurred");
        handleRecordingError();
      };

      mediaRecorderRef.current = mediaRecorder;
      
      // Start recording - request data every 1 second for better reliability
      mediaRecorder.start(1000);

      setIsRecording(true);
      setRecordingMode('screen');
      startTimer();
      
      // Notify parent about recording state
      if (onRecordingStateChange) {
        onRecordingStateChange(true, finalStream, 'screen');
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start recording. Please check permissions."
      );
      setIsRecording(false);
      setRecordingMode(null);
    }
  };

  const handleStartWebcamRecording = async (
    webcamDeviceId: string,
    microphoneDeviceId?: string
  ) => {
    try {
      setError(null);
      setRecordingMode('webcam');
      
      // Start recording in main process
      await electronService.startWebcamRecording(webcamDeviceId, microphoneDeviceId);
      
      // Get webcam stream
      const videoConstraints: any = {
        deviceId: { exact: webcamDeviceId },
      };

      const videoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints,
      });

      if (!videoStream.active || videoStream.getVideoTracks().length === 0) {
        throw new Error("Failed to get webcam stream");
      }

      // If microphone is requested, add audio track
      let finalStream = videoStream;
      if (microphoneDeviceId) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: microphoneDeviceId } },
            video: false,
          });
          
          // Combine video and audio streams
          const combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...audioStream.getAudioTracks(),
          ]);
          finalStream = combinedStream;
        } catch (err) {
          console.error("Failed to get microphone stream, continuing without audio:", err);
        }
      }

      streamRef.current = finalStream;
      chunksRef.current = [];

      // Check available MIME types
      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      
      let selectedMimeType = "video/webm";
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await handleRecorderStop();
      };

      mediaRecorder.onerror = (event: any) => {
        console.error("MediaRecorder error:", event);
        setError("Recording error occurred");
        handleRecordingError();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      setIsRecording(true);
      setRecordingMode('webcam');
      startTimer();
      
      // Notify parent about recording state
      if (onRecordingStateChange) {
        onRecordingStateChange(true, finalStream, 'webcam');
      }
    } catch (err) {
      console.error("Error starting webcam recording:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start webcam recording. Please check permissions."
      );
      setIsRecording(false);
      setRecordingMode(null);
    }
  };

  const handleStartSimultaneousRecording = async (
    screenSourceId: string,
    webcamDeviceId: string,
    microphoneDeviceId: string | undefined
  ) => {
    try {
      setError(null);
      setRecordingMode('simultaneous');
      
      // Always use separate-tracks mode
      const simRecordingMode = 'separate-tracks';
      simultaneousModeRef.current = simRecordingMode;
      
      // Start recording in main process
      await electronService.startSimultaneousRecording(
        screenSourceId,
        webcamDeviceId,
        microphoneDeviceId,
        simRecordingMode
      );
      
      // Get screen stream
      const screenConstraints: any = {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: screenSourceId,
        },
      };

      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: screenConstraints,
      });

      if (!screenStream.active || screenStream.getVideoTracks().length === 0) {
        throw new Error("Failed to get active screen stream");
      }

      // Get webcam stream (no audio from webcam)
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: webcamDeviceId } },
        audio: false,
      });

      if (!webcamStream.active || webcamStream.getVideoTracks().length === 0) {
        throw new Error("Failed to get webcam stream");
      }

      // Get microphone stream if requested - this goes with screen recording
      let audioStream: MediaStream | null = null;
      if (microphoneDeviceId) {
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: microphoneDeviceId } },
            video: false,
          });
        } catch (err) {
          console.error("Failed to get microphone stream, continuing without audio:", err);
        }
      }

      // Separate tracks mode: record screen and webcam separately
      chunksRef.current = [];
      secondaryChunksRef.current = [];

      // Screen gets video only (no audio)
      const finalScreenStream = screenStream;

      // Webcam gets video + microphone audio (person talking to camera)
      let finalWebcamStream = webcamStream;
      if (audioStream) {
        finalWebcamStream = new MediaStream([
          ...webcamStream.getVideoTracks(),
          ...audioStream.getAudioTracks(),
        ]);
      }

      // Check available MIME types
      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      
      let selectedMimeType = "video/webm";
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      // Create MediaRecorder for screen (video only, no audio)
      const screenRecorder = new MediaRecorder(finalScreenStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000,
      });

      screenRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Track when both recorders have stopped
      let screenStopped = false;
      let webcamStopped = false;

      const checkBothStopped = async () => {
        if (screenStopped && webcamStopped) {
          await handleSeparateTracksStop();
        }
      };

      screenRecorder.onstop = async () => {
        screenStopped = true;
        await checkBothStopped();
      };

      screenRecorder.onerror = (event: any) => {
        console.error("Screen MediaRecorder error:", event);
        setError("Screen recording error occurred");
        handleRecordingError();
      };

      // Create MediaRecorder for webcam (video + microphone audio)
      const webcamRecorder = new MediaRecorder(finalWebcamStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000,
      });

      webcamRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          secondaryChunksRef.current.push(event.data);
        }
      };

      webcamRecorder.onstop = async () => {
        webcamStopped = true;
        await checkBothStopped();
      };

      webcamRecorder.onerror = (event: any) => {
        console.error("Webcam MediaRecorder error:", event);
        setError("Webcam recording error occurred");
        handleRecordingError();
      };

      mediaRecorderRef.current = screenRecorder;
      secondaryMediaRecorderRef.current = webcamRecorder;
      streamRef.current = finalScreenStream;

      // Store webcam stream separately for cleanup
      const webcamStreamForCleanup = finalWebcamStream;

      // Start both recorders
      screenRecorder.start(1000);
      webcamRecorder.start(1000);

      setIsRecording(true);
      startTimer();
      
      // Notify parent about recording state - pass screen stream for main preview
      // We'll need to handle webcam stream separately for PiP
      if (onRecordingStateChange) {
        onRecordingStateChange(true, finalScreenStream, 'simultaneous', webcamStreamForCleanup);
      }

      // Store webcam stream for later cleanup
      (screenRecorder as any).webcamStream = webcamStreamForCleanup;
    } catch (err) {
      console.error("Error starting simultaneous recording:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start simultaneous recording. Please check permissions."
      );
      setIsRecording(false);
      setRecordingMode(null);
      simultaneousModeRef.current = null;
    }
  };

  const handleRecorderStop = async () => {
    if (chunksRef.current.length === 0) {
      setError("No video data was recorded. Please try again.");
      handleRecordingError();
      return;
    }
    
    // Convert Blob array to Uint8Array for IPC
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    
    if (blob.size === 0) {
      setError("Recording failed: no data captured");
      handleRecordingError();
      return;
    }
    
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    try {
      // Save the recording
      await electronService.saveRecording([uint8Array]);
      
      // Stop the recording in main process
      await electronService.stopRecording();
      
      // Clean up compositor if used
      if (compositorRef.current) {
        compositorRef.current.stopComposition();
        compositorRef.current = null;
      }
      
      // Clean up
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      
      setIsRecording(false);
      setRecordingMode(null);
      simultaneousModeRef.current = null;
      stopTimer();
      
      // Notify parent about recording stopped
      if (onRecordingStateChange) {
        onRecordingStateChange(false, null, null);
      }
    } catch (err) {
      console.error("Error saving recording:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save recording"
      );
      handleRecordingError();
    }
  };

  const handleSeparateTracksStop = async () => {
    // Prevent double-processing if both onstop handlers fire
    if (chunksRef.current.length === 0 && secondaryChunksRef.current.length === 0) {
      return; // Already processed
    }
    
    if (chunksRef.current.length === 0 || secondaryChunksRef.current.length === 0) {
      setError("Recording failed: no data captured from one or both sources");
      handleRecordingError();
      return;
    }
    
    // Convert screen recording
    const screenBlob = new Blob(chunksRef.current, { type: "video/webm" });
    const screenBuffer = await screenBlob.arrayBuffer();
    const screenArray = new Uint8Array(screenBuffer);

    // Convert webcam recording
    const webcamBlob = new Blob(secondaryChunksRef.current, { type: "video/webm" });
    const webcamBuffer = await webcamBlob.arrayBuffer();
    const webcamArray = new Uint8Array(webcamBuffer);
    
    // Clear chunks immediately to prevent reprocessing
    chunksRef.current = [];
    secondaryChunksRef.current = [];

    try {
      // Save both recordings
      await electronService.saveRecording([screenArray]);
      await electronService.saveSecondaryRecording([webcamArray]);
      
      // Stop the recording in main process
      // This will trigger the 'recording-stopped' event which will import the files
      // Don't call onRecordingComplete here - let the event handler do it
      await electronService.stopRecording();
      
      // Clean up screen stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      
      // Clean up webcam stream (stored in mediaRecorderRef)
      if (mediaRecorderRef.current && (mediaRecorderRef.current as any).webcamStream) {
        const webcamStream = (mediaRecorderRef.current as any).webcamStream;
        webcamStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      
      setIsRecording(false);
      setRecordingMode(null);
      simultaneousModeRef.current = null;
      stopTimer();
      
      // Notify parent about recording stopped
      if (onRecordingStateChange) {
        onRecordingStateChange(false, null, null);
      }
    } catch (err) {
      console.error("Error saving separate tracks:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save recordings"
      );
      handleRecordingError();
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (secondaryMediaRecorderRef.current && secondaryMediaRecorderRef.current.state !== "inactive") {
      secondaryMediaRecorderRef.current.stop();
    }
  };

  const handleRecordingError = () => {
    setIsRecording(false);
    setRecordingMode(null);
    simultaneousModeRef.current = null;
    stopTimer();
    
    // Notify parent about recording stopped
    if (onRecordingStateChange) {
      onRecordingStateChange(false, null, null);
    }
    
    // Clean up screen stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    // Clean up webcam stream (stored in mediaRecorderRef for simultaneous recordings)
    if (mediaRecorderRef.current && (mediaRecorderRef.current as any).webcamStream) {
      const webcamStream = (mediaRecorderRef.current as any).webcamStream;
      webcamStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }
    
    if (compositorRef.current) {
      compositorRef.current.stopComposition();
      compositorRef.current = null;
    }
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    
    if (secondaryMediaRecorderRef.current) {
      secondaryMediaRecorderRef.current = null;
    }
    
    chunksRef.current = [];
    secondaryChunksRef.current = [];
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {!isRecording ? (
          <>
            <button
              onClick={handleStartRecordingClick}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              title="Start screen recording"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span>Record Screen</span>
            </button>
            <button
              onClick={handleStartWebcamClick}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              title="Start webcam recording"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Record Webcam</span>
            </button>
            <button
              onClick={handleStartSimultaneousClick}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              title="Start screen + webcam recording"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              <span>Screen + Webcam</span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-white font-mono text-sm">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
              <span className="text-gray-400 text-sm">
                Recording {recordingMode === 'screen' ? 'Screen' : recordingMode === 'webcam' ? 'Webcam' : 'Screen + Webcam'}...
              </span>
            </div>
            <button
              onClick={handleStopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              title="Stop recording"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
              <span>Stop</span>
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mt-2 px-4 py-2 bg-red-500 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      <RecordingDialog
        isOpen={showScreenDialog}
        onClose={() => setShowScreenDialog(false)}
        onStartRecording={handleStartRecording}
      />
      
      <WebcamRecordingDialog
        isOpen={showWebcamDialog}
        onClose={() => setShowWebcamDialog(false)}
        onStartRecording={handleStartWebcamRecording}
      />
      
      <SimultaneousRecordingDialog
        isOpen={showSimultaneousDialog}
        onClose={() => setShowSimultaneousDialog(false)}
        onStartRecording={handleStartSimultaneousRecording}
      />
    </>
  );
};

