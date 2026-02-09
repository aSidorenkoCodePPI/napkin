import { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeCanvas } from '../api/client';
import type { OptimizeResult } from '../types';

interface InsightPanelProps {
  open: boolean;
  onClose: () => void;
  captureSnapshot: () => Promise<string | null>;
  onApplyRecommendation: (prompt: string) => Promise<number>;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const CATEGORY_COLORS: Record<string, string> = {
  performance: '#3b82f6',
  security: '#ef4444',
  structure: '#a78bfa',
  scalability: '#f59e0b',
};

function renderMarkdown(text: string) {
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
  return html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

export function InsightPanel({ open, onClose, captureSnapshot, onApplyRecommendation }: InsightPanelProps) {
  const [activeTab, setActiveTab] = useState<'optimize' | 'explain'>('optimize');
  const [loading, setLoading] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [explainResult, setExplainResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());
  const hasFetchedInitial = useRef(false);

  const fetchTab = useCallback(async (tab: 'optimize' | 'explain', force = false) => {
    if (!force) {
      if (tab === 'optimize' && optimizeResult) return;
      if (tab === 'explain' && explainResult) return;
    }

    setLoading(true);
    setError(null);
    try {
      const base64 = await captureSnapshot();
      if (!base64) {
        setError('Could not capture canvas snapshot');
        return;
      }
      const raw = await analyzeCanvas(tab, base64);

      if (tab === 'optimize') {
        const parsed: OptimizeResult = JSON.parse(raw);
        setOptimizeResult(parsed);
        setAppliedIndices(new Set());
      } else {
        setExplainResult(raw);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [captureSnapshot, optimizeResult, explainResult]);

  // Auto-fetch optimize on first open
  useEffect(() => {
    if (open && !hasFetchedInitial.current && !optimizeResult && !loading) {
      hasFetchedInitial.current = true;
      fetchTab('optimize');
    }
  }, [open, optimizeResult, loading, fetchTab]);

  const handleTabClick = useCallback((tab: 'optimize' | 'explain') => {
    setActiveTab(tab);
    fetchTab(tab);
  }, [fetchTab]);

  const handleRefresh = useCallback(() => {
    fetchTab(activeTab, true);
  }, [fetchTab, activeTab]);

  const handleClose = useCallback(() => {
    // Keep cached results — only reset transient state
    setError(null);
    setLoading(false);
    setApplyingIndex(null);
    onClose();
  }, [onClose]);

  const handleApply = useCallback(async (index: number) => {
    if (!optimizeResult) return;
    const rec = optimizeResult.recommendations[index];
    if (!rec) return;

    setApplyingIndex(index);
    try {
      await onApplyRecommendation(rec.diagram_prompt);
      setAppliedIndices((prev) => new Set(prev).add(index));
    } catch {
      // Error handled by parent
    } finally {
      setApplyingIndex(null);
    }
  }, [optimizeResult, onApplyRecommendation]);

  const hasContent = activeTab === 'optimize' ? !!optimizeResult : !!explainResult;

  return (
    <div className={`insight-panel ${open ? 'open' : ''}`}>
      <div className="insight-header">
        <span className="insight-title">Insights</span>
        <div className="insight-header-actions">
          {hasContent && !loading && (
            <button
              className="btn-refresh"
              onClick={handleRefresh}
              title="Re-analyze canvas"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
          <button className="insight-close" onClick={handleClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="insight-tabs">
        <button
          className={`insight-tab ${activeTab === 'optimize' ? 'active' : ''}`}
          onClick={() => handleTabClick('optimize')}
        >
          Optimize
        </button>
        <button
          className={`insight-tab ${activeTab === 'explain' ? 'active' : ''}`}
          onClick={() => handleTabClick('explain')}
        >
          Explain
        </button>
      </div>

      <div className="insight-content">
        {loading && (
          <div className="insight-loading">
            <div className="insight-spinner" />
            <span>Analyzing...</span>
          </div>
        )}

        {error && !loading && (
          <div className="insight-error">{error}</div>
        )}

        {/* Optimize tab */}
        {activeTab === 'optimize' && optimizeResult && !loading && (
          <div className="optimize-results">
            <div className="optimize-summary">{optimizeResult.summary}</div>

            {optimizeResult.recommendations.map((rec, i) => {
              const isApplying = applyingIndex === i;
              const isApplied = appliedIndices.has(i);
              const isDisabled = applyingIndex !== null;

              return (
                <div
                  key={i}
                  className={`optimize-card ${isApplied ? 'applied' : ''}`}
                  style={{ borderLeftColor: PRIORITY_COLORS[rec.priority] || '#94a3b8' }}
                >
                  <div className="optimize-card-header">
                    <strong>{rec.title}</strong>
                    <div className="optimize-card-tags">
                      <span
                        className="optimize-category"
                        style={{ background: CATEGORY_COLORS[rec.category] || '#71717a' }}
                      >
                        {rec.category}
                      </span>
                      <span
                        className="optimize-priority"
                        style={{ background: PRIORITY_COLORS[rec.priority] || '#94a3b8' }}
                      >
                        {rec.priority}
                      </span>
                    </div>
                  </div>
                  <p>{rec.description}</p>
                  <button
                    className={`btn-apply ${isApplied ? 'applied' : ''}`}
                    onClick={() => handleApply(i)}
                    disabled={isDisabled || isApplied}
                  >
                    {isApplying ? (
                      <>
                        <div className="btn-apply-spinner" />
                        Applying...
                      </>
                    ) : isApplied ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Applied
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Apply
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Explain tab */}
        {activeTab === 'explain' && explainResult && !loading && (
          <div
            className="explain-content insight-explain"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(explainResult) }}
          />
        )}
      </div>
    </div>
  );
}
