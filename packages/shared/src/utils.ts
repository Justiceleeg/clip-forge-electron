// Re-export comprehensive time utilities
export * from "./utils/timeUtils";

// Validation utilities
export function isValidVideoFormat(filename: string): boolean {
  const supportedFormats = [".mp4", ".mov", ".webm", ".avi", ".mkv"];
  const extension = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return supportedFormats.includes(extension);
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
