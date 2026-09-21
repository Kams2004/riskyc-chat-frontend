import type { ReactionRow } from '../features/messaging/api';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** A small row of emoji to pick from — opened from the kebab menu's "React" item, mirrors mobile's quick-react bar. */
export function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="reaction-picker">
      {QUICK_EMOJIS.map((emoji) => (
        <button key={emoji} type="button" className="reaction-picker-emoji" onClick={() => onPick(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** Aggregated reaction pills below a bubble — click your own emoji again to remove it (see useConversation's sendReaction toggle behavior). */
export function ReactionPills({
  reactions,
  currentUserId,
  onToggle,
}: {
  reactions: ReactionRow[];
  currentUserId: string | null;
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;

  const byEmoji = new Map<string, ReactionRow[]>();
  for (const r of reactions) {
    const list = byEmoji.get(r.emoji) ?? [];
    list.push(r);
    byEmoji.set(r.emoji, list);
  }

  return (
    <div className="reaction-pills">
      {[...byEmoji.entries()].map(([emoji, rows]) => {
        const mine = rows.some((r) => r.userId === currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            className={`reaction-pill ${mine ? 'mine' : ''}`}
            onClick={() => onToggle(emoji)}
            title={rows.length === 1 ? '1 reaction' : `${rows.length} reactions`}
          >
            <span>{emoji}</span>
            {rows.length > 1 && <span className="reaction-pill-count">{rows.length}</span>}
          </button>
        );
      })}
    </div>
  );
}
