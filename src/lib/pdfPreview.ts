/**
 * Renders a PDF's first page to a PNG data URL — just enough for a
 * pre-send "yes, this is the right file" glance, not a full PDF viewer.
 * Returns null on any failure (corrupt file, password-protected, etc.) so
 * callers can fall back to a plain file-icon preview instead.
 *
 * pdfjs-dist (plus its ~1.2MB worker) is dynamically imported here rather
 * than at module scope — it was previously pulled into the main bundle,
 * nearly doubling the app's initial JS payload for every visitor even
 * though this only ever runs when someone picks a PDF to send.
 */
export async function renderPdfFirstPage(file: File, maxWidth = 480): Promise<string | null> {
  try {
    const [pdfjsLib, workerUrlModule] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = maxWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    if (!context) return null;

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
