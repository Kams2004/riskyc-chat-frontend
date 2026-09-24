import { faCheck, faCrop, faFont, faPenNib, faRotateRight, faWandMagicSparkles, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';

import { EMPTY_OVERLAY, isOverlayEmpty, type DrawStroke, type StatusOverlay } from '../lib/overlay';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';
import { OverlayView } from './OverlayView';

const DRAW_COLORS = ['#ffffff', '#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#00bcd4', '#2196f3', '#9c27b0', '#000000'];

type Tool = 'crop' | 'rotate' | 'draw' | 'text';
type CropRect = { x: number; y: number; width: number; height: number }; // fractional, 0-1

/** Renders a canvas onto a new File — shared by rotate/crop/enhance, each of which bakes its result immediately rather than deferring. */
async function canvasToFile(canvas: HTMLCanvasElement, sourceFile: File, hd: boolean): Promise<File> {
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
      hd ? 0.98 : 0.85
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
 * Crop, rotate, and auto-enhance bake new pixels client-side (canvas), each
 * applied immediately on confirm rather than deferred — so later crop math
 * always works against the current, already-transformed image instead of
 * needing combined-transform bookkeeping. Drawing and the text label stay
 * non-destructive (an overlay, composited at view time — see OverlayView),
 * matching the existing convention Status already uses for the exact same
 * reason.
 */
export function ImageEditor({ file, initialOverlay, onCancel, onConfirm }: ImageEditorProps) {
  const [workingFile, setWorkingFile] = useState(file);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [overlay, setOverlay] = useState<StatusOverlay>(initialOverlay);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHd, setIsHd] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const drawingStrokeRef = useRef<DrawStroke | null>(null);
  const cropDragRef = useRef<{ mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; start: CropRect } | null>(null);

  const hasUnsavedChanges = workingFile !== file || !isOverlayEmpty(overlay);

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
      const rotated = await canvasToFile(canvas, workingFile, isHd);
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
      const cropped = await canvasToFile(canvas, workingFile, isHd);
      setWorkingFile(cropped);
      setCropRect({ x: 0, y: 0, width: 1, height: 1 });
      // A crop shifts everything drawn so far out from under its old
      // coordinates — rather than trying to remap strokes into the new
      // frame, clear them; re-drawing after confirming crop is cheap and
      // unambiguous.
      setOverlay(EMPTY_OVERLAY);
    } finally {
      setIsProcessing(false);
    }
  }

  async function applyEnhance() {
    if (!objectUrl || isProcessing) return;
    setIsProcessing(true);
    try {
      const img = await loadImage(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // A modest, fixed contrast/saturation/brightness boost — not a real
      // auto-levels/histogram algorithm, just enough to visibly "pop" the
      // same way a one-tap phone-camera enhance does.
      ctx.filter = 'contrast(1.12) saturate(1.18) brightness(1.04)';
      ctx.drawImage(img, 0, 0);
      const enhanced = await canvasToFile(canvas, workingFile, isHd);
      setWorkingFile(enhanced);
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

  function handleCanvasDown(e: React.PointerEvent) {
    if (tool === 'draw') {
      const p = pointFromEvent(e);
      if (!p) return;
      const stroke: DrawStroke = { color: drawColor, points: [p] };
      drawingStrokeRef.current = stroke;
      setOverlay((prev) => ({ ...prev, strokes: [...prev.strokes, stroke] }));
    } else if (tool === 'text') {
      const p = pointFromEvent(e);
      if (!p) return;
      setTextDraft({ x: p.x, y: p.y, value: overlay.text?.text ?? '' });
    }
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

  function commitTextDraft() {
    if (!textDraft) return;
    const trimmed = textDraft.value.trim();
    setOverlay((prev) => ({
      ...prev,
      text: trimmed ? { text: trimmed, color: drawColor, x: textDraft.x, y: textDraft.y } : null,
    }));
    setTextDraft(null);
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

  function handleCloseClick() {
    if (hasUnsavedChanges) {
      setConfirmDiscard(true);
    } else {
      onCancel();
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleCloseClick}>
      <div className="image-editor" onClick={(e) => e.stopPropagation()}>
        <div className="image-editor-toolbar">
          <button type="button" className="icon-button" onClick={handleCloseClick} title="Cancel">
            <Icon icon={faXmark} />
          </button>
          <div className="image-editor-tools">
            <button type="button" className={`image-editor-tool ${tool === 'rotate' ? 'active' : ''}`} onClick={applyRotate} title="Rotate" disabled={isProcessing}>
              <Icon icon={faRotateRight} />
            </button>
            <button type="button" className={`image-editor-tool ${tool === 'crop' ? 'active' : ''}`} onClick={() => setTool(tool === 'crop' ? null : 'crop')} title="Crop">
              <Icon icon={faCrop} />
            </button>
            <button type="button" className="image-editor-tool" onClick={applyEnhance} title="Auto-enhance" disabled={isProcessing}>
              <Icon icon={faWandMagicSparkles} />
            </button>
            <button type="button" className={`image-editor-tool ${tool === 'draw' ? 'active' : ''}`} onClick={() => setTool(tool === 'draw' ? null : 'draw')} title="Draw">
              <Icon icon={faPenNib} />
            </button>
            <button type="button" className={`image-editor-tool ${tool === 'text' ? 'active' : ''}`} onClick={() => setTool(tool === 'text' ? null : 'text')} title="Add text">
              <Icon icon={faFont} />
            </button>
            <button
              type="button"
              className={`image-editor-tool image-editor-hd ${isHd ? 'active' : ''}`}
              onClick={() => setIsHd((v) => !v)}
              title="HD quality"
            >
              HD
            </button>
          </div>
          <button type="button" className="icon-button image-editor-done" onClick={handleDone} title="Done">
            <Icon icon={faCheck} />
          </button>
        </div>

        <div
          className="image-editor-canvas"
          ref={imageBoxRef}
          onPointerDown={tool === 'draw' || tool === 'text' ? handleCanvasDown : undefined}
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

          {textDraft && (
            <div
              className="image-editor-text-draft"
              style={{ left: `${textDraft.x * 100}%`, top: `${textDraft.y * 100}%` }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                value={textDraft.value}
                onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTextDraft();
                  if (e.key === 'Escape') setTextDraft(null);
                }}
                onBlur={commitTextDraft}
                style={{ color: drawColor }}
                placeholder="Type text"
              />
            </div>
          )}

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

        {tool === 'crop' && (
          <div className="image-editor-actions">
            <button type="button" className="link-button" onClick={applyCrop} disabled={isProcessing}>
              <Icon icon={faCheck} /> Apply crop
            </button>
          </div>
        )}

        {(tool === 'draw' || tool === 'text') && (
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

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard changes?"
          body="Your crop, rotation, drawing, or text will be lost."
          confirmLabel="Discard"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={onCancel}
        />
      )}
    </div>
  );
}
