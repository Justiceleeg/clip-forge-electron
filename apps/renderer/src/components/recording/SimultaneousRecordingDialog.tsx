import React, { useState, useEffect, useRef } from "react";
import { electronService } from "../../services/electronService";
import { ScreenSource } from "../../types/electron";
import { PipConfig } from "@clipforge/shared";
import { RecordingCompositor } from "../../services/recordingCompositor";

interface SimultaneousRecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRecording: (
    screenSourceId: string,
    webcamDeviceId: string,
    microphoneDeviceId: string | undefined
  ) => void;
}

export const SimultaneousRecordingDialog: React.FC<SimultaneousRecordingDialogProps> = ({
  isOpen,
  onClose,
  onStartRecording,
}) => {
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([]);
  const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedScreenSource, setSelectedScreenSource] = useState<string>("");
  const [selectedWebcam, setSelectedWebcam] = useState<string>("");
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("none");
  // Fixed PiP config for preview only (users configure in timeline later)
  const pipConfig: PipConfig = {
    position: 'bottom-right',
    size: 'medium',
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositorRef = useRef<RecordingCompositor | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSources();
    } else {
      // Cleanup on close
      stopPreview();
    }

    return () => {
      stopPreview();
    };
  }, [isOpen]);

  // PiP config is fixed, no need to update dynamically

  const loadSources = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get screen sources
      const sources = await electronService.getScreenSources();
      setScreenSources(sources);
      if (sources.length > 0) {
        setSelectedScreenSource(sources[0].id);
      }

      // Request camera permission first to get device labels
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        tempStream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.warn("Failed to request initial permissions:", err);
      }

      // Get webcam and microphone devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const webcams = devices.filter((device) => device.kind === "videoinput");
      const mics = devices.filter((device) => device.kind === "audioinput");

      setWebcamDevices(webcams);
      setMicrophoneDevices(mics);

      if (webcams.length > 0) {
        setSelectedWebcam(webcams[0].deviceId);
      }
      if (mics.length > 0) {
        setSelectedMicrophone(mics[0].deviceId);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading sources:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load recording sources. Please check permissions."
      );
      setLoading(false);
    }
  };

  const startPreview = async () => {
    if (!selectedScreenSource || !selectedWebcam) {
      setError("Please select both screen and webcam sources");
      return;
    }

    try {
      setIsLoadingPreview(true);
      setError(null);

      // Get screen stream
      const screenConstraints: any = {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: selectedScreenSource,
        },
      };

      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: screenConstraints,
      });

      // Get webcam stream
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedWebcam } },
        audio: false,
      });

      screenStreamRef.current = screenStream;
      webcamStreamRef.current = webcamStream;

      // Create compositor
      const compositor = new RecordingCompositor();
      compositorRef.current = compositor;

      // Start composition
      await compositor.startComposition({
        screenStream,
        webcamStream,
        pipConfig,
        targetWidth: 1280, // Preview size
        targetHeight: 720,
      });

      // Display preview in canvas
      if (previewCanvasRef.current) {
        const compositorCanvas = compositor.getCanvas();
        const ctx = previewCanvasRef.current.getContext('2d');
        if (ctx) {
          previewCanvasRef.current.width = compositorCanvas.width;
          previewCanvasRef.current.height = compositorCanvas.height;
          
          // Copy frames from compositor canvas to preview canvas
          const renderPreview = () => {
            if (ctx && previewCanvasRef.current && compositorRef.current) {
              ctx.drawImage(compositorCanvas, 0, 0);
              requestAnimationFrame(renderPreview);
            }
          };
          renderPreview();
        }
      }

      setIsLoadingPreview(false);
    } catch (err) {
      console.error("Error starting preview:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start preview. Please check permissions."
      );
      setIsLoadingPreview(false);
      stopPreview();
    }
  };

  const stopPreview = () => {
    if (compositorRef.current) {
      compositorRef.current.stopComposition();
      compositorRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => track.stop());
      webcamStreamRef.current = null;
    }
  };

  useEffect(() => {
    if (selectedScreenSource && selectedWebcam) {
      stopPreview();
      startPreview();
    }
  }, [selectedScreenSource, selectedWebcam]);

  const handleStart = () => {
    if (!selectedScreenSource || !selectedWebcam) {
      setError("Please select both screen and webcam sources");
      return;
    }

    const micId = selectedMicrophone === "none" ? undefined : selectedMicrophone;
    onStartRecording(selectedScreenSource, selectedWebcam, micId);
    stopPreview();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200]">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            Screen + Webcam Recording
          </h2>
          <button
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close"
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

        {error && (
          <div className="mb-4 p-4 bg-red-500 bg-opacity-20 border border-red-500 rounded text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-white">Loading sources...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Live Preview */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Live Preview</h3>
              <div className="relative bg-black rounded overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <canvas
                  ref={previewCanvasRef}
                  className="w-full h-full"
                  style={{ objectFit: 'contain' }}
                />
                {isLoadingPreview && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="text-white">Loading preview...</div>
                  </div>
                )}
              </div>
            </div>

            {/* Screen Source Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Screen Source
              </label>
              <select
                value={selectedScreenSource}
                onChange={(e) => setSelectedScreenSource(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a screen...</option>
                {screenSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Webcam Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Webcam
              </label>
              <select
                value={selectedWebcam}
                onChange={(e) => setSelectedWebcam(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a webcam...</option>
                {webcamDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Webcam ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Microphone Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Microphone (Optional)
              </label>
              <select
                value={selectedMicrophone}
                onChange={(e) => setSelectedMicrophone(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
              >
                <option value="none">No microphone</option>
                {microphoneDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Info about separate files */}
            <div className="bg-blue-500 bg-opacity-10 border border-blue-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-200">
                  <p className="font-medium mb-1">Recording as Separate Files</p>
                  <p className="text-blue-300">Screen and webcam will be saved as separate files. You can arrange and position them on the timeline after recording.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  stopPreview();
                  onClose();
                }}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={!selectedScreenSource || !selectedWebcam}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Recording
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

