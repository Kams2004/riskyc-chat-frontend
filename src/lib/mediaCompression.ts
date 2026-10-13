/** Hard cap on anything sent as a chat attachment — large files slow everyone down and bloat storage long after the chat moves on. Mirrors mobile's mediaCompression.ts. */
export const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

/** Longest edge an outgoing chat image is resized to — see mobile's mediaCompression.ts for the same constant/reasoning. */
const MAX_IMAGE_DIMENSION = 1920;
const IMAGE_COMPRESS_QUALITY = 0.72;

export function exceedsMediaSizeLimit(bytes: number | null | undefined): boolean {
  return typeof bytes === 'number' && bytes > MAX_MEDIA_BYTES;
}

/**
 * Resizes (if larger than MAX_IMAGE_DIMENSION on its longest edge) and
 * re-compresses a picked image file entirely in the browser — a
 * `<canvas>` draw + `toBlob` pass, no server round trip and no new
 * dependency, so this stays fast (milliseconds to low-hundreds-of-ms even
 * for a large photo) and never touches the device's actual storage, just
 * in-memory `Blob`s the browser already garbage-collects once the upload
 * finishes.
 *
 * Falls back to the original file on any failure (decode error, an
 * unusual format `<canvas>` can't draw) — compression is a size
 * optimization, never something that should block a send that would
 * otherwise have worked fine uncompressed.
 */
export async function compressImageForSend(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_COMPRESS_QUALITY));
    if (!blob) return file;
    // Smaller-or-equal only — a tiny/already-compressed source image can
    // come back larger after a fresh JPEG re-encode; no point swapping in
    // a worse file than what was picked.
    if (blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^./\\]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch (e) {
    console.warn('[mediaCompression] image compression failed, sending original', e);
    return file;
  }
}
