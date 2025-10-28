import { useState } from "react";
import { ImportDialog } from "./components/media/ImportDialog";
import { MediaLibrary } from "./components/media/MediaLibrary";
import { Timeline } from "./components/timeline/Timeline";
import { useProjectStore } from "./stores/projectStore";
import { VideoClip } from "@clipforge/shared";
import {
  Upload,
  Download,
  Settings,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Video,
  Film,
} from "lucide-react";

function App() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { clips, addClip } = useProjectStore();

  const handleImport = (importedClips: VideoClip[]) => {
    importedClips.forEach((clip) => addClip(clip));
    setShowImportDialog(false);
  };

  const handleCancelImport = () => {
    setShowImportDialog(false);
  };

  const handleClipSelect = (clipId: string) => {
    console.log("Selected clip:", clipId);
    // TODO: Implement clip selection logic
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
            onImport={() => setShowImportDialog(true)}
          />
        </div>

        {/* Video Preview Panel */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center bg-gray-800">
            {clips.length === 0 ? (
              <div className="text-center">
                <Video className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                <h2 className="text-xl font-semibold mb-2 text-gray-300">
                  No video imported yet
                </h2>
                <p className="text-gray-400 mb-4">
                  Click Import to get started
                </p>
                <p className="text-sm text-gray-500">Supported: MP4, MOV</p>
              </div>
            ) : (
              <div className="text-center">
                <Film className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                <h2 className="text-xl font-semibold mb-2 text-gray-300">
                  Video Preview
                </h2>
                <p className="text-gray-400 mb-4">
                  Preview player will be implemented in the next story
                </p>
                <div className="text-sm text-gray-500">
                  Imported clips: {clips.length}
                </div>
              </div>
            )}
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 p-4 bg-gray-800 border-t border-gray-700">
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <RotateCcw className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            <button className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors">
              <Play className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <RotateCw className="w-5 h-5" />
            </button>
            <div className="ml-4 text-sm text-gray-400 font-mono">
              00:00:00 / 00:00:00
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
