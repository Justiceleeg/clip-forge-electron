import React from "react";
import { VideoClip } from "@clipforge/shared";

interface MediaLibraryProps {
  clips: VideoClip[];
  onClipSelect: (clipId: string) => void;
  onImport: () => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  clips,
  onClipSelect,
  onImport,
}) => {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatResolution = (width: number, height: number): string => {
    if (width === 0 || height === 0) return "Unknown";
    return `${width}x${height}`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Media Library</h2>
        <button
          onClick={onImport}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1 px-3 rounded transition-colors"
        >
          Import
        </button>
      </div>

      {clips.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <svg
            className="mx-auto h-12 w-12 mb-3"
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
          <p className="text-sm">No videos imported yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Click Import to add video files
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clips.map((clip) => (
            <div
              key={clip.id}
              onClick={() => onClipSelect(clip.id)}
              className="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-start space-x-3">
                {/* Thumbnail placeholder */}
                <div className="w-16 h-12 bg-gray-600 rounded flex-shrink-0 flex items-center justify-center">
                  {clip.thumbnailPath ? (
                    <img
                      src={clip.thumbnailPath}
                      alt={clip.name}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <svg
                      className="w-6 h-6 text-gray-400"
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
                  )}
                </div>

                {/* Clip info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">
                    {clip.name}
                  </h3>
                  <div className="text-xs text-gray-400 mt-1 space-y-1">
                    <div>Duration: {formatDuration(clip.duration)}</div>
                    <div>
                      Resolution: {formatResolution(clip.width, clip.height)}
                    </div>
                    {clip.fps > 0 && <div>FPS: {clip.fps}</div>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaLibrary;
