import React from "react";

interface ProgressBarProps {
  progress: number; // 0-100
  status: string;
  isVisible: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  status,
  isVisible,
}) => {
  if (!isVisible) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-300">{status}</span>
        <span className="text-gray-400">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
};

