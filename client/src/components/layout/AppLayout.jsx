import { Outlet, useLocation } from 'react-router-dom';
import LeftSidebar from './LeftSidebar.jsx';
import RightPanel from './RightPanel.jsx';
import TopBar from './TopBar.jsx';
import BottomNav from './BottomNav.jsx';
import styles from './AppLayout.module.css';

function AppLayout() {
  const location = useLocation();
  const isMessagesPage = location.pathname.startsWith('/messages');
  const isMessagesChat = isMessagesPage && new URLSearchParams(location.search).has('conversation');

  return (
    <>
      <div className={isMessagesChat ? styles.mobileHiddenOnChat : ''}>
        <TopBar />
      </div>
      <div className={`${styles.layout} ${isMessagesPage ? styles.messagesLayout : ''} ${isMessagesChat ? styles.chatFocusedLayout : ''}`.trim()}>
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
      <div className={isMessagesChat ? styles.mobileHiddenOnChat : ''}>
        <BottomNav />
      </div>
    </>
  );
}

export default AppLayout;
