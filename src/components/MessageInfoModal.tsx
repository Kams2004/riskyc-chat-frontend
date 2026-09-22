import { useEffect, useState } from 'react';

import { Spinner } from './Spinner';
import { fetchMessageReceipts, type ReceiptRow } from '../features/messaging/api';

const STATUS_LABEL: Record<ReceiptRow['status'], string> = {
  READ: 'Read',
  DELIVERED: 'Delivered',
  SENT: 'Sent',
};

/** Per-member read/delivery breakdown for a group message — on-demand fetch (web isn't offline-first so it can't accumulate this locally the way mobile does), see MessageHistoryController#receipts. */
export function MessageInfoModal({
  conversationId,
  messageId,
  memberNames,
  onClose,
}: {
  conversationId: string;
  messageId: string;
  memberNames: Record<string, string>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ReceiptRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMessageReceipts(conversationId, messageId)
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, messageId]);

  const readRows = (rows ?? []).filter((r) => r.status === 'READ');
  const deliveredRows = (rows ?? []).filter((r) => r.status === 'DELIVERED');
  const sentRows = (rows ?? []).filter((r) => r.status === 'SENT');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Message info</h3>
        {rows === null && <div className="loading-center" style={{ padding: 20 }}><Spinner /></div>}
        {rows !== null && rows.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No delivery info yet.</p>}
        {[
          { title: 'Read', items: readRows },
          { title: 'Delivered', items: deliveredRows },
          { title: 'Sent', items: sentRows },
        ]
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.title} className="message-info-group">
              <div className="message-info-group-title">{group.title}</div>
              {group.items.map((r) => (
                <div key={r.userId} className="message-info-row">
                  <span>{memberNames[r.userId] || 'Unknown'}</span>
                  <span className="message-info-status">{STATUS_LABEL[r.status]}</span>
                </div>
              ))}
            </div>
          ))}
        <button className="link-button secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
