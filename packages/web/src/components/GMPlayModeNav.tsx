import type { GmPlayMode } from '../data/gmControlModel';

interface GMPlayModeNavProps {
  activeMode: GmPlayMode;
  onChangeMode: (mode: GmPlayMode) => void;
}

export function GMPlayModeNav({ activeMode, onChangeMode }: GMPlayModeNavProps) {
  return (
    <nav className="c-gm-play-nav" aria-label="GM play modes">
      <button
        type="button"
        className={`c-gm-play-nav__button ${activeMode === 'control' ? 'is-active' : ''}`.trim()}
        aria-pressed={activeMode === 'control'}
        onClick={() => onChangeMode('control')}
      >
        Control Center
      </button>
      <button
        type="button"
        className={`c-gm-play-nav__button ${activeMode === 'chat' ? 'is-active' : ''}`.trim()}
        aria-pressed={activeMode === 'chat'}
        onClick={() => onChangeMode('chat')}
      >
        Chat
      </button>
    </nav>
  );
}
