# ClipForge

A streamlined desktop video editor built with Electron + React, inspired by CapCut's intuitive mobile experience.

## 🎯 Overview

ClipForge brings the simplicity of mobile video editing to desktop, enabling creators, educators, and professionals to quickly record, edit, and export videos without complex software.

## ✨ Features

### MVP (Phase 1)
- **Import**: Drag & drop MP4/MOV files or use file picker
- **Timeline**: Visual timeline with clip representation
- **Preview**: HTML5 video player with play/pause controls
- **Trim**: Set in/out points with interactive handles
- **Export**: Single-clip export to MP4 with FFmpeg

### Phase 2 (Future)
- **Recording**: Screen capture, webcam recording, microphone audio
- **Multi-track**: Timeline with multiple video/audio tracks
- **Advanced Editing**: Split clips, arrange sequences, snap-to-grid
- **Export**: Full timeline composition export

## 🛠️ Tech Stack

- **Frontend**: React 18.2+ + TypeScript 5.3+ + Tailwind CSS
- **Desktop**: Electron 28+ with Node.js 20+
- **Video Processing**: FFmpeg for trimming and export
- **State Management**: Zustand for lightweight state
- **Build**: Vite + Electron Builder
- **UI Components**: Radix UI primitives

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 10+

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Package application
npm run package
```

## 📁 Project Structure

```
clip-forge-electron/
├── apps/
│   ├── electron/          # Electron main process
│   └── renderer/          # React frontend
├── packages/
│   ├── shared/            # Shared types & utilities
│   └── ui/                # Shared UI components
├── docs/                  # Documentation
└── package.json           # Root package.json
```

## 📋 Development Status

### Epic 1: MVP Core Media Pipeline
- [x] Story 1.1: Setup Project & Basic Window
- [x] Story 1.2: Implement Basic Video Import
- [x] Story 1.3: Display Clip Simple Timeline
- [x] Story 1.4: Implement Video Preview Player
- [x] Story 1.5: Implement Basic Trim Functionality
- [x] Story 1.6: Implement Basic Single-Clip Export
- [x] Story 1.7: Build Package MVP Application

## 📚 Documentation

- [Product Requirements Document](docs/prd.md)
- [Architecture Document](docs/architecture.md)
- [User Stories](docs/stories/)
- [Epic Definitions](docs/prd/)

## 🎯 Performance Targets

- Application launch: < 5 seconds
- Responsive UI with 10+ clips
- Smooth video preview (30 fps)
- Stable export process

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

This project follows a structured development approach with detailed user stories and acceptance criteria. See the documentation in the `docs/` directory for implementation guidance.

