import asyncio
import base64
import json
import os

from google import genai
from google.genai import types

from prompts import PROMPTS, GENERATE_PROMPT, GENERATE_WITH_CONTEXT_PROMPT, TRANSFORM_PROMPT, GITHUB_ARCHITECTURE_PROMPT


class GeminiClient:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        self.client = genai.Client(api_key=api_key)
        self.model = "gemini-3-flash"

        # Disable thinking for fast structured output (generate, transform)
        self.fast_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        )
        # Low thinking budget for analysis (needs some reasoning but not full)
        self.analyze_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=1024),
        )

    def _analyze_sync(self, mode: str, image_bytes: bytes) -> str:
        prompt = PROMPTS.get(mode)
        if not prompt:
            raise ValueError(f"Unknown mode: {mode}")

        image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/png")

        response = self.client.models.generate_content(
            model=self.model,
            contents=[prompt, image_part],
            config=self.analyze_config,
        )
        return response.text

    async def analyze(self, mode: str, image_base64: str) -> str:
        image_bytes = base64.b64decode(image_base64)
        return await asyncio.to_thread(self._analyze_sync, mode, image_bytes)

    def _generate_sync(self, user_prompt: str, image_bytes: bytes | None, existing_shapes: list[dict]) -> str:
        if image_bytes and existing_shapes:
            existing_info = json.dumps(existing_shapes)
            next_id = max(s["id"] for s in existing_shapes) + 1 if existing_shapes else 0
            prompt = GENERATE_WITH_CONTEXT_PROMPT.replace("{user_prompt}", user_prompt).replace(
                "{existing_shapes}", existing_info
            ).replace("{next_id}", str(next_id))
            image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/png")
            contents = [prompt, image_part]
        else:
            contents = [GENERATE_PROMPT + "\n\nUser request: " + user_prompt]

        response = self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=self.fast_config,
        )
        return response.text

    async def generate(self, user_prompt: str, image_base64: str | None, existing_shapes: list[dict] | None = None) -> str:
        image_bytes = base64.b64decode(image_base64) if image_base64 else None
        return await asyncio.to_thread(self._generate_sync, user_prompt, image_bytes, existing_shapes or [])

    def _transform_sync(self, image_bytes: bytes) -> str:
        image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/png")
        response = self.client.models.generate_content(
            model=self.model,
            contents=[TRANSFORM_PROMPT, image_part],
            config=self.fast_config,
        )
        return response.text

    async def transform(self, image_base64: str) -> str:
        image_bytes = base64.b64decode(image_base64)
        return await asyncio.to_thread(self._transform_sync, image_bytes)

    def _analyze_repo_sync(self, repo_context: str) -> str:
        prompt = GITHUB_ARCHITECTURE_PROMPT.replace("{repo_context}", repo_context)
        response = self.client.models.generate_content(
            model=self.model,
            contents=[prompt],
            config=self.fast_config,
        )
        return response.text

    async def analyze_repo(self, repo_context: str) -> str:
        return await asyncio.to_thread(self._analyze_repo_sync, repo_context)
