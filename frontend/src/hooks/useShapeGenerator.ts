import { useCallback, useRef } from 'react';
import { Editor, createShapeId, createBindingId, toRichText, type TLShapeId } from 'tldraw';
import { generateShapes, transformCanvas, analyzeGithubRepo } from '../api/client';
import type { ExistingShapeInfo } from '../api/client';

interface ShapeData {
  id: number;
  type: string;
  x?: number;
  y?: number;
  props: Record<string, unknown>;
}

interface RichTextDoc {
  type: string;
  content?: Array<{
    type: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
}

function extractTextFromRichText(rt: unknown): string {
  if (!rt || typeof rt !== 'object') return '';
  const doc = rt as RichTextDoc;
  if (doc.type !== 'doc' || !doc.content) return '';
  const parts: string[] = [];
  for (const paragraph of doc.content) {
    if (paragraph.content) {
      for (const node of paragraph.content) {
        if (node.text) parts.push(node.text);
      }
    }
  }
  return parts.join(' ');
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

interface AnchorOffset {
  x: number;
  y: number;
}

/**
 * Detect bidirectional arrow pairs and compute anchor offsets so they don't overlap.
 * Uses shape positions to determine orientation: horizontal pairs offset on y, vertical pairs offset on x.
 */
function computeArrowAnchorOffsets(
  arrows: ShapeData[],
  shapePositions: Map<number, { x: number; y: number }>
): Map<number, AnchorOffset> {
  const offsets = new Map<number, AnchorOffset>();

  // Group arrows by their undirected pair key (smaller id first)
  const pairMap = new Map<string, number[]>();
  for (let i = 0; i < arrows.length; i++) {
    const p = arrows[i].props;
    const from = p.from as number;
    const to = p.to as number;
    if (from == null || to == null) continue;
    const key = `${Math.min(from, to)}-${Math.max(from, to)}`;
    if (!pairMap.has(key)) pairMap.set(key, []);
    pairMap.get(key)!.push(i);
  }

  for (const [key, indices] of pairMap.entries()) {
    if (indices.length < 2) continue;

    // Determine orientation from shape positions
    const [idA, idB] = key.split('-').map(Number);
    const posA = shapePositions.get(idA);
    const posB = shapePositions.get(idB);

    let isVertical = false;
    if (posA && posB) {
      const dx = Math.abs(posA.x - posB.x);
      const dy = Math.abs(posA.y - posB.y);
      isVertical = dy > dx;
    }

    const spread = 0.2;
    for (let i = 0; i < indices.length; i++) {
      const offset = -spread + (2 * spread * i) / (indices.length - 1);
      if (isVertical) {
        // Vertical pair: offset on x-axis so arrows separate horizontally
        offsets.set(indices[i], { x: offset, y: 0 });
      } else {
        // Horizontal pair: offset on y-axis so arrows separate vertically
        offsets.set(indices[i], { x: 0, y: offset });
      }
    }
  }

  return offsets;
}

/**
 * Pick arrow text size based on label length.
 */
function arrowTextSize(text: string): string {
  if (!text) return 'l';
  if (text.length > 10) return 'xl';
  return 'l';
}

function createArrowsWithBindings(
  editor: Editor,
  arrows: ShapeData[],
  idMap: Map<number, TLShapeId>,
  shapePositions: Map<number, { x: number; y: number }>
) {
  const anchorOffsets = computeArrowAnchorOffsets(arrows, shapePositions);

  for (let i = 0; i < arrows.length; i++) {
    const arrow = arrows[i];
    const p = arrow.props;
    const fromId = idMap.get(p.from as number);
    const toId = idMap.get(p.to as number);

    const arrowTlId = createShapeId();
    idMap.set(arrow.id, arrowTlId);

    const text = (p.text as string) || '';

    editor.createShape({
      id: arrowTlId,
      type: 'arrow',
      x: 0,
      y: 0,
      props: {
        richText: toRichText(text),
        color: (p.color as string) || 'black',
        dash: (p.dash as string) || 'draw',
        size: (p.size as string) || arrowTextSize(text),
        font: 'draw',
      },
    });

    const off = anchorOffsets.get(i);
    const anchorX = 0.5 + (off?.x ?? 0);
    const anchorY = 0.5 + (off?.y ?? 0);
    const isPrecise = off != null;

    if (fromId) {
      editor.createBinding({
        id: createBindingId(),
        type: 'arrow',
        fromId: arrowTlId,
        toId: fromId,
        props: {
          terminal: 'start',
          normalizedAnchor: { x: anchorX, y: anchorY },
          isExact: false,
          isPrecise,
          snap: 'edge' as const,
        },
      });
    }

    if (toId) {
      editor.createBinding({
        id: createBindingId(),
        type: 'arrow',
        fromId: arrowTlId,
        toId: toId,
        props: {
          terminal: 'end',
          normalizedAnchor: { x: anchorX, y: anchorY },
          isExact: false,
          isPrecise,
          snap: 'edge' as const,
        },
      });
    }
  }

  return arrows.length;
}

export function useShapeGenerator() {
  const editorRef = useRef<Editor | null>(null);

  const setEditor = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const generate = useCallback(async (
    prompt: string,
    captureSnapshot: () => Promise<string | null>
  ) => {
    const editor = editorRef.current;
    if (!editor) throw new Error('Editor not ready');

    const existingShapes = editor.getCurrentPageShapes();
    let imageBase64: string | null = null;

    // Build existing shapes info for the API and pre-populate ID map
    const idMap = new Map<number, TLShapeId>();
    const existingInfo: ExistingShapeInfo[] = [];

    if (existingShapes.length > 0) {
      imageBase64 = await captureSnapshot();

      // Assign integer IDs to existing shapes (skip arrows/text for now, focus on connectable shapes)
      let nextId = 0;
      for (const shape of existingShapes) {
        if (shape.type === 'arrow') continue; // arrows aren't targets for connections

        const props = shape.props as Record<string, unknown>;
        let label = '';
        if (props.richText) {
          label = extractTextFromRichText(props.richText);
        } else if (props.text && typeof props.text === 'string') {
          label = props.text;
        }

        const id = nextId++;
        idMap.set(id, shape.id);
        existingInfo.push({
          id,
          type: shape.type,
          label: label || `(unlabeled ${shape.type})`,
          x: Math.round(shape.x),
          y: Math.round(shape.y),
        });
      }
    }

    const rawResult = await generateShapes(prompt, imageBase64, existingInfo.length > 0 ? existingInfo : undefined);
    const shapeDataArray = JSON.parse(cleanJsonResponse(rawResult)) as ShapeData[];

    // Separate arrows from non-arrows
    const nonArrows: ShapeData[] = [];
    const arrows: ShapeData[] = [];

    for (const shape of shapeDataArray) {
      if (shape.type === 'arrow') {
        arrows.push(shape);
      } else {
        nonArrows.push(shape);
      }
    }

    // Create new non-arrow shapes (skip if ID already in map = existing shape)
    const newShapes = nonArrows
      .filter((shape) => !idMap.has(shape.id))
      .map((shape) => {
        const tlId = createShapeId();
        idMap.set(shape.id, tlId);

        const p = shape.props;
        switch (shape.type) {
          case 'geo':
            return {
              id: tlId,
              type: 'geo' as const,
              x: shape.x ?? 100,
              y: shape.y ?? 100,
              props: {
                w: (p.w as number) || 200,
                h: (p.h as number) || 100,
                geo: (p.geo as string) || 'rectangle',
                richText: toRichText((p.text as string) || ''),
                color: (p.color as string) || 'black',
                fill: (p.fill as string) || 'semi',
                dash: (p.dash as string) || 'draw',
                size: (p.size as string) || 'm',
                font: 'draw',
              },
            };
          case 'text':
            return {
              id: tlId,
              type: 'text' as const,
              x: shape.x ?? 100,
              y: shape.y ?? 50,
              props: {
                richText: toRichText((p.text as string) || ''),
                color: (p.color as string) || 'black',
                size: (p.size as string) || 'm',
                font: 'draw',
              },
            };
          case 'note':
            return {
              id: tlId,
              type: 'note' as const,
              x: shape.x ?? 100,
              y: shape.y ?? 100,
              props: {
                richText: toRichText((p.text as string) || ''),
                color: (p.color as string) || 'yellow',
                size: (p.size as string) || 'm',
                font: 'draw',
              },
            };
          default:
            return null;
        }
      })
      .filter(Boolean);

    if (newShapes.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.createShapes(newShapes as any);
    }

    // Build position map from existing shapes + newly generated shapes
    const shapePositions = new Map<number, { x: number; y: number }>();
    for (const info of existingInfo) {
      shapePositions.set(info.id, { x: info.x, y: info.y });
    }
    for (const shape of nonArrows) {
      if (shape.x != null && shape.y != null) {
        shapePositions.set(shape.id, { x: shape.x, y: shape.y });
      }
    }

    // Create arrows and bind to shapes (both existing and new)
    const arrowCount = createArrowsWithBindings(editor, arrows, idMap, shapePositions);

    const totalCreated = newShapes.length + arrowCount;

    const allShapes = editor.getCurrentPageShapes();
    if (allShapes.length > 0) {
      editor.zoomToFit({ animation: { duration: 400 } });
    }

    return totalCreated;
  }, []);

  const transform = useCallback(async (
    captureSnapshot: () => Promise<string | null>
  ) => {
    const editor = editorRef.current;
    if (!editor) throw new Error('Editor not ready');

    const imageBase64 = await captureSnapshot();
    if (!imageBase64) throw new Error('Nothing on the canvas to transform');

    const rawResult = await transformCanvas(imageBase64);
    const shapeDataArray = JSON.parse(cleanJsonResponse(rawResult)) as ShapeData[];

    // Delete all existing shapes
    const existingShapes = editor.getCurrentPageShapes();
    if (existingShapes.length > 0) {
      editor.deleteShapes(existingShapes.map((s) => s.id));
    }

    // Build new shapes
    const idMap = new Map<number, TLShapeId>();
    const nonArrows: ShapeData[] = [];
    const arrows: ShapeData[] = [];

    for (const shape of shapeDataArray) {
      if (shape.type === 'arrow') {
        arrows.push(shape);
      } else {
        nonArrows.push(shape);
      }
    }

    const newShapes = nonArrows
      .map((shape) => {
        const tlId = createShapeId();
        idMap.set(shape.id, tlId);

        const p = shape.props;
        switch (shape.type) {
          case 'geo':
            return {
              id: tlId,
              type: 'geo' as const,
              x: shape.x ?? 100,
              y: shape.y ?? 100,
              props: {
                w: (p.w as number) || 200,
                h: (p.h as number) || 100,
                geo: (p.geo as string) || 'rectangle',
                richText: toRichText((p.text as string) || ''),
                color: (p.color as string) || 'black',
                fill: (p.fill as string) || 'semi',
                dash: (p.dash as string) || 'draw',
                size: (p.size as string) || 'm',
                font: 'draw',
              },
            };
          case 'text':
            return {
              id: tlId,
              type: 'text' as const,
              x: shape.x ?? 100,
              y: shape.y ?? 50,
              props: {
                richText: toRichText((p.text as string) || ''),
                color: (p.color as string) || 'black',
                size: (p.size as string) || 'm',
                font: 'draw',
              },
            };
          case 'note':
            return {
              id: tlId,
              type: 'note' as const,
              x: shape.x ?? 100,
              y: shape.y ?? 100,
              props: {
                richText: toRichText((p.text as string) || ''),
                color: (p.color as string) || 'yellow',
                size: (p.size as string) || 'm',
                font: 'draw',
              },
            };
          default:
            return null;
        }
      })
      .filter(Boolean);

    if (newShapes.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.createShapes(newShapes as any);
    }

    const shapePositions = new Map<number, { x: number; y: number }>();
    for (const shape of nonArrows) {
      if (shape.x != null && shape.y != null) {
        shapePositions.set(shape.id, { x: shape.x, y: shape.y });
      }
    }

    const arrowCount = createArrowsWithBindings(editor, arrows, idMap, shapePositions);

    const totalCreated = newShapes.length + arrowCount;

    const allShapes = editor.getCurrentPageShapes();
    if (allShapes.length > 0) {
      editor.zoomToFit({ animation: { duration: 400 } });
    }

    return totalCreated;
  }, []);

  const importGithub = useCallback(async (repoUrl: string) => {
    const editor = editorRef.current;
    if (!editor) throw new Error('Editor not ready');

    const rawResult = await analyzeGithubRepo(repoUrl);
    const shapeDataArray = JSON.parse(cleanJsonResponse(rawResult)) as ShapeData[];

    // Clear canvas
    const existingShapes = editor.getCurrentPageShapes();
    if (existingShapes.length > 0) {
      editor.deleteShapes(existingShapes.map((s) => s.id));
    }

    const idMap = new Map<number, TLShapeId>();
    const nonArrows: ShapeData[] = [];
    const arrows: ShapeData[] = [];

    for (const shape of shapeDataArray) {
      if (shape.type === 'arrow') {
        arrows.push(shape);
      } else {
        nonArrows.push(shape);
      }
    }

    const newShapes = nonArrows
      .map((shape) => {
        const tlId = createShapeId();
        idMap.set(shape.id, tlId);

        const p = shape.props;
        switch (shape.type) {
          case 'geo':
            return {
              id: tlId,
              type: 'geo' as const,
              x: shape.x ?? 100,
              y: shape.y ?? 100,
              props: {
                w: (p.w as number) || 200,
                h: (p.h as number) || 100,
                geo: (p.geo as string) || 'rectangle',
                richText: toRichText((p.text as string) || ''),
                color: (p.color as string) || 'black',
                fill: (p.fill as string) || 'semi',
                dash: (p.dash as string) || 'draw',
                size: (p.size as string) || 'm',
                font: 'draw',
              },
            };
          case 'text':
            return {
              id: tlId,
              type: 'text' as const,
              x: shape.x ?? 100,
              y: shape.y ?? 50,
              props: {
                richText: toRichText((p.text as string) || ''),
                color: (p.color as string) || 'black',
                size: (p.size as string) || 'm',
                font: 'draw',
              },
            };
          case 'note':
            return {
              id: tlId,
              type: 'note' as const,
              x: shape.x ?? 100,
              y: shape.y ?? 100,
              props: {
                richText: toRichText((p.text as string) || ''),
                color: (p.color as string) || 'yellow',
                size: (p.size as string) || 'm',
                font: 'draw',
              },
            };
          default:
            return null;
        }
      })
      .filter(Boolean);

    if (newShapes.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.createShapes(newShapes as any);
    }

    const shapePositions = new Map<number, { x: number; y: number }>();
    for (const shape of nonArrows) {
      if (shape.x != null && shape.y != null) {
        shapePositions.set(shape.id, { x: shape.x, y: shape.y });
      }
    }

    const arrowCount = createArrowsWithBindings(editor, arrows, idMap, shapePositions);

    const totalCreated = newShapes.length + arrowCount;

    const allShapes = editor.getCurrentPageShapes();
    if (allShapes.length > 0) {
      editor.zoomToFit({ animation: { duration: 400 } });
    }

    return totalCreated;
  }, []);

  return { setEditor, generate, transform, importGithub };
}
