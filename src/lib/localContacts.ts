/**
 * Per-device contact-name overrides — web's counterpart to mobile's
 * local_contacts SQLite table (see mobile/src/data/db.ts). Same WhatsApp-
 * style rule: this never touches the other person's account, it only
 * changes what THIS browser/device shows for them, same as
 * conversationPrefs.ts's favorites/lastViewedAt. localStorage (not a
 * per-conversation structure) since it's keyed by userId and meant to
 * apply everywhere that person's name shows up — the sidebar, the thread
 * header, contact info, search results.
 */
const LOCAL_CONTACTS_KEY = 'riskyc.localContacts';

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_CONTACTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getLocalContactName(userId: string): string | null {
  return readAll()[userId] ?? null;
}

export function setLocalContactName(userId: string, name: string) {
  try {
    const all = readAll();
    const trimmed = name.trim();
    if (trimmed) all[userId] = trimmed;
    else delete all[userId];
    localStorage.setItem(LOCAL_CONTACTS_KEY, JSON.stringify(all));
  } catch {
    // Ignored — worst case this device just keeps showing the person's own displayName.
  }
}
