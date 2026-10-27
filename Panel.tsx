import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  /** Rendered right of the title — counts, badges, run state. */
  aside?: ReactNode;
  children: ReactNode;
  /**
   * Announce content changes to screen readers. Used by the activity feed,
   * where the arrival of a message is the information.
   */
  live?: boolean;
  className?: string;
}

export function Panel({ title, aside, children, live, className }: PanelProps): React.JSX.Element {
  return (
    <section className={`panel ${className ?? ''}`} aria-label={title}>
      <header className="panel-head">
        <h2>{title}</h2>
        {aside}
      </header>
      <div className="panel-body" {...(live ? { 'aria-live': 'polite' as const } : {})}>
        {children}
      </div>
    </section>
  );
}
