import React, { useState, useEffect, useRef } from "react";
import { electronService } from "../../services/electronService";
import { RecordingDialog } from "./RecordingDialog";

interface RecordingControlsProps {
  onRecordingComplete: (filePath: string) => void;
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  onRecordingComplete,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Set up event listeners for recording events
    electronService.onRecordingStarted((data) => {
      if (data.success) {
        console.log("Recording started successfully");
      }
    });

    electronService.onRecordingStopped((data) => {
      console.log("Recording stopped:", data.outputPath);
      onRecordingComplete(data.outputPath);
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
    setShowDialog(true);
    setError(null);
  };

  const handleStartRecording = async (
    sourceId: string,
    includeAudio: boolean
  ) => {
    try {
      setError(null);
      
      // Start recording in main process
      await electronService.startScreenRecording(sourceId, includeAudio);
      
      // Get the media stream for the selected source
      // For Electron, we need to use specific constraints format
      const constraints: any = {
        audio: false, // Note: System audio in Electron is complex, start with video only
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
          },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!stream.active || stream.getVideoTracks().length === 0) {
        throw new Error("Failed to get active video stream");
      }

      streamRef.current = stream;
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
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
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
          
          // Clean up
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          
          setIsRecording(false);
          stopTimer();
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

      mediaRecorder.onerror = (event: any) => {
        console.error("MediaRecorder error:", event);
        setError("Recording error occurred");
        handleRecordingError();
      };

      mediaRecorderRef.current = mediaRecorder;
      
      // Start recording - request data every 1 second for better reliability
      mediaRecorder.start(1000);

      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start recording. Please check permissions."
      );
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRecordingError = () => {
    setIsRecording(false);
    stopTimer();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    
    chunksRef.current = [];
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {!isRecording ? (
          <button
            onClick={handleStartRecordingClick}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            title="Start screen recording"
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
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span>Record Screen</span>
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-white font-mono text-sm">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
              <span className="text-gray-400 text-sm">Recording...</span>
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
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onStartRecording={handleStartRecording}
      />
    </>
  );
};

