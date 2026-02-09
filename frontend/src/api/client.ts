import type { AnalysisMode } from '../types';

export async function analyzeCanvas(
  mode: AnalysisMode,
  imageBase64: string
): Promise<string> {
  const response = await fetch(`/api/analyze/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

export async function transformCanvas(
  imageBase64: string
): Promise<string> {
  const response = await fetch('/api/transform', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

export async function analyzeGithubRepo(
  repoUrl: string
): Promise<string> {
  const response = await fetch('/api/github-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

export interface ExistingShapeInfo {
  id: number;
  type: string;
  label: string;
  x: number;
  y: number;
}

export async function generateShapes(
  prompt: string,
  imageBase64: string | null,
  existingShapes?: ExistingShapeInfo[]
): Promise<string> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_base64: imageBase64, existing_shapes: existingShapes || [] }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}
