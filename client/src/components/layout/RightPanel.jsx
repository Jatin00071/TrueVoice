import { Link } from 'react-router-dom';
import { useAuthContext } from '../../hooks/useAuth.js';
import styles from './RightPanel.module.css';

function RightPanel() {
  const { user } = useAuthContext();

  const suggestions = [
    {
      name: 'Asha Raman',
      handle: 'asharaman',
      note: 'Sharp essays on culture and memory.',
      initial: 'A'
    },
    {
      name: 'Miles Kent',
      handle: 'milesk',
      note: 'Quiet photography threads with strong attribution.',
      initial: 'M'
    },
    {
      name: 'Sana Idris',
      handle: 'sanaspeaks',
      note: 'Community-first storytelling with warm replies.',
      initial: 'S'
    }
  ];

  const origins = [
    {
      title: 'Photo essays with attribution are climbing',
      meta: 'Editorial visual posts · Warm conversations'
    },
    {
      title: 'Reshared field notes are drawing readers in',
      meta: 'Origin-linked posts · High trust'
    },
    {
      title: 'Shielded discussion threads are staying thoughtful',
      meta: 'Curated replies · Lower noise'
    }
  ];

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.sectionTop}>
          <h3 className={styles.heading}>Who to follow</h3>
          <Link to="/discover" className={styles.inlineLink}>
            Browse
          </Link>
        </div>
        <div className={styles.stack}>
          {suggestions.map((person) => (
            <Link key={person.handle} to="/discover" className={styles.personCard}>
              <div className={styles.personAvatar} aria-hidden="true">
                {person.initial}
              </div>
              <div className={styles.personBody}>
                <p className={styles.personName}>{person.name}</p>
                <p className={styles.personMeta}>@{person.handle}</p>
                <p className={styles.personNote}>{person.note}</p>
              </div>
              <span className={styles.followChip}>Follow</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTop}>
          <h3 className={styles.heading}>Trending origins</h3>
          <span className={styles.signal}>Live</span>
        </div>
        <div className={styles.stack}>
          {origins.map((item) => (
            <div key={item.title} className={styles.storyCard}>
              <p className={styles.storyTitle}>{item.title}</p>
              <p className={styles.storyMeta}>{item.meta}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTop}>
          <h3 className={styles.heading}>Your shield activity</h3>
          <span className={styles.statusPill}>{user?.shield_enabled ? 'Synced' : 'Manual'}</span>
        </div>
        <p className={styles.placeholder}>
          {user
            ? `${user.display_name || user.username}, moderation signals for your posts will surface here the moment they happen.`
            : 'Sign in to watch shield alerts and comment review activity in one place.'}
        </p>

        <div className={styles.activityBanner}>
          <div>
            <p className={styles.bannerLabel}>Post defaults</p>
            <p className={styles.bannerTitle}>
              {user?.shield_enabled ? 'Shield mode is ready by default' : 'You are manually controlling shield mode'}
            </p>
          </div>
          <Link to="/settings" className={styles.inlineLink}>
            Settings
          </Link>
        </div>

        <div className={styles.metricStrip}>
          <div className={styles.metric}>
            <span className={styles.metricValue}>Calm</span>
            <span className={styles.metricLabel}>Conversation tone</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricValue}>0</span>
            <span className={styles.metricLabel}>Items in review</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default RightPanel;
