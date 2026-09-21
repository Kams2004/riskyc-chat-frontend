import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '../components/Avatar';
import { CallLogRow } from '../components/CallLogRow';
import { FileAttachmentRow } from '../components/FileAttachmentRow';
import { firstUrlIn, LinkPreviewCard } from '../components/LinkPreviewCard';
import { MediaViewer } from '../components/MediaViewer';
import { MessageAttachmentGrid } from '../components/MessageAttachmentGrid';
import { InfoPanel, type InfoPanelView } from '../components/InfoPanel';
import { MessageInfoModal } from '../components/MessageInfoModal';
import { MessageTicks } from '../components/MessageTicks';
import { ReactionPicker, ReactionPills } from '../components/ReactionBar';
import { VoiceMessagePlayer } from '../components/VoiceMessagePlayer';
import { VoiceRecorderButton } from '../components/VoiceRecorderButton';
import { useAuth } from '../features/auth/AuthContext';
import { useCall } from '../features/calls/CallContext';
import { useGroupCall } from '../features/calls/GroupCallContext';
import { forwardMessage } from '../features/messaging/forward';
import { conversationIdFor, UNRESOLVED_PERSON_PLACEHOLDER } from '../features/messaging/conversationId';
import type { AttachmentItem, MessageEnvelope } from '../features/messaging/api';
import { useConversation, type ReplyToDraft } from '../features/messaging/useConversation';
import { useConversationList } from '../features/messaging/useConversationList';
import { uploadMedia } from '../features/media/api';
import { blockUser, getUser, reportUser } from '../features/users/api';
import { getGroup } from '../features/groups/api';
import { isStarred, star, unstar } from '../lib/starredMessages';
import { useWallpaperVariant } from '../lib/wallpaper';

const DISAPPEARING_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: 'Off', seconds: null },
  { label: '24 hours', seconds: 24 * 60 * 60 },
  { label: '7 days', seconds: 7 * 24 * 60 * 60 },
  { label: '90 days', seconds: 90 * 24 * 60 * 60 },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type Props = {
  conversationId: string;
  title: string;
  avatarObjectKey: string | null;
  isGroup: boolean;
  recipientId?: string;
  groupId?: string;
  /** Arriving via a quoted-reply jump from a DIFFERENT conversation — see navigateToMessage below. */
  scrollToMessageId?: string;
  /** Arriving via "reply privately" from a group — prefills the composer's reply state. */
  initialReplyDraft?: ReplyToDraft;
  onMessageSent?: () => void;
};

/**
 * The right-hand pane of the two-pane chat layout. Message actions mirror
 * mobile's action set: own messages get Edit/Delete(popup)/Forward/Copy,
 * received messages get Delete-for-me/Forward only — via a small floating
 * menu opened from a kebab button shown on hover (desktop has no long-press,
 * so this is the equivalent affordance a right-click menu would give, kept
 * as a plain button for simplicity/accessibility).
 */
