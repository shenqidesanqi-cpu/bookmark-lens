import type { CompressionResult } from './image-compression';
export type Crop = { zoom: number; x: number; y: number; mode: 'cover' | 'contain' };
export const defaultCrop: Crop = { zoom: 1, x: 0, y: 0, mode: 'cover' };
export function geometry(width: number, height: number, crop: Crop) {
  const zoom = Math.max(1, Math.min(3, crop.zoom));
  const scale = (crop.mode === 'cover' ? Math.max(960 / width, 540 / height) : Math.min(960 / width, 540 / height)) * zoom;
  const w = width * scale, h = height * scale;
  const limitX = Math.max(0, (w - 960) / 2), limitY = Math.max(0, (h - 540) / 2);
  const x = Math.max(-limitX, Math.min(limitX, crop.x)), y = Math.max(-limitY, Math.min(limitY, crop.y));
  return { width: w, height: h, left: (960 - w) / 2 + x, top: (540 - h) / 2 + y, crop: { ...crop, zoom, x, y } };
}
export async function exportCover(source: Blob, crop: Crop, originalSize: number): Promise<CompressionResult> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = typeof document === 'undefined' ? new OffscreenCanvas(960,540) : document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null; if (!ctx) throw new Error('浏览器无法导出封面');
    ctx.fillStyle = '#18181b'; ctx.fillRect(0, 0, 960, 540);
    const g = geometry(bitmap.width, bitmap.height, crop);
    ctx.drawImage(bitmap, g.left, g.top, g.width, g.height);
    let best: Blob | undefined;
    for (const quality of [.8, .72, .65]) {
      const blob = await new Promise<Blob | null>(resolve => 'convertToBlob' in canvas ? canvas.convertToBlob({type:'image/webp',quality}).then(resolve).catch(()=>resolve(null)) : canvas.toBlob(resolve, 'image/webp', quality));
      if (blob && (!best || blob.size < best.size)) best = blob;
      if (blob && blob.size <= 300 * 1024) break;
    }
    // Keep the composition even if the preferred encoder is unavailable.
    if (!best) best = await new Promise<Blob | null>(resolve => 'convertToBlob' in canvas ? canvas.convertToBlob({type:'image/png'}).then(resolve).catch(()=>resolve(null)) : canvas.toBlob(resolve, 'image/png')) ?? undefined;
    if (!best) throw new Error('封面导出失败，请保留编辑内容并重试');
    return { blob: best, width: 960, height: 540, originalSize, finalSize: best.size, reduction: (1 - best.size / originalSize) * 100 };
  } finally { bitmap.close(); }
}
