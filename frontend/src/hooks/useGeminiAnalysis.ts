import { useState, useCallback } from 'react';
import type { AnalysisState, LabelResult, SuggestResult, FullAnalysisResult } from '../types';
import { analyzeCanvas } from '../api/client';

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

function cleanMermaidResponse(text: string): string {
  let code = text.trim();
  if (code.startsWith('```mermaid')) {
    code = code.slice(10);
  } else if (code.startsWith('```')) {
    code = code.slice(3);
  }
  if (code.endsWith('```')) {
    code = code.slice(0, -3);
  }
  return code.trim();
}

export function useGeminiAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    loading: false,
    progress: 0,
    error: null,
    result: null,
  });

  const analyzeAll = useCallback(async (imageBase64: string) => {
    setState({ loading: true, progress: 0, error: null, result: null });

    const result: FullAnalysisResult = {
      labelResult: null,
      cleanupResult: null,
      suggestResult: null,
      explainResult: null,
    };

    const bump = () => setState((prev) => ({ ...prev, progress: prev.progress + 1 }));

    const tasks = [
      analyzeCanvas('label', imageBase64)
        .then((raw) => {
          result.labelResult = JSON.parse(cleanJsonResponse(raw)) as LabelResult;
          bump();
        })
        .catch(() => bump()),
      analyzeCanvas('cleanup', imageBase64)
        .then((raw) => {
          result.cleanupResult = cleanMermaidResponse(raw);
          bump();
        })
        .catch(() => bump()),
      analyzeCanvas('suggest', imageBase64)
        .then((raw) => {
          result.suggestResult = JSON.parse(cleanJsonResponse(raw)) as SuggestResult;
          bump();
        })
        .catch(() => bump()),
      analyzeCanvas('explain', imageBase64)
        .then((raw) => {
          result.explainResult = raw;
          bump();
        })
        .catch(() => bump()),
    ];

    try {
      await Promise.all(tasks);
      setState({ loading: false, progress: 4, error: null, result });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'An error occurred',
        result,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, progress: 0, error: null, result: null });
  }, []);

  return { state, analyzeAll, reset };
}
