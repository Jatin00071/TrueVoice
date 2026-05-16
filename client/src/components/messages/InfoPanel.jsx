import { useEffect, useMemo, useState } from 'react';
import { getConversationDetails } from '../../api/conversationApi.js';
import styles from './Messages.module.css';

function shortHash(value) {
  if (!value) return 'Not available';
  return `${value.slice(0, 8).toUpperCase()} ... ${value.slice(-8).toUpperCase()}`;
}

function InfoPanel({ conversation, myFingerprint, onClose }) {
  const [details, setDetails] = useState(null);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!conversation?.id) return undefined;
    getConversationDetails(conversation.id)
      .then((data) => {
        if (!cancelled) setDetails(data.conversation);
      })
      .catch(() => {
        if (!cancelled) setDetails(conversation);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation]);

  const participant = details?.participant || {
    id: conversation?.other_user_id,
    username: conversation?.other_username,
    display_name: conversation?.other_display_name,
    avatar_url: conversation?.other_avatar_url
  };
  const name = participant?.display_name || participant?.username || 'TrueVoice user';
  const theirFingerprint = participant?.encryptionKey?.key_fingerprint;
  const started = useMemo(() => {
    const value = details?.created_at || conversation?.created_at;
    return value ? new Date(value).toLocaleString() : 'Unknown';
  }, [conversation?.created_at, details?.created_at]);

  return (
    <div className={styles.infoBackdrop} role="presentation" onMouseDown={onClose}>
      <aside className={styles.infoPanel} aria-label="Conversation details" onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.infoHeader}>
          <button type="button" onClick={onClose} aria-label="Close conversation details">x</button>
          <h2>Conversation Details</h2>
        </header>

        <section className={styles.infoParticipant}>
          <span className={styles.largeAvatar}>{name[0]?.toUpperCase()}</span>
          <strong>{name}</strong>
          <span>@{participant?.username || 'user'}</span>
          {participant?.bio ? <p>{participant.bio}</p> : null}
          <button type="button" disabled>Message</button>
          <a href={`/profile/${participant?.username || participant?.id}`}>View Profile</a>
        </section>

        <section className={styles.infoSection}>
          <h3>End-to-end encrypted</h3>
          <p className={styles.verifiedLine}>Verified transport</p>
          <dl className={styles.fingerprintList}>
            <dt>Your fingerprint</dt>
            <dd>{showFull ? myFingerprint || 'Not available' : shortHash(myFingerprint)}</dd>
            <dt>Their fingerprint</dt>
            <dd>{showFull ? theirFingerprint || 'Not available' : shortHash(theirFingerprint)}</dd>
          </dl>
          <button type="button" className={styles.textButton} onClick={() => setShowFull((value) => !value)}>
            {showFull ? 'Hide full fingerprints' : 'Verify contact'}
          </button>
        </section>

        <section className={styles.infoSection}>
          <h3>Conversation Info</h3>
          <p>Started: {started}</p>
          <p>Messages: {details?.messageCount ?? '...'}</p>
          <p>Last message: {details?.last_message_timestamp ? new Date(details.last_message_timestamp).toLocaleString() : 'No messages yet'}</p>
          <p>Status: {Number(conversation?.unread_count || 0)} unread messages</p>
        </section>

        <section className={styles.infoActions}>
          <button type="button">Pin conversation</button>
          <button type="button">Mute notifications</button>
          <button type="button">Block user</button>
          <button type="button">Report conversation</button>
          <button type="button">Archive conversation</button>
        </section>
      </aside>
    </div>
  );
}

export default InfoPanel;
