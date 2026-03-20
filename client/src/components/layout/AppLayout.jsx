import { Outlet } from 'react-router-dom';
import LeftSidebar from './LeftSidebar.jsx';
import RightPanel from './RightPanel.jsx';
import TopBar from './TopBar.jsx';
import BottomNav from './BottomNav.jsx';
import styles from './AppLayout.module.css';

function AppLayout() {
  return (
    <>
      <TopBar />
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <LeftSidebar />
        </aside>
        <main className={styles.main}>
          <Outlet />
        </main>
        <aside className={styles.rightPanel}>
          <RightPanel />
        </aside>
      </div>
      <BottomNav />
    </>
  );
}

export default AppLayout;
