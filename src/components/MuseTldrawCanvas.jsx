import { useCallback, useRef } from 'react';
import { createShapeId, getSnapshot, Tldraw, toRichText } from 'tldraw';
import 'tldraw/tldraw.css';
import { MuseCanvas as LegacyMuseCanvas } from './MuseCanvas';

const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY;
const canUseTldraw = import.meta.env.DEV || Boolean(licenseKey);

const shapeColors = { brief: 'grey', research: 'yellow', asset: 'blue', moodboard: 'violet', direction: 'green', critique: 'red' };

function seedLegacyNodes(editor, nodes = []) {
  if (editor.getCurrentPageShapes().length || !nodes.length) return;
  editor.createShapes(nodes.map((node) => ({
    id: createShapeId(node.id.replace(/[^a-zA-Z0-9_-]/g, '-')),
    type: 'geo',
    x: node.x,
    y: node.y,
    props: {
      w: node.width ?? 280,
      h: node.height ?? 170,
      geo: 'rectangle',
      color: shapeColors[node.kind] ?? 'grey',
      fill: 'semi',
      size: 'm',
      richText: toRichText(`${node.title}\n\n${node.body}`),
    },
    meta: { museKind: node.kind, museNodeId: node.id },
  })));
  editor.zoomToFit({ animation: { duration: 220 } });
}

export function MuseTldrawCanvas({ projectId, canvas, onSave, onSelectionChange, onOpenMoodboard, onOpenDirections }) {
  const saveTimer = useRef();
  const initialSnapshot = useRef(canvas?.tldrawSnapshot);
  const latest = useRef({ canvas, onSave, onSelectionChange });
  latest.current = { canvas, onSave, onSelectionChange };
  const onMount = useCallback((editor) => {
    editor.user.updateUserPreferences({ colorScheme: 'dark' });
    seedLegacyNodes(editor, latest.current.canvas?.nodes);

    const unsubscribe = editor.store.listen(() => {
      latest.current.onSelectionChange?.(editor.getSelectedShapes().map((shape) => ({ id: shape.id, kind: shape.meta?.museKind ?? shape.type })));
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        latest.current.onSave?.({ ...latest.current.canvas, engine: 'tldraw', tldrawSnapshot: getSnapshot(editor.store), updatedAt: new Date().toISOString() });
      }, 280);
    });

    return () => {
      unsubscribe();
      window.clearTimeout(saveTimer.current);
    };
  }, []);

  if (!canUseTldraw) {
    return <div className="canvas-license-fallback">
      <div className="canvas-license-fallback__notice"><strong>当前使用 Muse 原生画布</strong><span>画布内容会持续保存在当前浏览器。</span></div>
      <LegacyMuseCanvas canvas={canvas} onSave={onSave} onSelectionChange={onSelectionChange} onOpenMoodboard={onOpenMoodboard} onOpenDirections={onOpenDirections}/>
    </div>;
  }

  return <section className="muse-tldraw" aria-label="Muse 无限创意画布">
    <Tldraw key={projectId} snapshot={initialSnapshot.current} onMount={onMount} licenseKey={licenseKey}/>
    <div className="muse-tldraw__actions">
      <button type="button" onClick={onOpenMoodboard}>整理情绪板</button>
      <button type="button" onClick={onOpenDirections}>生成创意方向</button>
    </div>
  </section>;
}
