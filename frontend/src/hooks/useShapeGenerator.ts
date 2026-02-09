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
  action?: 'add' | 'edit' | 'delete';
}

interface RichTextDoc {
  type: string;
  content?: Array<{
    type: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
}

export interface RegionBounds {
  x: number;
  y: number;
  w: number;
  h: number;
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

const VALID_GEO_TYPES = new Set([
  'cloud', 'rectangle', 'ellipse', 'triangle', 'diamond', 'pentagon',
  'hexagon', 'octagon', 'star', 'rhombus', 'rhombus-2', 'oval',
  'trapezoid', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down',
  'x-box', 'check-box', 'heart',
]);

function sanitizeGeoType(geo: string): string {
  if (VALID_GEO_TYPES.has(geo)) return geo;
  // Map common invalid types to closest valid ones
  if (geo === 'cylinder' || geo === 'database' || geo === 'barrel') return 'ellipse';
  if (geo === 'circle') return 'ellipse';
  if (geo === 'square' || geo === 'box') return 'rectangle';
  if (geo === 'parallelogram') return 'trapezoid';
  return 'rectangle';
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

    const spread = 0.35;
    for (let i = 0; i < indices.length; i++) {
      const offset = -spread + (2 * spread * i) / (indices.length - 1);
      if (isVertical) {
        offsets.set(indices[i], { x: offset, y: 0 });
      } else {
        offsets.set(indices[i], { x: 0, y: offset });
      }
    }
  }

  return offsets;
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
        dash: (p.dash as string) || 'solid',
        size: (p.size as string) || 'm',
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

/**
 * Shared 3-pass processing: deletes, edits, adds.
 * Used by both generate() and generateRegion().
 */
function processShapeResponse(
  editor: Editor,
  shapeDataArray: ShapeData[],
  idMap: Map<number, TLShapeId>,
  existingInfo: ExistingShapeInfo[],
  options?: { skipZoomToFit?: boolean }
): number {
  // --- Pass 1: Deletes ---
  const deleteTlIds: TLShapeId[] = [];
  for (const shape of shapeDataArray) {
    if (shape.action !== 'delete') continue;
    const tlId = idMap.get(shape.id);
    if (tlId) deleteTlIds.push(tlId);
  }
  if (deleteTlIds.length > 0) {
    editor.deleteShapes(deleteTlIds);
  }

  // --- Pass 2: Edits ---
  for (const shape of shapeDataArray) {
    if (shape.action !== 'edit') continue;
    const tlId = idMap.get(shape.id);
    if (!tlId) continue;

    const existing = editor.getShape(tlId);
    if (!existing) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = { id: tlId, type: existing.type };
    if (shape.x != null) update.x = shape.x;
    if (shape.y != null) update.y = shape.y;

    if (shape.props && Object.keys(shape.props).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const propUpdates: Record<string, any> = {};
      const p = shape.props;
      for (const [key, value] of Object.entries(p)) {
        // Skip arrow connection fields — these are handled via bindings, not props
        if (key === 'from' || key === 'to') continue;
        if (key === 'text') {
          propUpdates.richText = toRichText(value as string);
        } else if (key === 'w' || key === 'h') {
          propUpdates[key] = value as number;
        } else if (key === 'geo') {
          propUpdates[key] = sanitizeGeoType(value as string);
        } else {
          propUpdates[key] = value;
        }
      }
      update.props = propUpdates;
    }

    editor.updateShape(update);
  }

  // --- Pass 3: Adds (default behavior) ---
  const addShapes = shapeDataArray.filter(
    (s) => !s.action || s.action === 'add'
  );

  const nonArrows: ShapeData[] = [];
  const arrows: ShapeData[] = [];

  for (const shape of addShapes) {
    if (shape.type === 'arrow') {
      arrows.push(shape);
    } else {
      nonArrows.push(shape);
    }
  }

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
              geo: sanitizeGeoType((p.geo as string) || 'rectangle'),
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

  const arrowCount = createArrowsWithBindings(editor, arrows, idMap, shapePositions);

  const totalCreated = newShapes.length + arrowCount;
  const totalDeleted = deleteTlIds.length;
  const totalEdited = shapeDataArray.filter((s) => s.action === 'edit').length;

  if (!options?.skipZoomToFit) {
    const allShapes = editor.getCurrentPageShapes();
    if (allShapes.length > 0) {
      editor.zoomToFit({ animation: { duration: 400 } });
    }
  }

  return totalCreated + totalDeleted + totalEdited;
}

/**
 * Build existingInfo and idMap from a set of shapes (two-pass: non-arrows then arrows).
 */
function buildExistingShapeInfo(
  editor: Editor,
  shapes: ReturnType<Editor['getCurrentPageShapes']>
): { idMap: Map<number, TLShapeId>; existingInfo: ExistingShapeInfo[] } {
  const idMap = new Map<number, TLShapeId>();
  const existingInfo: ExistingShapeInfo[] = [];
  let nextId = 0;
  const tlIdToIntId = new Map<TLShapeId, number>();

  // First pass: non-arrow shapes
  for (const shape of shapes) {
    if (shape.type === 'arrow') continue;

    const props = shape.props as Record<string, unknown>;
    let label = '';
    if (props.richText) {
      label = extractTextFromRichText(props.richText);
    } else if (props.text && typeof props.text === 'string') {
      label = props.text;
    }

    const id = nextId++;
    idMap.set(id, shape.id);
    tlIdToIntId.set(shape.id, id);
    existingInfo.push({
      id,
      type: shape.type,
      label: label || `(unlabeled ${shape.type})`,
      x: Math.round(shape.x),
      y: Math.round(shape.y),
    });
  }

  // Second pass: arrows with from/to connections
  for (const shape of shapes) {
    if (shape.type !== 'arrow') continue;

    const props = shape.props as Record<string, unknown>;
    let label = '';
    if (props.richText) {
      label = extractTextFromRichText(props.richText);
    } else if (props.text && typeof props.text === 'string') {
      label = props.text;
    }

    const bindings = editor.getBindingsFromShape(shape, 'arrow');
    let fromIntId: number | undefined;
    let toIntId: number | undefined;
    for (const binding of bindings) {
      const bProps = binding.props as Record<string, unknown>;
      const targetIntId = tlIdToIntId.get(binding.toId);
      if (targetIntId != null) {
        if (bProps.terminal === 'start') fromIntId = targetIntId;
        else if (bProps.terminal === 'end') toIntId = targetIntId;
      }
    }

    const id = nextId++;
    idMap.set(id, shape.id);
    existingInfo.push({
      id,
      type: 'arrow',
      label: label || '(arrow)',
      x: 0,
      y: 0,
      from_id: fromIntId,
      to_id: toIntId,
    });
  }

  return { idMap, existingInfo };
}

/**
 * Find shapes whose page bounds intersect with the given region bounds.
 * For arrows, also include if either bound endpoint shape is in the region.
 */
function shapesInRegion(
  editor: Editor,
  bounds: RegionBounds
): ReturnType<Editor['getCurrentPageShapes']> {
  const allShapes = editor.getCurrentPageShapes();
  const regionRight = bounds.x + bounds.w;
  const regionBottom = bounds.y + bounds.h;

  // First pass: find non-arrow shapes in region
  const inRegionIds = new Set<TLShapeId>();
  const result: typeof allShapes = [];

  for (const shape of allShapes) {
    if (shape.type === 'arrow') continue;
    const shapeBounds = editor.getShapePageBounds(shape.id);
    if (!shapeBounds) continue;

    // AABB intersection: two rects overlap if neither is fully outside
    const overlaps =
      shapeBounds.x < regionRight &&
      shapeBounds.x + shapeBounds.w > bounds.x &&
      shapeBounds.y < regionBottom &&
      shapeBounds.y + shapeBounds.h > bounds.y;

    if (overlaps) {
      inRegionIds.add(shape.id);
      result.push(shape);
    }
  }

  // Second pass: include arrows if they connect to shapes in the region
  for (const shape of allShapes) {
    if (shape.type !== 'arrow') continue;

    const bindings = editor.getBindingsFromShape(shape, 'arrow');
    let connected = false;
    for (const binding of bindings) {
      if (inRegionIds.has(binding.toId)) {
        connected = true;
        break;
      }
    }

    // Also check if arrow's own bounds intersect
    if (!connected) {
      const shapeBounds = editor.getShapePageBounds(shape.id);
      if (shapeBounds) {
        connected =
          shapeBounds.x < regionRight &&
          shapeBounds.x + shapeBounds.w > bounds.x &&
          shapeBounds.y < regionBottom &&
          shapeBounds.y + shapeBounds.h > bounds.y;
      }
    }

    if (connected) {
      result.push(shape);
    }
  }

  return result;
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

    const idMap = new Map<number, TLShapeId>();
    const existingInfo: ExistingShapeInfo[] = [];

    if (existingShapes.length > 0) {
      imageBase64 = await captureSnapshot();

      const built = buildExistingShapeInfo(editor, existingShapes);
      // Copy into our local maps
      for (const [k, v] of built.idMap) idMap.set(k, v);
      existingInfo.push(...built.existingInfo);
    }

    const rawResult = await generateShapes(prompt, imageBase64, existingInfo.length > 0 ? existingInfo : undefined);
    const shapeDataArray = JSON.parse(cleanJsonResponse(rawResult)) as ShapeData[];

    return processShapeResponse(editor, shapeDataArray, idMap, existingInfo);
  }, []);

