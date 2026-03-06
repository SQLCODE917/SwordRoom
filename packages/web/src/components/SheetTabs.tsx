import type { ReactNode } from 'react';

export interface SheetTabItem {
  id: string;
  title: string;
  panel: ReactNode;
}

interface SheetTabsProps {
  tabs: SheetTabItem[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}

export function SheetTabs({ tabs, activeTabId, onTabChange }: SheetTabsProps) {
  return (
    <div className="c-stepper c-sheet-tabs">
      <div className="l-row" role="tablist" aria-label="Character Sheet Pages">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`c-stepper__step c-btn ${isActive ? 'is-active' : ''}`.trim()}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="c-stepper__title">{tab.title}</span>
            </button>
          );
        })}
      </div>

      <div className="c-sheet-tabs__panes">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <section
              key={tab.id}
              role="tabpanel"
              aria-hidden={!isActive}
              className={`c-stepper__panel c-sheet-tabs__pane ${isActive ? 'is-active' : 'is-disabled'}`.trim()}
            >
              {tab.panel}
            </section>
          );
        })}
      </div>
    </div>
  );
}
