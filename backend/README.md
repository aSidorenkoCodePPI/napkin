# Napkin Backend

Python FastAPI server that bridges the frontend canvas with Google Gemini for AI-powered diagram generation and analysis.

## Tech Stack

| Technology | Purpose |
| ---------- | ------- |
| FastAPI | Web framework & API routing |
| uvicorn | ASGI server |
| google-genai | Google Gemini SDK |
| httpx | Async HTTP client (GitHub API) |
| python-dotenv | Environment variable loading |

## Project Structure

```
backend/
├── main.py               # FastAPI app, endpoints, SPA routing
├── gemini_client.py       # Gemini API wrapper with model fallback
├── github_analyzer.py     # GitHub repo fetcher & context builder
├── prompts.py             # All AI prompt templates
├── requirements.txt       # Python dependencies
└── .env                   # API keys (not committed)
```

## API Endpoints

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/health` | Health check -- returns status, key presence, port |
| `POST` | `/api/analyze/{mode}` | Analyze canvas image (5 modes below) |
| `POST` | `/api/transform` | Convert rough sketches into clean shapes |
| `POST` | `/api/generate` | Generate diagram shapes from a text prompt |
| `POST` | `/api/github-analyze` | Generate architecture diagram from a GitHub repo URL |
| `GET` | `/{path}` | Catch-all SPA routing (production static files) |

### Analysis Modes (`/api/analyze/{mode}`)

| Mode | Output |
| ---- | ------ |
| `label` | Identified elements with names and positions |
| `cleanup` | Mermaid.js diagram code |
| `suggest` | Prioritized improvement suggestions |
| `explain` | Detailed markdown explanation |
| `optimize` | Architecture optimization recommendations |

### Request / Response Models

**AnalyzeRequest** / **TransformRequest**
```json
{ "image_base64": "iVBOR..." }
```

**GenerateRequest**
```json
{
  "prompt": "microservices with auth and api gateway",
  "image_base64": "iVBOR...",
  "existing_shapes": [
    { "id": "shape:abc", "type": "geo", "label": "API", "x": 100, "y": 150 }
  ]
}
```

**GithubAnalyzeRequest**
```json
{ "repo_url": "https://github.com/owner/repo" }
```

All endpoints return JSON. Shape-producing endpoints return arrays of shape objects that the frontend renders onto the tldraw canvas.

## Modules

### `gemini_client.py`
Wrapper around the Google Gemini SDK:
- **Primary model**: `gemini-3-flash-preview`
- **Fallback model**: `gemini-2.5-flash` (used automatically if the primary fails)
- Configurable thinking budget (0 for fast inference, 1024 for analysis)
- Async execution via `asyncio.to_thread`

### `github_analyzer.py`
Fetches repository context from the GitHub REST API:
- Parses GitHub URLs (multiple formats supported)
- Retrieves repo metadata, directory tree, and key config files
- Builds a structured text summary for Gemini to analyze
- 30-second timeout with async httpx

### `prompts.py`
All AI prompt templates in one place:
- Analysis prompts (label, cleanup, suggest, explain, optimize)
- Shape generation prompts (base, with-context, transform)
- GitHub architecture prompt with color-coding rules
- Grid layout constraints (4x4 grid, 550px horizontal / 450px vertical spacing)

## Setup

### Prerequisites
- Python 3.10+
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### Install

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### Configure

Create a `.env` file:

```
GEMINI_API_KEY=your_api_key_here
```

### Run

```bash
uvicorn main:app --reload
```

The server starts at [http://localhost:8000](http://localhost:8000).

In production (Docker), it runs on port 8080 and serves the frontend static build.

## Docker

The backend is part of a multi-stage Docker build at the project root. In production:
1. The frontend is pre-built into `static/`
2. FastAPI serves the SPA via a catch-all route
3. CORS is enabled for all origins
4. The Gemini API key is passed via environment variable (not baked into the image)
