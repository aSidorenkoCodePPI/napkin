import { useState, useCallback, useEffect, useRef } from 'react';
import { WhiteboardCanvas } from './components/WhiteboardCanvas';
import { ReportModal } from './components/ReportModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { RegionSelect } from './components/RegionSelect';
import { InsightPanel } from './components/InsightPanel';
import { useCanvasSnapshot } from './hooks/useCanvasSnapshot';
import { useGeminiAnalysis } from './hooks/useGeminiAnalysis';
import { useVoiceInput } from './hooks/useVoiceInput';
import { useShapeGenerator } from './hooks/useShapeGenerator';
import type { RegionBounds } from './hooks/useShapeGenerator';
import { Editor } from 'tldraw';
import './App.css';

function App() {
  const [showReport, setShowReport] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [promptText, setPromptText] = useState('');
  const { setEditor: setSnapshotEditor, captureSnapshot } = useCanvasSnapshot();
  const { state, analyzeAll, reset } = useGeminiAnalysis();
  const { isListening, transcript, isSupported, startListening, stopListening } = useVoiceInput();
  const [insightOpen, setInsightOpen] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [importingGithub, setImportingGithub] = useState(false);
  const { setEditor: setGenEditor, generate, generateRegion, transform, importGithub } = useShapeGenerator();

  // Region mode state
  const [regionMode, setRegionMode] = useState(false);
  const [regionRect, setRegionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [regionPageRect, setRegionPageRect] = useState<RegionBounds | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const handleEditorMount = useCallback((editor: Editor) => {
    setSnapshotEditor(editor);
    setGenEditor(editor);
    editorRef.current = editor;
  }, [setSnapshotEditor, setGenEditor]);

  // Keyboard shortcut: G to enter region mode, Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'g' || e.key === 'G') {
        if (!generating && !transforming && !regionMode) {
          e.preventDefault();
          setRegionMode(true);
        }
      } else if (e.key === 'Escape') {
        if (regionMode) {
          e.preventDefault();
          setRegionMode(false);
          setRegionRect(null);
          setRegionPageRect(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [generating, transforming, regionMode]);

  const handleRegionDrawn = useCallback((screenRect: { x: number; y: number; w: number; h: number }) => {
    setRegionRect(screenRect);

    // Convert screen rect corners to page coords
    const editor = editorRef.current;
    if (editor) {
      const topLeft = editor.screenToPage({ x: screenRect.x, y: screenRect.y + 52 }); // +52 for topbar height
      const bottomRight = editor.screenToPage({ x: screenRect.x + screenRect.w, y: screenRect.y + screenRect.h + 52 });
      setRegionPageRect({
        x: topLeft.x,
        y: topLeft.y,
        w: bottomRight.x - topLeft.x,
        h: bottomRight.y - topLeft.y,
      });
    }
  }, []);

  const handleRegionCancel = useCallback(() => {
    setRegionMode(false);
    setRegionRect(null);
    setRegionPageRect(null);
  }, []);

  const handleRegionGenerate = useCallback(async (text: string) => {
    if (!text.trim() || !regionPageRect) return;
    setGenerating(true);
    setGenStatus(`Region: "${text}"`);
    try {
      const count = await generateRegion(text, captureSnapshot, regionPageRect);
      setGenStatus(`Updated ${count} shape${count !== 1 ? 's' : ''} in region`);
      setTimeout(() => setGenStatus(''), 3000);
    } catch (err) {
      setGenStatus(`Error: ${err instanceof Error ? err.message : 'Generation failed'}`);
      setTimeout(() => setGenStatus(''), 5000);
    } finally {
      setGenerating(false);
      setRegionMode(false);
      setRegionRect(null);
      setRegionPageRect(null);
    }
  }, [generateRegion, captureSnapshot, regionPageRect]);

  const handleAnalyze = useCallback(async () => {
    const base64 = await captureSnapshot();
    if (!base64) return;
    await analyzeAll(base64);
    setShowReport(true);
  }, [captureSnapshot, analyzeAll]);

  const handleCloseReport = useCallback(() => {
    setShowReport(false);
    reset();
  }, [reset]);

  const handleGenerate = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setGenerating(true);
    setGenStatus(`Generating: "${text}"`);
    try {
      const count = await generate(text, captureSnapshot);
      setGenStatus(`Created ${count} shape${count !== 1 ? 's' : ''}`);
      setTimeout(() => setGenStatus(''), 3000);
    } catch (err) {
      setGenStatus(`Error: ${err instanceof Error ? err.message : 'Generation failed'}`);
      setTimeout(() => setGenStatus(''), 5000);
    } finally {
      setGenerating(false);
    }
  }, [generate, captureSnapshot]);

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening(handleGenerate);
    }
  }, [isListening, stopListening, startListening, handleGenerate]);

  const handleTransform = useCallback(async () => {
    setTransforming(true);
    try {
      const count = await transform(captureSnapshot);
      setGenStatus(`Transformed into ${count} clean shape${count !== 1 ? 's' : ''}`);
      setTimeout(() => setGenStatus(''), 3000);
    } catch (err) {
      setGenStatus(`Error: ${err instanceof Error ? err.message : 'Transform failed'}`);
      setTimeout(() => setGenStatus(''), 5000);
    } finally {
      setTransforming(false);
    }
  }, [transform, captureSnapshot]);

  const handleGithubImport = useCallback(async () => {
    if (!githubUrl.trim()) return;
    setShowGithubModal(false);
    setImportingGithub(true);
    try {
      const count = await importGithub(githubUrl.trim());
      setGenStatus(`Architecture diagram created with ${count} shape${count !== 1 ? 's' : ''}`);
      setGithubUrl('');
      setTimeout(() => setGenStatus(''), 3000);
    } catch (err) {
      setGenStatus(`Error: ${err instanceof Error ? err.message : 'GitHub import failed'}`);
      setTimeout(() => setGenStatus(''), 5000);
    } finally {
      setImportingGithub(false);
    }
  }, [githubUrl, importGithub]);

  const handleApplyRecommendation = useCallback(async (prompt: string) => {
    const augmented = prompt + '\n\nIMPORTANT: Place any new shapes in free space on the canvas. Do NOT overlap with existing shapes. Find empty grid positions that are not occupied.';
    return await generate(augmented, captureSnapshot);
  }, [generate, captureSnapshot]);

  const handlePromptSubmit = useCallback(() => {
    if (!promptText.trim() || generating) return;
    const text = promptText;
    setPromptText('');
    handleGenerate(text);
  }, [promptText, generating, handleGenerate]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <span>Napkin</span>
        </div>

        <div className="topbar-actions">
          {/* Voice status indicator */}
          {(isListening || genStatus) && (
            <div className={`voice-status ${isListening ? 'listening' : generating ? 'generating' : 'done'}`}>
              {isListening ? (
                <>
                  <div className="voice-pulse" />
                  {transcript || 'Listening...'}
                </>
              ) : (
                genStatus
              )}
            </div>
          )}

          {/* Prompt text input */}
          <div className="prompt-input-wrapper">
            <input
              className="prompt-input"
              type="text"
              placeholder="Describe what to draw..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePromptSubmit(); }}
              disabled={generating || isListening}
            />
            <button
              className="btn-send"
              onClick={handlePromptSubmit}
              disabled={generating || isListening || !promptText.trim()}
              title="Generate"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          {/* Region select button */}
          <button
            className={`btn-region ${regionMode ? 'active' : ''}`}
            onClick={() => {
              if (regionMode) {
                handleRegionCancel();
              } else {
                setRegionMode(true);
              }
            }}
            disabled={generating || transforming}
            title="Region select — draw a rectangle to scope AI changes (G)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
            Region
          </button>

          {/* Voice button */}
          {isSupported && (
            <button
              className={`btn-voice ${isListening ? 'active' : ''}`}
              onClick={handleMicClick}
              disabled={generating}
              title={isListening ? 'Stop listening' : 'Voice command - describe what to draw'}
            >
              {isListening ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          )}

          {/* GitHub import button */}
          <button
            className="btn-github"
            onClick={() => setShowGithubModal(true)}
            disabled={state.loading || generating || transforming || importingGithub}
            title="Import GitHub repo architecture"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </button>

          {/* Transform button */}
          <button
            className="btn-transform"
            onClick={handleTransform}
            disabled={state.loading || generating || transforming}
          >
            {transforming ? (
              <>
                <div className="btn-spinner" />
                Transforming...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                Transform
              </>
            )}
          </button>

          {/* Analyze button */}
          <button
            className="btn-analyze"
            onClick={handleAnalyze}
            disabled={state.loading || generating || transforming}
          >
            {state.loading ? (
              <>
                <div className="btn-spinner" />
                Analyzing...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Analyze
              </>
            )}
          </button>

          {/* Insights button */}
          <button
            className={`btn-insight ${insightOpen ? 'active' : ''}`}
            onClick={() => setInsightOpen(!insightOpen)}
            disabled={generating || transforming}
            title="Architecture insights & optimization"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="9" y1="18" x2="15" y2="18" />
              <line x1="10" y1="22" x2="14" y2="22" />
              <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
            </svg>
            Insights
          </button>
        </div>
      </div>

      <div className="canvas-wrapper">
        <WhiteboardCanvas onMount={handleEditorMount} />

        {/* Region select overlay */}
        {regionMode && (
          <RegionSelect
            regionRect={regionRect}
            onDrawn={handleRegionDrawn}
            onSubmit={handleRegionGenerate}
            onCancel={handleRegionCancel}
            generating={generating}
            isListening={isListening}
            isSupported={isSupported}
            startListening={startListening}
            stopListening={stopListening}
          />
        )}
      </div>

      {/* Generating overlay */}
      {generating && (
        <div className="gen-overlay">
          <div className="gen-card">
            <div className="loading-pulse" />
            <h3>Drawing on canvas...</h3>
            <p>{genStatus}</p>
          </div>
        </div>
      )}

      {/* Transforming overlay */}
      {transforming && (
        <div className="gen-overlay">
          <div className="gen-card">
            <div className="loading-pulse transform-pulse" />
            <h3>Transforming content...</h3>
            <p>Interpreting handwritten content and converting to clean shapes</p>
          </div>
        </div>
      )}

      {/* GitHub importing overlay */}
      {importingGithub && (
        <div className="gen-overlay">
          <div className="gen-card">
            <div className="loading-pulse github-pulse" />
            <h3>Analyzing repository...</h3>
            <p>Fetching structure and generating architecture diagram</p>
          </div>
        </div>
      )}

      {/* GitHub URL modal */}
      {showGithubModal && (
        <div className="github-modal-overlay" onClick={() => setShowGithubModal(false)}>
          <div className="github-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import GitHub Repository</h3>
            <p>Paste a GitHub repo URL to generate its architecture diagram</p>
            <input
              className="github-url-input"
              type="text"
              placeholder="https://github.com/owner/repo"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGithubImport(); }}
              autoFocus
            />
            <div className="github-modal-actions">
              <button className="btn-github-cancel" onClick={() => setShowGithubModal(false)}>
                Cancel
              </button>
              <button
                className="btn-github-import"
                onClick={handleGithubImport}
                disabled={!githubUrl.trim()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Generate Architecture
              </button>
            </div>
          </div>
        </div>
      )}

      {state.loading && <LoadingOverlay progress={state.progress} />}

      {showReport && state.result && (
        <ReportModal result={state.result} onClose={handleCloseReport} />
      )}

      <InsightPanel
        open={insightOpen}
        onClose={() => setInsightOpen(false)}
        captureSnapshot={captureSnapshot}
        onApplyRecommendation={handleApplyRecommendation}
      />
    </div>
  );
}

export default App;
