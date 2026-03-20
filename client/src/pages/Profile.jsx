import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDiscover } from '../api/postApi.js';
import { userApi } from '../api/userApi.js';
import { useAuthContext } from '../hooks/useAuth.js';
import styles from './Profile.module.css';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function resolveAssetUrl(value) {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  return `http://localhost:5000${value}`;
}

function getMediaUrl(post) {
  return resolveAssetUrl(post?.media_url) || '';
}

function formatRelativeTime(value) {
  if (!value) return 'Now';
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.floor(diff / 3600000));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuthContext();
  const fileInputRef = useRef(null);
  const viewerId = user?.id;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [followBusy, setFollowBusy] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const isOwnProfile = Boolean(user && profile && String(user.id) === String(profile.id));

  const fetchProfile = useCallback(
    async (identifier = id, { showLoading = true } = {}) => {
      if (!identifier) return;

      try {
        if (showLoading) {
          setIsLoading(true);
        }
        setError('');

        const profileResponse = await userApi.getProfile(identifier);
        const nextProfile = profileResponse?.data || profileResponse?.user || profileResponse || null;

        if (!nextProfile) {
          setProfile(null);
          setFollowers([]);
          setFollowing([]);
          setPosts([]);
          setIsFollowing(false);
          return;
        }

        const [followersData, followingData, discoverData] = await Promise.all([
          userApi.getFollowers(nextProfile.id),
          userApi.getFollowing(nextProfile.id),
          getDiscover(null, 50)
        ]);

        const nextFollowers = Array.isArray(followersData?.items) ? followersData.items : [];
        const nextFollowing = Array.isArray(followingData?.items) ? followingData.items : [];
        const discoverPosts = Array.isArray(discoverData?.items) ? discoverData.items : [];

        setProfile(nextProfile);
        setFollowers(nextFollowers);
        setFollowing(nextFollowing);
        setPosts(discoverPosts.filter((item) => String(item.user_id) === String(nextProfile.id)));

        if (viewerId && String(viewerId) !== String(nextProfile.id)) {
          const viewerFollowing = await userApi.getFollowing(viewerId);
          const viewerFollowingItems = Array.isArray(viewerFollowing?.items) ? viewerFollowing.items : [];
          setIsFollowing(
            viewerFollowingItems.some((item) => String(item.id) === String(nextProfile.id))
          );
        } else {
          setIsFollowing(false);
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
        setError(getErrorMessage(err, 'Could not load profile'));
      } finally {
        setIsLoading(false);
      }
    },
    [id, viewerId]
  );

  useEffect(() => {
    void fetchProfile(id);
  }, [fetchProfile, id]);

  const resharesReceived = useMemo(
    () => posts.filter((item) => Number(item.is_reshare) === 1).length,
    [posts]
  );

  const handleFollow = async () => {
    if (!profile || !user) return;

    setFollowBusy(true);
    try {
      const result = await userApi.followUser(profile.id);
      const nowFollowing = Boolean(result?.following);
      setIsFollowing(nowFollowing);
      setFollowers((current) =>
        nowFollowing
          ? [...current, { id: user.id, username: user.username, display_name: user.display_name }]
          : current.filter((item) => String(item.id) !== String(user.id))
      );
    } catch (followError) {
      setError(getErrorMessage(followError, 'Unable to update the follow status.'));
    } finally {
      setFollowBusy(false);
    }
  };

  const startEditing = () => {
    if (!profile) return;
    setEditDisplayName(profile.display_name || '');
    setEditBio(profile.bio || '');
    setEditAvatarPreview(resolveAssetUrl(profile.avatar_url));
    setEditAvatar(null);
    setEditError(null);
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setEditSaving(true);
    setEditError(null);

    try {
      const formData = new FormData();
      formData.append('displayName', editDisplayName);
      formData.append('bio', editBio);
      if (editAvatar) {
        formData.append('avatar', editAvatar);
      }

      const response = await userApi.updateProfile(user.id, formData);
      const updatedUser = response?.data || response?.user || response;

      if (updatedUser?.id) {
        updateUser(updatedUser);
        setProfile((previous) => ({
          ...(previous || {}),
          ...updatedUser,
          display_name: updatedUser.display_name,
          bio: updatedUser.bio,
          avatar_url: updatedUser.avatar_url
        }));
        setEditAvatarPreview(resolveAssetUrl(updatedUser.avatar_url));
        await fetchProfile(user.id, { showLoading: false });
      }

      setIsEditing(false);
      setEditAvatar(null);
    } catch (err) {
      setEditError(getErrorMessage(err, 'Failed to save'));
    } finally {
      setEditSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.page}>
        <p className={styles.status}>Loading profile...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.page}>
        <div className={styles.messageCard}>
          <p className={styles.error}>{error}</p>
          <Link to="/discover" className={styles.primaryAction}>
            Back to discover
          </Link>
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className={styles.page}>
        <div className={styles.messageCard}>
          <p className={styles.status}>This profile could not be found.</p>
        </div>
      </section>
    );
  }

  const avatarUrl = resolveAssetUrl(profile.avatar_url);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.nameSection}>
          {!isEditing ? (
            <>
              <h1 className={styles.displayName}>{profile.display_name || profile.username}</h1>
              <p className={styles.username}>@{profile.username}</p>
              {profile.bio ? <p className={styles.bio}>{profile.bio}</p> : null}
            </>
          ) : (
            isOwnProfile && (
              <div className={styles.editForm}>
                <div className={styles.editAvatarRow}>
                  <div
                    className={styles.editAvatarClick}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <div className={styles.avatar} style={{ overflow: 'hidden' }}>
                      {editAvatarPreview ? (
                        <img
                          src={editAvatarPreview}
                          alt="preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        (profile.display_name || profile.username || 'P').charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className={styles.avatarEditOverlay}>Change photo</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setEditAvatar(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setEditAvatarPreview(reader.result);
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>Display name</label>
                  <input
                    className={styles.editInput}
                    value={editDisplayName}
                    onChange={(event) => setEditDisplayName(event.target.value)}
                    maxLength={80}
                    placeholder="Your display name"
                  />
                </div>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>
                    Bio
                    <span className={styles.editCharCount}>{editBio.length}/300</span>
                  </label>
                  <textarea
                    className={styles.editTextarea}
                    value={editBio}
                    onChange={(event) => setEditBio(event.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="Tell people about yourself"
                  />
                </div>
                {editError ? <p className={styles.editError}>{editError}</p> : null}
                <div className={styles.editActions}>
                  <button
                    className={styles.cancelEditBtn}
                    onClick={() => setIsEditing(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.saveEditBtn}
                    onClick={handleSaveProfile}
                    disabled={editSaving}
                    type="button"
                  >
                    {editSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        <div className={styles.headerSide}>
          <div className={styles.avatar} aria-hidden="true" style={{ overflow: 'hidden' }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile.display_name || profile.username}
                key={profile.avatar_url}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              (profile.display_name || profile.username || 'P').charAt(0).toUpperCase()
            )}
          </div>

          {isOwnProfile ? (
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={startEditing}
              aria-label="Edit profile"
            >
              Edit profile
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={handleFollow}
              aria-label={isFollowing ? 'Unfollow this user' : 'Follow this user'}
              disabled={followBusy}
            >
              {followBusy ? 'Updating...' : isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </header>

      <section className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{posts.length}</span>
          <span className={styles.statLabel}>Posts</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{followers.length}</span>
          <span className={styles.statLabel}>Followers</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{following.length}</span>
          <span className={styles.statLabel}>Following</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.sage}`}>{resharesReceived}</span>
          <span className={styles.statLabel}>Reshares received</span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Posts</h2>

        {posts.length === 0 ? (
          <div className={styles.messageCard}>
            <p className={styles.status}>No posts from this profile have appeared in discover yet.</p>
          </div>
        ) : (
          <div className={styles.postsGrid}>
            {posts.map((post) => (
              <div
                key={post.id}
                className={styles.postMiniCard}
                onClick={() => navigate(`/post/${post.id}`)}
              >
                {post.media_url && (
                  <div className={styles.miniCardImage}>
                    {post.media_type === 'video' ? (
                      <video
                        src={getMediaUrl(post)}
                        className={styles.miniCardMedia}
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={getMediaUrl(post)}
                        alt="Post media"
                        className={styles.miniCardMedia}
                      />
                    )}
                  </div>
                )}
                <div className={styles.miniCardBody}>
                  <p className={styles.miniPostContent}>
                    {post.content
                      ? post.content.length > 80
                        ? `${post.content.slice(0, 80)}...`
                        : post.content
                      : post.media_url
                        ? 'Photo'
                        : ''}
                  </p>
                  <span className={styles.miniPostTime}>
                    {post.timeAgo || formatRelativeTime(post.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isOwnProfile ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Origin contributions</h2>
          <div className={styles.messageCard}>
            <p className={styles.status}>Your content has been reshared {resharesReceived} times.</p>
          </div>
        </section>
      ) : null}
    </section>
  );
}

export default Profile;
