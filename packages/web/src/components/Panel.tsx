import type { PropsWithChildren, ReactNode } from 'react';

interface PanelProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
}

export function Panel({ title, subtitle, footer, children }: PanelProps) {
  return (
    <section className="c-panel c-panel--lined l-col" aria-label={title}>
      <div className="c-panel__hd l-col l-tight">
        <h2 className="t-h3">{title}</h2>
        <p className="t-small">{subtitle ?? ' '}</p>
      </div>
      <div className="c-panel__bd">{children}</div>
      <div className="c-panel__ft">{footer ?? <span className="t-small">Reserved action area</span>}</div>
    </section>
  );
}
