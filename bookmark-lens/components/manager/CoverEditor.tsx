import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, RefreshCw, X } from 'lucide-react';
import { compressImage, sizeLabel } from '../../lib/image-compression';
import { readCustomCover, saveCustomCover } from '../../lib/custom-covers';
import { defaultCrop, exportCover, geometry, type Crop } from '../../lib/cover-edit';
type Source = { blob: Blob; url: string; width: number; height: number; originalSize: number };
export default function CoverEditor({ bookmarkId, title, initialFile, initialImage, onClose, report }: { bookmarkId: string; title: string; initialFile?: File; initialImage?: string; onClose: () => void; report: (s: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null), viewport = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<Source>(), [crop, setCrop] = useState<Crop>(defaultCrop), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(true), [error, setError] = useState('');
  const sourceRef = useRef<Source | undefined>(undefined), mounted = useRef(true), lock = useRef(false), dirtyRef = useRef(false), busyRef = useRef(true), generation = useRef(0);
  dirtyRef.current = dirty; busyRef.current = busy;
  const pointer = useRef<{ x: number; y: number; crop: Crop } | undefined>(undefined);
  const close = () => { if (!busyRef.current && (!dirtyRef.current || window.confirm('有未保存的封面修改，确定放弃吗？'))) onClose(); };
  function replace(next: Source) { if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url); sourceRef.current = next; setSource(next); }
  async function load(file: Blob, optimized: boolean, savedCrop = defaultCrop, originalSize = file.size) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const version = ++generation.current;
    try {
      const result = optimized ? { blob: file, originalSize } : await compressImage(file);
      const bitmap = await createImageBitmap(result.blob);
      const width = bitmap.width, height = bitmap.height; bitmap.close();
      if (!mounted.current || version !== generation.current) return;
      replace({ blob: result.blob, url: URL.createObjectURL(result.blob), width, height, originalSize: result.originalSize });
      setCrop(geometry(width, height, savedCrop).crop); setDirty(!optimized);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '图片读取失败，原封面已保留'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    mounted.current = true; const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      try {
        if (initialFile) { await load(initialFile, false); return; }
        const saved = await readCustomCover(bookmarkId);
        if (!alive) return;
        if (saved) await load(saved.source ?? saved.blob, true, saved.crop ?? defaultCrop, saved.originalSize);
        else if(initialImage?.startsWith('data:image/')) await load(await (await fetch(initialImage)).blob(),true);
        else setBusy(false);
      } catch { if (alive) { setBusy(false); setError('无法读取已保存的封面，可重新上传图片'); } }
    })();
    return () => { alive = false; mounted.current = false; generation.current++; if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url); previous?.focus(); };
  }, [bookmarkId]);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); if (busyRef.current || !sourceRef.current) return; setCrop(c => geometry(sourceRef.current!.width, sourceRef.current!.height, { ...c, zoom: c.zoom + (e.deltaY < 0 ? .1 : -.1) }).crop); setDirty(true); };
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel);
  }, []);
  const change = (next: Crop) => { if (!source || busy) return; setCrop(geometry(source.width, source.height, next).crop); setDirty(true); };
  async function save() {
    if (!source || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const result = await exportCover(source.blob, crop, source.originalSize);
      await saveCustomCover(bookmarkId, { ...result, source: source.blob, crop });
      const delta = result.reduction >= 0 ? `压缩 ${result.reduction.toFixed(1)}%` : `体积增加 ${Math.abs(result.reduction).toFixed(1)}%（保留 960×540 构图）`;
      report(`封面已保存：${sizeLabel(result.originalSize)} → ${sizeLabel(result.finalSize)}，${delta}${result.finalSize > 300 * 1024 ? '；为保留清晰度未压至 300KB' : ''}`);
      setDirty(false); onClose();
    } catch (e) { setError(`${e instanceof Error ? e.message : '保存失败'}；旧封面未改变，请重试。`); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const g = source ? geometry(source.width, source.height, crop) : undefined;
  return createPortal(<dialog ref={dialog} className="cover-editor" aria-labelledby="cover-editor-title" onCancel={e => { e.preventDefault(); close(); }} onPaste={e => { const file = Array.from(e.clipboardData.files).find(f => f.type.startsWith('image/')); if (file) { e.preventDefault(); if (!busy) void load(file, false); } }}>
    <div className="editor-heading"><div><h2 id="cover-editor-title">编辑封面</h2><p title={title}>{title}</p></div><button className="icon" disabled={busy} aria-label="关闭封面编辑器" onClick={close}><X size={19}/></button></div>
    <div ref={viewport} className="editor-viewport" tabIndex={0} aria-label="封面预览，拖动或方向键调整位置，滚轮缩放" onDragOver={e => { e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (!busy && e.dataTransfer.files.length === 1) void load(e.dataTransfer.files[0]!, false); }} onKeyDown={e => { const movements: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }; const move = movements[e.key]; if (move) { e.preventDefault(); change({ ...crop, x: crop.x + move[0], y: crop.y + move[1] }); } }} onPointerDown={e => { if (!source || busy) return; e.currentTarget.setPointerCapture(e.pointerId); pointer.current = { x: e.clientX, y: e.clientY, crop }; }} onPointerMove={e => { const p = pointer.current; if (!p || busy) return; const ratio = 960 / e.currentTarget.clientWidth; change({ ...p.crop, x: p.crop.x + (e.clientX - p.x) * ratio, y: p.crop.y + (e.clientY - p.y) * ratio }); }} onPointerUp={() => { pointer.current = undefined; }} onPointerCancel={() => { pointer.current = undefined; }}>
      {source && g ? <img draggable={false} src={source.url} alt="封面构图预览" style={{ width: `${g.width / 960 * 100}%`, height: `${g.height / 540 * 100}%`, left: `${g.left / 960 * 100}%`, top: `${g.top / 540 * 100}%` }}/> : <span>选择图片，或拖入 / 粘贴 JPG、PNG、WebP</span>}
      {busy && <div className="editor-loading" role="status"><RefreshCw className="spin" size={20}/>正在处理图片…</div>}
    </div>
    <div className="editor-controls"><label>缩放 <input type="range" min="1" max="3" step="0.01" value={crop.zoom} disabled={!source || busy} onChange={e => change({ ...crop, zoom: Number(e.target.value) })}/><output>{Math.round(crop.zoom * 100)}%</output></label><label>填充方式<select disabled={!source || busy} value={crop.mode} onChange={e => change({ ...defaultCrop, mode: e.target.value as Crop['mode'] })}><option value="cover">填满卡片</option><option value="contain">完整显示</option></select></label></div>
    <p className="editor-help">拖动定位 · 滚轮缩放 · 方向键微调 · Cmd/Ctrl+V 粘贴。完整显示模式的留边会保存为深色背景。</p>
    {error && <p className="editor-error" role="alert">{error}</p>}
    <div className="editor-actions"><button disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={16}/>上传图片</button><button disabled={!source || busy} onClick={() => change(defaultCrop)}>重置</button><span/><button disabled={busy} onClick={close}>取消</button><button className="editor-save" disabled={!source || busy} onClick={() => void save()}>{busy ? '处理中…' : '保存封面'}</button></div>
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) void load(file, false); e.target.value = ''; }}/>
  </dialog>, document.body);
}
