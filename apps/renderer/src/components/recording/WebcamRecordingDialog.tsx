import React, { useState, useEffect, useRef } from "react";

interface WebcamRecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRecording: (webcamDeviceId: string, microphoneDeviceId?: string) => void;
}

export const WebcamRecordingDialog: React.FC<WebcamRecordingDialogProps> = ({
  isOpen,
  onClose,
  onStartRecording,
}) => {
  const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedWebcam, setSelectedWebcam] = useState<string>("");
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");
  const [includeMicrophone, setIncludeMicrophone] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    } else {
      // Clean up preview stream when dialog closes
      cleanupPreview();
    }

    return () => {
      cleanupPreview();
    };
  }, [isOpen]);

  useEffect(() => {
    // Update preview when selected webcam changes
    if (selectedWebcam && isOpen) {
      // Small delay to ensure video element is mounted
      const timeoutId = setTimeout(() => {
        startPreview();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedWebcam, isOpen]);

  const cleanupPreview = () => {
    if (previewStream) {
      previewStream.getTracks().forEach((track) => track.stop());
      setPreviewStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      // Request permissions first by getting a temporary stream
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      // Stop the temporary stream immediately
      tempStream.getTracks().forEach((track) => track.stop());
      
      // Now enumerate devices (labels will be available after permission grant)
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter((device) => device.kind === "videoinput");
      const microphones = devices.filter((device) => device.kind === "audioinput");
      
      setWebcamDevices(cameras);
      setMicrophoneDevices(microphones);
      
      // Auto-select first devices
      if (cameras.length > 0 && !selectedWebcam) {
        setSelectedWebcam(cameras[0].deviceId);
      }
      if (microphones.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(microphones[0].deviceId);
      }
    } catch (err) {
      console.error("Error loading devices:", err);
      
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError(
            "Camera and microphone permissions denied. Please allow access in your browser or system settings."
          );
        } else if (err.name === "NotFoundError") {
          setError("No camera or microphone found. Please connect a device and try again.");
        } else {
          setError(`Failed to access camera/microphone: ${err.message}`);
        }
      } else {
        setError("Failed to load devices. Please check permissions.");
      }
    } finally {
      setLoading(false);
    }
  };

  const startPreview = async () => {
    cleanupPreview();
    
    if (!selectedWebcam) {
      console.log("No webcam selected");
      return;
    }
    
    console.log("Starting preview for webcam:", selectedWebcam);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedWebcam },
        },
        audio: false, // Don't include audio in preview to avoid feedback
      });
      
      console.log("Got stream:", stream, "Active tracks:", stream.getTracks().length);
      setPreviewStream(stream);
      
      if (videoRef.current) {
        console.log("Setting srcObject on video element");
        videoRef.current.srcObject = stream;
        // Ensure video plays - handle any play errors
        try {
          await videoRef.current.play();
          console.log("Video playing successfully");
        } catch (playError) {
          console.warn("Video play failed, but stream is set:", playError);
          // The video element with autoPlay should handle this
        }
      } else {
        console.error("Video ref is null!");
      }
    } catch (err) {
      console.error("Error starting preview:", err);
      setError(
        err instanceof Error
          ? `Failed to start webcam preview: ${err.message}`
          : "Failed to start webcam preview"
      );
    }
  };

  const handleStartRecording = () => {
    if (selectedWebcam) {
      cleanupPreview();
      onStartRecording(
        selectedWebcam,
        includeMicrophone ? selectedMicrophone : undefined
      );
      onClose();
    }
  };

  const handleClose = () => {
    cleanupPreview();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            Record from Webcam
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-white">Loading devices...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded p-4 mb-4">
            <p className="text-red-200">{error}</p>
            <button
              onClick={loadDevices}
              className="mt-2 text-sm text-red-300 hover:text-red-100 underline"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Webcam Preview */}
            <div className="mb-4">
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover scale-x-[-1] ${
                    previewStream ? 'block' : 'hidden'
                  }`}
                />
                {!previewStream && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="w-16 h-16"
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
                      <p className="text-sm">Select a camera to preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Device Selection */}
            <div className="space-y-4 mb-4">
              {/* Webcam Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Camera
                </label>
                <select
                  value={selectedWebcam}
                  onChange={(e) => setSelectedWebcam(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                >
                  {webcamDevices.length === 0 ? (
                    <option value="">No cameras found</option>
                  ) : (
                    webcamDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Microphone Selection */}
              <div>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="includeMicrophone"
                    checked={includeMicrophone}
                    onChange={(e) => setIncludeMicrophone(e.target.checked)}
                    className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor="includeMicrophone"
                    className="ml-2 text-sm font-medium text-gray-300"
                  >
                    Include microphone
                  </label>
                </div>
                {includeMicrophone && (
                  <select
                    value={selectedMicrophone}
                    onChange={(e) => setSelectedMicrophone(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                  >
                    {microphoneDevices.length === 0 ? (
                      <option value="">No microphones found</option>
                    ) : (
                      microphoneDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartRecording}
                disabled={!selectedWebcam || webcamDevices.length === 0}
                className={`px-6 py-2 rounded font-medium transition-colors ${
                  selectedWebcam && webcamDevices.length > 0
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-gray-600 text-gray-400 cursor-not-allowed"
                }`}
              >
                Start Recording
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

