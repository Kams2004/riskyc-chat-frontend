import { faCheck, faCrop, faPenNib, faRotateRight, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';

import { EMPTY_OVERLAY, type DrawStroke, type StatusOverlay } from '../lib/overlay';
import { Icon } from './Icon';
import { OverlayView } from './OverlayView';

const DRAW_COLORS = ['#ffffff', '#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#00bcd4', '#2196f3', '#9c27b0', '#000000'];

type Tool = 'crop' | 'rotate' | 'draw';
type CropRect = { x: number; y: number; width: number; height: number }; // fractional, 0-1

/** Renders a File onto a canvas and resolves a new File from the result — shared by both rotate and crop-apply. */
async function canvasToFile(canvas: HTMLCanvasElement, sourceFile: File): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas export failed'));
          return;
        }
        resolve(new File([blob], sourceFile.name, { type: blob.type || sourceFile.type }));
      },
      sourceFile.type === 'image/png' ? 'image/png' : 'image/jpeg',
      0.92
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

type ImageEditorProps = {
  file: File;
  initialOverlay: StatusOverlay;
  onCancel: () => void;
  onConfirm: (result: { file: File; overlay: StatusOverlay }) => void;
};

/**
 * Crop and rotate bake new pixels client-side (canvas), each applied
 * immediately on confirm rather than deferred — so later crop math always
 * works against the current, already-rotated image instead of needing
 * combined-transform bookkeeping. Drawing stays non-destructive (an
 * overlay, composited at view time — see OverlayView), matching the
 * existing convention Status already uses for the exact same reason.
 */
