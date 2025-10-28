import { useState, useRef } from "react";
import { ImportDialog } from "./components/media/ImportDialog";
import { MediaLibrary } from "./components/media/MediaLibrary";
import { Timeline } from "./components/timeline/Timeline";
import { VideoPlayer, VideoPlayerRef } from "./components/preview/VideoPlayer";
import { useProjectStore } from "./stores/projectStore";
import { usePreviewStore } from "./stores/previewStore";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const { clips, addClip, selectClip } = useProjectStore();
  const { preview } = usePreviewStore();
  const { currentTime, duration } = preview;

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
    if (videoPlayerRef.current) {
      if (isPlaying) {
        videoPlayerRef.current.pause();
        setIsPlaying(false);
      } else {
        videoPlayerRef.current.play();
        setIsPlaying(true);
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
      <div className="flex items-center gap-4 p-4 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => setShowImportDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
        <button
          disabled={clips.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
        <div className="ml-auto">
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
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
          <div className="flex-1 p-4">
            <VideoPlayer ref={videoPlayerRef} className="h-full" />
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 p-4 bg-gray-800 border-t border-gray-700">
            <button
              onClick={handleSeekBack}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={handlePlayPause}
              className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
            >
              {isPlaying ? (
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
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>
            <div className="ml-4 text-sm text-gray-400 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="h-64 bg-gray-800 border-t border-gray-700">
        <Timeline className="h-full" />
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
