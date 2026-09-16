/** Ported verbatim from mobile/src/lib/mask.ts. */
export function maskIdentifier(identifier: string): string {
  if (identifier.includes('@')) {
    const [local, domain] = identifier.split('@');
    if (local.length <= 2) return `${local.slice(0, 1)}***@${domain}`;
    return `${local.slice(0, 1)}***${local.slice(-1)}@${domain}`;
  }
  if (identifier.length <= 4) return `***${identifier.slice(-2)}`;
  return `${identifier.slice(0, 3)}***${identifier.slice(-2)}`;
}
