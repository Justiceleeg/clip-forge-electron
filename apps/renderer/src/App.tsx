import { useState } from "react";
import { ImportDialog } from "./components/media/ImportDialog";
import { MediaLibrary } from "./components/media/MediaLibrary";
import { useProjectStore } from "./stores/projectStore";
import { VideoClip } from "@clipforge/shared";

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
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-400 mb-2">ClipForge</h1>
          <p className="text-gray-400">Professional Video Editor</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Media Library Panel */}
          <div className="lg:col-span-1">
            <MediaLibrary
              clips={clips}
              onClipSelect={handleClipSelect}
              onImport={() => setShowImportDialog(true)}
            />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {clips.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <h2 className="text-xl font-semibold mb-4">
                  Welcome to ClipForge
                </h2>
                <p className="text-gray-300 mb-6">
                  Your video editing journey starts here. Import videos, create
                  amazing content, and export your masterpieces.
                </p>
                <button
                  onClick={() => setShowImportDialog(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Import Your First Video
                </button>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Timeline</h2>
                <p className="text-gray-300">
                  Timeline component will be implemented in the next story.
                </p>
                <div className="mt-4 text-sm text-gray-400">
                  Imported clips: {clips.length}
                </div>
              </div>
            )}
          </div>
        </main>
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
