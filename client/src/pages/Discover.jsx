import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addComment, deletePost, getDiscover, likePost } from '../api/postApi.js';
import { searchUsers } from '../api/userApi.js';
import { useAuthContext } from '../hooks/useAuth.js';
import styles from './Discover.module.css';

function formatRelativeTime(value) {
  if (!value) return 'Now';
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));

  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function resolveAssetUrl(value) {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  return `${import.meta.env.VITE_API_URL || 'https://truevoice-9qth.onrender.com'}${value}`;
}

function getMediaUrl(post) {
  return resolveAssetUrl(post?.media_url) || '';
}

function Discover() {
  const { user } = useAuthContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsError, setPostsError] = useState('');
  const [postsLoading, setPostsLoading] = useState(true);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentFeedback, setCommentFeedback] = useState({});
  const [commentBusyPostId, setCommentBusyPostId] = useState(null);
  const [likeBusyPostId, setLikeBusyPostId] = useState(null);
  const [deleteBusyPostId, setDeleteBusyPostId] = useState(null);

  const updateCommentFeedback = (postId, text = '', type = 'info') => {
    setCommentFeedback((current) => {
      const next = { ...current };
      if (!text) {
        delete next[postId];
        return next;
      }

      next[postId] = { text, type };
      return next;
    });
  };

  const clearCommentFeedbackLater = (postId, delay) => {
    window.setTimeout(() => {
      setCommentFeedback((current) => {
        if (!current[postId]) {
          return current;
        }

        const next = { ...current };
        delete next[postId];
        return next;
      });
    }, delay);
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!query.trim()) {
        setResults([]);
        setSearchError('');
        return;
      }

      setSearchLoading(true);
      setSearchError('');

      try {
        const data = await searchUsers(query.trim());
        if (active) {
          setResults(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (error) {
        if (active) {
          setSearchError(getErrorMessage(error, 'Search is unavailable right now.'));
        }
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    };

    const timer = window.setTimeout(run, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const loadTrending = async () => {
    setPostsLoading(true);
    setPostsError('');

    try {
      const data = await getDiscover(null, 10);
      setPosts(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      setPostsError(getErrorMessage(error, 'Unable to load trending posts.'));
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    loadTrending();
  }, []);

  const hasSearch = useMemo(() => query.trim().length > 0, [query]);

  const handleLike = async (postId) => {
    setLikeBusyPostId(postId);
    updateCommentFeedback(postId);

    try {
      const result = await likePost(postId);
      setPosts((current) =>
        current.map((post) => {
          if (post.id !== postId) return post;

          const likeCount = Number(post.like_count || 0);
          const nextLiked = Boolean(result?.liked);

          return {
            ...post,
            viewer_has_liked: nextLiked ? 1 : 0,
            like_count: Math.max(0, likeCount + (nextLiked ? 1 : -1))
          };
        })
      );
    } catch (error) {
      updateCommentFeedback(postId, getErrorMessage(error, 'Unable to update the like right now.'), 'error');
    } finally {
      setLikeBusyPostId(null);
    }
  };

  const handleCommentSubmit = async (postId) => {
    const draft = commentDrafts[postId] || '';
    const trimmed = draft.trim();

    if (!trimmed) {
      updateCommentFeedback(postId, 'Write a comment first.', 'error');
      return;
    }

    setCommentBusyPostId(postId);
    updateCommentFeedback(postId);

    try {
      const data = await addComment(postId, trimmed);

      setCommentDrafts((current) => ({ ...current, [postId]: '' }));

      if (data?.wasDeleted) {
        updateCommentFeedback(postId, 'Your comment was removed by our content moderation system.', 'warning');
        clearCommentFeedbackLater(postId, 5000);
        return;
      }

      const comment = data?.data || data?.comment || data;

      if (comment?.status === 'pending') {
        updateCommentFeedback(postId, 'Your comment is pending review', 'info');
        clearCommentFeedbackLater(postId, 4000);
        return;
      }

      if (comment?.status === 'approved') {
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? { ...post, comment_count: Number(post.comment_count || 0) + 1 }
              : post
          )
        );

        updateCommentFeedback(postId, 'Comment posted.', 'info');
        clearCommentFeedbackLater(postId, 3000);
      }
    } catch (error) {
      updateCommentFeedback(postId, getErrorMessage(error, 'Unable to add that comment.'), 'error');
    } finally {
      setCommentBusyPostId(null);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post permanently?')) {
      return;
    }

    setDeleteBusyPostId(postId);
    updateCommentFeedback(postId);

    try {
      await deletePost(postId);
      setPosts((current) => current.filter((post) => post.id !== postId));
      setCommentDrafts((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
      setCommentFeedback((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
      setActiveCommentPostId((current) => (current === postId ? null : current));
    } catch (error) {
      updateCommentFeedback(postId, getErrorMessage(error, 'Unable to delete this post.'), 'error');
    } finally {
      setDeleteBusyPostId(null);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.bar}>
        <span className={styles.title}>Discover</span>
        <span className={styles.badge}>Trending</span>
      </div>

      <label className={styles.searchWrap} htmlFor="discover-search">
        <span className={styles.searchLabel}>Search people</span>
        <input
          id="discover-search"
          className={styles.searchInput}
          type="search"
          placeholder="Search people..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {hasSearch ? (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>People</h2>
            {searchLoading ? <span className={styles.status}>Searching...</span> : null}
          </div>

          {searchError ? <p className={styles.error}>{searchError}</p> : null}

          {!searchLoading && !searchError && results.length === 0 ? (
            <p className={styles.status}>No people matched that search yet.</p>
          ) : null}

          <div className={styles.userList}>
            {results.map((item) => (
              <Link key={item.id} to={`/profile/${item.id}`} className={styles.userCard}>
                <div className={styles.avatar} aria-hidden="true" style={{ overflow: 'hidden' }}>
                  {resolveAssetUrl(item.avatar_url) ? (
                    <img
                      src={resolveAssetUrl(item.avatar_url)}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    (item.display_name || item.username || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className={styles.userName}>{item.display_name || item.username}</p>
                  <p className={styles.userMeta}>@{item.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Trending posts</h2>
          <button type="button" className={styles.retryButton} onClick={loadTrending} aria-label="Refresh trending">
            Refresh
          </button>
        </div>

        {postsLoading ? <p className={styles.status}>Loading trending posts...</p> : null}
        {postsError ? <p className={styles.error}>{postsError}</p> : null}

        {!postsLoading && !postsError && posts.length === 0 ? (
          <p className={styles.status}>The discover stream is quiet right now.</p>
        ) : null}

        <div className={styles.postList}>
          {posts.map((post) => {
            const feedback = commentFeedback[post.id];

            return (
            <article key={post.id} className={styles.postCard}>
              <div className={styles.postHeader}>
                <div className={styles.avatarSmall} aria-hidden="true" style={{ overflow: 'hidden' }}>
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
                  <Link to={`/profile/${post.user_id}`} className={styles.userName}>
                    {post.display_name || post.username}
                  </Link>
                  <p className={styles.userMeta}>
                    @{post.username} | <span className={styles.timestamp}>{formatRelativeTime(post.created_at)}</span>
                  </p>
                </div>
              </div>
              <p className={styles.postContent}>{post.content || 'This post was shared with media only.'}</p>
              {post.media_url ? (
                <div className={styles.mediaWrap}>
                  {post.media_type === 'video' ? (
                    <video className={styles.media} controls preload="metadata">
                      <source src={getMediaUrl(post)} type="video/mp4" />
                    </video>
                  ) : (
                    <img
                      className={styles.media}
                      src={getMediaUrl(post)}
                      alt={`Post media from ${post.display_name || post.username}`}
                    />
                  )}
                </div>
              ) : null}
              <div className={styles.postFooter}>
                <button
                  type="button"
                  className={`${styles.actionButton} ${Number(post.viewer_has_liked) ? styles.actionButtonLiked : ''}`}
                  onClick={() => handleLike(post.id)}
                  aria-label={Number(post.viewer_has_liked) ? 'Unlike this post' : 'Like this post'}
                  disabled={likeBusyPostId === post.id}
                >
                  {Number(post.viewer_has_liked) ? 'Liked' : 'Like'} {Number(post.like_count || 0)}
                </button>
                <button
                  type="button"
                  className={`${styles.actionButton} ${activeCommentPostId === post.id ? styles.actionButtonComment : ''}`}
                  onClick={() => setActiveCommentPostId((current) => (current === post.id ? null : post.id))}
                  aria-label="Write a comment on this post"
                >
                  Comment {Number(post.comment_count || 0)}
                </button>
                <Link to={`/post/${post.id}`} className={styles.detailLink}>
                  Open thread
                </Link>
                {user && String(user.id) === String(post.user_id) ? (
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                    onClick={() => handleDelete(post.id)}
                    aria-label="Delete this post"
                    disabled={deleteBusyPostId === post.id}
                  >
                    {deleteBusyPostId === post.id ? 'Deleting...' : 'Delete'}
                  </button>
                ) : null}
              </div>
              {activeCommentPostId === post.id ? (
                <div className={styles.commentBox}>
                  <label className={styles.commentLabel} htmlFor={`discover-comment-${post.id}`}>
                    Add a comment
                  </label>
                  <textarea
                    id={`discover-comment-${post.id}`}
                    className={styles.commentInput}
                    value={commentDrafts[post.id] || ''}
                    onChange={(event) =>
                      setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))
                    }
                    rows={3}
                    placeholder="Join the conversation"
                  />
                  <div className={styles.commentActions}>
                    <button
                      type="button"
                      className={styles.commentSubmit}
                      onClick={() => handleCommentSubmit(post.id)}
                      aria-label="Submit comment"
                      disabled={commentBusyPostId === post.id}
                    >
                      {commentBusyPostId === post.id ? 'Sending...' : 'Send comment'}
                    </button>
                    <Link to={`/post/${post.id}`} className={styles.commentDetailLink}>
                      View full conversation
                    </Link>
                  </div>
                  {feedback ? <p className={`${styles.commentMsg} ${styles[feedback.type]}`}>{feedback.text}</p> : null}
                </div>
              ) : null}
            </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

export default Discover;
