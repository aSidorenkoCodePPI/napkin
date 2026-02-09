import { Tldraw, Editor } from 'tldraw';
import 'tldraw/tldraw.css';

interface WhiteboardCanvasProps {
  onMount: (editor: Editor) => void;
}

export function WhiteboardCanvas({ onMount }: WhiteboardCanvasProps) {
  return (
    <div className="canvas-container">
      <Tldraw persistenceKey="napkin" onMount={onMount} licenseKey="tldraw-2026-05-20/WyJsR3V4NjlfZyIsWyIqIl0sMTYsIjIwMjYtMDUtMjAiXQ.INFwygZGRPYXX8Ie9yRiFuZZjzeOswBqwG7NCWmtXdtHuIaXJvwbHy7QaD5UpsfDZWuOsAr/wH8m/mlA+EDfLA" />
    </div>
  );
}
