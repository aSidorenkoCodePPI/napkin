import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(override=False)

from gemini_client import GeminiClient
from github_analyzer import fetch_repo_context

app = FastAPI(title="Napkin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_client = None


def get_client():
    global _client
    if _client is None:
        _client = GeminiClient()
    return _client


VALID_MODES = {"label", "cleanup", "suggest", "explain", "optimize"}


@app.get("/api/health")
async def health():
    has_key = bool(os.environ.get("GEMINI_API_KEY"))
    return {"status": "ok", "has_gemini_key": has_key, "port": os.environ.get("PORT", "not set")}


class AnalyzeRequest(BaseModel):
    image_base64: str


class ExistingShape(BaseModel):
    id: int
    type: str
    label: str
    x: float
    y: float


class GenerateRequest(BaseModel):
    prompt: str
    image_base64: str | None = None
    existing_shapes: list[ExistingShape] = []


@app.post("/api/analyze/{mode}")
async def analyze(mode: str, request: AnalyzeRequest):
    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}. Must be one of {VALID_MODES}")

    try:
        result = await get_client().analyze(mode, request.image_base64)
        return {"result": result, "mode": mode}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/transform")
async def transform(request: AnalyzeRequest):
    try:
        result = await get_client().transform(request.image_base64)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class GithubAnalyzeRequest(BaseModel):
    repo_url: str


@app.post("/api/github-analyze")
async def github_analyze(request: GithubAnalyzeRequest):
    try:
        repo_context = await fetch_repo_context(request.repo_url)
        result = await get_client().analyze_repo(repo_context)
        return {"result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def generate(request: GenerateRequest):
    try:
        existing = [s.model_dump() for s in request.existing_shapes]
        result = await get_client().generate(request.prompt, request.image_base64, existing)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Static file serving for production (Cloud Run) ---
STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Catch-all: serve static files or fall back to index.html for SPA routing."""
        file_path = STATIC_DIR / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
