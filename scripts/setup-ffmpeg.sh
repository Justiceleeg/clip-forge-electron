#!/bin/bash

# FFmpeg Setup Script for ClipForge
# This script downloads FFmpeg binaries for macOS and sets up permissions

set -e

BIN_DIR="$(dirname "$0")/../apps/electron/bin"
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

echo "Setting up FFmpeg binaries for $PLATFORM-$ARCH..."

# Create bin directory if it doesn't exist
mkdir -p "$BIN_DIR"

# Check if FFmpeg is already installed via Homebrew
if command -v ffmpeg &> /dev/null; then
    echo "FFmpeg found in system PATH, copying binaries..."
    
    # Copy actual binaries (not symlinks) for packaging
    cp "$(which ffmpeg)" "$BIN_DIR/ffmpeg"
    cp "$(which ffprobe)" "$BIN_DIR/ffprobe"
    
    echo "Binaries copied successfully!"
else
    echo "FFmpeg not found in system PATH."
    echo "Please install FFmpeg using one of the following methods:"
    echo ""
    echo "1. Using Homebrew (recommended):"
    echo "   brew install ffmpeg"
    echo ""
    echo "2. Download from official site:"
    echo "   https://ffmpeg.org/download.html"
    echo ""
    echo "3. Use ffmpeg4nugget for pre-built binaries:"
    echo "   https://github.com/cartesiancs/ffmpeg4nugget"
    echo ""
    echo "After installation, run this script again."
    exit 1
fi

# Set permissions
echo "Setting permissions..."
chmod +x "$BIN_DIR/ffmpeg" 2>/dev/null || true
chmod +x "$BIN_DIR/ffprobe" 2>/dev/null || true

# Verify installation
echo "Verifying FFmpeg installation..."
if [ -f "$BIN_DIR/ffmpeg" ]; then
    "$BIN_DIR/ffmpeg" -version | head -1
    echo "✓ FFmpeg binary is accessible"
else
    echo "✗ FFmpeg binary not found"
    exit 1
fi

if [ -f "$BIN_DIR/ffprobe" ]; then
    "$BIN_DIR/ffprobe" -version | head -1
    echo "✓ FFprobe binary is accessible"
else
    echo "✗ FFprobe binary not found"
    exit 1
fi

echo ""
echo "FFmpeg setup completed successfully!"
echo "Binaries location: $BIN_DIR"
