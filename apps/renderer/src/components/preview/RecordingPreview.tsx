import { useRef, useEffect } from "react";

interface RecordingPreviewProps {
  stream: MediaStream | null;
  mode: 'screen' | 'webcam' | 'screen+webcam' | null;
  className?: string;
}

export const RecordingPreview: React.FC<RecordingPreviewProps> = ({
  stream,
  mode,
  className = "",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.error("Error playing recording preview:", err);
      });
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  if (!stream || !mode) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 ${className}`}>
        <div className="text-gray-500 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-2"
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
          <p className="text-sm">No recording active</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-contain ${
          mode === 'webcam' ? 'scale-x-[-1]' : ''
        }`}
      />
      <div className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1 bg-red-600 rounded-full">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span className="text-white text-xs font-medium">
          REC - {mode === 'screen' ? 'Screen' : mode === 'webcam' ? 'Webcam' : 'Screen + Webcam'}
        </span>
      </div>
    </div>
  );
};

