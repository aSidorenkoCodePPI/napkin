import { useRef } from 'react';
import type { FullAnalysisResult } from '../types';
import { MermaidDiagram } from './MermaidDiagram';

interface ReportModalProps {
  result: FullAnalysisResult;
  onClose: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
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

export function ReportModal({ result, onClose }: ReportModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = () => {
    const printContent = reportRef.current;
    if (!printContent) return;

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Napkin Analysis Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; padding: 40px; max-width: 900px; margin: 0 auto; }
          .report-header { text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
          .report-header h1 { font-size: 28px; margin-bottom: 8px; }
          .report-header p { color: #64748b; font-size: 14px; }
          .report-section { margin-bottom: 32px; }
          .section-title { font-size: 20px; font-weight: 700; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }
          .label-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .label-card { padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; }
          .label-card .type { display: inline-block; background: #eff6ff; color: #3b82f6; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-bottom: 4px; }
          .label-card .name { font-weight: 600; font-size: 14px; }
          .label-card .desc { color: #64748b; font-size: 13px; margin-top: 4px; }
          .suggestion-card { padding: 12px 16px; border-left: 3px solid #94a3b8; border-radius: 0 8px 8px 0; background: #f8fafc; margin-bottom: 8px; }
          .suggestion-card .title { font-weight: 600; font-size: 14px; }
          .suggestion-card .desc { color: #64748b; font-size: 13px; margin-top: 4px; }
          .priority { display: inline-block; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: 8px; }
          .assessment { padding: 16px; background: #f8fafc; border-radius: 8px; margin-bottom: 16px; font-size: 14px; color: #475569; line-height: 1.6; }
          .explain-content h1 { font-size: 20px; margin: 16px 0 8px; }
          .explain-content h2 { font-size: 17px; margin: 14px 0 6px; }
          .explain-content h3 { font-size: 15px; margin: 12px 0 4px; }
          .explain-content li { margin-left: 20px; margin-bottom: 4px; }
          .explain-content p { margin-bottom: 8px; line-height: 1.7; font-size: 14px; }
          .explain-content code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
          .mermaid-code { padding: 16px; background: #1e293b; color: #e2e8f0; border-radius: 8px; font-size: 12px; white-space: pre-wrap; font-family: monospace; overflow-x: auto; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>${printContent.innerHTML}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => {
      win.print();
    }, 500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-topbar">
          <div className="modal-topbar-left">
            <h2>Analysis Report</h2>
          </div>
          <div className="modal-topbar-right">
            <button className="btn-download" onClick={handleDownloadPdf}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </button>
            <button className="btn-close-modal" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="modal-body" ref={reportRef}>
          <div className="report-header">
            <h1>Napkin Analysis Report</h1>
            <p>Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>

          {/* Explanation Section */}
          {result.explainResult && (
            <div className="report-section">
              <div className="section-title">
                <span className="section-icon">&#128214;</span>
                Explanation
              </div>
              <div
                className="explain-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(result.explainResult) }}
              />
            </div>
          )}

          {/* Labels Section */}
          {result.labelResult && result.labelResult.labels.length > 0 && (
            <div className="report-section">
              <div className="section-title">
                <span className="section-icon">&#127991;</span>
                Detected Elements
              </div>
              <div className="label-grid">
                {result.labelResult.labels.map((label, i) => (
                  <div key={i} className="label-card">
                    <span className="label-card-type">{label.type}</span>
                    <div className="label-card-name">{label.name}</div>
                    <div className="label-card-desc">{label.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mermaid Cleanup Section */}
          {result.cleanupResult && (
            <div className="report-section">
              <div className="section-title">
                <span className="section-icon">&#10024;</span>
                Structured Diagram
              </div>
              <MermaidDiagram code={result.cleanupResult} />
            </div>
          )}

          {/* Suggestions Section */}
          {result.suggestResult && (
            <div className="report-section">
              <div className="section-title">
                <span className="section-icon">&#128161;</span>
                Suggestions
              </div>
              {result.suggestResult.overall_assessment && (
                <div className="assessment-box">
                  {result.suggestResult.overall_assessment}
                </div>
              )}
              <div className="suggestions-list">
                {result.suggestResult.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="suggestion-card"
                    style={{ borderLeftColor: PRIORITY_COLORS[s.priority] || '#94a3b8' }}
                  >
                    <div className="suggestion-header">
                      <strong>{s.title}</strong>
                      <span
                        className="priority-badge"
                        style={{ backgroundColor: PRIORITY_COLORS[s.priority] || '#94a3b8' }}
                      >
                        {s.priority}
                      </span>
                    </div>
                    <p>{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
