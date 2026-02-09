interface LoadingOverlayProps {
  progress: number; // 0-4
}

const STEPS = ['Labeling elements', 'Generating diagram', 'Finding suggestions', 'Writing explanation'];

export function LoadingOverlay({ progress }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <div className="loading-pulse" />
        <h2>Analyzing your sketch</h2>
        <p className="loading-subtitle">Running 4 AI analyses in parallel...</p>
        <div className="loading-steps">
          {STEPS.map((step, i) => (
            <div key={i} className={`loading-step ${i < progress ? 'done' : i === progress ? 'active' : ''}`}>
              <div className="step-indicator">
                {i < progress ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : i === progress ? (
                  <div className="step-spinner" />
                ) : (
                  <div className="step-dot" />
                )}
              </div>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(progress / 4) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
