import { useEffect, useState } from 'react';

import { clearAllCached, getCacheSoftLimit, getTotalCachedMessages, onCacheSizeChanged } from '../features/messaging/messageCache';

/**
 * A simple, portable proxy for actual memory pressure: performance.memory
 * is Chrome-only and non-standard, so this tracks the total number of
 * messages held across every conversation's in-memory cache (see
 * messageCache.ts) instead. Crossing the soft limit blurs the app and
 * offers to drop the whole cache — the next visit to any conversation then
 * starts fresh from its own 24h window again, same as a first-ever visit.
 */
export function MemoryPressureGate() {
  const [total, setTotal] = useState(getTotalCachedMessages());
  const [dismissedAt, setDismissedAt] = useState(0);

  useEffect(() => onCacheSizeChanged(setTotal), []);

  const softLimit = getCacheSoftLimit();
  // Re-prompts only once the total has grown meaningfully past wherever the
  // user last dismissed it (another whole soft-limit's worth), not on the
  // very next message — dismissedAt alone would otherwise reopen this
  // almost immediately once cache growth resumes.
  const overLimit = total >= softLimit && total >= dismissedAt + softLimit;

  if (!overLimit) return null;

  return (
    <div className="memory-pressure-backdrop">
      <div className="modal-card" style={{ maxWidth: 380, textAlign: 'center' }}>
        <h3 style={{ marginTop: 0 }}>Free up some memory?</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
          You've built up a lot of cached conversation history in this tab ({total.toLocaleString()} messages). Clearing it
          won't delete anything from your account — each conversation just reloads its most recent messages the next time you
          open it.
        </p>
        <button
          className="button"
          onClick={() => {
            clearAllCached();
            setDismissedAt(0);
          }}
        >
          Clear cached conversations
        </button>
        <button className="link-button secondary" style={{ marginTop: 8 }} onClick={() => setDismissedAt(total)}>
          Not now
        </button>
      </div>
    </div>
  );
}