  const generateRegion = useCallback(async (
    prompt: string,
    captureSnapshot: () => Promise<string | null>,
    regionBounds: RegionBounds
  ) => {
    const editor = editorRef.current;
    if (!editor) throw new Error('Editor not ready');

    // Find shapes in the region
    const regionShapes = shapesInRegion(editor, regionBounds);

    let imageBase64: string | null = null;
    if (regionShapes.length > 0) {
      // Try to capture snapshot of just the region shapes
      try {
        const regionShapeIds = regionShapes.map((s) => s.id);
        const { blob } = await editor.toImage(regionShapeIds, { format: 'png', quality: 0.8, scale: 1, padding: 20 });
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        // Fallback to full snapshot
        imageBase64 = await captureSnapshot();
      }
    }

    // Build existing info from region shapes only
    const { idMap, existingInfo } = buildExistingShapeInfo(editor, regionShapes);

    // Augment prompt with region bounds
    const bx1 = Math.round(regionBounds.x);
    const by1 = Math.round(regionBounds.y);
    const bx2 = Math.round(regionBounds.x + regionBounds.w);
    const by2 = Math.round(regionBounds.y + regionBounds.h);
    const augmentedPrompt = `${prompt}\n\nPlace all new shapes within x=${bx1} to x=${bx2}, y=${by1} to y=${by2}.`;

    const rawResult = await generateShapes(augmentedPrompt, imageBase64, existingInfo.length > 0 ? existingInfo : undefined);
    const shapeDataArray = JSON.parse(cleanJsonResponse(rawResult)) as ShapeData[];

    return processShapeResponse(editor, shapeDataArray, idMap, existingInfo, { skipZoomToFit: true });
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

    const idMap = new Map<number, TLShapeId>();
    return processShapeResponse(editor, shapeDataArray, idMap, []);
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
    return processShapeResponse(editor, shapeDataArray, idMap, []);
  }, []);

  return { setEditor, generate, generateRegion, transform, importGithub };
}
