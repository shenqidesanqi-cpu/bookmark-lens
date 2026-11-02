const TARGET = 300 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export type CompressionResult = { blob: Blob; originalSize: number; finalSize: number; width: number; height: number; reduction: number };
export function validateImage(file: Blob) {
  if (!TYPES.has(file.type)) throw new Error('仅支持 JPG、PNG 和 WebP 图片');
  if (!file.size) throw new Error('图片文件为空');
  if (file.size > 30 * 1024 * 1024) throw new Error('图片过大，请选择 30MB 以内的图片');
}
export function outputSize(width: number, height: number) {
  if (width <= 0 || height <= 0 || !Number.isFinite(width + height)) throw new Error('无效的图片尺寸');
  const scale = Math.min(1, 1200 / width);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function sizeLabel(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)}MB` : `${(bytes / 1024).toFixed(1)}KB`; }
/** Six bounded attempts; no cropping, no upscaling, quality floor 0.65. */
export async function compressImage(file: Blob): Promise<CompressionResult> {
  validateImage(file);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('图片无法解码，文件可能已损坏'); }
  try {
    if (bitmap.width * bitmap.height > 48_000_000) throw new Error('图片分辨率过大，请选择 4800 万像素以内的图片');
    const initial = outputSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法处理图片');
    let best: { blob: Blob; width: number; height: number } | undefined;
    const steps = [{ scale: 1, quality: .8 }, { scale: 1, quality: .72 }, { scale: 1, quality: .65 }, { scale: .85, quality: .75 }, { scale: .7, quality: .72 }, { scale: .6, quality: .7 }];
    for (const step of steps) {
      canvas.width = Math.max(1, Math.round(initial.width * step.scale));
      canvas.height = Math.max(1, Math.round(initial.height * step.scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片压缩失败')), 'image/webp', step.quality));
      if (!best || blob.size < best.blob.size) best = { blob, width: canvas.width, height: canvas.height };
      if (blob.size <= TARGET) break;
    }
    if (!best) throw new Error('图片压缩失败');
    // Keep the original when it already meets dimensions and is smaller.
    if (bitmap.width <= 1200 && file.size <= best.blob.size) best = { blob: file, width: bitmap.width, height: bitmap.height };
    return { ...best, originalSize: file.size, finalSize: best.blob.size, reduction: Math.max(0, (1 - best.blob.size / file.size) * 100) };
  } finally { bitmap.close(); }
}
