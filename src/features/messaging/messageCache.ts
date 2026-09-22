import type { MessageEnvelope } from './api';

/**
 * In-memory, module-level cache of loaded messages per conversation —
 * web has no local SQLite mirror the way mobile does, so re-entering a
 * conversation previously fetched this session should show what's already
 * there instantly rather than re-fetching from scratch (see
 * useConversation.ts). Paired with time-windowed fetching (24h initial,
 * 12h increments going backward — see MessageHistoryController#history's
 * since/until params) so a long-lived thread never pulls its entire
 * history in one request.
 *
 * Deliberately NOT persisted to localStorage/IndexedDB — this is a
 * same-session convenience, not an offline store; a reload starts fresh,
 * same as the rest of this web client's session-only caches (see
 * useConversationList.ts's own nameCache).
 */
const INITIAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const INCREMENT_WINDOW_MS = 12 * 60 * 60 * 1000;
/** Bounded retries when a 12h window comes back empty — a quiet stretch of the thread shouldn't look like "no more history" after just one empty page. */
const MAX_EMPTY_WINDOW_RETRIES = 6;
/** Total messages cached across every conversation before the memory-pressure prompt fires — a simple, portable proxy for actual browser memory (performance.memory is Chrome-only and non-standard). */
const TOTAL_MESSAGE_SOFT_LIMIT = 4000;

type ConversationCache = {
  messages: MessageEnvelope[];
  /** The inclusive lower bound (ISO) of what's currently loaded — "load more" fetches further back from here. */
  oldestLoadedAt: string;
  /** True once a fetch going further back returned nothing for MAX_EMPTY_WINDOW_RETRIES windows in a row — no more "load more" needed. */
  reachedStart: boolean;
};

const cache = new Map<string, ConversationCache>();
let totalCachedMessages = 0;
const totalListeners = new Set<(total: number) => void>();

function recomputeTotal() {
  totalCachedMessages = 0;
  for (const entry of cache.values()) totalCachedMessages += entry.messages.length;
  for (const listener of totalListeners) listener(totalCachedMessages);
}

export function onCacheSizeChanged(listener: (total: number) => void): () => void {
  totalListeners.add(listener);
  return () => totalListeners.delete(listener);
}

export function getCacheSoftLimit(): number {
  return TOTAL_MESSAGE_SOFT_LIMIT;
}

export function initialWindowSince(): string {
  return new Date(Date.now() - INITIAL_WINDOW_MS).toISOString();
}

export function nextWindowBounds(conversationId: string): { since: string; until: string } | null {
  const entry = cache.get(conversationId);
  if (!entry || entry.reachedStart) return null;
  const until = entry.oldestLoadedAt;
  const since = new Date(new Date(until).getTime() - INCREMENT_WINDOW_MS).toISOString();
  return { since, until };
}

export function getCached(conversationId: string): MessageEnvelope[] | null {
  return cache.get(conversationId)?.messages ?? null;
}

export function hasReachedStart(conversationId: string): boolean {
  return cache.get(conversationId)?.reachedStart ?? false;
}

/** Seeds or replaces the cache for a conversation with an initial (24h) fetch result. */
export function seedCache(conversationId: string, messages: MessageEnvelope[], sinceIso: string) {
  cache.set(conversationId, {
    messages: messages.slice().sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    oldestLoadedAt: sinceIso,
    reachedStart: false,
  });
  recomputeTotal();
}

/** Merges a live/catch-up fetch's results into the existing cached list without disturbing oldestLoadedAt/reachedStart. */
export function mergeCached(conversationId: string, messages: MessageEnvelope[]) {
  const entry = cache.get(conversationId);
  if (!entry) return;
  const byId = new Map(entry.messages.map((m) => [m.messageId, m]));
  for (const m of messages) byId.set(m.messageId, m);
  entry.messages = [...byId.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  recomputeTotal();
}

/** Prepends an older window fetched via "load more" — emptyWindowCount lets the caller retry a few consecutive empty windows before giving up (see MAX_EMPTY_WINDOW_RETRIES). */
export function prependOlder(conversationId: string, olderMessages: MessageEnvelope[], newSinceIso: string, emptyWindowCount: number) {
  const entry = cache.get(conversationId);
  if (!entry) return;
  if (olderMessages.length > 0) {
    const byId = new Map(olderMessages.map((m) => [m.messageId, m]));
    for (const m of entry.messages) byId.set(m.messageId, m);
    entry.messages = [...byId.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }
  entry.oldestLoadedAt = newSinceIso;
  if (olderMessages.length === 0 && emptyWindowCount >= MAX_EMPTY_WINDOW_RETRIES) {
    entry.reachedStart = true;
  }
  recomputeTotal();
}

export function upsertLive(conversationId: string, envelope: MessageEnvelope) {
  const entry = cache.get(conversationId);
  if (!entry) return;
  const idx = entry.messages.findIndex((m) => m.messageId === envelope.messageId);
  if (idx === -1) entry.messages = [...entry.messages, envelope].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  else entry.messages = entry.messages.map((m, i) => (i === idx ? envelope : m));
  recomputeTotal();
}

export function removeFromCache(conversationId: string, messageId: string) {
  const entry = cache.get(conversationId);
  if (!entry) return;
  entry.messages = entry.messages.filter((m) => m.messageId !== messageId);
  recomputeTotal();
}

/** The memory-pressure "clear cache" action — drops everything, so the next visit to any conversation starts from a fresh 24h window again. */
export function clearAllCached() {
  cache.clear();
  recomputeTotal();
}

export function getTotalCachedMessages(): number {
  return totalCachedMessages;
}
