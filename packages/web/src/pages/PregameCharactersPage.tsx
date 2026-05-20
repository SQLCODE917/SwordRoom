import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ButtonLink } from '../components/ButtonLink';
import { Panel } from '../components/Panel';
import { PregameWorkflowNav } from '../components/PregameWorkflowNav';
import { createPregameCharactersViewModel, usePregameCharacters } from '../features/pregame-characters';

type WorkbenchTabId = 'mine' | 'shared' | 'approved';

export function PregameCharactersPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const workbench = usePregameCharacters(gameId);
  const view = useMemo(() => createPregameCharactersViewModel(workbench.state), [workbench.state]);
  const [activeTabId, setActiveTabId] = useState<WorkbenchTabId>('mine');
  const [selectedSharedRowKey, setSelectedSharedRowKey] = useState<string | null>(null);

  useEffect(() => {
    if (view.status !== 'ready') {
      setSelectedSharedRowKey(null);
      return;
    }
    if (view.sharedRows.length === 0) {
      setSelectedSharedRowKey(null);
      return;
    }
    if (!selectedSharedRowKey || !view.sharedRows.some((row) => row.key === selectedSharedRowKey)) {
      setSelectedSharedRowKey(view.sharedRows[0]!.key);
    }
  }, [selectedSharedRowKey, view]);

  const selectedSharedRow =
    view.status === 'ready' ? view.sharedRows.find((row) => row.key === selectedSharedRowKey) ?? view.sharedRows[0] ?? null : null;

  return (
    <div className="l-page">
      <Panel title={view.title} subtitle={view.subtitle}>
        <div className={`c-note ${view.noticeTone === 'error' ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">{view.notice}</span>
        </div>
        <PregameWorkflowNav gameId={gameId} createTo={view.workflow.createTo} charactersTo={view.workflow.charactersTo} />

        {view.status === 'ready' ? (
          <>
            <div className="c-note c-note--info c-pregame-planning__summary">
              {view.summaryLines.map((line) => (
                <div className="t-small" key={line}>
                  {line}
                </div>
              ))}
            </div>

            <div className="l-row" role="tablist" aria-label="Character workbench tabs">
              <WorkbenchTabButton
                label={`Mine (${view.mineRows.length})`}
                tabId="mine"
                activeTabId={activeTabId}
                onSelect={setActiveTabId}
              />
              <WorkbenchTabButton
                label={`Shared (${view.sharedRows.length})`}
                tabId="shared"
                activeTabId={activeTabId}
                onSelect={setActiveTabId}
              />
              <WorkbenchTabButton
                label={`Approved (${view.approvedRows.length})`}
                tabId="approved"
                activeTabId={activeTabId}
                onSelect={setActiveTabId}
              />
            </div>

            {activeTabId === 'mine' ? (
              <div className="c-table" role="table" aria-label="Characters workbench mine">
                <div className="c-table__head c-table__row" role="row">
                  <div className="c-table__cell t-small">Character</div>
                  <div className="c-table__cell t-small">Status</div>
                  <div className="c-table__cell t-small">Share State</div>
                  <div className="c-table__cell t-small">Actions</div>
                </div>
                {view.mineRows.length === 0 ? (
                  <div className="c-table__row" role="row">
                    <div className="c-table__cell t-small">No game-scoped characters yet. Use Create to start one.</div>
                  </div>
                ) : (
                  view.mineRows.map((row) => (
                    <div className="c-table__row" role="row" key={row.key}>
                      <div className="c-table__cell t-small">{row.characterName}</div>
                      <div className="c-table__cell t-small">{row.status}</div>
                      <div className="c-table__cell t-small">{row.shareLabel}</div>
                      <div className="c-table__cell t-small">
                        <div className="l-row">
                          <ButtonLink to={row.sheetTo}>Sheet</ButtonLink>
                          {row.editTo ? <ButtonLink to={row.editTo}>Edit</ButtonLink> : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {activeTabId === 'shared' ? (
              <div className="c-pregame-workspace c-characters-workbench">
                <div className="c-pregame-workspace__main">
                  <div className="c-table" role="table" aria-label="Characters workbench shared">
                    <div className="c-table__head c-table__row" role="row">
                      <div className="c-table__cell t-small">Character</div>
                      <div className="c-table__cell t-small">Shared By</div>
                      <div className="c-table__cell t-small">Snapshot</div>
                      <div className="c-table__cell t-small">Discussion</div>
                      <div className="c-table__cell t-small">Actions</div>
                    </div>
                    {view.sharedRows.length === 0 ? (
                      <div className="c-table__row" role="row">
                        <div className="c-table__cell t-small">No shared character artifacts yet. Share a draft from Create to start the conversation.</div>
                      </div>
                    ) : (
                      view.sharedRows.map((row) => (
                        <div className="c-table__row" role="row" key={row.key}>
                          <div className="c-table__cell t-small">{row.characterName}</div>
                          <div className="c-table__cell t-small">{`${row.sharedBy} · ${row.sharedAtLabel}`}</div>
                          <div className="c-table__cell t-small">{row.snapshotLabel}</div>
                          <div className="c-table__cell t-small">{row.discussionLabel}</div>
                          <div className="c-table__cell t-small">
                            <div className="l-row">
                              <button className="c-btn" type="button" onClick={() => setSelectedSharedRowKey(row.key)}>
                                Review
                              </button>
                              <ButtonLink to={row.sheetTo}>Sheet</ButtonLink>
                              <ButtonLink to={row.chatTo}>Discuss</ButtonLink>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <aside className="c-pregame-workspace__aside">
                  <Panel
                    title={selectedSharedRow ? `${selectedSharedRow.characterName} Preview` : 'Shared Preview'}
                    subtitle={selectedSharedRow ? `${selectedSharedRow.sharedBy} · ${selectedSharedRow.sharedAtLabel}` : 'Select a shared character update.'}
                    footer={
                      selectedSharedRow ? (
                        <div className="l-row">
                          <ButtonLink to={selectedSharedRow.chatTo}>Continue Discussion</ButtonLink>
                          <ButtonLink to={selectedSharedRow.sheetTo}>Open Full Sheet</ButtonLink>
                        </div>
                      ) : undefined
                    }
                  >
                    {selectedSharedRow ? (
                      <div className="l-col">
                        <div className="c-note c-note--info c-pregame-planning__summary">
                          <div className="t-small">{selectedSharedRow.shareIntentLabel}</div>
                          <div className="t-small">{selectedSharedRow.snapshotLabel}</div>
                          {selectedSharedRow.contextNote ? <div className="t-small">{selectedSharedRow.contextNote}</div> : null}
                          <div className="t-small">{selectedSharedRow.abilitySummaryLabel}</div>
                          <div className="t-small">{selectedSharedRow.skillSummaryLabel}</div>
                        </div>
                        <div className="c-note c-note--info c-pregame-planning__summary">
                          <div className="t-small">Discussion</div>
                          <div className="t-small">{selectedSharedRow.discussionLabel}</div>
                          <div className="t-small">Use Continue Discussion to jump into chat with reply context already staged.</div>
                        </div>
                      </div>
                    ) : (
                      <div className="c-note c-note--info">
                        <span className="t-small">Select a shared update to inspect it before leaving the workbench.</span>
                      </div>
                    )}
                  </Panel>
                </aside>
              </div>
            ) : null}

            {activeTabId === 'approved' ? (
              <div className="c-table" role="table" aria-label="Characters workbench approved">
                <div className="c-table__head c-table__row" role="row">
                  <div className="c-table__cell t-small">Character</div>
                  <div className="c-table__cell t-small">Owner</div>
                  <div className="c-table__cell t-small">Status</div>
                  <div className="c-table__cell t-small">Actions</div>
                </div>
                {view.approvedRows.length === 0 ? (
                  <div className="c-table__row" role="row">
                    <div className="c-table__cell t-small">No approved characters yet. Use the lobby and chat loop to move drafts toward approval.</div>
                  </div>
                ) : (
                  view.approvedRows.map((row) => (
                    <div className="c-table__row" role="row" key={row.key}>
                      <div className="c-table__cell t-small">{row.characterName}</div>
                      <div className="c-table__cell t-small">{row.ownerLabel}</div>
                      <div className="c-table__cell t-small">{row.status}</div>
                      <div className="c-table__cell t-small">
                        <ButtonLink to={row.sheetTo}>Sheet</ButtonLink>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </Panel>
    </div>
  );
}

function WorkbenchTabButton(props: {
  label: string;
  tabId: WorkbenchTabId;
  activeTabId: WorkbenchTabId;
  onSelect: (value: WorkbenchTabId) => void;
}) {
  return (
    <button
      className={`c-btn ${props.activeTabId === props.tabId ? 'is-active' : ''}`.trim()}
      type="button"
      role="tab"
      aria-selected={props.activeTabId === props.tabId}
      onClick={() => props.onSelect(props.tabId)}
    >
      {props.label}
    </button>
  );
}
