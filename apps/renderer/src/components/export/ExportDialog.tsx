import React, { useState, useEffect } from "react";
import { VideoClip, ExportSettings, Timeline } from "@clipforge/shared";
import { ProgressBar } from "./ProgressBar";
import { X, Download, FileVideo, Settings as SettingsIcon } from "lucide-react";

interface ExportDialogProps {
  isOpen: boolean;
  onExport: (outputPath: string, settings: ExportSettings) => void;
  onCancel: () => void;
  timeline: Timeline;
  clips: VideoClip[];
  progress: number;
  status: string;
  isExporting: boolean;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onExport,
  onCancel,
  timeline,
  clips,
  progress,
  status,
  isExporting,
}) => {
  const [outputPath, setOutputPath] = useState("");
  const [settings, setSettings] = useState<ExportSettings>({
    resolution: "1080p",
    quality: "high",
    format: "mp4",
    fps: 30,
    bitrate: 5000,
    audioBitrate: 128,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate timeline duration and clip count
  const videoTrack = timeline.tracks.find((track) => track.type === "video");
  const clipCount = videoTrack?.clips.length || 0;
  const timelineDuration =
    videoTrack?.clips.reduce((total, clip) => {
      return total + (clip.trimEnd - clip.trimStart);
    }, 0) || 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bitrate: number, duration: number): string => {
    // Rough estimate: (video bitrate + audio bitrate) * duration / 8 / 1024
    const totalBitrate = bitrate + settings.audioBitrate;
    const sizeKB = (totalBitrate * duration) / 8;
    const sizeMB = sizeKB / 1024;
    return sizeMB >= 1024
      ? `~${(sizeMB / 1024).toFixed(1)} GB`
      : `~${sizeMB.toFixed(1)} MB`;
  };

  const handleChooseLocation = async () => {
    try {
      // Use Electron's dialog API to choose save location
      const result = await window.electronAPI.showSaveDialog({
        title: "Export Video",
        defaultPath: `timeline-export-${Date.now()}`,
        filters: [{ name: "Video Files", extensions: ["mp4"] }],
      });

      if (result && !result.canceled && result.filePath) {
        setOutputPath(result.filePath);
      }
    } catch (error) {
      console.error("Error choosing save location:", error);
    }
  };

  const handleExport = () => {
    if (!outputPath || clipCount === 0) return;
    onExport(outputPath, settings);
  };

  useEffect(() => {
    // Update settings based on clips
    if (clips.length > 0) {
      setSettings((prev) => ({
        ...prev,
        fps: clips[0]?.fps || 30,
      }));
    }
  }, [clips]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FileVideo className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">Export Video</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isExporting}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Timeline Info */}
          {clipCount > 0 && (
            <div className="bg-gray-900 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-400">Timeline</h3>
              <p className="text-white font-medium">
                {clipCount} clip{clipCount !== 1 ? "s" : ""} •{" "}
                {formatTime(timelineDuration)}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                {clips.length > 0 && (
                  <>
                    <span>
                      {clips[0].width} × {clips[0].height}
                    </span>
                    <span>•</span>
                    <span>{clips[0].fps} fps</span>
                  </>
                )}
              </div>
              {clipCount > 1 && (
                <div className="text-sm text-blue-400">
                  ✓ Multiple clips will be concatenated
                </div>
              )}
            </div>
          )}

          {/* Output Location */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Save Location
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputPath}
                readOnly
                placeholder="Choose export location..."
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleChooseLocation}
                disabled={isExporting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors"
              >
                Browse
              </button>
            </div>
          </div>

          {/* Export Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">
                Export Settings
              </h3>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <SettingsIcon className="w-4 h-4" />
                {showAdvanced ? "Hide" : "Show"} Advanced
              </button>
            </div>

            {/* Basic Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Resolution
                </label>
                <select
                  value={settings.resolution}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      resolution: e.target.value as any,
                    })
                  }
                  disabled={isExporting}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="source">Source (Original)</option>
                  <option value="1080p">1080p (1920×1080)</option>
                  <option value="720p">720p (1280×720)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Quality
                </label>
                <select
                  value={settings.quality}
                  onChange={(e) =>
                    setSettings({ ...settings, quality: e.target.value as any })
                  }
                  disabled={isExporting}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Frame Rate (fps)
                  </label>
                  <input
                    type="number"
                    value={settings.fps}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        fps: parseInt(e.target.value),
                      })
                    }
                    disabled={isExporting}
                    min="1"
                    max="120"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Video Bitrate (kbps)
                  </label>
                  <input
                    type="number"
                    value={settings.bitrate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        bitrate: parseInt(e.target.value),
                      })
                    }
                    disabled={isExporting}
                    min="500"
                    max="50000"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Audio Bitrate (kbps)
                  </label>
                  <input
                    type="number"
                    value={settings.audioBitrate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        audioBitrate: parseInt(e.target.value),
                      })
                    }
                    disabled={isExporting}
                    min="64"
                    max="320"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <div className="text-sm text-gray-400">
                    Est. Size:{" "}
                    {formatFileSize(settings.bitrate, timelineDuration)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <ProgressBar
            progress={progress}
            status={status}
            isVisible={isExporting}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onCancel}
            disabled={isExporting}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            {isExporting ? "Cancel Export" : "Close"}
          </button>
          <button
            onClick={handleExport}
            disabled={!outputPath || clipCount === 0 || isExporting}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded transition-colors"
          >
            <Download className="w-4 h-4" />
            {isExporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
};
