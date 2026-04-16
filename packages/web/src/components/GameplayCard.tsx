interface GameplayCardProps {
  eyebrow: string;
  title: string;
  summary: string;
  focusPrompt: string;
  facts: string[];
  ariaLabel: string;
  compact?: boolean;
}

export function GameplayCard({
  eyebrow,
  title,
  summary,
  focusPrompt,
  facts,
  ariaLabel,
  compact = false,
}: GameplayCardProps) {
  return (
    <section
      className={`c-gameplay-card ${compact ? 'c-gameplay-card--compact' : ''}`.trim()}
      aria-label={ariaLabel}
    >
      <div className="c-gameplay-card__eyebrow t-small">{eyebrow}</div>
      <h3 className="t-h3">{title}</h3>
      <p className="t-small">{summary}</p>
      <div className="c-gameplay-card__prompt">{focusPrompt}</div>
      <div className="c-gameplay-card__facts">
        {facts.map((fact) => (
          <span key={fact} className="c-gameplay-card__fact">
            {fact}
          </span>
        ))}
      </div>
    </section>
  );
}
