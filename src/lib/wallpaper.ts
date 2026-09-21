import { useEffect, useState } from 'react';

export type WallpaperVariant = 'dots' | 'doodle' | 'plain';

const STORAGE_KEY = 'riskyc.wallpaperVariant';
const CHANGE_EVENT = 'riskyc:wallpaperChanged';

function readVariant(): WallpaperVariant {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dots' || stored === 'doodle' || stored === 'plain') return stored;
  } catch {
    // Private browsing / storage disabled — falls through to the default below.
  }
  return 'doodle';
}

/** Per-device only (localStorage), same as mobile's own wallpaper preference — not synced across devices. Broadcasts a same-tab event so every ChatWallpaper consumer (there's normally just the one open thread) updates immediately when Settings changes it. */
export function setWallpaperVariant(variant: WallpaperVariant) {
  try {
    localStorage.setItem(STORAGE_KEY, variant);
  } catch {
    // Ignored — the in-memory state below still updates for this tab even if persistence fails.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: variant }));
}

export function useWallpaperVariant(): WallpaperVariant {
  const [variant, setVariant] = useState<WallpaperVariant>(readVariant);

  useEffect(() => {
    function onChange(e: Event) {
      setVariant((e as CustomEvent<WallpaperVariant>).detail);
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  return variant;
}
