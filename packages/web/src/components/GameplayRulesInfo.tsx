import { useState } from 'react';
import type { GameplayInfoTopicId } from '@starter/shared';
import { gameplayRulesByTopicId } from '../data/gmGameplayRules';

interface GameplayRulesInfoProps {
  topicId: GameplayInfoTopicId | null;
}

export function GameplayRulesInfo({ topicId }: GameplayRulesInfoProps) {
  const [open, setOpen] = useState(false);

  if (!topicId) {
    return null;
  }

  const rules = gameplayRulesByTopicId[topicId];

  return (
    <section className="c-gm-rules" aria-label="Step rules info">
      <div className="l-row">
        <div className="l-col l-tight">
          <h3 className="t-h4">{rules.title}</h3>
          <span className="t-small">{rules.summary}</span>
        </div>
        <button
          type="button"
          className="c-btn"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? 'Hide Info' : 'Show Info'}
        </button>
      </div>
      {open ? (
        <ul className="c-gm-rules__list">
          {rules.bullets.map((bullet) => (
            <li key={bullet} className="t-small">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
