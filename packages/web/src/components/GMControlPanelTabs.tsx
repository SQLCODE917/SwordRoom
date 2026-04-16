import type { GmControlPanelId } from '../data/gmControlModel';

interface GMControlPanelTabsProps {
  activePanel: GmControlPanelId;
  onChangePanel: (panel: GmControlPanelId) => void;
}

export function GMControlPanelTabs({ activePanel, onChangePanel }: GMControlPanelTabsProps) {
  return (
    <div className="c-gm-control-tabs" role="tablist" aria-label="GM control center panels">
      <button
        type="button"
        role="tab"
        aria-selected={activePanel === 'step'}
        className={`c-gm-control-tabs__button ${activePanel === 'step' ? 'is-active' : ''}`.trim()}
        onClick={() => onChangePanel('step')}
      >
        Current Step
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activePanel === 'graph'}
        className={`c-gm-control-tabs__button ${activePanel === 'graph' ? 'is-active' : ''}`.trim()}
        onClick={() => onChangePanel('graph')}
      >
        Whole Graph
      </button>
    </div>
  );
}
