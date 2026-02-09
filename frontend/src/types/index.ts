export type AnalysisMode = 'label' | 'cleanup' | 'suggest' | 'explain' | 'optimize';

export interface LabelItem {
  name: string;
  type: string;
  description: string;
  x_percent: number;
  y_percent: number;
}

export interface LabelResult {
  labels: LabelItem[];
}

export interface SuggestionItem {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SuggestResult {
  suggestions: SuggestionItem[];
  overall_assessment: string;
}

export interface FullAnalysisResult {
  labelResult: LabelResult | null;
  cleanupResult: string | null;
  suggestResult: SuggestResult | null;
  explainResult: string | null;
}

export interface OptimizeRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'performance' | 'security' | 'structure' | 'scalability';
  diagram_prompt: string;
}

export interface OptimizeResult {
  summary: string;
  recommendations: OptimizeRecommendation[];
}

export interface AnalysisState {
  loading: boolean;
  progress: number; // 0-4 how many modes completed
  error: string | null;
  result: FullAnalysisResult | null;
}