export function ImageEditor({ file, initialOverlay, onCancel, onConfirm }: ImageEditorProps) {
  const [workingFile, setWorkingFile] = useState(file);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('draw');
  const [overlay, setOverlay] = useState<StatusOverlay>(initialOverlay);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const drawingStrokeRef = useRef<DrawStroke | null>(null);
  const cropDragRef = useRef<{ mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; start: CropRect } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(workingFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [workingFile]);

  async function applyRotate() {
    if (!objectUrl || isProcessing) return;
    setIsProcessing(true);
    try {
      const img = await loadImage(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const rotated = await canvasToFile(canvas, workingFile);
      setWorkingFile(rotated);
      setCropRect({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
    } finally {
      setIsProcessing(false);
    }
  }

  async function applyCrop() {
    if (!objectUrl || isProcessing) return;
    setIsProcessing(true);
    try {
      const img = await loadImage(objectUrl);
      const sx = cropRect.x * img.naturalWidth;
      const sy = cropRect.y * img.naturalHeight;
      const sw = cropRect.width * img.naturalWidth;
      const sh = cropRect.height * img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const cropped = await canvasToFile(canvas, workingFile);
      setWorkingFile(cropped);
      setCropRect({ x: 0, y: 0, width: 1, height: 1 });
      // A crop shifts everything drawn so far out from under its old
      // coordinates — rather than trying to remap strokes into the new
      // frame, clear them; re-drawing after crop is confirming is
      // cheap and unambiguous.
      setOverlay(EMPTY_OVERLAY);
    } finally {
      setIsProcessing(false);
    }
  }

  function pointFromEvent(e: React.PointerEvent): { x: number; y: number } | null {
    const box = imageBoxRef.current;
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function handleDrawStart(e: React.PointerEvent) {
    if (tool !== 'draw') return;
    const p = pointFromEvent(e);
    if (!p) return;
    const stroke: DrawStroke = { color: drawColor, points: [p] };
    drawingStrokeRef.current = stroke;
    setOverlay((prev) => ({ ...prev, strokes: [...prev.strokes, stroke] }));
  }

  function handleDrawMove(e: React.PointerEvent) {
    if (tool !== 'draw' || !drawingStrokeRef.current) return;
    const p = pointFromEvent(e);
    if (!p) return;
    drawingStrokeRef.current.points.push(p);
    setOverlay((prev) => ({ ...prev, strokes: [...prev.strokes.slice(0, -1), { ...drawingStrokeRef.current! }] }));
  }

  function handleDrawEnd() {
    drawingStrokeRef.current = null;
  }

  function handleCropHandleDown(mode: 'move' | 'nw' | 'ne' | 'sw' | 'se', e: React.PointerEvent) {
    e.stopPropagation();
    const p = pointFromEvent(e);
    if (!p) return;
    cropDragRef.current = { mode, startX: p.x, startY: p.y, start: cropRect };
  }

  function handleCropMove(e: React.PointerEvent) {
    const drag = cropDragRef.current;
    if (!drag) return;
    const p = pointFromEvent(e);
    if (!p) return;
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    const MIN = 0.08;
    setCropRect(() => {
      const s = drag.start;
      if (drag.mode === 'move') {
        const x = Math.max(0, Math.min(1 - s.width, s.x + dx));
        const y = Math.max(0, Math.min(1 - s.height, s.y + dy));
        return { ...s, x, y };
      }
      let { x, y, width, height } = s;
      if (drag.mode === 'nw' || drag.mode === 'sw') {
        const newX = Math.max(0, Math.min(s.x + s.width - MIN, s.x + dx));
        width = s.x + s.width - newX;
        x = newX;
      } else {
        width = Math.max(MIN, Math.min(1 - s.x, s.width + dx));
      }
      if (drag.mode === 'nw' || drag.mode === 'ne') {
        const newY = Math.max(0, Math.min(s.y + s.height - MIN, s.y + dy));
        height = s.y + s.height - newY;
        y = newY;
      } else {
        height = Math.max(MIN, Math.min(1 - s.y, s.height + dy));
      }
      return { x, y, width, height };
    });
  }

  function handleCropUp() {
    cropDragRef.current = null;
  }

  function handleDone() {
    onConfirm({ file: workingFile, overlay });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="image-editor" onClick={(e) => e.stopPropagation()}>
        <div className="image-editor-toolbar">
          <button type="button" className="icon-button" onClick={onCancel} title="Cancel">
            <Icon icon={faXmark} />
          </button>
          <div className="image-editor-tools">
            <button type="button" className={`image-editor-tool ${tool === 'crop' ? 'active' : ''}`} onClick={() => setTool('crop')}>
              <Icon icon={faCrop} /> Crop
            </button>
            <button type="button" className={`image-editor-tool ${tool === 'rotate' ? 'active' : ''}`} onClick={() => setTool('rotate')}>
              <Icon icon={faRotateRight} /> Rotate
            </button>
            <button type="button" className={`image-editor-tool ${tool === 'draw' ? 'active' : ''}`} onClick={() => setTool('draw')}>
              <Icon icon={faPenNib} /> Draw
            </button>
          </div>
          <button type="button" className="icon-button image-editor-done" onClick={handleDone} title="Done">
            <Icon icon={faCheck} />
          </button>
        </div>

        <div
          className="image-editor-canvas"
          ref={imageBoxRef}
          onPointerDown={tool === 'draw' ? handleDrawStart : undefined}
          onPointerMove={(e) => {
            handleDrawMove(e);
            handleCropMove(e);
          }}
          onPointerUp={() => {
            handleDrawEnd();
            handleCropUp();
          }}
          onPointerLeave={() => {
            handleDrawEnd();
            handleCropUp();
          }}
        >
          {objectUrl && <img src={objectUrl} alt="" draggable={false} />}
          <OverlayView overlay={overlay} />

          {tool === 'crop' && (
            <div
              className="image-editor-crop-rect"
              style={{
                left: `${cropRect.x * 100}%`,
                top: `${cropRect.y * 100}%`,
                width: `${cropRect.width * 100}%`,
                height: `${cropRect.height * 100}%`,
              }}
              onPointerDown={(e) => handleCropHandleDown('move', e)}
            >
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <div
                  key={corner}
                  className={`image-editor-crop-handle ${corner}`}
                  onPointerDown={(e) => handleCropHandleDown(corner, e)}
                />
              ))}
            </div>
          )}
        </div>

        {tool === 'rotate' && (
          <div className="image-editor-actions">
            <button type="button" className="link-button" onClick={applyRotate} disabled={isProcessing}>
              <Icon icon={faRotateRight} /> Rotate 90°
            </button>
          </div>
        )}

        {tool === 'crop' && (
          <div className="image-editor-actions">
            <button type="button" className="link-button" onClick={applyCrop} disabled={isProcessing}>
              <Icon icon={faCheck} /> Apply crop
            </button>
          </div>
        )}

        {tool === 'draw' && (
          <div className="image-editor-actions image-editor-swatches">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`status-bg-swatch ${drawColor === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setDrawColor(c)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
