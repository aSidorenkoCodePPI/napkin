# Napkin Frontend

React + TypeScript single-page application built on [tldraw](https://tldraw.com) -- an infinite canvas for AI-powered diagram creation.

## Tech Stack

| Technology | Version | Purpose |
| ---------- | ------- | ------- |
| React | 19.x | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7.x | Build tool & dev server |
| tldraw | 4.3 | Infinite canvas engine |
| Mermaid | 11.x | Diagram rendering |

## Project Structure

```
src/
├── main.tsx                    # App entry point
├── App.tsx                     # Root component & state management
├── App.css / index.css         # Styles
│
├── api/
│   └── client.ts               # REST client (analyze, transform, generate, github)
│
├── components/
│   ├── WhiteboardCanvas.tsx     # tldraw editor wrapper
│   ├── App.tsx                  # Main UI layout & toolbar wiring
│   ├── ReportModal.tsx          # 5-tab analysis report with PDF export
│   ├── InsightPanel.tsx         # Slide-in side panel (Optimize / Explain)
│   ├── RegionSelect.tsx         # Region-bounded generation overlay
│   ├── LoadingOverlay.tsx       # Progress spinner
│   ├── MermaidDiagram.tsx       # Mermaid.js renderer
│   ├── LabelOverlay.tsx         # Element label display
│   ├── SidePanel.tsx            # Generic side panel shell
│   └── Toolbar.tsx              # Action toolbar
│
├── hooks/
│   ├── useGeminiAnalysis.ts     # Parallel 5-mode canvas analysis
│   ├── useCanvasSnapshot.ts     # Canvas → base64 PNG export
│   ├── useShapeGenerator.ts     # JSON → tldraw shapes (add/edit/delete)
│   └── useVoiceInput.ts         # Web Speech API integration
│
├── types/
│   └── index.ts                 # Shared TypeScript definitions
│
└── assets/
```

## Key Components

### WhiteboardCanvas
Wraps the tldraw `<Tldraw />` editor. Provides the infinite canvas that all other features build on.

### InsightPanel
Sliding side panel with two lazy-loaded tabs:
- **Optimize** -- Architecture recommendations with one-click **Apply** buttons that modify shapes directly on the canvas
- **Explain** -- Markdown architecture summary

### ReportModal
Full analysis report with five tabs (Label, Cleanup, Suggest, Explain, Optimize) and PDF export.

### RegionSelect
Overlay for drawing a bounding box on the canvas. Constrains AI generation to a specific region. Activated with the **G** key.

## Custom Hooks

| Hook | Purpose |
| ---- | ------- |
| `useGeminiAnalysis` | Fires 5 parallel analysis requests (label, cleanup, suggest, explain, optimize) with progress tracking |
| `useCanvasSnapshot` | Debounced (2s) canvas export to base64 PNG |
| `useShapeGenerator` | Parses Gemini JSON into tldraw shapes; handles 3-pass processing (deletes → edits → adds), collision avoidance, and bidirectional arrow anchoring |
| `useVoiceInput` | Web Speech API wrapper with continuous mode and browser fallback |

## API Client

All backend communication goes through `src/api/client.ts`:

```ts
analyzeCanvas(mode, imageBase64)   // POST /api/analyze/{mode}
transformCanvas(imageBase64)       // POST /api/transform
generateShapes(prompt, image, existing) // POST /api/generate
analyzeGithubRepo(repoUrl)        // POST /api/github-analyze
```

In development, Vite proxies `/api` requests to the backend at `http://localhost:8000`.

## Setup

```bash
npm install
npm run dev
```

The dev server starts at [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

## Environment

No `.env` file is needed for the frontend. The Vite dev server proxy is configured in `vite.config.ts` and routes `/api` to the backend.

In production, the frontend is built as static files and served by the FastAPI backend.
