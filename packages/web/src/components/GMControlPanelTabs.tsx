import type { GmControlPanelId } from '../data/gmControlModel';
import styles from './GMControlPanelTabs.module.css';

interface GMControlPanelTabsProps {
  activePanel: GmControlPanelId;
  onChangePanel: (panel: GmControlPanelId) => void;
}

export function GMControlPanelTabs({ activePanel, onChangePanel }: GMControlPanelTabsProps) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="GM control center panels">
      <button
        type="button"
        role="tab"
        aria-selected={activePanel === 'step'}
        className={`${styles.button} ${activePanel === 'step' ? 'is-active' : ''}`.trim()}
        onClick={() => onChangePanel('step')}
      >
        Current Step
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activePanel === 'graph'}
        className={`${styles.button} ${activePanel === 'graph' ? 'is-active' : ''}`.trim()}
        onClick={() => onChangePanel('graph')}
      >
        Whole Graph
      </button>
    </div>
  );
}
