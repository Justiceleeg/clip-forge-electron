import React, { useState, useCallback } from "react";
import { VideoClip } from "@clipforge/shared";
import { electronService } from "../../services/electronService";

interface MediaLibraryProps {
  clips: VideoClip[];
  onClipSelect: (clipId: string) => void;
  onImport: (clips: VideoClip[]) => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  clips,
  onClipSelect,
  onImport,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const SUPPORTED_FORMATS = ["mp4", "mov", "webm"];
  const SUPPORTED_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

  const validateFile = useCallback((file: File): boolean => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    return (
      extension !== undefined &&
      SUPPORTED_FORMATS.includes(extension) &&
      SUPPORTED_MIME_TYPES.includes(file.type)
    );
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const files = event.dataTransfer.files;
      if (files.length > 0) {
        setIsImporting(true);

        try {
          const validFiles: File[] = [];
          const invalidFiles: string[] = [];

          // Process each dropped file
          Array.from(files).forEach((file) => {
            if (validateFile(file)) {
              validFiles.push(file);
            } else {
              invalidFiles.push(file.name);
            }
          });

          if (invalidFiles.length > 0) {
            console.warn(`Invalid file types: ${invalidFiles.join(", ")}`);
            // Continue with valid files only
          }

          if (validFiles.length > 0) {
            // Import valid files using Electron service
            const clips: VideoClip[] = [];
            for (const file of validFiles) {
              try {
                const clip = await electronService.importVideoFromFile(file);
                clips.push(clip);
              } catch (err) {
                console.error(`Failed to import ${file.name}:`, err);
              }
            }

            if (clips.length > 0) {
              onImport(clips);
            }
          }
        } catch (err) {
          console.error("Error importing files:", err);
        } finally {
          setIsImporting(false);
        }
      }
    },
    [validateFile, onImport]
  );

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatResolution = (width: number, height: number): string => {
    if (width === 0 || height === 0) return "Unknown";
    return `${width}x${height}`;
  };

  // Handle drag start for dragging clips to timeline
  const handleClipDragStart = useCallback(
    (e: React.DragEvent, clip: VideoClip) => {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData(
        "application/x-clipforge-clip",
        JSON.stringify(clip)
      );
      e.dataTransfer.setData("text/plain", clip.name); // Fallback
    },
    []
  );

  return (
    <div
      className={`bg-gray-800 rounded-lg p-4 h-full transition-colors ${
        isDragOver
          ? "bg-blue-900 bg-opacity-20 border-2 border-blue-400 border-dashed"
          : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Media Library</h2>
        {isImporting && (
          <div className="text-sm text-blue-400">Importing...</div>
        )}
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
          <p className="text-sm font-medium text-gray-300 mb-2">
            No videos imported yet
          </p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Drag & drop video files directly into this area</p>
            <p>• Or use the Import button in the toolbar</p>
            <p className="text-gray-600 mt-2">
              Supported formats: MP4, MOV, WebM
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {clips.map((clip) => (
            <div
              key={clip.id}
              draggable
              onDragStart={(e) => handleClipDragStart(e, clip)}
              onClick={() => onClipSelect(clip.id)}
              className="bg-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-start space-x-3">
                {/* Thumbnail placeholder */}
                <div className="w-16 h-12 bg-gray-600 rounded shrink-0 flex items-center justify-center">
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
