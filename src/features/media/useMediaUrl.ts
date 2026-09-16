import { useEffect, useState } from 'react';

import { createDownloadUrl } from './api';

const urlCache = new Map<string, string>();

/** Ported from mobile's useMediaUrl.ts — same presigned-URL session cache. */
export function useMediaUrl(objectKey?: string | null): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(objectKey ? (urlCache.get(objectKey) ?? null) : null);

  useEffect(() => {
    if (!objectKey) {
      setResolvedUrl(null);
      return;
    }
    const cached = urlCache.get(objectKey);
    if (cached) {
      setResolvedUrl(cached);
      return;
    }
    let cancelled = false;
    createDownloadUrl(objectKey)
      .then(({ downloadUrl }) => {
        urlCache.set(objectKey, downloadUrl);
        if (!cancelled) setResolvedUrl(downloadUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [objectKey]);

  return resolvedUrl;
}
