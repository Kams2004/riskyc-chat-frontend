/**
 * Single-active-tab enforcement via BroadcastChannel — event-driven, no
 * localStorage-polling race window, purpose-built for "is another tab of
 * this app already open?" Feature-detected: on a browser without
 * BroadcastChannel this degrades to a harmless no-op (every tab just stays
 * active), never a hard failure.
 *
 * Protocol (all tabs of this origin share one channel):
 *  - 'claim'    a tab announces itself on mount, asking "is anyone else here?"
 *  - 'here'     an already-active tab's reply to a 'claim' it saw
 *  - 'takeover' a tab declaring itself the one to keep — every OTHER tab
 *               receiving this locks itself (renders a "in use elsewhere"
 *               state, since a tab can't reliably close itself unless it was
 *               opened via window.open).
 */
export const CHANNEL_NAME = 'riskyc-tab-lock';

export type TabLockMessage =
  | { type: 'claim'; from: string }
  | { type: 'here'; from: string }
  | { type: 'takeover'; from: string };

export function isTabLockSupported(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}

export function newTabId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
