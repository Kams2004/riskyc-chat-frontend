import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { searchInConversation, type SearchResult } from '../features/messaging/api';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SearchInChatPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!conversationId || !query.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      searchInConversation(conversationId, query.trim())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [conversationId, query]);

  return (
    <div className="settings-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h1>Search in this conversation</h1>
      <input className="input" placeholder="Search messages" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />

      {isSearching && <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Searching…</p>}
      {!isSearching && query.trim() && results.length === 0 && <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>No messages found.</p>}

      {results.map((r) => (
        <div key={r.messageId} className="settings-row">
          <p style={{ margin: 0 }}>{r.ciphertext}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{formatTime(r.sentAt)}</p>
        </div>
      ))}
    </div>
  );
}
