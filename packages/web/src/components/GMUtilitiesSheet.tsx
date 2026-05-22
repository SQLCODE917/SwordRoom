import type { ReactNode } from 'react';
import type { GmUtilityId } from '../data/gmControlModel';
import styles from './GMUtilitiesSheet.module.css';

interface GMUtilitiesSheetProps {
  utility: GmUtilityId | null;
  onClose: () => void;
  children: ReactNode;
}

export function GMUtilitiesSheet({ utility, onClose, children }: GMUtilitiesSheetProps) {
  if (!utility) {
    return null;
  }

  return (
    <>
      <button
        className={styles.backdrop}
        type="button"
        aria-label="Close utility panel"
        onClick={onClose}
      />
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-label="GM utility panel">
        <div className="l-row">
          <h2 className="t-h4">{readUtilityTitle(utility)}</h2>
          <button type="button" className="c-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </section>
    </>
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
