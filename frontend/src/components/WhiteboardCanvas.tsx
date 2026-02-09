import { Tldraw, Editor } from 'tldraw';
import 'tldraw/tldraw.css';

interface WhiteboardCanvasProps {
  onMount: (editor: Editor) => void;
}

export function WhiteboardCanvas({ onMount }: WhiteboardCanvasProps) {
  return (
    <div className="canvas-container">
      <Tldraw persistenceKey="napkin" onMount={onMount} />
    </div>
  );
}
