import type { ReactNode } from 'react';
import type { GmUtilityId } from '../data/gmControlModel';

interface GMUtilitiesDockProps {
  utility: GmUtilityId | null;
  onClose: () => void;
  children: ReactNode;
}

export function GMUtilitiesDock({ utility, onClose, children }: GMUtilitiesDockProps) {
  if (!utility) {
    return null;
  }

  return (
    <aside className="c-gm-utility-dock" aria-label="GM utility dock">
      <div className="l-row">
        <h2 className="t-h4">{readUtilityTitle(utility)}</h2>
        <button type="button" className="c-btn" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </aside>
  );
}

function readUtilityTitle(utility: GmUtilityId): string {
  switch (utility) {
    case 'timeseries':
      return 'Timeseries';
    case 'transcript':
      return 'Transcript';
    case 'status':
      return 'Command Status';
  }
}
