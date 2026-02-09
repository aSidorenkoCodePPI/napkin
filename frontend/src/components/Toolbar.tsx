import type { AnalysisMode } from '../types';

interface ToolbarProps {
  onAnalyze: (mode: AnalysisMode) => void;
  loading: boolean;
  activeMode: AnalysisMode | null;
  autoAnalyze: boolean;
  onToggleAutoAnalyze: () => void;
}

const MODES: { mode: AnalysisMode; label: string; icon: string }[] = [
  { mode: 'label', label: 'Auto-Label', icon: '🏷' },
  { mode: 'cleanup', label: 'Cleanup', icon: '✨' },
  { mode: 'suggest', label: 'Suggest', icon: '💡' },
  { mode: 'explain', label: 'Explain', icon: '📖' },
];

export function Toolbar({
  onAnalyze,
  loading,
  activeMode,
  autoAnalyze,
  onToggleAutoAnalyze,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-brand">Napkin</div>
      <div className="toolbar-actions">
        {MODES.map(({ mode, label, icon }) => (
          <button
            key={mode}
            className={`toolbar-btn ${activeMode === mode ? 'active' : ''}`}
            onClick={() => onAnalyze(mode)}
            disabled={loading}
          >
            <span className="btn-icon">{icon}</span>
            {label}
          </button>
        ))}
        <div className="toolbar-divider" />
        <label className="auto-toggle">
          <input
            type="checkbox"
            checked={autoAnalyze}
            onChange={onToggleAutoAnalyze}
          />
          Auto-analyze
        </label>
        {loading && <div className="loading-spinner" />}
      </div>
    </div>
  );
}