export function ConversationThreadPage({
  conversationId,
  title,
  avatarObjectKey,
  isGroup,
  recipientId,
  groupId,
  scrollToMessageId,
  initialReplyDraft,
  onMessageSent,
}: Props) {
  const { userId, accessToken } = useAuth();
  const { startGroupCall } = useGroupCall();
  const { startCall } = useCall();
  const {
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    typingUserIds,
    notifyTyping,
    reactions,
    sendReaction,
    muted,
    setMuted,
    disappearingSeconds,
    setDisappearing,
  } = useConversation({
    conversationId,
    recipientId,
    groupId,
  });
  const navigate = useNavigate();
  const { conversations } = useConversationList(userId);
  const wallpaper = useWallpaperVariant();

  const [draft, setDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [messageInfoFor, setMessageInfoFor] = useState<string | null>(null);
  const [starredIds, setStarredIds] = useState<Set<string>>(() => new Set());
  const [forwardPickerFor, setForwardPickerFor] = useState<MessageEnvelope | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [viewer, setViewer] = useState<{ items: AttachmentItem[]; index: number } | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [disappearingPickerOpen, setDisappearingPickerOpen] = useState(false);
  const [infoPanelView, setInfoPanelView] = useState<InfoPanelView | null>(null);
  const [replyDraft, setReplyDraft] = useState<ReplyToDraft | null>(initialReplyDraft ?? null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [onlyAdminsCanMessage, setOnlyAdminsCanMessage] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didScrollRef = useRef(false);

  function toggleStar(messageId: string) {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
        unstar(messageId);
      } else {
        next.add(messageId);
        star(messageId);
      }
      return next;
    });
  }

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages.length]);

  // Closes the info panel on a conversation switch — its contents (contact
  // id, media, search results) are conversation-specific, and keeping a
  // stale 'contact' view open pointed at a group with no single recipientId
  // would otherwise render nothing useful.
  useEffect(() => {
    setInfoPanelView(null);
  }, [conversationId]);

  // Seeds the starred set from localStorage once, from whatever's currently
  // loaded — new messages arriving afterward are never pre-starred, so
  // there's nothing to re-seed for those.
  useEffect(() => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const m of messages) {
        if (!next.has(m.messageId) && isStarred(m.messageId)) {
          next.add(m.messageId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [messages]);

  // Resolves group member names (for sender labels/quoted blocks/pin banner)
  // and this account's admin status + the group's announcement-only flag —
  // 1:1 threads skip this entirely.
  useEffect(() => {
    setMemberNames({});
    setIsGroupAdmin(false);
    setOnlyAdminsCanMessage(false);
    if (!isGroup || !groupId) return;
    let cancelled = false;
    getGroup(groupId).then(async (group) => {
      if (cancelled) return;
      setOnlyAdminsCanMessage(group.onlyAdminsCanMessage);
      setIsGroupAdmin(group.members.some((m) => m.userId === userId && m.role === 'ADMIN'));
      const entries = await Promise.all(
        group.members.map(async (m) => [m.userId, (await getUser(m.userId).catch(() => null))?.displayName || UNRESOLVED_PERSON_PLACEHOLDER] as const)
      );
      if (!cancelled) setMemberNames(Object.fromEntries(entries));
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [groupId, isGroup, userId]);

  function memberName(otherId: string): string {
    if (otherId === userId) return 'You';
    if (!isGroup) return title;
    return memberNames[otherId] || UNRESOLVED_PERSON_PLACEHOLDER;
  }

  function snippetFor(m: MessageEnvelope): string {
    if (m.mediaType === 'IMAGE') return '📷 Photo';
    if (m.mediaType === 'VIDEO') return '🎥 Video';
    if (m.mediaType === 'AUDIO') return '🎤 Voice message';
    if (m.mediaType === 'FILE') return '📎 Document';
    if (m.attachments && m.attachments.length > 0) return `📷 ${m.attachments.length} photos`;
    return m.ciphertext.length > 80 ? m.ciphertext.slice(0, 77) + '...' : m.ciphertext;
  }

  /** Same-conversation: scroll+briefly highlight. Cross-conversation: navigate there with the target message id in route state. */
  function navigateToMessage(targetConversationId: string, messageId: string) {
    if (targetConversationId === conversationId) {
      const el = bodyRef.current?.querySelector(`[data-message-id="${messageId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
      return;
    }
    navigate(`/chats/${targetConversationId}`, { state: { scrollToMessageId: messageId } });
  }

  // Jumps to (and briefly highlights) a message once its history has loaded
  // — arriving via a quoted-reply tap from a DIFFERENT conversation.
  useEffect(() => {
    if (didScrollRef.current || !scrollToMessageId || messages.length === 0) return;
    const exists = messages.some((m) => m.messageId === scrollToMessageId);
    if (!exists) return;
    didScrollRef.current = true;
    setTimeout(() => {
      const el = bodyRef.current?.querySelector(`[data-message-id="${scrollToMessageId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    setHighlightedMessageId(scrollToMessageId);
    setTimeout(() => setHighlightedMessageId(null), 2500);
  }, [messages, scrollToMessageId]);

  /** Opens a 1:1 with the original message's sender, pre-filled with a reply quoting it — WhatsApp's "reply privately" from a group. */
  async function replyPrivately(m: MessageEnvelope) {
    setOpenMenuFor(null);
    if (!userId) return;
    const targetId = m.senderId;
    const targetConversationId = conversationIdFor(userId, targetId);
    const targetUser = await getUser(targetId).catch(() => null);
    navigate(`/chats/${targetConversationId}`, {
      state: {
        title: targetUser?.displayName || memberName(targetId),
        avatarObjectKey: targetUser?.avatarObjectKey ?? null,
        recipientId: targetId,
        replyDraft: { messageId: m.messageId, conversationId, senderId: targetId, snippet: snippetFor(m) },
      },
    });
  }

  function togglePin(m: MessageEnvelope) {
    setOpenMenuFor(null);
    pinMessage(m.messageId, !m.pinned);
  }

  function confirmReportSender(m: MessageEnvelope) {
    setOpenMenuFor(null);
    const name = memberName(m.senderId);
    const reason = window.prompt(`Report ${name} — briefly describe the issue:`);
    if (reason === null) return;
    reportUser(m.senderId, reason || 'Reported from a group message').catch(() => {});
  }

  const pinnedMessage = useMemo(() => {
    const pinned = messages.filter((m) => m.pinned && !m.deleted);
    return pinned.length > 0 ? pinned[pinned.length - 1] : null;
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    if (editingMessageId) {
      editMessage(editingMessageId, draft);
      setEditingMessageId(null);
    } else {
      const reply = replyDraft ?? undefined;
      setReplyDraft(null);
      sendMessage(draft, undefined, false, undefined, reply);
      onMessageSent?.();
    }
    setDraft('');
  }

  function startEdit(m: MessageEnvelope) {
    setEditingMessageId(m.messageId);
    setDraft(m.ciphertext);
    setReplyDraft(null);
    setOpenMenuFor(null);
  }

  function startReply(m: MessageEnvelope) {
    setEditingMessageId(null);
    setReplyDraft({ messageId: m.messageId, conversationId, senderId: m.senderId, snippet: snippetFor(m) });
    setOpenMenuFor(null);
  }

  function handleDeleteMine(m: MessageEnvelope) {
    setOpenMenuFor(null);
    const everyone = window.confirm('Delete for everyone? Choose Cancel to only delete it for yourself instead.');
    deleteMessage(m.messageId, everyone ? 'everyone' : 'me');
  }

  function handleDeleteTheirs(m: MessageEnvelope) {
    setOpenMenuFor(null);
    if (window.confirm('Delete this message for you? The sender keeps their copy.')) {
      deleteMessage(m.messageId, 'me');
    }
  }

  async function handleCopy(m: MessageEnvelope) {
    setOpenMenuFor(null);
    try {
      await navigator.clipboard.writeText(m.ciphertext);
    } catch {
      // Clipboard access can be denied by the browser — silently no-op, same as a failed native copy would.
    }
  }

  async function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow picking the same file again later
    if (files.length === 0) return;

    // Documents never join a photo/video gallery (attachments are IMAGE/VIDEO
    // only, same as mobile) — each goes out as its own FILE message; any
    // image/video files picked alongside them still go through the normal
    // single-or-gallery path below.
    const mediaFiles = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const documentFiles = files.filter((f) => !f.type.startsWith('image/') && !f.type.startsWith('video/'));

    setIsUploading(true);
    const reply = replyDraft ?? undefined;
    try {
      for (const file of documentFiles) {
        const objectKey = await uploadMedia(file);
        sendMessage('', { type: 'FILE', objectKey, fileName: file.name }, false, undefined, reply);
      }

      if (mediaFiles.length > 0) {
        const uploaded = await Promise.all(
          mediaFiles.map(async (file) => {
            const objectKey = await uploadMedia(file);
            return { type: file.type.startsWith('video/') ? ('VIDEO' as const) : ('IMAGE' as const), objectKey };
          })
        );
        if (uploaded.length === 1) {
          sendMessage('', { type: uploaded[0].type, objectKey: uploaded[0].objectKey }, false, undefined, reply);
        } else {
          sendMessage('', undefined, false, uploaded, reply);
        }
      }

      setReplyDraft(null);
      onMessageSent?.();
    } catch (err) {
      window.alert('Could not send — please check your connection and try again.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleVoiceSend(objectKey: string, durationMs: number) {
    const reply = replyDraft ?? undefined;
    sendMessage('', { type: 'AUDIO', objectKey, durationMs }, false, undefined, reply);
    setReplyDraft(null);
    onMessageSent?.();
  }

  function handleReact(messageId: string, emoji: string) {
    setReactionPickerFor(null);
    setOpenMenuFor(null);
    sendReaction(messageId, emoji);
  }

  async function handleForwardTo(target: { conversationId: string; recipientId?: string; groupId?: string }) {
    if (!forwardPickerFor || !userId) return;
    await forwardMessage(accessToken, userId, forwardPickerFor, target);
    setForwardPickerFor(null);
    onMessageSent?.();
    navigate(`/chats/${target.conversationId}`);
  }

  const typingLabel = typingUserIds.length > 0 ? 'Typing…' : null;

  function goToContact() {
    if (isGroup) {
      window.alert("Viewing group info from the web app isn't built yet — use the mobile app for now.");
      return;
    }
    if (recipientId) setInfoPanelView('contact');
  }

  /**
   * Unlike mobile (a purely local SQLite delete — see mobile's
   * clearConversationMessages — which can let cleared messages reappear on
   * a later re-sync since the server never forgot them), web isn't
   * offline-first: there's no local cache to clear, so this instead
   * delete-for-me's every currently-loaded message individually, the same
   * real, server-persisted action a single "Delete for me" already uses.
   * That's the only way "clear chat" is actually durable here.
   */
  function clearChat() {
    setOverflowOpen(false);
    if (!window.confirm('Clear this chat? Messages will be removed for you only.')) return;
    for (const m of messages) {
      deleteMessage(m.messageId, 'me');
    }
  }

  return (
    <>
    <div className="main-panel">
      <div className="thread-header">
        {/* Only visible at mobile widths (see index.css's media query) — the
            two-pane layout doesn't need it, but a full-width mobile thread
            view has no other way back to the conversation list. */}
        <button className="icon-button mobile-back-button" onClick={() => navigate('/chats')} title="Back to chats">
          ←
        </button>
        <div onClick={goToContact} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <Avatar label={title} objectKey={avatarObjectKey} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="thread-header-name">{title}</div>
            <div className="thread-header-status">{typingLabel || (isGroup ? 'Group' : '')}</div>
          </div>
        </div>
        {!isGroup && recipientId && (
          <>
            <button className="icon-button" title="Voice call" onClick={() => void startCall(recipientId, title, 'AUDIO')}>
              📞
            </button>
            <button className="icon-button" title="Video call" onClick={() => void startCall(recipientId, title, 'VIDEO')}>
              🎥
            </button>
          </>
        )}
        {isGroup && groupId && (
          <>
            <button
              className="icon-button"
              title="Start audio call"
              onClick={() => void startGroupCall(groupId, title, Object.keys(memberNames).filter((id) => id !== userId), 'AUDIO')}
            >
              📞
            </button>
            <button
              className="icon-button"
              title="Start video call"
              onClick={() => void startGroupCall(groupId, title, Object.keys(memberNames).filter((id) => id !== userId), 'VIDEO')}
            >
              🎥
            </button>
          </>
        )}
        <div style={{ position: 'relative' }}>
          <button className="icon-button" onClick={() => setOverflowOpen((v) => !v)} title="More">
            ⋮
          </button>
          {overflowOpen && (
            <div className="bubble-menu" style={{ top: '110%', right: 0 }} onMouseLeave={() => setOverflowOpen(false)}>
              <button onClick={() => { setOverflowOpen(false); navigate('/chats/new'); }}>New chat</button>
              <button onClick={() => { setOverflowOpen(false); goToContact(); }}>{isGroup ? 'Group info' : 'View contact'}</button>
              <button onClick={() => { setOverflowOpen(false); setInfoPanelView('search'); }}>Search</button>
              <button onClick={() => { setOverflowOpen(false); setInfoPanelView('media'); }}>Media, links, and docs</button>
              <button onClick={() => { setMuted(!muted); setOverflowOpen(false); }}>{muted ? 'Unmute notifications' : 'Mute notifications'}</button>
              <button onClick={() => { setDisappearingPickerOpen(true); setOverflowOpen(false); }}>Disappearing messages</button>
              <button onClick={clearChat}>Clear chat</button>
              {!isGroup && recipientId && (
                <button
                  className="destructive"
                  onClick={() => {
                    setOverflowOpen(false);
                    if (window.confirm(`Block ${title}? You won't receive calls or messages from them anymore.`)) {
                      blockUser(recipientId);
                    }
                  }}
                >
                  Block {title}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {pinnedMessage && (
        <div className="pin-banner" onClick={() => navigateToMessage(conversationId, pinnedMessage.messageId)}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📌 {isGroup ? `${memberName(pinnedMessage.senderId)}: ` : ''}{snippetFor(pinnedMessage)}
          </span>
          <button
            className="icon-button"
            title="Unpin"
            onClick={(e) => {
              e.stopPropagation();
              togglePin(pinnedMessage);
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div className={`thread-body wallpaper-${wallpaper}`} ref={bodyRef}>
        {messages.map((m) => {
          const isMine = m.senderId === userId;

          if (m.system) {
            return (
              <div key={m.messageId} className="system-message-row" data-message-id={m.messageId}>
                <span className="system-message-pill">{m.ciphertext}</span>
              </div>
            );
          }

          if (m.deleted) {
            return (
              <div key={m.messageId} className={`bubble-row ${isMine ? 'mine' : ''}`} data-message-id={m.messageId}>
                <div className={`bubble ${isMine ? 'mine' : 'theirs'} deleted`}>This message was deleted</div>
              </div>
            );
          }

          if (m.mediaType === 'CALL') {
            return (
              <div key={m.messageId} className="call-log-row-wrap" data-message-id={m.messageId}>
                <CallLogRow
                  callType={m.mediaFileName}
                  outcome={m.ciphertext}
                  durationMs={m.mediaDurationMs}
                  isMine={isMine}
                  onCallBack={
                    !isGroup && recipientId
                      ? () => void startCall(recipientId, title, m.mediaFileName === 'VIDEO' ? 'VIDEO' : 'AUDIO')
                      : undefined
                  }
                />
              </div>
            );
          }

          const url = m.ciphertext ? firstUrlIn(m.ciphertext) : null;
          const messageReactions = reactions.filter((r) => r.messageId === m.messageId);
          const starredHere = starredIds.has(m.messageId);

          return (
            <div key={m.messageId} className={`bubble-row ${isMine ? 'mine' : ''}`} data-message-id={m.messageId}>
              <div className={`bubble ${isMine ? 'mine' : 'theirs'} ${highlightedMessageId === m.messageId ? 'highlighted' : ''}`}>
                {isGroup && !isMine && <div className="bubble-sender">{memberName(m.senderId)}</div>}
                {m.forwarded && <span className="bubble-forwarded">Forwarded</span>}
                {starredHere && <span className="bubble-star-badge" title="Starred">★</span>}
                {!!m.replyToMessageId && (
                  <div
                    className="bubble-quote"
                    onClick={() => navigateToMessage(m.replyToConversationId!, m.replyToMessageId!)}
                  >
                    <div className="bubble-quote-sender">{memberName(m.replyToSenderId || '')}</div>
                    <div className="bubble-quote-snippet">{m.replyToSnippet}</div>
                  </div>
                )}
                {!!m.replyToStatusId && (
                  <div className="bubble-quote">
                    <div className="bubble-quote-sender">Replied to a status</div>
                    <div className="bubble-quote-snippet">{memberName(m.replyToStatusOwnerId || '')}</div>
                  </div>
                )}
                {m.attachments && m.attachments.length > 0 && (
                  <div style={{ marginBottom: m.ciphertext ? 6 : 0 }}>
                    <MessageAttachmentGrid items={m.attachments} onOpen={(index) => setViewer({ items: m.attachments!, index })} />
                  </div>
                )}
                {!m.attachments?.length && m.mediaType === 'IMAGE' && m.mediaObjectKey && (
                  <div style={{ marginBottom: m.ciphertext ? 6 : 0 }}>
                    <MessageAttachmentGrid
                      items={[{ position: 0, mediaType: 'IMAGE', mediaObjectKey: m.mediaObjectKey, mediaFileName: m.mediaFileName ?? null, mediaDurationMs: null }]}
                      onOpen={(index) =>
                        setViewer({
                          items: [{ position: 0, mediaType: 'IMAGE', mediaObjectKey: m.mediaObjectKey!, mediaFileName: m.mediaFileName ?? null, mediaDurationMs: null }],
                          index,
                        })
                      }
                    />
                  </div>
                )}
                {m.mediaType === 'AUDIO' && m.mediaObjectKey && (
                  <div style={{ marginBottom: 4 }}>
                    <VoiceMessagePlayer objectKey={m.mediaObjectKey} durationMs={m.mediaDurationMs ?? null} isMine={isMine} />
                  </div>
                )}
                {m.mediaType === 'FILE' && m.mediaObjectKey && (
                  <FileAttachmentRow objectKey={m.mediaObjectKey} fileName={m.mediaFileName} />
                )}
                {!!m.ciphertext && <div>{m.ciphertext}</div>}
                {!!url && <LinkPreviewCard url={url} isMine={isMine} />}
                <div className="bubble-meta">
                  {m.edited && 'edited · '}
                  {formatTime(m.sentAt)}
                  {isMine && !isGroup && <MessageTicks status={m.status} />}
                </div>
                <ReactionPills reactions={messageReactions} currentUserId={userId} onToggle={(emoji) => handleReact(m.messageId, emoji)} />

                <button className="bubble-kebab" onClick={() => setOpenMenuFor(openMenuFor === m.messageId ? null : m.messageId)}>
                  ⋮
                </button>
                {reactionPickerFor === m.messageId && (
                  <div style={{ position: 'absolute', top: -44, right: 0, zIndex: 10 }}>
                    <ReactionPicker onPick={(emoji) => handleReact(m.messageId, emoji)} />
                  </div>
                )}
                {openMenuFor === m.messageId && (
                  <div className="bubble-menu" onMouseLeave={() => setOpenMenuFor(null)}>
                    <button
                      onClick={() => {
                        setReactionPickerFor(m.messageId);
                        setOpenMenuFor(null);
                      }}
                    >
                      React
                    </button>
                    {isMine && !m.mediaType && <button onClick={() => startEdit(m)}>Edit</button>}
                    <button onClick={() => startReply(m)}>Reply</button>
                    {!m.mediaType && <button onClick={() => handleCopy(m)}>Copy</button>}
                    <button
                      onClick={() => {
                        setForwardPickerFor(m);
                        setOpenMenuFor(null);
                      }}
                    >
                      Forward
                    </button>
                    {isGroup && !isMine && <button onClick={() => replyPrivately(m)}>Reply privately</button>}
                    <button onClick={() => togglePin(m)}>{m.pinned ? 'Unpin' : 'Pin'}</button>
                    <button
                      onClick={() => {
                        toggleStar(m.messageId);
                        setOpenMenuFor(null);
                      }}
                    >
                      {starredHere ? 'Unstar' : 'Star'}
                    </button>
                    {isGroup && isMine && (
                      <button
                        onClick={() => {
                          setMessageInfoFor(m.messageId);
                          setOpenMenuFor(null);
                        }}
                      >
                        Info
                      </button>
                    )}
                    {isGroup && !isMine && (
                      <button className="destructive" onClick={() => confirmReportSender(m)}>
                        Report {memberName(m.senderId)}
                      </button>
                    )}
                    {isMine ? (
                      <button className="destructive" onClick={() => handleDeleteMine(m)}>
                        Delete
                      </button>
                    ) : (
                      <button className="destructive" onClick={() => handleDeleteTheirs(m)}>
                        Delete for me
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingMessageId && (
        <div className="editing-banner">
          <span>Editing message</span>
          <button
            onClick={() => {
              setEditingMessageId(null);
              setDraft('');
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {!editingMessageId && replyDraft && (
        <div className="editing-banner">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Replying to {memberName(replyDraft.senderId)}: {replyDraft.snippet}
          </span>
          <button onClick={() => setReplyDraft(null)}>Cancel</button>
        </div>
      )}

      {isGroup && onlyAdminsCanMessage && !isGroupAdmin ? (
        <div className="composer" style={{ color: 'var(--text-muted)', justifyContent: 'center' }}>
          Only admins can send messages in this group.
        </div>
      ) : (
      <form className="composer" onSubmit={handleSend}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFilesPicked}
        />
        {!isRecordingVoice && (
          <button
            type="button"
            className="icon-button"
            title="Attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? '…' : '📎'}
          </button>
        )}
        {isRecordingVoice ? (
          <VoiceRecorderButton onSend={handleVoiceSend} onRecordingChange={setIsRecordingVoice} />
        ) : (
          <>
            <input
              className="composer-input"
              placeholder="Type a message"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                notifyTyping();
              }}
            />
            {draft.trim() ? (
              <button type="submit" className="composer-send" title="Send">
                ➤
              </button>
            ) : (
              <VoiceRecorderButton onSend={handleVoiceSend} onRecordingChange={setIsRecordingVoice} />
            )}
          </>
        )}
      </form>
      )}

      {viewer && <MediaViewer items={viewer.items} initialIndex={viewer.index} onClose={() => setViewer(null)} />}

      {forwardPickerFor && (
        <ForwardPickerModal
          conversations={conversations.filter((c) => c.conversationId !== conversationId)}
          onPick={handleForwardTo}
          onClose={() => setForwardPickerFor(null)}
        />
      )}

      {disappearingPickerOpen && (
        <div className="modal-backdrop" onClick={() => setDisappearingPickerOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Disappearing messages</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>New messages will disappear from this chat after the selected time. Applies to messages sent from now on.</p>
            {DISAPPEARING_OPTIONS.map((opt) => (
              <div
                key={opt.label}
                className="conversation-row"
                style={{ borderBottom: 'none', borderRadius: 10, cursor: 'pointer' }}
                onClick={() => {
                  setDisappearing(opt.seconds);
                  setDisappearingPickerOpen(false);
                }}
              >
                <div className="conversation-row-title" style={{ flex: 1 }}>{opt.label}</div>
                {disappearingSeconds === opt.seconds && <span>✓</span>}
              </div>
            ))}
            <button className="link-button secondary" onClick={() => setDisappearingPickerOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {messageInfoFor && (
        <MessageInfoModal
          conversationId={conversationId}
          messageId={messageInfoFor}
          memberNames={memberNames}
          onClose={() => setMessageInfoFor(null)}
        />
      )}
    </div>
    {infoPanelView && (
      <InfoPanel
        conversationId={conversationId}
        recipientId={recipientId}
        initialView={infoPanelView}
        onClose={() => setInfoPanelView(null)}
      />
    )}
    </>
  );
}

function ForwardPickerModal({
  conversations,
  onPick,
  onClose,
}: {
  conversations: ReturnType<typeof useConversationList>['conversations'];
  onPick: (target: { conversationId: string; recipientId?: string; groupId?: string }) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{ background: 'var(--surface)', borderRadius: 16, padding: 20, width: 340, maxHeight: '70vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Forward to</h3>
        {conversations.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No other conversations yet.</p>}
        {conversations.map((c) => (
          <div
            key={c.conversationId}
            className="conversation-row"
            style={{ borderBottom: 'none', borderRadius: 10 }}
            onClick={() =>
              onPick({
                conversationId: c.conversationId,
                recipientId: c.isGroup ? undefined : (c.otherUserId ?? undefined),
                groupId: c.isGroup ? c.groupId ?? undefined : undefined,
              })
            }
          >
            <Avatar label={c.title} objectKey={c.avatarObjectKey} size={36} />
            <div className="conversation-row-title">{c.title}</div>
          </div>
        ))}
        <button className="link-button secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
