import React, { useState, useEffect } from "react";
import { electronService } from "../../services/electronService";
import { ScreenSource } from "../../types/electron";

interface RecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRecording: (sourceId: string, includeAudio: boolean, microphoneDeviceId?: string) => void;
}

export const RecordingDialog: React.FC<RecordingDialogProps> = ({
  isOpen,
  onClose,
  onStartRecording,
}) => {
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<ScreenSource | null>(
    null
  );
  const [includeAudio, setIncludeAudio] = useState(false);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");
  const [includeMicrophone, setIncludeMicrophone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadScreenSources();
      loadMicrophoneDevices();
    }
  }, [isOpen]);

  const loadScreenSources = async () => {
    setLoading(true);
    setError(null);
    try {
      const screenSources = await electronService.getScreenSources();
      setSources(screenSources);
      
      // Auto-select the first screen source
      if (screenSources.length > 0) {
        setSelectedSource(screenSources[0]);
      }
    } catch (err) {
      console.error("Error loading screen sources:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load screen sources. Please check permissions."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadMicrophoneDevices = async () => {
    try {
      // Request permission for microphones
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((track) => track.stop());
      
      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter((device) => device.kind === "audioinput");
      
      setMicrophoneDevices(microphones);
      
      // Auto-select first microphone
      if (microphones.length > 0) {
        setSelectedMicrophone(microphones[0].deviceId);
      }
    } catch (err) {
      console.error("Error loading microphone devices:", err);
      // Microphone permission denied - not critical for screen recording
    }
  };

  const handleStartRecording = () => {
    if (selectedSource) {
      onStartRecording(
        selectedSource.id,
        includeAudio,
        includeMicrophone && selectedMicrophone ? selectedMicrophone : undefined
      );
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            Select Screen or Window to Record
          </h2>
          <button
            onClick={onClose}
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
            <div className="text-white">Loading screen sources...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded p-4 mb-4">
            <p className="text-red-200">{error}</p>
            <button
              onClick={loadScreenSources}
              className="mt-2 text-sm text-red-300 hover:text-red-100 underline"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && sources.length === 0 && (
          <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded p-4 mb-4">
            <p className="text-yellow-200">
              No screen sources available. Please check your permissions.
            </p>
          </div>
        )}

        {!loading && !error && sources.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto mb-4">
              <div className="grid grid-cols-2 gap-4">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    onClick={() => setSelectedSource(source)}
                    className={`cursor-pointer border-2 rounded-lg p-3 transition-all ${
                      selectedSource?.id === source.id
                        ? "border-blue-500 bg-blue-500 bg-opacity-10"
                        : "border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    <div className="aspect-video bg-gray-900 rounded mb-2 flex items-center justify-center overflow-hidden">
                      {source.thumbnail ? (
                        <img
                          src={source.thumbnail}
                          alt={source.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg
                          className="w-16 h-16 text-gray-600"
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
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <div
                        className={`flex-shrink-0 w-4 h-4 rounded-full border-2 mt-0.5 ${
                          selectedSource?.id === source.id
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-500"
                        }`}
                      >
                        {selectedSource?.id === source.id && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {source.name}
                        </p>
                        <p className="text-gray-400 text-xs capitalize">
                          {source.type}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="includeAudio"
                  checked={includeAudio}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                  className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="includeAudio"
                  className="ml-2 text-sm text-gray-300"
                >
                  Include system audio (if available)
                </label>
              </div>

              <div className="mb-4">
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

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartRecording}
                  disabled={!selectedSource}
                  className={`px-6 py-2 rounded font-medium transition-colors ${
                    selectedSource
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-600 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Start Recording
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};


