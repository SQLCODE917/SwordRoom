import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ButtonLink } from '../components/ButtonLink';
import { Panel } from '../components/Panel';
import { createPregameLobbyViewModel, usePregameLobby } from '../features/pregame-lobby';

export function PregameLobbyPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const state = usePregameLobby(gameId);
  const view = useMemo(() => createPregameLobbyViewModel(state), [state]);

  return (
    <div className="l-page">
      <Panel title={view.title} subtitle={view.subtitle} footer={<LobbyActions actions={view.actions} />}>
        <div className={`c-note ${view.noticeTone === 'error' ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">{view.notice}</span>
        </div>

        {view.status === 'ready' ? (
          <div className="l-split">
            <div className="l-col l-grow">
              <SectionTitle title="Planning Status" />
              <InfoList lines={view.summaryLines} />

              <SectionTitle title="Party Roster" />
              <div className="c-table" role="table" aria-label="Pregame party roster">
                <div className="c-table__head c-table__row" role="row">
                  <div className="c-table__cell t-small">Member</div>
                  <div className="c-table__cell t-small">Role</div>
                  <div className="c-table__cell t-small">Character</div>
                </div>
                {view.rosterRows.map((row) => (
                  <div className="c-table__row" role="row" key={row.key}>
                    <div className="c-table__cell t-small">{row.displayName}</div>
                    <div className="c-table__cell t-small">{row.roleLabel}</div>
                    <div className="c-table__cell t-small">
                      {row.characterTo ? <ButtonLink to={row.characterTo}>Open {row.characterLabel}</ButtonLink> : row.characterLabel}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="l-col l-grow">
              <SectionTitle title="Party Needs" />
              <InfoList lines={view.partyNeedsLines} />

              <SectionTitle title="Recent Activity" />
              <div className="c-table" role="table" aria-label="Pregame recent activity">
                <div className="c-table__head c-table__row" role="row">
                  <div className="c-table__cell t-small">Member</div>
                  <div className="c-table__cell t-small">Message</div>
                  <div className="c-table__cell t-small">When</div>
                </div>
                {view.recentActivityRows.length === 0 ? (
                  <div className="c-table__row" role="row">
                    <div className="c-table__cell t-small">No pregame chat yet. Open Chat to start the planning thread.</div>
                  </div>
                ) : (
                  view.recentActivityRows.map((row) => (
                    <div className="c-table__row" role="row" key={row.key}>
                      <div className="c-table__cell t-small">{row.actorLabel}</div>
                      <div className="c-table__cell t-small">{row.body}</div>
                      <div className="c-table__cell t-small">{row.createdAtLabel}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function LobbyActions({ actions }: { actions: ReadonlyArray<{ label: string; to: string; disabled?: boolean; disabledReason?: string | null }> }) {
  return (
    <div className="l-row">
      {actions.map((action) => (
        <ButtonLink
          key={`${action.label}:${action.to}`}
          to={action.to}
          disabled={action.disabled}
          disabledReason={action.disabledReason}
        >
          {action.label}
        </ButtonLink>
      ))}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="t-h4">{title}</h3>;
}

function InfoList({ lines }: { lines: readonly string[] }) {
  return (
    <div className="c-note c-note--info">
      {lines.map((line) => (
        <div className="t-small" key={line}>
          {line}
        </div>
      ))}
    </div>
  );
}
