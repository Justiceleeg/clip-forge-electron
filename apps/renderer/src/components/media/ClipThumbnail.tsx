import React from "react";

interface ClipThumbnailProps {
  thumbnailPath: string;
  alt: string;
  className?: string;
}

export const ClipThumbnail: React.FC<ClipThumbnailProps> = ({
  thumbnailPath,
  alt,
  className = "",
}) => {
  const [imageError, setImageError] = React.useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  if (imageError || !thumbnailPath) {
    return (
      <div
        className={`bg-gray-600 flex items-center justify-center ${className}`}
      >
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
      </div>
    );
  }

  return (
    <img
      src={thumbnailPath}
      alt={alt}
      className={`object-cover ${className}`}
      onError={handleImageError}
    />
  );
};

export default ClipThumbnail;
