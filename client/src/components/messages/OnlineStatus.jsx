import styles from './Messages.module.css';
function OnlineStatus({ online }) { return <span className={`${styles.status} ${online ? styles.online : ''}`} title={online ? 'Online' : 'Offline'} />; }
export default OnlineStatus;
