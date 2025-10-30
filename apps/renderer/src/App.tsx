import { useState, useRef } from "react";
import { ImportDialog } from "./components/media/ImportDialog";
import { ExportDialog } from "./components/export/ExportDialog";
import { MediaLibrary } from "./components/media/MediaLibrary";
import { Timeline } from "./components/timeline/Timeline";
import { VideoPlayer, VideoPlayerRef } from "./components/preview/VideoPlayer";
import { RecordingPreview } from "./components/preview/RecordingPreview";
import { RecordingControls } from "./components/recording/RecordingControls";
import { useProjectStore } from "./stores/projectStore";
import { usePreviewStore } from "./stores/previewStore";
import { useTimelineStore } from "./stores/timelineStore";
import { VideoClip, ExportSettings } from "@clipforge/shared";
import { electronService } from "./services/electronService";
import {
  Upload,
  Download,
  Settings,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";

function App() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [recordingWebcamStream, setRecordingWebcamStream] = useState<MediaStream | null>(null);
  const [recordingMode, setRecordingMode] = useState<'screen' | 'webcam' | 'simultaneous' | null>(null);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const {
    clips,
    addClip,
    selectClip,
    selectedClip,
    isExporting,
    exportProgress,
    exportStatus,
    setExporting,
    setExportProgress,
    setExportStatus,
    setError,
  } = useProjectStore();
  const { preview } = usePreviewStore();
  const { timeline } = useTimelineStore();

  // Calculate timeline-aware times for display
  const timelineDuration = timeline.tracks.reduce((total, track) => {
    return (
      total +
      track.clips.reduce((trackTotal, clip) => {
        const trimmedDuration = clip.trimEnd - clip.trimStart;
        return trackTotal + trimmedDuration;
      }, 0)
    );
  }, 0);

  const timelineCurrentTime = timeline.playheadPosition; // Use timeline position for immediate updates

  // Format time for display
  const formatTime = (seconds: number): string => {
    // Handle NaN or invalid values
    if (isNaN(seconds) || !isFinite(seconds)) {
      return "0:00";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleImport = (importedClips: VideoClip[]) => {
    importedClips.forEach((clip) => addClip(clip));
    setShowImportDialog(false);
  };

  const handleCancelImport = () => {
    setShowImportDialog(false);
  };

  const handleClipSelect = (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    selectClip(clip || null);
  };

  // Video control handlers
  const handlePlayPause = () => {
    if (videoPlayerRef.current && clips.length > 0) {
      if (preview.isPlaying) {
        videoPlayerRef.current.pause();
      } else {
        videoPlayerRef.current.play();
      }
    }
  };

  const handleSeekBack = () => {
    if (videoPlayerRef.current) {
      const currentTime = videoPlayerRef.current.getCurrentTime();
      videoPlayerRef.current.seekTo(Math.max(0, currentTime - 5));
    }
  };

  const handleSeekForward = () => {
    if (videoPlayerRef.current) {
      const currentTime = videoPlayerRef.current.getCurrentTime();
      const duration = videoPlayerRef.current.getDuration();
      videoPlayerRef.current.seekTo(Math.min(duration, currentTime + 5));
    }
  };

  const handleExport = async (outputPath: string, settings: ExportSettings) => {
    // Check if there are clips on the timeline
    const hasClips = timeline.tracks.some(
      (track) => track.clips && track.clips.length > 0
    );

    if (!hasClips) {
      setError("No clips on timeline to export");
      return;
    }

    try {
      setExporting(true);
      setExportProgress(0);
      setExportStatus("Starting export...");

      await electronService.exportTimeline(
        timeline,
        clips,
        outputPath,
        settings,
        (progress, status) => {
          setExportProgress(progress);
          setExportStatus(status);
        }
      );

      setExportProgress(100);
      setExportStatus("Export complete!");

      // Close dialog after a brief delay
      setTimeout(() => {
        setShowExportDialog(false);
        setExporting(false);
        setExportProgress(0);
        setExportStatus("");
      }, 2000);
    } catch (error) {
      console.error("Export failed:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Export failed. Please try again."
      );
      setExporting(false);
      setExportProgress(0);
      setExportStatus("");
    }
  };

  const handleCancelExport = () => {
    if (!isExporting) {
      setShowExportDialog(false);
      setExportProgress(0);
      setExportStatus("");
    }
  };

  const handleRecordingComplete = async (filePath: string) => {
    try {
      // Wait a bit for the file to be fully written and flushed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Auto-import the recorded video
      const clip = await electronService.importVideo(filePath);
      
      if (clip.duration === 0) {
        setError("Recording imported but has no duration. The video file may be corrupted.");
      }
      
      addClip(clip);
    } catch (error) {
      console.error("Error importing recorded video:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to import recorded video"
      );
    }
  };

  const handleRecordingStateChange = (
    recording: boolean,
    stream: MediaStream | null,
    mode: 'screen' | 'webcam' | 'simultaneous' | null,
    webcamStream?: MediaStream | null
  ) => {
    setIsRecording(recording);
    setRecordingStream(stream);
    setRecordingWebcamStream(webcamStream || null);
    setRecordingMode(mode);
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => setShowImportDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Import
        </button>
        <button
          onClick={() => setShowExportDialog(true)}
          disabled={
            timeline.tracks.length === 0 ||
            !timeline.tracks.some((t) => t.clips && t.clips.length > 0)
          }
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          Export
        </button>
        
        {/* Recording Controls */}
        <RecordingControls 
          onRecordingComplete={handleRecordingComplete} 
          onRecordingStateChange={handleRecordingStateChange}
        />
        
        <div className="ml-auto">
          <button className="p-1 text-gray-400 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top Container - Takes 2/3 of available space */}
        <div className="flex flex-2 min-h-0">
          {/* Media Library Panel */}
          <div className="w-64 bg-gray-800 border-r border-gray-700">
            <MediaLibrary
              clips={clips}
              onClipSelect={handleClipSelect}
              onImport={handleImport}
              selectedVideoClipId={selectedClip?.id || null}
            />
          </div>

          {/* Video Preview Panel */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-4 overflow-hidden">
              {isRecording ? (
                <RecordingPreview 
                  stream={recordingStream} 
                  mode={recordingMode}
                  webcamStream={recordingWebcamStream}
                  className="h-full rounded-lg" 
                />
              ) : (
                <VideoPlayer ref={videoPlayerRef} className="h-full" />
              )}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4 p-4 bg-gray-800 border-t border-gray-700">
              <button
                onClick={handleSeekBack}
                disabled={clips.length === 0 || isRecording}
                className={`p-2 transition-colors ${
                  clips.length === 0 || isRecording
                    ? "text-gray-600 cursor-not-allowed"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={handlePlayPause}
                disabled={clips.length === 0 || isRecording}
                className={`p-3 rounded-full transition-colors ${
                  clips.length === 0 || isRecording
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white`}
              >
                {preview.isPlaying ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={handleSeekForward}
                disabled={clips.length === 0 || isRecording}
                className={`p-2 transition-colors ${
                  clips.length === 0 || isRecording
                    ? "text-gray-600 cursor-not-allowed"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <SkipForward className="w-5 h-5" />
              </button>
              <div className="ml-4 text-sm text-gray-400 font-mono">
                {formatTime(timelineCurrentTime)} /{" "}
                {formatTime(timelineDuration)}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Section - Takes 1/3 of available space */}
        <div className="flex-1 bg-gray-800 border-t border-gray-700 min-h-0">
          <Timeline className="h-full" />
        </div>
      </div>

      {/* Import Dialog */}
      <ImportDialog
        isOpen={showImportDialog}
        onImport={handleImport}
        onCancel={handleCancelImport}
      />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onExport={handleExport}
        onCancel={handleCancelExport}
        timeline={timeline}
        clips={clips}
        progress={exportProgress}
        status={exportStatus}
        isExporting={isExporting}
      />
    </div>
  );
}

export default App;
