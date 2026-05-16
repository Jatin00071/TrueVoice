import { Outlet, useLocation } from 'react-router-dom';
import LeftSidebar from './LeftSidebar.jsx';
import RightPanel from './RightPanel.jsx';
import TopBar from './TopBar.jsx';
import BottomNav from './BottomNav.jsx';
import styles from './AppLayout.module.css';

function AppLayout() {
  const location = useLocation();
  const isMessagesPage = location.pathname.startsWith('/messages');

  return (
    <>
      <TopBar />
      <div className={`${styles.layout} ${isMessagesPage ? styles.messagesLayout : ''}`.trim()}>
        <aside className={styles.sidebar}>
          <LeftSidebar />
        </aside>
        <main className={styles.main}>
          <Outlet />
        </main>
        {!isMessagesPage ? (
          <aside className={styles.rightPanel}>
            <RightPanel />
          </aside>
        ) : null}
      </div>
      <BottomNav />
    </>
  );
}

export default AppLayout;
