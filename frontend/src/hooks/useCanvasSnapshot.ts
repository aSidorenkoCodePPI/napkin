import { useCallback, useRef } from 'react';
import { Editor } from 'tldraw';

export function useCanvasSnapshot() {
  const editorRef = useRef<Editor | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setEditor = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const captureSnapshot = useCallback(async (): Promise<string | null> => {
    const editor = editorRef.current;
    if (!editor) return null;

    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) return null;

    try {
      const shapeIds = shapes.map((s) => s.id);
      const { blob } = await editor.toImage(shapeIds, { format: 'png', quality: 0.8, scale: 1, padding: 20 });

      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
      return null;
    }
  }, []);

  const debouncedCapture = useCallback(
    (callback: (base64: string) => void) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(async () => {
        const base64 = await captureSnapshot();
        if (base64) {
          callback(base64);
        }
      }, 2000);
    },
    [captureSnapshot]
  );

  return { setEditor, captureSnapshot, debouncedCapture };
}
