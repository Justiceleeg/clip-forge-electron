import React, { useState, useCallback, useRef } from "react";
import { VideoClip } from "@clipforge/shared";
import { electronService } from "../../services/electronService";

interface ImportDialogProps {
  onImport: (clips: VideoClip[]) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const SUPPORTED_FORMATS = ["mp4", "mov", "webm"];
const SUPPORTED_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export const ImportDialog: React.FC<ImportDialogProps> = ({
  onImport,
  onCancel,
  isOpen,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): boolean => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    return (
      extension !== undefined &&
      SUPPORTED_FORMATS.includes(extension) &&
      SUPPORTED_MIME_TYPES.includes(file.type)
    );
  }, []);

  const handleFilePathsImport = useCallback(
    async (filePaths: string[]) => {
      setIsImporting(true);
      setError(null);

      try {
        const clips: VideoClip[] = [];
        for (const filePath of filePaths) {
          try {
            const clip = await electronService.importVideo(filePath);
            clips.push(clip);
          } catch (err) {
            console.error(`Failed to import ${filePath}:`, err);
            // Continue with other files even if one fails
          }
        }

        if (clips.length === 0) {
          setError(
            "Failed to import any video files. Please check the files and try again."
          );
        } else {
          onImport(clips);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to import files");
      } finally {
        setIsImporting(false);
      }
    },
    [onImport]
  );

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setIsImporting(true);
      setError(null);

      try {
        const validFiles: File[] = [];
        const invalidFiles: string[] = [];

        // Validate all files
        Array.from(files).forEach((file) => {
          if (validateFile(file)) {
            validFiles.push(file);
          } else {
            invalidFiles.push(file.name);
          }
        });

        if (invalidFiles.length > 0) {
          setError(
            `Invalid file types: ${invalidFiles.join(
              ", "
            )}. Please use MP4, MOV, or WebM files.`
          );
          setIsImporting(false);
          return;
        }

        if (validFiles.length === 0) {
          setError("No valid video files selected.");
          setIsImporting(false);
          return;
        }

        // Import valid files using Electron service
        const clips: VideoClip[] = [];
        for (const file of validFiles) {
          try {
            // For drag and drop, we need to use the file path from the dataTransfer
            // The file.path property should be available in Electron
            const filePath = (file as any).path || file.name;
            const clip = await electronService.importVideo(filePath);
            clips.push(clip);
          } catch (err) {
            console.error(`Failed to import ${file.name}:`, err);
            // Continue with other files even if one fails
          }
        }

        if (clips.length === 0) {
          setError(
            "Failed to import any video files. Please check the files and try again."
          );
        } else {
          onImport(clips);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to import files");
      } finally {
        setIsImporting(false);
      }
    },
    [validateFile, onImport]
  );

  const handleNativeFilePicker = useCallback(async () => {
    try {
      if (!electronService.isElectronEnvironment()) {
        // Fallback to HTML file input
        fileInputRef.current?.click();
        return;
      }

      const result = await electronService.openFileDialog();
      if (!result.canceled && result.filePaths) {
        // Import files using file paths
        const clips: VideoClip[] = [];
        for (const filePath of result.filePaths) {
          try {
            const clip = await electronService.importVideo(filePath);
            clips.push(clip);
          } catch (err) {
            console.error(`Failed to import ${filePath}:`, err);
            // Continue with other files
          }
        }

        if (clips.length > 0) {
          onImport(clips);
        } else {
          setError(
            "Failed to import any video files. Please check the files and try again."
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open file dialog"
      );
    }
  }, [onImport]);

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(event.target.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      // For drag and drop in Electron, we should use the file paths directly
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        const filePaths: string[] = [];
        const validFiles: File[] = [];
        const invalidFiles: string[] = [];

        // Process each dropped file
        Array.from(files).forEach((file) => {
          const filePath = (file as any).path;

          if (filePath && validateFile(file)) {
            filePaths.push(filePath);
            validFiles.push(file);
          } else {
            invalidFiles.push(file.name);
          }
        });

        if (invalidFiles.length > 0) {
          setError(
            `Invalid file types: ${invalidFiles.join(
              ", "
            )}. Please use MP4, MOV, or WebM files.`
          );
          return;
        }

        if (filePaths.length === 0) {
          setError("No valid video files dropped.");
          return;
        }

        // Import files using file paths directly
        handleFilePathsImport(filePaths);
      }
    },
    [validateFile]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Import Video Files</h2>

        {/* Drag and Drop Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? "border-blue-400 bg-blue-900 bg-opacity-20"
              : "border-gray-600 hover:border-gray-500"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-lg font-medium">
              {isDragOver ? "Drop files here" : "Drag & drop video files here"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Supports MP4, MOV, and WebM files
            </p>
          </div>

          <div className="text-gray-400 text-sm">
            <span>or</span>
          </div>

          <button
            onClick={handleNativeFilePicker}
            disabled={isImporting}
            className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isImporting ? "Importing..." : "Choose Files"}
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-900 bg-opacity-50 border border-red-600 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            disabled={isImporting}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
