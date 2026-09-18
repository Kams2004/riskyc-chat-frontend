/**
 * Same shape/defaults as mobile/src/lib/config.ts — see that file's comment
 * for the full rationale (real HTTPS/WSS through chat.riskycfashion.com's
 * nginx path proxying, not the raw VPS IP:port this used to point at).
 * Since this web app is ALSO served at chat.riskycfashion.com, these are
 * same-origin requests now, not cross-origin ones — CORS still works either
 * way (RISKYC_CORS_ALLOWED_ORIGINS already lists this domain), but same-
 * origin skips it entirely.
 * Vite inlines VITE_* vars at build time; override via .env.local for local
 * backend dev.
 */
export const config = {
  authServiceUrl: import.meta.env.VITE_AUTH_SERVICE_URL ?? 'https://chat.riskycfashion.com/auth',
  messagingServiceUrl: import.meta.env.VITE_MESSAGING_SERVICE_URL ?? 'https://chat.riskycfashion.com/messaging',
  mediaServiceUrl: import.meta.env.VITE_MEDIA_SERVICE_URL ?? 'https://chat.riskycfashion.com/media',
  presenceServiceUrl: import.meta.env.VITE_PRESENCE_SERVICE_URL ?? 'https://chat.riskycfashion.com/presence',
  /** Group-calling SFU (backend/sfu-service) — separate service/port from messaging-service's 1:1 call signaling (which web doesn't have at all). */
  sfuServiceUrl: import.meta.env.VITE_SFU_SERVICE_URL ?? 'https://chat.riskycfashion.com/sfu',
  /**
   * Self-hosted TURN relay (see backend/docker-compose.yml's coturn
   * service and mobile/src/lib/config.ts's identical fields) — a fallback
   * ICE relay for mediasoup-client's transports when a direct UDP path to
   * the SFU's public port isn't reachable (restrictive NAT/firewall).
   */
  turnServerUrl: import.meta.env.VITE_TURN_SERVER_URL ?? 'turn:167.86.120.214:3478',
  turnUsername: import.meta.env.VITE_TURN_USERNAME ?? 'riskyc',
  turnCredential: import.meta.env.VITE_TURN_CREDENTIAL ?? 'riskyc-turn-secret',
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

/** sfu-service's protoo-wire signaling endpoint — auth + room-join happen in this one handshake, same as mobile's sfuWebSocketUrl. */
export function sfuWebSocketUrl(
  accessToken: string | null | undefined,
  groupId: string,
  displayName: string,
  callType: 'AUDIO' | 'VIDEO'
): string {
  const base = config.sfuServiceUrl.replace(/^http/, 'ws');
  const params = new URLSearchParams({ token: accessToken ?? '', groupId, displayName, callType });
  // Trailing slash matters: nginx's `location /sfu/ { proxy_pass
  // http://127.0.0.1:8095/; }` only matches requests with that trailing
  // slash — a bare query string right after /sfu doesn't match it.
  return `${base}/?${params.toString()}`;
}
