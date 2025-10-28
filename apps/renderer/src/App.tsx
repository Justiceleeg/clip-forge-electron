import { useState, useRef } from "react";
import { ImportDialog } from "./components/media/ImportDialog";
import { MediaLibrary } from "./components/media/MediaLibrary";
import { Timeline } from "./components/timeline/Timeline";
import { VideoPlayer, VideoPlayerRef } from "./components/preview/VideoPlayer";
import { useProjectStore } from "./stores/projectStore";
import { usePreviewStore } from "./stores/previewStore";
import { useTimelineStore } from "./stores/timelineStore";
import { VideoClip } from "@clipforge/shared";
import {
  Upload,
  Download,
  Settings,
  Play,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Video,
  Film,
} from "lucide-react";

function App() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const { clips, addClip, selectClip } = useProjectStore();
  const { preview } = usePreviewStore();
  const { timeline } = useTimelineStore();
  const { currentTime: rawCurrentTime, duration: rawDuration } = preview;

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

  const timelineCurrentTime = rawCurrentTime; // This should already be timeline time from VideoPlayer

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

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => setShowImportDialog(true)}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
        >
          <Upload className="w-3 h-3" />
          Import
        </button>
        <button
          disabled={clips.length === 0}
          className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          <Download className="w-3 h-3" />
          Export
        </button>
        <div className="ml-auto">
          <button className="p-1 text-gray-400 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top Container - Takes 2/3 of available space */}
        <div className="flex flex-[2] min-h-0">
          {/* Media Library Panel */}
          <div className="w-64 bg-gray-800 border-r border-gray-700">
            <MediaLibrary
              clips={clips}
              onClipSelect={handleClipSelect}
              onImport={handleImport}
            />
          </div>

          {/* Video Preview Panel */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-4 overflow-hidden">
              <VideoPlayer ref={videoPlayerRef} className="h-full" />
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4 p-4 bg-gray-800 border-t border-gray-700">
              <button
                onClick={handleSeekBack}
                disabled={clips.length === 0}
                className={`p-2 transition-colors ${
                  clips.length === 0
                    ? "text-gray-600 cursor-not-allowed"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={handlePlayPause}
                disabled={clips.length === 0}
                className={`p-3 rounded-full transition-colors ${
                  clips.length === 0
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
                disabled={clips.length === 0}
                className={`p-2 transition-colors ${
                  clips.length === 0
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
        <div className="flex-[1] bg-gray-800 border-t border-gray-700 min-h-0">
          <Timeline className="h-full" />
        </div>
      </div>

      {/* Import Dialog */}
      <ImportDialog
        isOpen={showImportDialog}
        onImport={handleImport}
        onCancel={handleCancelImport}
      />
    </div>
  );
}

export default App;
