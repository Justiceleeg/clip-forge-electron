import React, { useEffect, useRef } from "react";
import { Scissors, Trash2, TableColumnsSplit } from "lucide-react";

interface TimelineContextMenuProps {
  x: number;
  y: number;
  onSplit: () => void;
  onDelete: () => void;
  onTrim: () => void;
  onClose: () => void;
  canSplit: boolean;
  canDelete: boolean;
  canTrim: boolean;
}

export const TimelineContextMenu: React.FC<TimelineContextMenuProps> = ({
  x,
  y,
  onSplit,
  onDelete,
  onTrim,
  onClose,
  canSplit,
  canDelete,
  canTrim,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate smart positioning to keep menu on screen
  const [position, setPosition] = React.useState({ x, y });

  React.useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let adjustedX = x;
      let adjustedY = y;

      // Check if menu goes off the bottom of screen
      if (y + menuRect.height > viewportHeight) {
        // Open upward - cursor at bottom-left of menu
        adjustedY = y - menuRect.height;
      }

      // Check if menu goes off the right of screen
      if (x + menuRect.width > viewportWidth) {
        // Open leftward
        adjustedX = x - menuRect.width;
      }

      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);

  // Handle clicks outside the menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    // Add listeners with a small delay to avoid immediate close on right-click
    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 0);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleSplit = () => {
    if (canSplit) {
      onSplit();
      onClose();
    }
  };

  const handleDelete = () => {
    if (canDelete) {
      onDelete();
      onClose();
    }
  };
  
  const handleTrim = () => {
    if (canTrim) {
      onTrim();
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl min-w-[180px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="py-1">
        {/* Trim Option */}
        <button
          onClick={handleTrim}
          disabled={!canTrim}
          className={`w-full px-4 py-2 text-left flex items-center space-x-3 ${
            canTrim
              ? "hover:bg-gray-700 text-white"
              : "text-gray-500 cursor-not-allowed"
          }`}
          title={
            canTrim
              ? "Start trim mode for selected clip (T)"
              : "No clip selected"
          }
        >
          <Scissors size={16} />
          <span>Trim Clip</span>
          <span className="text-xs text-gray-400 ml-auto">T</span>
        </button>
        
        {/* Divider */}
        <div className="border-t border-gray-700 my-1" />
        
        {/* Split Option */}
        <button
          onClick={handleSplit}
          disabled={!canSplit}
          className={`w-full px-4 py-2 text-left flex items-center space-x-3 ${
            canSplit
              ? "hover:bg-gray-700 text-white"
              : "text-gray-500 cursor-not-allowed"
          }`}
          title={
            canSplit
              ? "Split clip at playhead position (S)"
              : "Playhead must be within selected clip bounds"
          }
        >
          <TableColumnsSplit size={16} />
          <span>Split Clip</span>
          <span className="text-xs text-gray-400 ml-auto">S</span>
        </button>

        {/* Divider */}
        <div className="border-t border-gray-700 my-1" />

        {/* Delete Option */}
        <button
          onClick={handleDelete}
          disabled={!canDelete}
          className={`w-full px-4 py-2 text-left flex items-center space-x-3 ${
            canDelete
              ? "hover:bg-red-900 hover:bg-opacity-50 text-red-400"
              : "text-gray-500 cursor-not-allowed"
          }`}
          title={
            canDelete
              ? "Delete selected clip(s) (Delete/Backspace)"
              : "No clips selected"
          }
        >
          <Trash2 size={16} />
          <span>Delete Clip</span>
          <span className="text-xs text-gray-400 ml-auto">Del</span>
        </button>
      </div>
    </div>
  );
};

