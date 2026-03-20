import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addComment, createPost, deletePost, getFeed, likePost } from '../api/postApi.js';
import api from '../api/axiosInstance.js';
import { useAuthContext } from '../hooks/useAuth.js';
import styles from './Feed.module.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatRelativeTime(value) {
  if (!value) return 'Now';
  const then = new Date(value).getTime();
  const diff = Math.max(1, Date.now() - then);
  const minutes = Math.floor(diff / 60000);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(value).toLocaleDateString();
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function postAuthor(post) {
  return post?.display_name || post?.username || 'Unknown author';
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

function isResharePost(post) {
  return (
    post?.is_reshare === 1 ||
    post?.is_reshare === true ||
    post?.isReshare === 1 ||
    post?.isReshare === true
  );
}

function getOriginalPostId(post) {
  return post?.original_post_id || post?.originalPostId || null;
}

function getOriginalOwnerUsername(post) {
  return (
    post?.original_owner_username ||
    post?.originalOwnerUsername ||
    post?.originalPost?.user?.username ||
    post?.original_post?.user?.username ||
    null
  );
}

function Feed() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [shieldEnabled, setShieldEnabled] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [showComposerError, setShowComposerError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shieldReports, setShieldReports] = useState({});
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentFeedback, setCommentFeedback] = useState({});
  const [commentBusyPostId, setCommentBusyPostId] = useState(null);
  const [likeBusyPostId, setLikeBusyPostId] = useState(null);
  const [deleteBusyPostId, setDeleteBusyPostId] = useState(null);
  const [socketToast, setSocketToast] = useState(null);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    if (!mediaFile) {
      setMediaPreview('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(mediaFile);
    setMediaPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [mediaFile]);

  useEffect(() => {
    if (!infoMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setInfoMessage('');
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [infoMessage]);

  const loadFeed = async ({ nextCursor = null, append = false } = {}) => {
    const setLoadingState = append ? setIsLoadingMore : setIsLoading;
    setLoadingState(true);
    setError('');

    try {
      const data = await getFeed(nextCursor, 10);
      const items = Array.isArray(data?.items) ? data.items : [];
      setPosts((current) => (append ? [...current, ...items] : items));
      setCursor(data?.nextCursor || null);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load your feed right now.'));
    } finally {
      setLoadingState(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    let active = true;
    const ownShieldedPosts = posts.filter(
      (post) =>
        (post.shield_active || post.shieldActive) &&
        user &&
        String(user.id) === String(post.user_id)
    );

    if (!ownShieldedPosts.length) {
      return undefined;
    }

    const loadShieldReports = async () => {
      const results = await Promise.all(
        ownShieldedPosts.map(async (post) => {
          try {
            const response = await api.get(`/posts/${post.id}/shield/status`);
            return [post.id, response.data];
          } catch {
            return null;
          }
        })
      );

      if (!active) {
        return;
      }

      setShieldReports((current) => {
        const next = { ...current };
        results.forEach((entry) => {
          if (!entry) return;
          next[entry[0]] = entry[1];
        });
        return next;
      });
    };

    loadShieldReports();

    return () => {
      active = false;
    };
  }, [posts, user]);

  useEffect(() => {
    const openComposer = () => {
      composerRef.current?.focus();
    };

    window.addEventListener('tv:openComposer', openComposer);
    return () => {
      window.removeEventListener('tv:openComposer', openComposer);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handlePostRemoved = (event) => {
      const postId = event.detail?.postId;
      if (!postId) {
        return;
      }

      setPosts((prev) => prev.filter((post) => post.id !== postId));
      setShieldReports((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
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
    };

    window.addEventListener('post:removed', handlePostRemoved);
    return () => window.removeEventListener('post:removed', handlePostRemoved);
  }, []);

  useEffect(() => {
    const handleShieldStateUpdate = (event) => {
      const postId = event.detail?.postId;
      const shieldActive = Boolean(event.detail?.shieldActive);

      if (!postId) {
        return;
      }

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, shield_active: shieldActive ? 1 : 0, shieldActive }
            : post
        )
      );
    };

    window.addEventListener('post:shield-updated', handleShieldStateUpdate);
    return () => window.removeEventListener('post:shield-updated', handleShieldStateUpdate);
  }, []);

  useEffect(() => {
    const handleToast = (event) => {
      const message = event.detail?.message;
      const tone = event.detail?.tone || 'info';
      const duration = Number(event.detail?.duration || 5000);

      if (!message) {
        return;
      }

      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }

      setSocketToast({ message, tone });
      toastTimerRef.current = window.setTimeout(() => {
        setSocketToast(null);
        toastTimerRef.current = null;
      }, duration);
    };

    window.addEventListener('tv:toast', handleToast);
    return () => window.removeEventListener('tv:toast', handleToast);
  }, []);

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const trimmed = content.trim();

    if (!trimmed && !mediaFile) {
      setShowComposerError(true);
      setSubmitError('Write something or attach an image before posting.');
      return;
    }

    setShowComposerError(false);
    setIsSubmitting(true);
    setSubmitError('');
    setInfoMessage('');

    try {
      const formData = new FormData();
      if (trimmed) {
        formData.append('content', trimmed);
      }
      if (mediaFile) {
        formData.append('media', mediaFile);
      }
      formData.append('shieldEnabled', String(shieldEnabled));
      const data = await createPost(formData);

      if (data?.removed) {
        setSubmitError(`Post not published: ${data.message}`);
        return;
      }

      const payload = data?.data || data;
      const createdPost = payload?.post || null;

      if (createdPost) {
        setPosts((current) => [createdPost, ...current]);
      } else {
        await loadFeed();
      }

      if (payload?.isDuplicate || data?.isDuplicate) {
        setInfoMessage(
          data?.message ||
            (getOriginalOwnerUsername(createdPost)
              ? `This is @${getOriginalOwnerUsername(createdPost)}'s post.`
              : 'This post was shared with credit to the original creator.')
        );
      }

      setContent('');
      setMediaFile(null);
      setShieldEnabled(false);
      setShowComposerError(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Your post could not be published.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;

    if (!nextFile) {
      setShowComposerError(false);
      setSubmitError('');
      setMediaFile(null);
      return;
    }

    if (!nextFile.type.startsWith('image/')) {
      setSubmitError('Only image uploads are enabled in the composer right now.');
      event.target.value = '';
      return;
    }

    setShowComposerError(false);
    setSubmitError('');
    setMediaFile(nextFile);
  };

  const clearSelectedMedia = () => {
    setShowComposerError(false);
    setSubmitError('');
    setMediaFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

  const handleDeactivateShield = async (postId) => {
    try {
      await api.post(`/posts/${postId}/shield/deactivate`);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, shield_active: 0, shieldActive: false }
            : post
        )
      );
      setShieldReports((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
    } catch (error) {
      console.error('Failed to deactivate shield:', error);
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
      <div className={styles.feedTopbar}>
        <span className={styles.feedLogo}>TrueVoice</span>
        <span className={styles.feedBadge}>Chronological</span>
      </div>

      <p className={styles.greeting}>
        {getGreeting()} {'\u2014'} here's what's new
      </p>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <label className={styles.composerLabel} htmlFor="post-content">
          Share an update
        </label>
        <textarea
          id="post-content"
          ref={composerRef}
          className={[
            styles.textarea,
            content.trim() ? styles.textareaActive : '',
            showComposerError && !content.trim() && !mediaFile ? styles.textareaError : ''
          ]
            .filter(Boolean)
            .join(' ')}
          placeholder="What's on your mind?"
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setShowComposerError(false);
            setSubmitError('');
          }}
          rows={4}
          aria-invalid={showComposerError && !content.trim() && !mediaFile}
        />
        <div className={styles.uploadRow}>
          <input
            ref={fileInputRef}
            id="post-media"
            className={styles.fileInput}
            type="file"
            accept="image/png,image/jpeg,image/gif"
            onChange={handleFileChange}
          />
          <label className={styles.uploadButton} htmlFor="post-media">
            Add photo
          </label>
          {mediaFile ? (
            <button
              type="button"
              className={styles.clearMediaButton}
              onClick={clearSelectedMedia}
              aria-label="Remove selected image"
            >
              Remove
            </button>
          ) : null}
          <span className={styles.uploadMeta}>
            {mediaFile ? mediaFile.name : 'JPG, PNG, or GIF up to 10MB'}
          </span>
        </div>
        {mediaPreview ? (
          <div className={styles.previewWrap}>
            <img className={styles.previewImage} src={mediaPreview} alt="Selected post media preview" />
          </div>
        ) : null}
        <div className={styles.shieldToggleRow}>
          <div className={styles.shieldToggleInfo}>
            <span className={styles.shieldToggleIcon}>{'\uD83D\uDEE1'}</span>
            <div>
              <span className={styles.shieldToggleLabel}>Shield Mode</span>
              <span className={styles.shieldToggleDesc}>Auto-activates if abuse is detected</span>
            </div>
          </div>
          <button
            type="button"
            className={`${styles.shieldToggleBtn} ${shieldEnabled ? styles.shieldOn : ''}`}
            onClick={() => setShieldEnabled((value) => !value)}
            aria-label="Toggle Shield Mode"
            role="switch"
            aria-checked={shieldEnabled}
          >
            <span className={styles.shieldToggleKnob} />
          </button>
        </div>
        <div className={styles.composerFooter}>
          <p className={styles.composerHint}>Posts keep their original credit whenever they are reshared.</p>
          <button type="submit" className={styles.submitButton} aria-label="Publish post" disabled={isSubmitting}>
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>
        {socketToast ? (
          <p className={socketToast.tone === 'warning' ? styles.messageError : styles.infoMessage}>
            {socketToast.message}
          </p>
        ) : null}
        {infoMessage ? <p className={styles.infoMessage}>{infoMessage}</p> : null}
        {submitError ? <p className={styles.messageError}>{submitError}</p> : null}
      </form>

      {isLoading ? <p className={styles.status}>Loading your feed...</p> : null}

      {!isLoading && error ? (
        <div className={styles.feedbackCard}>
          <p className={styles.messageError}>{error}</p>
          <button type="button" className={styles.retryButton} onClick={() => loadFeed()} aria-label="Retry feed">
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !error && posts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIllustration} aria-hidden="true">
            <span className={styles.circle1} />
            <span className={styles.circle2} />
            <span className={styles.line1} />
            <span className={styles.line2} />
          </div>
          <p className={styles.emptyTitle}>Your feed is empty</p>
          <p className={styles.emptySubtitle}>Follow people to see their posts here</p>
          <button
            type="button"
            className={styles.discoverBtn}
            onClick={() => navigate('/discover')}
            aria-label="Discover people"
          >
            Discover people
          </button>
        </div>
      ) : null}

      {!isLoading && !error && posts.length > 0 ? (
        <div className={styles.feedList}>
          {posts.map((post) => {
            const isReshare = isResharePost(post);
            const originalPostId = getOriginalPostId(post);
            const originalUsername = getOriginalOwnerUsername(post);
            const isShieldActive = post.shield_active || post.shieldActive;
            const isOwnPost = user && String(user.id) === String(post.user_id);
            const shieldReport = shieldReports[post.id];
            const feedback = commentFeedback[post.id];

            return (
              <article
                key={post.id}
                className={styles.postCard}
                data-shield={isShieldActive ? 'true' : 'false'}
                data-reshare={isReshare ? 'true' : 'false'}
                style={{
                  borderLeftColor: isReshare ? 'var(--sage)' : isShieldActive ? 'var(--accent)' : 'var(--gold)'
                }}
              >
                {isReshare && originalUsername && originalPostId ? (
                  <Link
                    to={`/post/${originalPostId}`}
                    className={styles.originRibbon}
                    title="View original post"
                    aria-label={`View the original post by ${originalUsername}`}
                  >
                    {'\u21A9'} Originally by @{originalUsername}
                  </Link>
                ) : null}
                <div className={styles.postHeader}>
                  <div className={styles.avatar} aria-hidden="true" style={{ overflow: 'hidden' }}>
                    {resolveAssetUrl(post.avatar_url) ? (
                      <img
                        src={resolveAssetUrl(post.avatar_url)}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      postAuthor(post).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className={styles.postMeta}>
                    <Link to={`/profile/${post.user_id}`} className={styles.postName}>
                      {postAuthor(post)}
                    </Link>
                    <p className={styles.postSubline}>
                      @{post.username || 'unknown'} |{' '}
                      <time className={styles.timestamp} dateTime={post.created_at}>
                        {formatRelativeTime(post.created_at)}
                      </time>
                    </p>
                  </div>
                </div>

                {post.content ? <p className={styles.postContent}>{post.content}</p> : null}

                {post.media_url ? (
                  <div className={styles.mediaWrap}>
                    {post.media_type === 'video' ? (
                      <video className={styles.media} controls preload="metadata">
                        <source src={getMediaUrl(post)} type="video/mp4" />
                      </video>
                    ) : (
                      <img className={styles.media} src={getMediaUrl(post)} alt={`Post media from ${postAuthor(post)}`} />
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
                      <button
                        type="button"
                        className={styles.shieldOffBtn}
                        onClick={() => handleDeactivateShield(post.id)}
                      >
                        Turn off
                      </button>
                    ) : null}
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
                    onClick={() =>
                      setActiveCommentPostId((current) => (current === post.id ? null : post.id))
                    }
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
                    <label className={styles.commentLabel} htmlFor={`feed-comment-${post.id}`}>
                      Add a comment
                    </label>
                    <textarea
                      id={`feed-comment-${post.id}`}
                      className={styles.commentInput}
                      value={commentDrafts[post.id] || ''}
                      onChange={(event) =>
                        setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))
                      }
                      rows={3}
                      placeholder="Say something thoughtful"
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
                    {feedback ? (
                      <p className={`${styles.commentMsg} ${styles[feedback.type]}`}>{feedback.text}</p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {!isLoading && cursor ? (
        <button
          type="button"
          className={styles.loadMoreButton}
          onClick={() => loadFeed({ nextCursor: cursor, append: true })}
          aria-label="Load more posts"
          disabled={isLoadingMore}
        >
          {isLoadingMore ? 'Loading...' : 'Load more'}
        </button>
      ) : null}

      {!user ? <p className={styles.status}>Please sign in again to continue.</p> : null}
    </section>
  );
}

export default Feed;
