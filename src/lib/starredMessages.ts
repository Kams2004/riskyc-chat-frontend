/**
 * Message starring is local-only on mobile too (plain SQLite rows, never
 * synced to the server — see mobile's data/db.ts starMessage/unstarMessage),
 * so localStorage is the right web equivalent: a per-device bookmark set,
 * not shared state.
 */
const STORAGE_KEY = 'riskyc.starredMessageIds';

function readAll(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeAll(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Private browsing / storage disabled — starring just won't persist across reloads, not worth surfacing an error for.
  }
}

export function isStarred(messageId: string): boolean {
  return readAll().has(messageId);
}

export function star(messageId: string) {
  const ids = readAll();
  ids.add(messageId);
  writeAll(ids);
}

export function unstar(messageId: string) {
  const ids = readAll();
  ids.delete(messageId);
  writeAll(ids);
}
