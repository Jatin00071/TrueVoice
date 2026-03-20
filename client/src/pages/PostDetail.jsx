import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addComment, deletePost, getComments, getOriginChain, getPost, likePost } from '../api/postApi.js';
import api from '../api/axiosInstance.js';
import { useAuthContext } from '../hooks/useAuth.js';
import styles from './PostDetail.module.css';

function formatAbsolute(value) {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString();
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function resolveAssetUrl(value) {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${value}`;
}

function getMediaUrl(post) {
  return resolveAssetUrl(post?.media_url) || '';
}

function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [post, setPost] = useState(null);
  const [chain, setChain] = useState([]);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info');
  const [shieldReport, setShieldReport] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [postData, chainData, commentsData] = await Promise.all([
        getPost(id),
        getOriginChain(id),
        getComments(id)
      ]);

      setPost(postData?.post || null);
      setChain(Array.isArray(chainData?.chain) ? chainData.chain : []);
      setComments(Array.isArray(commentsData?.items) ? commentsData.items : []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load this post.'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setMessage(null);
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message]);

  useEffect(() => {
    let active = true;
    const isOwnPost = user && post && String(user.id) === String(post.user_id);
    const isShieldActive = post?.shield_active || post?.shieldActive;

    if (!post || !isShieldActive || !isOwnPost) {
      setShieldReport(null);
      return undefined;
    }

    const loadShieldReport = async () => {
      try {
        const response = await api.get(`/posts/${post.id}/shield/status`);
        if (active) {
          setShieldReport(response.data);
        }
      } catch {
        if (active) {
          setShieldReport(null);
        }
      }
    };

    loadShieldReport();

    return () => {
      active = false;
    };
  }, [post, user]);

  const setFeedback = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
  };

  const handleComment = async (event) => {
    event.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setMessage(null);
    try {
      const data = await addComment(id, trimmed);

      setComment('');

      if (data?.wasDeleted) {
        setFeedback('Your comment was removed by our content moderation system.', 'warning');
        return;
      }

      const nextComment = data?.data || data?.comment || data;

      if (nextComment?.status === 'approved') {
        await loadDetail();
      } else {
        setFeedback('Your comment is pending review', 'info');
      }
    } catch (submitError) {
      setFeedback(getErrorMessage(submitError, 'Unable to add that comment.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (!post) return;

    setLikeBusy(true);
    setMessage(null);

    try {
      const data = await likePost(post.id);
      const nextLiked = Boolean(data?.liked);
      setPost((current) =>
        current
          ? {
              ...current,
              viewer_has_liked: nextLiked ? 1 : 0,
              like_count: Math.max(0, Number(current.like_count || 0) + (nextLiked ? 1 : -1))
            }
          : current
      );
    } catch (likeError) {
      setFeedback(getErrorMessage(likeError, 'Unable to update the like right now.'), 'error');
    } finally {
      setLikeBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!window.confirm('Delete this post permanently?')) {
      return;
    }

    setDeleteBusy(true);
    setMessage(null);

    try {
      await deletePost(post.id);
      navigate('/feed');
    } catch (deleteError) {
      setFeedback(getErrorMessage(deleteError, 'Unable to delete this post.'), 'error');
      setDeleteBusy(false);
    }
  };

  const handleDeactivateShield = async () => {
    if (!post) return;

    try {
      await api.post(`/posts/${post.id}/shield/deactivate`);
      setPost((current) =>
        current
          ? {
              ...current,
              shield_active: 0,
              shieldActive: false
            }
          : current
      );
      setShieldReport(null);
    } catch (deactivateError) {
      setFeedback('Failed to deactivate shield.', 'error');
      console.error('Failed to deactivate shield:', deactivateError);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.page}>
        <p className={styles.status}>Loading post...</p>
      </section>
    );
  }

  if (error || !post) {
    return (
      <section className={styles.page}>
        <div className={styles.card}>
          <p className={styles.error}>{error || 'Post not found.'}</p>
          <button type="button" className={styles.secondaryButton} onClick={loadDetail} aria-label="Retry post detail">
            Retry
          </button>
        </div>
      </section>
    );
  }

  const isShieldActive = post.shield_active || post.shieldActive;
  const isOwnPost = user && String(user.id) === String(post.user_id);

  return (
    <section className={styles.page}>
      <article className={styles.card}>
        <div className={styles.header}>
          <div className={styles.avatar} aria-hidden="true" style={{ overflow: 'hidden' }}>
            {resolveAssetUrl(post.avatar_url) ? (
              <img
                src={resolveAssetUrl(post.avatar_url)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              (post.display_name || post.username || 'P').charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <Link to={`/profile/${post.user_id}`} className={styles.author}>
              {post.display_name || post.username}
            </Link>
            <p className={styles.meta}>
              @{post.username} | <span className={styles.timestamp}>{formatAbsolute(post.created_at)}</span>
            </p>
          </div>
        </div>

        <p className={styles.content}>{post.content || 'This post contains media only.'}</p>

        {post.media_url ? (
          <div className={styles.mediaWrap}>
            {post.media_type === 'video' ? (
              <video className={styles.media} controls preload="metadata">
                <source src={getMediaUrl(post)} type="video/mp4" />
              </video>
            ) : (
              <img className={styles.media} src={getMediaUrl(post)} alt={`Post media from ${post.display_name || post.username}`} />
            )}
          </div>
        ) : null}

        {isShieldActive ? (
          <div className={styles.shieldBanner}>
            <div className={styles.shieldBannerLeft}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
              <span className={styles.shieldBannerText}>
                Shield active
                {shieldReport?.totalDeletedToday > 0 ? (
                  <span className={styles.shieldCount}>
                    {' - '}
                    {shieldReport.totalDeletedToday} abusive comment
                    {shieldReport.totalDeletedToday !== 1 ? 's' : ''} auto-deleted today
                  </span>
                ) : null}
              </span>
            </div>
            {isOwnPost ? (
              <button type="button" className={styles.shieldOffBtn} onClick={handleDeactivateShield}>
                Turn off
              </button>
            ) : null}
          </div>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionButton} ${Number(post.viewer_has_liked) ? styles.actionButtonLiked : ''}`}
            onClick={handleLike}
            aria-label={Number(post.viewer_has_liked) ? 'Unlike this post' : 'Like this post'}
            disabled={likeBusy}
          >
            {Number(post.viewer_has_liked) ? 'Liked' : 'Like'} {Number(post.like_count || 0)}
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => document.getElementById('comment-content')?.focus()}
            aria-label="Focus the comment box"
          >
            Comment {Number(post.comment_count || comments.length)}
          </button>
          {user && String(user.id) === String(post.user_id) ? (
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionButtonDanger}`}
              onClick={handleDelete}
              aria-label="Delete this post"
              disabled={deleteBusy}
            >
              {deleteBusy ? 'Deleting...' : 'Delete post'}
            </button>
          ) : null}
        </div>
      </article>

      {chain.length > 1 ? (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Origin chain</h2>
          <div className={styles.chain}>
            {chain.map((item) => (
              <Link key={item.id} to={`/post/${item.id}`} className={styles.chainNode}>
                <span className={styles.chainDot} aria-hidden="true" />
                <div>
                  <p className={styles.chainTitle}>{item.is_reshare ? 'Reshared post' : 'Original post'}</p>
                  <p className={styles.chainMeta}>Post #{item.id}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.card}>
        <div className={styles.commentsHeader}>
          <h2 className={styles.sectionTitle}>Comments</h2>
          <span className={styles.count}>{comments.length}</span>
        </div>

        <form className={styles.commentForm} onSubmit={handleComment}>
          <label className={styles.commentLabel} htmlFor="comment-content">
            Add a comment
          </label>
          <textarea
            id="comment-content"
            className={styles.textarea}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder="Join the conversation"
          />
          <div className={styles.commentFooter}>
            <button
              type="submit"
              className={styles.primaryButton}
              aria-label="Submit comment"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Comment'}
            </button>
          </div>
          {message ? <p className={`${styles.commentMsg} ${styles[messageType]}`}>{message}</p> : null}
        </form>

        <div className={styles.commentList}>
          {comments.length === 0 ? <p className={styles.status}>No comments yet.</p> : null}

          {comments.map((item) => (
            <article key={item.id} className={styles.commentCard}>
              <div className={styles.commentTop}>
                <span className={styles.commentAuthor}>{item.display_name || item.username}</span>
                <span className={styles.commentTime}>{formatAbsolute(item.created_at)}</span>
              </div>
              <p className={styles.commentText}>{item.content}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default PostDetail;
