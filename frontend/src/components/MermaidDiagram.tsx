import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

/**
 * Sanitize Mermaid flowchart code: wrap node labels containing
 * special characters (parentheses, <br>, angle brackets) in double quotes.
 */
function sanitizeMermaidCode(code: string): string {
  // Match flowchart node definitions like A[...], A(...), A{...}, A>...]
  // and ensure labels with special chars are quoted
  return code.replace(
    /(\w+)\[([^\]"]+)\]/g,
    (_match, nodeId: string, label: string) => {
      // If label contains special characters that break Mermaid parsing, quote it
      if (/[()<>{}|&#]|<br\s*\/?>/.test(label)) {
        // Replace <br> with <br/> for consistency
        const fixedLabel = label.replace(/<br\s*>/gi, '<br/>');
        return `${nodeId}["${fixedLabel}"]`;
      }
      return _match;
    }
  );
}

interface MermaidDiagramProps {
  code: string;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !code) return;

    const id = `mermaid-${Date.now()}`;
    setError(null);

    const sanitized = sanitizeMermaidCode(code);

    mermaid
      .render(id, sanitized)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to render diagram');
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      });
  }, [code]);

  return (
    <div className="mermaid-container">
      {error && <div className="mermaid-error">Render error: {error}</div>}
      <div ref={containerRef} className="mermaid-svg" />
      <details className="mermaid-source">
        <summary>View Mermaid Code</summary>
        <pre><code>{code}</code></pre>
      </details>
    </div>
  );
}
