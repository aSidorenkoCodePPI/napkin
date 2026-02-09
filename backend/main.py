from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from gemini_client import GeminiClient
from github_analyzer import fetch_repo_context

app = FastAPI(title="Napkin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = GeminiClient()

VALID_MODES = {"label", "cleanup", "suggest", "explain", "optimize"}


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
        result = await client.analyze(mode, request.image_base64)
        return {"result": result, "mode": mode}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/transform")
async def transform(request: AnalyzeRequest):
    try:
        result = await client.transform(request.image_base64)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class GithubAnalyzeRequest(BaseModel):
    repo_url: str


@app.post("/api/github-analyze")
async def github_analyze(request: GithubAnalyzeRequest):
    try:
        repo_context = await fetch_repo_context(request.repo_url)
        result = await client.analyze_repo(repo_context)
        return {"result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def generate(request: GenerateRequest):
    try:
        existing = [s.model_dump() for s in request.existing_shapes]
        result = await client.generate(request.prompt, request.image_base64, existing)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
