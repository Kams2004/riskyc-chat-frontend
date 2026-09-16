/**
 * Same shape/defaults as mobile/src/lib/config.ts — see that file's comment
 * for the full rationale (plain HTTP/WS, non-standard ports, VPS defaults).
 * Vite inlines VITE_* vars at build time; override via .env.local for local
 * backend dev.
 */
export const config = {
  authServiceUrl: import.meta.env.VITE_AUTH_SERVICE_URL ?? 'http://167.86.120.214:8091',
  messagingServiceUrl: import.meta.env.VITE_MESSAGING_SERVICE_URL ?? 'http://167.86.120.214:8092',
  mediaServiceUrl: import.meta.env.VITE_MEDIA_SERVICE_URL ?? 'http://167.86.120.214:8083',
  presenceServiceUrl: import.meta.env.VITE_PRESENCE_SERVICE_URL ?? 'http://167.86.120.214:8084',
} as const;

/**
 * WebSocket has no way to attach a custom Authorization header at handshake
 * time, so the access token rides along as a query param instead —
 * messaging-service's WebSocketAuthInterceptor reads it from there. Same
 * mechanism as mobile's messagingWebSocketUrl.
 */
export function messagingWebSocketUrl(accessToken?: string | null): string {
  const base = `${config.messagingServiceUrl.replace(/^http/, 'ws')}/ws`;
  return accessToken ? `${base}?token=${encodeURIComponent(accessToken)}` : base;
}
