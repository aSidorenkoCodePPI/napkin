import type { AnalysisState } from '../types';
import { MermaidDiagram } from './MermaidDiagram';

interface SidePanelProps {
  state: AnalysisState;
  onClose: () => void;
}

function renderMarkdown(text: string) {
  // Simple markdown renderer
  const lines = text.split('\n');
  const html = lines
    .map((line) => {
      if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
      if (line.startsWith('* ')) return `<li>${line.slice(2)}</li>`;
      if (line.trim() === '') return '<br/>';
      return `<p>${line}</p>`;
    })
    .join('');
  // Bold and inline code
  const formatted = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
  return formatted;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

export function SidePanel({ state, onClose }: SidePanelProps) {
  const { activeMode, loading, error } = state;

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <h2>
          {activeMode === 'label' && 'Auto-Label'}
          {activeMode === 'cleanup' && 'Cleanup (Mermaid)'}
          {activeMode === 'suggest' && 'Suggestions'}
          {activeMode === 'explain' && 'Explanation'}
        </h2>
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className="side-panel-content">
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner large" />
            <p>Analyzing your sketch...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>Error: {error}</p>
          </div>
        )}

        {!loading && !error && activeMode === 'label' && state.labelResult && (
          <div className="label-results">
            <p className="result-count">
              Found {state.labelResult.labels.length} element(s)
            </p>
            {state.labelResult.labels.map((label, i) => (
              <div key={i} className="label-card">
                <div className="label-card-header">
                  <span className="label-card-type">{label.type}</span>
                  <strong>{label.name}</strong>
                </div>
                <p>{label.description}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && activeMode === 'cleanup' && state.cleanupResult && (
          <MermaidDiagram code={state.cleanupResult} />
        )}

        {!loading && !error && activeMode === 'suggest' && state.suggestResult && (
          <div className="suggest-results">
            <div className="overall-assessment">
              <h3>Overall Assessment</h3>
              <p>{state.suggestResult.overall_assessment}</p>
            </div>
            {state.suggestResult.suggestions.map((suggestion, i) => (
              <div
                key={i}
                className="suggestion-card"
                style={{
                  borderLeftColor: PRIORITY_COLORS[suggestion.priority] || '#94a3b8',
                }}
              >
                <div className="suggestion-header">
                  <strong>{suggestion.title}</strong>
                  <span
                    className="priority-badge"
                    style={{
                      backgroundColor: PRIORITY_COLORS[suggestion.priority] || '#94a3b8',
                    }}
                  >
                    {suggestion.priority}
                  </span>
                </div>
                <p>{suggestion.description}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && activeMode === 'explain' && state.explainResult && (
          <div
            className="explain-results"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(state.explainResult) }}
          />
        )}
      </div>
    </div>
  );
}
