/** Ported verbatim from mobile/src/features/messaging/conversationId.ts — same server contract, must stay identical. */
export function conversationIdFor(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join('_');
}

export function otherPartyFrom(conversationId: string, myUserId: string): string {
  const [a, b] = conversationId.split('_');
  return a === myUserId ? b : a;
}

export const UNRESOLVED_TITLE_PLACEHOLDER = 'New chat';
export const UNRESOLVED_PERSON_PLACEHOLDER = 'Unknown';
