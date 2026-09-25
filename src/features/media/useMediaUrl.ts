import { useCallback, useEffect, useState } from 'react';

import { createDownloadUrl } from './api';

const urlCache = new Map<string, string>();

// A presigned download URL is only valid ~15min and gets a fresh signature
// on every re-request, so it can never be used as a persistent cache key —
// but the underlying object it points to is immutable and named by a stable
// UUID objectKey forever. Caching the actual bytes in the Cache Storage API
// under a synthetic same-origin URL built from that objectKey means leaving
// a conversation and coming back (even after a full page reload) shows
// already-downloaded media straight from disk with no network fetch at all,
// instead of re-fetching every time a message list remounts a tile — the
// concrete gap this was built to close. Mobile does the same thing with a
// local file under FileSystem's cache directory (see useMediaUrl.ts there).
const MEDIA_CACHE_NAME = 'riskyc-media-v1';
const blobUrlCache = new Map<string, string>();
const supportsCacheStorage = typeof caches !== 'undefined';

function cacheKeyFor(objectKey: string): string {
  return `${location.origin}/__riskyc_media_cache__/${objectKey}`;
}

async function resolveLocalUrl(objectKey: string, presignedUrl: string): Promise<string> {
  const existing = blobUrlCache.get(objectKey);
  if (existing) return existing;
  if (!supportsCacheStorage) return presignedUrl;

  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const cacheKey = cacheKeyFor(objectKey);
    let response = await cache.match(cacheKey);
    if (!response) {
      const fetched = await fetch(presignedUrl);
      if (!fetched.ok) throw new Error(`media fetch failed: ${fetched.status}`);
      await cache.put(cacheKey, fetched.clone());
      response = fetched;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    blobUrlCache.set(objectKey, objectUrl);
    return objectUrl;
  } catch (e) {
    // Cache Storage unavailable/quota-full/network hiccup mid-cache — the
    // presigned URL still works directly, just without the local-cache win.
    console.warn('[useMediaUrl] local media cache failed, using direct URL', e);
    return presignedUrl;
  }
}

/** Ported from mobile's useMediaUrl.ts — same presigned-URL session cache, now backed by a persistent local blob cache (see resolveLocalUrl above). */
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
      .then(async ({ downloadUrl }) => {
        const localUrl = await resolveLocalUrl(objectKey, downloadUrl);
        urlCache.set(objectKey, localUrl);
        if (!cancelled) setResolvedUrl(localUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [objectKey]);

  return resolvedUrl;
}

export type MediaUrlStatus = 'loading' | 'error' | 'ready';

/**
 * Like useMediaUrl, but surfaces a distinguishable error state and a retry
 * trigger instead of leaving a failed resolve looking identical to a
 * still-loading one — used by message attachment tiles specifically, which
 * need to show a skeleton while loading and a clickable "Retry" on failure
 * rather than a permanently-empty box. Kept separate from useMediaUrl
 * (rather than changing its return shape) so the other, unrelated call
 * sites (avatars, voice player, stickers, ...) don't all need updating for
 * a UI need only attachment tiles actually have.
 */
export function useMediaUrlWithStatus(objectKey?: string | null): {
  url: string | null;
  status: MediaUrlStatus;
  retry: () => void;
} {
  const [url, setUrl] = useState<string | null>(objectKey ? (urlCache.get(objectKey) ?? null) : null);
  const [status, setStatus] = useState<MediaUrlStatus>(url ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!objectKey) {
      setUrl(null);
      setStatus('loading');
      return;
    }
    const cached = attempt === 0 ? urlCache.get(objectKey) : undefined;
    if (cached) {
      setUrl(cached);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    let cancelled = false;
    createDownloadUrl(objectKey)
      .then(async ({ downloadUrl }) => {
        const localUrl = await resolveLocalUrl(objectKey, downloadUrl);
        urlCache.set(objectKey, localUrl);
        if (!cancelled) {
          setUrl(localUrl);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [objectKey, attempt]);

  const retry = useCallback(() => {
    if (objectKey) {
      urlCache.delete(objectKey);
      blobUrlCache.delete(objectKey);
      if (supportsCacheStorage) {
        caches.open(MEDIA_CACHE_NAME).then((cache) => cache.delete(cacheKeyFor(objectKey))).catch(() => {});
      }
    }
    setAttempt((a) => a + 1);
  }, [objectKey]);

  return { url, status, retry };
}
