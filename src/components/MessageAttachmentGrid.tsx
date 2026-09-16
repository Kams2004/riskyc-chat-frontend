import { useMediaUrl } from '../features/media/useMediaUrl';
import type { AttachmentItem } from '../features/messaging/api';

const GRID_SIZE = 260;
const GAP = 3;

function Tile({ item, size, onClick, overlay }: { item: AttachmentItem; size: number; onClick: () => void; overlay?: React.ReactNode }) {
  const url = useMediaUrl(item.mediaObjectKey);
  return (
    <div
      onClick={onClick}
      style={{ width: size, height: size, position: 'relative', cursor: 'pointer', background: 'rgba(0,0,0,0.08)' }}
    >
      {url && (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
      {item.mediaType === 'VIDEO' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      {overlay}
    </div>
  );
}

/** WhatsApp-style collage — same layout rules as mobile's MessageAttachmentGrid. */
export function MessageAttachmentGrid({ items, onOpen }: { items: AttachmentItem[]; onOpen: (index: number) => void }) {
  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <div style={{ width: GRID_SIZE, height: GRID_SIZE, borderRadius: 12, overflow: 'hidden' }}>
        <Tile item={items[0]} size={GRID_SIZE} onClick={() => onOpen(0)} />
      </div>
    );
  }

  if (items.length <= 3) {
    const size = (GRID_SIZE - GAP) / 2;
    return (
      <div style={{ width: GRID_SIZE, display: 'flex', flexWrap: 'wrap', gap: GAP, borderRadius: 12, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <Tile key={i} item={item} size={items.length === 3 && i === 2 ? GRID_SIZE : size} onClick={() => onOpen(i)} />
        ))}
      </div>
    );
  }

  const size = (GRID_SIZE - GAP) / 2;
  const remaining = items.length - 4;
  return (
    <div style={{ width: GRID_SIZE, display: 'flex', flexWrap: 'wrap', gap: GAP, borderRadius: 12, overflow: 'hidden' }}>
      {items.slice(0, 4).map((item, i) => (
        <Tile
          key={i}
          item={item}
          size={size}
          onClick={() => onOpen(i)}
          overlay={
            i === 3 && remaining > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(41,0,15,0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                +{remaining}
              </div>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
