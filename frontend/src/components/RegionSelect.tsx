import { useState, useRef, useCallback, useEffect } from 'react';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RegionSelectProps {
  regionRect: Rect | null;
  onDrawn: (rect: Rect) => void;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  generating: boolean;
  isListening: boolean;
  isSupported: boolean;
  startListening: (cb: (text: string) => void) => void;
  stopListening: () => void;
}

export function RegionSelect({
  regionRect,
  onDrawn,
  onSubmit,
  onCancel,
  generating,
  isListening,
  isSupported,
  startListening,
  stopListening,
}: RegionSelectProps) {
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [promptText, setPromptText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when prompt phase starts
  useEffect(() => {
    if (regionRect && inputRef.current) {
      inputRef.current.focus();
    }
  }, [regionRect]);

  // Compute drawn rectangle from start + current
  const drawRect = drawStart && drawCurrent
    ? {
        x: Math.min(drawStart.x, drawCurrent.x),
        y: Math.min(drawStart.y, drawCurrent.y),
        w: Math.abs(drawCurrent.x - drawStart.x),
        h: Math.abs(drawCurrent.y - drawStart.y),
      }
    : null;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left button
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDrawStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDrawCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDrawCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [drawStart]);

  const handleMouseUp = useCallback(() => {
    if (!drawRect) {
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }
    // Only accept if big enough
    if (drawRect.w > 20 && drawRect.h > 20) {
      onDrawn(drawRect);
    }
    setDrawStart(null);
    setDrawCurrent(null);
  }, [drawRect, onDrawn]);

  const handleSubmit = useCallback(() => {
    if (!promptText.trim() || generating) return;
    onSubmit(promptText.trim());
    setPromptText('');
  }, [promptText, generating, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleSubmit, onCancel]);

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening((text) => {
        if (text.trim()) {
          onSubmit(text.trim());
        }
      });
    }
  }, [isListening, stopListening, startListening, onSubmit]);

  // Compute prompt card position (below the rect, or above if near bottom)
  const promptStyle: React.CSSProperties | undefined = regionRect
    ? (() => {
        const cardHeight = 80;
        const gap = 12;
        const viewportH = window.innerHeight;
        const rectBottom = regionRect.y + regionRect.h;
        const fitsBelow = rectBottom + gap + cardHeight < viewportH;
        return {
          position: 'absolute' as const,
          left: regionRect.x,
          top: fitsBelow ? rectBottom + gap : regionRect.y - gap - cardHeight,
        };
      })()
    : undefined;

  // Phase 1: Drawing
  if (!regionRect) {
    return (
      <div className="region-overlay">
        <div className="region-mode-banner">
          Draw a region — press Esc to cancel
        </div>
        <div
          className="region-draw-surface"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {drawRect && drawRect.w > 0 && drawRect.h > 0 && (
            <div
              className="region-rect"
              style={{
                left: drawRect.x,
                top: drawRect.y,
                width: drawRect.w,
                height: drawRect.h,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // Phase 2: Prompting
  return (
    <div className="region-overlay">
      {/* Show the drawn rectangle */}
      <div
        className="region-rect region-rect-fixed"
        style={{
          left: regionRect.x,
          top: regionRect.y,
          width: regionRect.w,
          height: regionRect.h,
        }}
      />

      {/* Floating prompt card */}
      <div className="region-prompt" style={promptStyle}>
        <div className="region-prompt-inner">
          <input
            ref={inputRef}
            className="region-prompt-input"
            type="text"
            placeholder="What to do in this region..."
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={generating}
          />
          <button
            className="btn-send"
            onClick={handleSubmit}
            disabled={generating || !promptText.trim()}
            title="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
          {isSupported && (
            <button
              className={`btn-voice-sm ${isListening ? 'active' : ''}`}
              onClick={handleMicClick}
              disabled={generating}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          )}
        </div>
        <div className="region-prompt-hint">
          Press Enter to send, Escape to cancel
        </div>
      </div>
    </div>
  );
}
