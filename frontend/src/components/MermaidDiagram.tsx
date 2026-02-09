import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

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

    mermaid
      .render(id, code)
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
