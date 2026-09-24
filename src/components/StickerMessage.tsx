import { faDownload } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';

import { useMediaUrl } from '../features/media/useMediaUrl';
import { saveSticker } from '../features/stickers/api';
import { getSavedStickerKeys, invalidateSavedStickerKeys } from '../features/stickers/savedKeysCache';
import { Icon } from './Icon';

/** WhatsApp renders a sticker with no bubble chrome at all — just the image floating on the wallpaper — unlike every other message type. Shows a "save to my stickers" button unless it's already in the viewer's own collection. */
export function StickerMessage({ objectKey }: { objectKey: string }) {
  const url = useMediaUrl(objectKey);
  const [isSaved, setIsSaved] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSavedStickerKeys().then((keys) => {
      if (!cancelled) setIsSaved(keys.has(objectKey));
    });
    return () => {
      cancelled = true;
    };
  }, [objectKey]);

  async function handleSave() {
    setIsSaved(true);
    try {
      await saveSticker(objectKey);
      invalidateSavedStickerKeys();
    } catch {
      setIsSaved(false);
    }
  }

  return (
    <div className="sticker-message">
      {url && <img src={url} alt="Sticker" />}
      {isSaved === false && (
        <button type="button" className="sticker-message-save" title="Save sticker" onClick={handleSave}>
          <Icon icon={faDownload} />
        </button>
      )}
    </div>
  );
}
