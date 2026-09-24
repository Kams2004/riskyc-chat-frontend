import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';

import { uploadMedia } from '../features/media/api';
import { useMediaUrl } from '../features/media/useMediaUrl';
import { deleteSavedSticker, listSavedStickers, saveSticker, type StickerItem } from '../features/stickers/api';
import { invalidateSavedStickerKeys } from '../features/stickers/savedKeysCache';
import { Icon } from './Icon';
import { Spinner } from './Spinner';

function StickerThumb({ objectKey, onPick, onDelete }: { objectKey: string; onPick: () => void; onDelete: () => void }) {
  const url = useMediaUrl(objectKey);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="sticker-thumb" onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}>
      <button type="button" className="sticker-thumb-button" onClick={onPick} title="Send sticker">
        {url ? <img src={url} alt="" /> : <div className="sticker-thumb-placeholder" />}
      </button>
      {menuOpen && (
        <div className="bubble-menu" style={{ top: '100%', left: 0 }} onMouseLeave={() => setMenuOpen(false)}>
          <button
            className="destructive"
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
          >
            <Icon icon={faTrash} /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * WhatsApp-style sticker tray — the signed-in user's own saved collection
 * (built up via "Create sticker" or by saving one someone sent, see
 * StickerMessage), not a curated built-in pack (no bundled sticker artwork
 * ships with this app). Docked in the composer next to the emoji/attach
 * controls, closes itself once a sticker is picked.
 */
export function StickerPicker({ onPick, onClose }: { onPick: (objectKey: string) => void; onClose: () => void }) {
  const [stickers, setStickers] = useState<StickerItem[] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    listSavedStickers()
      .then(setStickers)
      .catch(() => setStickers([]));
  }, []);

  async function handleCreateSticker(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploading(true);
    try {
      const objectKey = await uploadMedia(file);
      await saveSticker(objectKey);
      invalidateSavedStickerKeys();
      setStickers((prev) => [{ objectKey, savedAt: new Date().toISOString() }, ...(prev ?? [])]);
    } catch {
      window.alert('Could not create that sticker — please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(objectKey: string) {
    setStickers((prev) => (prev ?? []).filter((s) => s.objectKey !== objectKey));
    try {
      await deleteSavedSticker(objectKey);
      invalidateSavedStickerKeys();
    } catch {
      // Best-effort — a failed removal just means it reappears next time the tray reopens.
    }
  }

  return (
    <div className="sticker-picker" onMouseLeave={onClose}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCreateSticker} />
      <div className="sticker-picker-grid">
        <button
          type="button"
          className="sticker-thumb sticker-thumb-create"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Create sticker from an image"
        >
          {isUploading ? <Spinner size={20} /> : <Icon icon={faPlus} />}
        </button>
        {stickers === null && (
          <div className="loading-center" style={{ gridColumn: '1 / -1', padding: 16 }}>
            <Spinner size={22} />
          </div>
        )}
        {stickers !== null && stickers.length === 0 && (
          <p style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: 12.5, padding: '4px 2px' }}>
            No stickers yet — create one from a picture, or save one someone sends you.
          </p>
        )}
        {stickers?.map((s) => (
          <StickerThumb
            key={s.objectKey}
            objectKey={s.objectKey}
            onPick={() => onPick(s.objectKey)}
            onDelete={() => handleDelete(s.objectKey)}
          />
        ))}
      </div>
    </div>
  );
}
