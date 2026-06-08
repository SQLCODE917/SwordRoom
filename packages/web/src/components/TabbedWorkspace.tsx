import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './TabbedWorkspace.module.css';

export interface TabbedWorkspaceTab {
  id: string;
  label: string;
  href?: string;
  selected?: boolean;
  content?: ReactNode;
}

interface TabbedWorkspaceProps {
  ariaLabel: string;
  tabs: TabbedWorkspaceTab[];
  children?: ReactNode;
  className?: string;
  density?: 'default' | 'compact';
  leadingControl?: ReactNode;
  panelFlush?: boolean;
  panelClassName?: string;
}

export function TabbedWorkspace({
  ariaLabel,
  tabs,
  children,
  className,
  density = 'default',
  leadingControl,
  panelFlush = false,
  panelClassName,
}: TabbedWorkspaceProps) {
  const generatedId = useId();
  const defaultTabId = useMemo(() => {
    return tabs.find((tab) => tab.selected)?.id ?? tabs[0]?.id ?? '';
  }, [tabs]);
  const [localTabId, setLocalTabId] = useState(defaultTabId);
  const activeTabId = tabs.some((tab) => tab.selected)
    ? defaultTabId
    : tabs.some((tab) => tab.id === localTabId)
      ? localTabId
      : defaultTabId;
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
  const panelId = `${generatedId}-panel`;

  return (
    <section
      className={[
        styles.workspace,
        density === 'compact' ? styles.compact : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={ariaLabel}
    >
      <div className={styles.controlRail}>
        {leadingControl ? (
          <div className={styles.leadingControl}>{leadingControl}</div>
        ) : null}
        <nav className={styles.tabList} aria-label={ariaLabel} role="tablist">
          {tabs.map((tab) => {
            const selected = tab.id === activeTabId;
            const tabId = `${generatedId}-${tab.id}-tab`;
            if (tab.href) {
              return (
                <Link
                  key={tab.id}
                  className={`c-btn ${styles.tab}`}
                  to={tab.href}
                  id={tabId}
                  role="tab"
                  aria-selected={selected}
                  aria-current={selected ? 'page' : undefined}
                  aria-controls={panelId}
                >
                  {tab.label}
                </Link>
              );
            }

            return (
              <button
                key={tab.id}
                className={`c-btn ${styles.tab}`}
                type="button"
                id={tabId}
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                onClick={() => setLocalTabId(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div
        id={panelId}
        className={[
          styles.panel,
          panelFlush ? styles.panelFlush : '',
          panelClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        role="tabpanel"
        aria-labelledby={
          activeTab ? `${generatedId}-${activeTab.id}-tab` : undefined
        }
      >
        {children ?? activeTab?.content ?? null}
      </div>
    </section>
  );
}
