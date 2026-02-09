# Napkin

**Sketch it. Say it. Ship it.**

Napkin is an AI-powered collaborative canvas that turns rough sketches, voice commands, and text prompts into polished diagrams in seconds. Powered by Google Gemini, it bridges the gap between quick ideation and presentable visuals.

---

## What it does

- **Draw freely** on an infinite canvas powered by [tldraw](https://tldraw.com)
- **Generate diagrams from text** -- describe what you want and watch it appear
- **Transform sketches** -- draw rough shapes and let AI clean them into structured diagrams
- **Analyze anything** -- get auto-labels, Mermaid diagrams, improvement suggestions, and detailed explanations in one click
- **Voice input** -- speak your diagram into existence using the built-in speech-to-text
- **GitHub import** -- paste a repo URL and get an architecture diagram generated from its structure

## Demo

```
You:   "microservices architecture with auth, api gateway, user service, and postgres"
Napkin: [creates a clean, color-coded architecture diagram on the canvas]
```

## Tech Stack

| Layer    | Tech                                         |
| -------- | -------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, tldraw, Mermaid  |
| Backend  | Python, FastAPI, uvicorn                      |
| AI       | Google Gemini 3 Flash                       |
| APIs     | GitHub REST API (for repo analysis)           |

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/napkin.git
cd napkin
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```
GEMINI_API_KEY=your_api_key_here
```

Start the backend:

```bash
uvicorn main:app --reload
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and start drawing.

## How It Works

```
                  +-----------+
                  |  tldraw   |
                  |  Canvas   |
                  +-----+-----+
                        |
                  snapshot / prompt
                        |
                  +-----v-----+
                  |  React    |
                  |  Frontend |
                  +-----+-----+
                        |
                   REST API
                        |
                  +-----v-----+
                  |  FastAPI  |
                  |  Backend  |
                  +-----+-----+
                        |
                  +-----v-----+
                  |  Gemini   |
                  |  2.5 Flash|
                  +-----------+
```

1. The frontend captures a canvas snapshot or text prompt
2. Sends it to the FastAPI backend via REST
3. The backend forwards it to Gemini with specialized prompts
4. Gemini returns structured JSON (shapes, labels, Mermaid code, or suggestions)
5. The frontend renders the result directly onto the tldraw canvas

## Features in Detail

### Analyze Mode

Runs 4 AI analyses in parallel on your canvas content:

| Analysis | Output                                      |
| -------- | ------------------------------------------- |
| Label    | Identifies and names every element           |
| Cleanup  | Converts to a clean Mermaid.js diagram       |
| Suggest  | Prioritized improvement suggestions          |
| Explain  | Detailed markdown explanation of the content |

Results are presented in a downloadable PDF report.

### Generate Mode

Type or speak a description and Napkin creates shapes directly on the canvas. Supports:

- Architecture diagrams
- Flowcharts
- Mind maps
- Entity-relationship diagrams
- Any freeform diagram

### Transform Mode

Draw rough shapes by hand, hit Transform, and Napkin converts your sketches into clean, properly labeled digital shapes while preserving your layout.

### GitHub Import

Paste any public GitHub repo URL. Napkin fetches the repo structure, analyzes it with Gemini, and generates a color-coded architecture diagram with:

- Blue for frontend/client
- Green for backend/API
- Orange for databases
- Violet for external services

## Project Structure

```
napkin/
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx         # Main application
│   │   ├── api/            # Backend API client
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom React hooks
│   │   └── types/          # TypeScript definitions
│   └── package.json
│
├── backend/                # Python FastAPI
│   ├── main.py             # API endpoints
│   ├── gemini_client.py    # Gemini API integration
│   ├── github_analyzer.py  # GitHub repo fetching
│   ├── prompts.py          # AI prompt engineering
│   └── requirements.txt
│
└── README.md
```

## Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/cool-thing`)
3. Commit your changes (`git commit -m 'Add cool thing'`)
4. Push to the branch (`git push origin feature/cool-thing`)
5. Open a Pull Request

## License

MIT

---

Built with Gemini at the Gemini 3 Hackathon.
