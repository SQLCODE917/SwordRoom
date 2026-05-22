import type { GmPlayMode } from '../data/gmControlModel';
import styles from './GMPlayModeNav.module.css';

interface GMPlayModeNavProps {
  activeMode: GmPlayMode;
  onChangeMode: (mode: GmPlayMode) => void;
}

export function GMPlayModeNav({ activeMode, onChangeMode }: GMPlayModeNavProps) {
  return (
    <nav className={styles.nav} aria-label="GM play modes">
      <button
        type="button"
        className={`${styles.button} ${activeMode === 'control' ? 'is-active' : ''}`.trim()}
        aria-pressed={activeMode === 'control'}
        onClick={() => onChangeMode('control')}
      >
        Control Center
      </button>
      <button
        type="button"
        className={`${styles.button} ${activeMode === 'chat' ? 'is-active' : ''}`.trim()}
        aria-pressed={activeMode === 'chat'}
        onClick={() => onChangeMode('chat')}
      >
        Chat
      </button>
    </nav>
  );
}
