import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, FileCheck2, Hand, Image, Lightbulb, Maximize2, MousePointer2, Redo2, Search, Sparkles, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button, IconButton, StatusPill } from './ui';

const nodeIcon = { brief: FileCheck2, research: Search, asset: Image, moodboard: Sparkles, direction: Lightbulb, critique: Bot };

export function MuseCanvas({ canvas, onSave, onSelectionChange, onOpenMoodboard, onOpenDirections }) {
  const viewport = canvas?.viewport ?? { x: 0, y: 0, zoom: 1 };
  const [local, setLocal] = useState(canvas ?? { nodes: [], viewport, history: [], historyIndex: 0 });
  const [selectedIds, setSelectedIds] = useState([]);
  const [tool, setTool] = useState('select');
  const dragRef = useRef(null);
  const panRef = useRef(null);

  useEffect(() => setLocal(canvas ?? { nodes: [], viewport, history: [], historyIndex: 0 }), [canvas]);
  useEffect(() => { onSelectionChange?.(local.nodes.filter((node) => selectedIds.includes(node.id))); }, [local.nodes, onSelectionChange, selectedIds]);

  const commit = (nextNodes, nextViewport = local.viewport, withHistory = true) => {
    const history = withHistory ? [...(local.history ?? []).slice(0, (local.historyIndex ?? 0) + 1), nextNodes] : local.history;
    const next = { ...local, nodes: nextNodes, viewport: nextViewport, history, historyIndex: withHistory ? history.length - 1 : local.historyIndex };
    setLocal(next);
    onSave(next);
  };

  const setZoom = (delta) => {
    const nextViewport = { ...local.viewport, zoom: Math.max(.55, Math.min(1.45, Number((local.viewport.zoom + delta).toFixed(2)))) };
    commit(local.nodes, nextViewport, false);
  };
  const onNodePointerDown = (event, node) => {
    event.stopPropagation();
    if (tool === 'pan') {
      panRef.current = { startX: event.clientX, startY: event.clientY, x: local.viewport.x, y: local.viewport.y };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const additive = event.shiftKey;
    const nextSelected = additive ? (selectedIds.includes(node.id) ? selectedIds.filter((id) => id !== node.id) : [...selectedIds, node.id]) : [node.id];
    setSelectedIds(nextSelected);
    dragRef.current = { id: node.id, startX: event.clientX, startY: event.clientY, nodeX: node.x, nodeY: node.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (dragRef.current) {
      const { id, startX, startY, nodeX, nodeY } = dragRef.current;
      const dx = (event.clientX - startX) / local.viewport.zoom;
      const dy = (event.clientY - startY) / local.viewport.zoom;
      const selected = selectedIds.includes(id) ? selectedIds : [id];
      setLocal((current) => ({ ...current, nodes: current.nodes.map((node) => selected.includes(node.id) ? { ...node, x: node.id === id ? nodeX + dx : node.x + dx, y: node.id === id ? nodeY + dy : node.y + dy } : node) }));
    }
    if (panRef.current) {
      const { startX, startY, x, y } = panRef.current;
      const nextViewport = { ...local.viewport, x: x + event.clientX - startX, y: y + event.clientY - startY };
      setLocal((current) => ({ ...current, viewport: nextViewport }));
    }
  };
  const onPointerUp = () => {
    if (dragRef.current || panRef.current) commit(local.nodes, local.viewport, true);
    dragRef.current = null;
    panRef.current = null;
  };
  const onBackgroundPointerDown = (event) => {
    if (event.target !== event.currentTarget) return;
    if (tool === 'select') setSelectedIds([]);
    panRef.current = { startX: event.clientX, startY: event.clientY, x: local.viewport.x, y: local.viewport.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const undo = () => {
    if (!local.history?.length || local.historyIndex <= 0) return;
    const index = local.historyIndex - 1;
    const next = { ...local, nodes: local.history[index], historyIndex: index };
    setLocal(next); onSave(next);
  };
  const redo = () => {
    if (!local.history?.length || local.historyIndex >= local.history.length - 1) return;
    const index = local.historyIndex + 1;
    const next = { ...local, nodes: local.history[index], historyIndex: index };
    setLocal(next); onSave(next);
  };
  const fitCanvas = () => commit(local.nodes, { x: 0, y: 0, zoom: 1 }, false);

  useEffect(() => {
    const handler = (event) => {
      if ((event.key === 'Backspace' || event.key === 'Delete') && selectedIds.length && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        event.preventDefault(); const nextNodes = local.nodes.filter((node) => !selectedIds.includes(node.id)); setSelectedIds([]); commit(nextNodes);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  });

  const transform = `translate(${local.viewport.x}px, ${local.viewport.y}px) scale(${local.viewport.zoom})`;
  const selectedKinds = useMemo(() => local.nodes.filter((node) => selectedIds.includes(node.id)).map((node) => node.kind), [local.nodes, selectedIds]);
  const connectors = useMemo(() => local.nodes.slice(1).map((node, index) => {
    const previous = local.nodes[index];
    return { id: `${previous.id}-${node.id}`, x1: previous.x + previous.width, y1: previous.y + 70, x2: node.x, y2: node.y + 70 };
  }), [local.nodes]);
  return <section className="muse-canvas" aria-label="创意工作画布">
    <div className="canvas-toolbar"><IconButton label="选择工具" className={tool === 'select' ? 'is-active' : ''} onClick={() => setTool('select')}><MousePointer2 size={18}/></IconButton><IconButton label="平移画布" className={tool === 'pan' ? 'is-active' : ''} onClick={() => setTool('pan')}><Hand size={18}/></IconButton><span></span><IconButton label="撤销" onClick={undo} disabled={local.historyIndex <= 0}><Undo2 size={18}/></IconButton><IconButton label="重做" onClick={redo} disabled={local.historyIndex >= (local.history?.length ?? 1) - 1}><Redo2 size={18}/></IconButton></div>
    <div className="canvas-stage" onPointerDown={onBackgroundPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <div className="canvas-world" style={{ transform }}>
        <svg className="canvas-connectors" width="1200" height="760" aria-hidden="true">{connectors.map((connector) => <path key={connector.id} d={`M${connector.x1} ${connector.y1} C${connector.x1 + 40} ${connector.y1} ${connector.x2 - 40} ${connector.y2} ${connector.x2} ${connector.y2}`}/>)}</svg>
        {local.nodes.map((node) => { const NodeIcon = nodeIcon[node.kind] ?? FileCheck2; return <article key={node.id} className={`canvas-node canvas-node--${node.kind} ${selectedIds.includes(node.id) ? 'canvas-node--selected' : ''}`} style={{ left: node.x, top: node.y, width: node.width, minHeight: node.height }} onPointerDown={(event) => onNodePointerDown(event, node)}>
          <div className="canvas-node__title"><span><NodeIcon size={15}/></span><strong>{node.title}</strong><em aria-hidden="true">···</em></div><p>{node.body}</p>
          {node.kind === 'direction' && node.items?.length ? <div className="canvas-node__directions">{node.items.map((item) => <span key={item}>{item}</span>)}</div> : null}
          {node.kind === 'asset' && node.thumbnail ? <img src={node.thumbnail} alt={node.title}/> : null}
          <small>已保存</small>
        </article>; })}
      </div>
    </div>
    <div className="canvas-controls"><Button variant="quiet" icon={ZoomOut} onClick={() => setZoom(-.1)}>缩小</Button><strong>{Math.round(local.viewport.zoom * 100)}%</strong><Button variant="quiet" icon={ZoomIn} onClick={() => setZoom(.1)}>放大</Button><IconButton label="适应画布" onClick={fitCanvas}><Maximize2 size={17}/></IconButton></div>
    <div className="canvas-quick-actions"><StatusPill status="ai">{selectedKinds.length ? `已选中 ${selectedKinds.length} 个对象` : '画布已保存'}</StatusPill><button onClick={onOpenMoodboard}>整理情绪板</button><button onClick={onOpenDirections}>生成创意方向</button></div>
  </section>;
}
