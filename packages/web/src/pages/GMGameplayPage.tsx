import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { GameplayCombatActionType, GameplayMovementMode, GameplayNodeId, GameplayProcedure } from '@starter/shared';
import { type CommandEnvelopeInput } from '../api/ApiClient';
import { GameChatPanel } from '../components/GameChatPanel';
import { GameplayEventFeed } from '../components/GameplayEventFeed';
import { GameplayGraph } from '../components/GameplayGraph';
import { Panel } from '../components/Panel';
import { useGameChat } from '../hooks/useGameChat';
import { useGameplayView } from '../hooks/useGameplayView';
import { createCommandId, useCommandWorkflow } from '../hooks/useCommandStatus';

const procedureOptions: GameplayProcedure[] = ['NO_ROLL', 'STANDARD_CHECK', 'DIFFICULTY_CHECK', 'COMBAT', 'MAGIC'];
const attackContextOptions = ['CHARACTER_TO_MONSTER', 'MONSTER_TO_CHARACTER', 'CHARACTER_TO_CHARACTER'] as const;
const combatActionOptions: GameplayCombatActionType[] = ['ATTACK', 'CAST_MAGIC', 'MOVE', 'DELAY', 'DEFEND', 'OTHER'];
const movementModeOptions: GameplayMovementMode[] = ['FULL', 'NORMAL', 'STAND_STILL'];

export function GMGameplayPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const gameplayState = useGameplayView(gameId, 'GM');
  const chat = useGameChat(gameId);
  const { status: commandStatus, isRunning, submitEnvelopeAndAwait } = useCommandWorkflow();

  const gameplay = gameplayState.gameplay;
  const currentRound = gameplay?.session.combat?.rounds[gameplay.session.combat.rounds.length - 1] ?? null;
  const selectedAction =
    currentRound?.declaredActions[currentRound.declaredActions.length - 1] ?? null;
  const actorCombatant =
    gameplay?.session.combatants.find((combatant) => combatant.combatantId === selectedAction?.actorCombatantId) ?? null;
  const targetCombatant =
    gameplay?.session.combatants.find((combatant) => combatant.combatantId === selectedAction?.targetCombatantId) ?? null;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [procedure, setProcedure] = useState<GameplayProcedure>('STANDARD_CHECK');
  const [actionLabel, setActionLabel] = useState('Intervene with authority');
  const [baselineScore, setBaselineScore] = useState('4');
  const [modifiers, setModifiers] = useState('0');
  const [targetScore, setTargetScore] = useState('10');
  const [difficulty, setDifficulty] = useState('5');
  const [publicPrompt, setPublicPrompt] = useState('The heroes push back against the Brando family in full view of the room.');
  const [gmPrompt, setGmPrompt] = useState('Keep the Brando family pressure visible while hiding the difficulty number.');
  const [playerRollTotal, setPlayerRollTotal] = useState('8');
  const [gmRollTotal, setGmRollTotal] = useState('6');
  const [publicNarration, setPublicNarration] = useState('The table sees the heroes seize the initiative.');
  const [gmNarration, setGmNarration] = useState('Hidden difficulty reveals whether the Brando family loses nerve.');
  const [combatSummary, setCombatSummary] = useState('Steel leaves its scabbard and the tavern becomes a battlefield.');
  const [resolveActionId, setResolveActionId] = useState('');
  const [resolveActorCombatantId, setResolveActorCombatantId] = useState('');
  const [resolveTargetCombatantId, setResolveTargetCombatantId] = useState('');
  const [resolveAttackContext, setResolveAttackContext] = useState<(typeof attackContextOptions)[number]>('CHARACTER_TO_MONSTER');
  const [attackerBase, setAttackerBase] = useState('8');
  const [attackerRoll, setAttackerRoll] = useState('8');
  const [fixedTargetScore, setFixedTargetScore] = useState('9');
  const [defenderBase, setDefenderBase] = useState('8');
  const [defenderRoll, setDefenderRoll] = useState('7');
  const [baseDamage, setBaseDamage] = useState('7');
  const [bonusDamage, setBonusDamage] = useState('2');
  const [defenseValue, setDefenseValue] = useState('1');
  const [damageReduction, setDamageReduction] = useState('0');
  const [combatNarration, setCombatNarration] = useState('A clean hit lands and the target staggers into the tables.');
  const [closeSummary, setCloseSummary] = useState('The Brando family falls back and the room exhales.');
  const [gmCombatActorCombatantId, setGmCombatActorCombatantId] = useState('');
  const [gmCombatTargetCombatantId, setGmCombatTargetCombatantId] = useState('');
  const [gmCombatActionType, setGmCombatActionType] = useState<GameplayCombatActionType>('ATTACK');
  const [gmCombatMovementMode, setGmCombatMovementMode] = useState<GameplayMovementMode>('NORMAL');
  const [gmCombatDelay, setGmCombatDelay] = useState(false);
  const [gmCombatSummary, setGmCombatSummary] = useState('Brando Boss lunges with a club.');

  useEffect(() => {
    if (!gameplay) {
      return;
    }

    setSelectedNodeId(gameplay.session.currentNodeId);
    if (gameplay.session.selectedProcedure) {
      setProcedure(gameplay.session.selectedProcedure);
    }
    if (gameplay.session.activeCheck) {
      setActionLabel(gameplay.session.activeCheck.actionLabel);
      setBaselineScore(String(gameplay.session.activeCheck.baselineScore));
      setModifiers(String(gameplay.session.activeCheck.modifiers));
      setTargetScore(gameplay.session.activeCheck.targetScore === null ? '' : String(gameplay.session.activeCheck.targetScore));
      setDifficulty(gameplay.session.activeCheck.difficulty === null ? '' : String(gameplay.session.activeCheck.difficulty));
      setPlayerRollTotal(
        gameplay.session.activeCheck.playerRollTotal === null ? '' : String(gameplay.session.activeCheck.playerRollTotal)
      );
      setGmRollTotal(gameplay.session.activeCheck.gmRollTotal === null ? '' : String(gameplay.session.activeCheck.gmRollTotal));
      setPublicNarration(gameplay.session.activeCheck.publicNarration ?? publicNarration);
      setGmNarration(gameplay.session.activeCheck.gmNarration ?? gmNarration);
    }
  }, [gameplay]);

  useEffect(() => {
    if (!currentRound) {
      return;
    }

    if (currentRound.declaredActions.length > 0) {
      const latest = currentRound.declaredActions[currentRound.declaredActions.length - 1]!;
      setResolveActionId(latest.actionId);
      setResolveActorCombatantId(latest.actorCombatantId);
      setResolveTargetCombatantId(latest.targetCombatantId ?? '');
    }

    const gmActor =
      gameplay?.session.combatants.find((combatant) => combatant.side === 'NPC' && combatant.status === 'READY') ??
      gameplay?.session.combatants.find((combatant) => combatant.status === 'READY') ??
      null;
    const gmTarget =
      gameplay?.session.combatants.find((combatant) => combatant.side === 'PLAYER' && combatant.status === 'READY') ??
      gameplay?.session.combatants.find((combatant) => combatant.combatantId !== gmActor?.combatantId && combatant.status === 'READY') ??
      null;

    if (gmActor) {
      setGmCombatActorCombatantId(gmActor.combatantId);
    }
    if (gmTarget) {
      setGmCombatTargetCombatantId(gmTarget.combatantId);
    }
  }, [currentRound, gameplay?.session.combatants]);

  useEffect(() => {
    if (!actorCombatant) {
      return;
    }

    setResolveAttackContext(readDefaultAttackContext(actorCombatant.side, targetCombatant?.side ?? null));
    setAttackerBase(String(actorCombatant.stats.attackBase));
    setBaseDamage(String(actorCombatant.stats.strikeBase));
    setBonusDamage(String(actorCombatant.stats.bonusDamage));
  }, [actorCombatant, targetCombatant?.side]);

  useEffect(() => {
    if (!targetCombatant) {
      return;
    }

    setFixedTargetScore(String(targetCombatant.stats.evasionBase));
    setDefenderBase(String(targetCombatant.stats.evasionBase));
    setDefenseValue(String(targetCombatant.stats.defenseValue));
    setDamageReduction(String(targetCombatant.stats.damageReduction));
  }, [targetCombatant]);

  return (
    <div className="l-page">
      <Panel
        title="GM Play"
        subtitle={
          gameplay?.gameName
            ? `${gameplay.gameName} control-room view with graph, GM transcript, and live chat.`
            : 'GM control-room view with graph, GM transcript, and live chat.'
        }
      >
        <div className={`c-note ${gameplayState.error ? 'c-note--error' : 'c-note--info'}`}>
          <span className="t-small">
            {gameplayState.error ??
              (gameplayState.initialLoading
                ? 'Loading GM gameplay view...'
                : gameplay
                  ? 'The graph highlights the current state while the operator panels issue the state-changing commands.'
                  : 'Load the RPG sample to seed the tavern scene, then move the game through checks and combat.')}
          </span>
        </div>

        <div className="c-gameplay__layout">
          <div className="c-gameplay__main">
            {gameplay ? (
              <>
                <section className="c-gameplay-card" aria-label="GM scene summary">
                  <div className="c-gameplay-card__eyebrow t-small">GM View</div>
                  <h3 className="t-h3">{gameplay.session.sceneTitle}</h3>
                  <p className="t-small">{gameplay.session.sceneSummary}</p>
                  <div className="c-gameplay-card__prompt">{gameplay.session.focusPrompt}</div>
                  <div className="c-gameplay-card__facts">
                    <span className="c-gameplay-card__fact">Current node: {gameplay.session.currentNodeId}</span>
                    <span className="c-gameplay-card__fact">Status: {gameplay.session.status}</span>
                    {gameplay.session.selectedProcedure ? (
                      <span className="c-gameplay-card__fact">Procedure: {gameplay.session.selectedProcedure}</span>
                    ) : null}
                    {currentRound ? <span className="c-gameplay-card__fact">Round: {currentRound.roundNumber}</span> : null}
                  </div>
                </section>

                <GameplayGraph
                  nodes={gameplay.graph.nodes}
                  edges={gameplay.graph.edges}
                  currentNodeId={gameplay.session.currentNodeId}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={(nodeId) => {
                    setSelectedNodeId(nodeId);
                    const nextProcedure = mapNodeToProcedure(nodeId as GameplayNodeId);
                    if (nextProcedure) {
                      setProcedure(nextProcedure);
                    }
                  }}
                />

                <section className="c-gameplay-ops" aria-label="GM controls">
                  <div className="l-row">
                    <h3 className="t-h4">Operator Controls</h3>
                  </div>
                  <div className={`c-note ${commandStatus.state === 'Failed' ? 'c-note--error' : 'c-note--info'}`}>
                    <span className="t-small">{commandStatus.message}</span>
                  </div>

                  <div className="c-gameplay-ops__grid">
                    <form
                      className="c-gameplay-ops__panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void loadSample();
                      }}
                    >
                      <h4 className="t-h4">Seed</h4>
                      <div className="c-note c-note--info">
                        <span className="t-small">Bootstrap the tavern sample for this game.</span>
                      </div>
                      <button className={`c-btn ${isRunning ? 'is-disabled' : ''}`.trim()} type="submit" disabled={isRunning}>
                        Load RPG Sample
                      </button>
                    </form>

                    <form
                      className="c-gameplay-ops__panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void selectProcedureCommand();
                      }}
                    >
                      <h4 className="t-h4">Procedure</h4>
                      <label className="c-field">
                        <span className="c-field__label">Procedure</span>
                        <select
                          className="c-field__control"
                          value={procedure}
                          disabled={isRunning}
                          onChange={(event) => setProcedure(event.target.value as GameplayProcedure)}
                        >
                          {procedureOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="c-field">
                        <span className="c-field__label">Action label</span>
                        <input className="c-field__control" value={actionLabel} disabled={isRunning} onChange={(event) => setActionLabel(event.target.value)} />
                      </label>
                      <div className="c-gameplay-ops__row">
                        <NumberField label="Baseline" value={baselineScore} disabled={isRunning} onChange={setBaselineScore} />
                        <NumberField label="Modifiers" value={modifiers} disabled={isRunning} onChange={setModifiers} />
                        <NumberField label="Target" value={targetScore} disabled={isRunning || procedure === 'DIFFICULTY_CHECK'} onChange={setTargetScore} />
                        <NumberField label="Difficulty" value={difficulty} disabled={isRunning || procedure !== 'DIFFICULTY_CHECK'} onChange={setDifficulty} />
                      </div>
                      <label className="c-field">
                        <span className="c-field__label">Public prompt</span>
                        <textarea className="c-field__control c-gameplay__textarea" value={publicPrompt} disabled={isRunning} onChange={(event) => setPublicPrompt(event.target.value)} />
                      </label>
                      <label className="c-field">
                        <span className="c-field__label">GM prompt</span>
                        <textarea className="c-field__control c-gameplay__textarea" value={gmPrompt} disabled={isRunning} onChange={(event) => setGmPrompt(event.target.value)} />
                      </label>
                      <button className={`c-btn ${isRunning ? 'is-disabled' : ''}`.trim()} type="submit" disabled={isRunning}>
                        Select Procedure
                      </button>
                    </form>

                    <form
                      className="c-gameplay-ops__panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void resolveCheckCommand();
                      }}
                    >
                      <h4 className="t-h4">Resolve Check</h4>
                      <div className="c-gameplay-ops__row">
                        <NumberField label="Player roll" value={playerRollTotal} disabled={isRunning || procedure === 'NO_ROLL'} onChange={setPlayerRollTotal} />
                        <NumberField label="GM roll" value={gmRollTotal} disabled={isRunning || procedure !== 'DIFFICULTY_CHECK'} onChange={setGmRollTotal} />
                      </div>
                      <label className="c-field">
                        <span className="c-field__label">Public narration</span>
                        <textarea className="c-field__control c-gameplay__textarea" value={publicNarration} disabled={isRunning} onChange={(event) => setPublicNarration(event.target.value)} />
                      </label>
                      <label className="c-field">
                        <span className="c-field__label">GM narration</span>
                        <textarea className="c-field__control c-gameplay__textarea" value={gmNarration} disabled={isRunning} onChange={(event) => setGmNarration(event.target.value)} />
                      </label>
                      <button className={`c-btn ${isRunning ? 'is-disabled' : ''}`.trim()} type="submit" disabled={isRunning}>
                        Resolve Check
                      </button>
                    </form>

                    <form
                      className="c-gameplay-ops__panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void openCombat();
                      }}
                    >
                      <h4 className="t-h4">Open Combat</h4>
                      <label className="c-field">
                        <span className="c-field__label">Combat summary</span>
                        <textarea className="c-field__control c-gameplay__textarea" value={combatSummary} disabled={isRunning} onChange={(event) => setCombatSummary(event.target.value)} />
                      </label>
                      <button className={`c-btn ${isRunning ? 'is-disabled' : ''}`.trim()} type="submit" disabled={isRunning}>
                        Open Combat Round
                      </button>
                    </form>

                    <form
                      className="c-gameplay-ops__panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitCombatAction();
                      }}
                    >
                      <h4 className="t-h4">GM Combat Declaration</h4>
                      <div className="c-note c-note--info">
                        <span className="t-small">
                          {currentRound ? `Round ${currentRound.roundNumber} is collecting actions.` : 'Open combat before declaring actions.'}
                        </span>
                      </div>
                      <label className="c-field">
                        <span className="c-field__label">Actor combatant</span>
                        <select className="c-field__control" value={gmCombatActorCombatantId} disabled={isRunning || !currentRound} onChange={(event) => setGmCombatActorCombatantId(event.target.value)}>
                          <option value="">Select actor</option>
                          {(gameplay.session.combatants ?? []).map((combatant) => (
                            <option key={combatant.combatantId} value={combatant.combatantId}>
                              {combatant.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="c-field">
                        <span className="c-field__label">Target combatant</span>
                        <select className="c-field__control" value={gmCombatTargetCombatantId} disabled={isRunning || !currentRound} onChange={(event) => setGmCombatTargetCombatantId(event.target.value)}>
                          <option value="">Select target</option>
                          {(gameplay.session.combatants ?? []).map((combatant) => (
                            <option key={combatant.combatantId} value={combatant.combatantId}>
                              {combatant.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="c-field">
                        <span className="c-field__label">Action</span>
                        <select className="c-field__control" value={gmCombatActionType} disabled={isRunning || !currentRound} onChange={(event) => setGmCombatActionType(event.target.value as GameplayCombatActionType)}>
                          {combatActionOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="c-field">
                        <span className="c-field__label">Movement</span>
                        <select className="c-field__control" value={gmCombatMovementMode} disabled={isRunning || !currentRound} onChange={(event) => setGmCombatMovementMode(event.target.value as GameplayMovementMode)}>
                          {movementModeOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="c-field">
                        <span className="c-field__label">Summary</span>
                        <input className="c-field__control" value={gmCombatSummary} disabled={isRunning || !currentRound} onChange={(event) => setGmCombatSummary(event.target.value)} />
                      </label>
                      <label className="c-field__check">
                        <input
                          className="c-field__control c-field__control--check"
                          type="checkbox"
                          checked={gmCombatDelay}
                          disabled={isRunning || !currentRound}
                          onChange={(event) => setGmCombatDelay(event.target.checked)}
                        />
                        <span className="t-small">Delay to order zero</span>
                      </label>
                      <button className={`c-btn ${isRunning || !currentRound ? 'is-disabled' : ''}`.trim()} type="submit" disabled={isRunning || !currentRound}>
                        Declare Combat Action
                      </button>
                    </form>

                    <form
                      className="c-gameplay-ops__panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void resolveCombat();
                      }}
                    >
                      <h4 className="t-h4">Resolve Combat Turn</h4>
                      <label className="c-field">
                        <span className="c-field__label">Action</span>
                        <select className="c-field__control" value={resolveActionId} disabled={isRunning || !currentRound} onChange={(event) => setResolveActionId(event.target.value)}>
                          <option value="">Select action</option>
                          {(currentRound?.declaredActions ?? []).map((action: {
                            actionId: string;
                            summary: string;
                          }) => (
                            <option key={action.actionId} value={action.actionId}>
                              {action.summary}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="c-field">
                        <span className="c-field__label">Actor combatant</span>
                        <select className="c-field__control" value={resolveActorCombatantId} disabled={isRunning || !currentRound} onChange={(event) => setResolveActorCombatantId(event.target.value)}>
                          <option value="">Select actor</option>
                          {(gameplay.session.combatants ?? []).map((combatant) => (
                            <option key={combatant.combatantId} value={combatant.combatantId}>
                              {combatant.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="c-field">
                        <span className="c-field__label">Target combatant</span>
                        <select className="c-field__control" value={resolveTargetCombatantId} disabled={isRunning || !currentRound} onChange={(event) => setResolveTargetCombatantId(event.target.value)}>
                          <option value="">Select target</option>
                          {(gameplay.session.combatants ?? []).map((combatant) => (
                            <option key={combatant.combatantId} value={combatant.combatantId}>
                              {combatant.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="c-field">
                        <span className="c-field__label">Attack context</span>
                        <select className="c-field__control" value={resolveAttackContext} disabled={isRunning || !currentRound} onChange={(event) => setResolveAttackContext(event.target.value as (typeof attackContextOptions)[number])}>
                          {attackContextOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="c-gameplay-ops__row">
                        <NumberField label="Attacker base" value={attackerBase} disabled={isRunning || !currentRound} onChange={setAttackerBase} />
                        <NumberField label="Attacker roll" value={attackerRoll} disabled={isRunning || !currentRound} onChange={setAttackerRoll} />
                        <NumberField label="Fixed target" value={fixedTargetScore} disabled={isRunning || !currentRound} onChange={setFixedTargetScore} />
                        <NumberField label="Defender base" value={defenderBase} disabled={isRunning || !currentRound || resolveAttackContext === 'CHARACTER_TO_MONSTER'} onChange={setDefenderBase} />
                        <NumberField label="Defender roll" value={defenderRoll} disabled={isRunning || !currentRound || resolveAttackContext === 'CHARACTER_TO_MONSTER'} onChange={setDefenderRoll} />
                      </div>
                      <div className="c-gameplay-ops__row">
                        <NumberField label="Base damage" value={baseDamage} disabled={isRunning || !currentRound} onChange={setBaseDamage} />
                        <NumberField label="Bonus damage" value={bonusDamage} disabled={isRunning || !currentRound} onChange={setBonusDamage} />
                        <NumberField label="Defense value" value={defenseValue} disabled={isRunning || !currentRound} onChange={setDefenseValue} />
                        <NumberField label="Damage reduction" value={damageReduction} disabled={isRunning || !currentRound} onChange={setDamageReduction} />
                      </div>
                      <label className="c-field">
                        <span className="c-field__label">Narration</span>
                        <textarea className="c-field__control c-gameplay__textarea" value={combatNarration} disabled={isRunning || !currentRound} onChange={(event) => setCombatNarration(event.target.value)} />
                      </label>
                      <button className={`c-btn ${isRunning || !currentRound ? 'is-disabled' : ''}`.trim()} type="submit" disabled={isRunning || !currentRound}>
                        Resolve Combat Turn
                      </button>
                    </form>

                    <form
                      className="c-gameplay-ops__panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void closeCombatCommand();
                      }}
                    >
                      <h4 className="t-h4">Close Combat</h4>
                      <label className="c-field">
                        <span className="c-field__label">Aftermath summary</span>
                        <textarea className="c-field__control c-gameplay__textarea" value={closeSummary} disabled={isRunning} onChange={(event) => setCloseSummary(event.target.value)} />
                      </label>
                      <button className={`c-btn ${isRunning ? 'is-disabled' : ''}`.trim()} type="submit" disabled={isRunning}>
                        Close Combat
                      </button>
                    </form>
                  </div>
                </section>

                <CombatControlStatus
                  combatants={gameplay.session.combatants.map((combatant) => ({
                    combatantId: combatant.combatantId,
                    displayName: combatant.displayName,
                    side: combatant.side,
                    status: combatant.status,
                    lifePoints: combatant.lifePoints,
                    maxLifePoints: combatant.maxLifePoints,
                  }))}
                  declaredActions={(currentRound?.declaredActions ?? []).map((action: {
                    actionId: string;
                    actorCombatantId: string;
                    actionType: string;
                    movementMode: string;
                    summary: string;
                  }) => ({
                    actionId: action.actionId,
                    actorCombatantId: action.actorCombatantId,
                    actionType: action.actionType,
                    movementMode: action.movementMode,
                    summary: action.summary,
                  }))}
                  roundNumber={currentRound?.roundNumber ?? null}
                  announcementOrder={currentRound?.announcementOrder ?? []}
                  resolutionOrder={currentRound?.resolutionOrder ?? []}
                />

                <div className="c-gameplay-feed-grid">
                  <GameplayEventFeed
                    title="Public Transcript"
                    events={gameplay.publicEvents}
                    emptyText="Public transcript will appear as the table advances."
                  />
                  <GameplayEventFeed
                    title="GM Transcript"
                    events={gameplay.gmOnlyEvents ?? []}
                    emptyText="GM-only notes will appear for hidden information and combat math."
                    variant="gm"
                  />
                </div>
              </>
            ) : (
              <section className="c-gameplay-ops" aria-label="Seed gameplay">
                <div className="c-note c-note--info">
                  <span className="t-small">No gameplay session exists for this game yet.</span>
                </div>
                <button className={`c-btn ${isRunning ? 'is-disabled' : ''}`.trim()} type="button" disabled={isRunning} onClick={() => void loadSample()}>
                  Load RPG Sample
                </button>
              </section>
            )}
          </div>

          <aside className="c-gameplay__aside">
            <Panel title="Game Chat" subtitle={chat.chat.gameName || 'Current game chat'}>
              <GameChatPanel
                chat={chat.chat}
                initialLoading={chat.initialLoading}
                error={chat.error}
                draftBody={chat.draftBody}
                setDraftBody={chat.setDraftBody}
                membersOpen={chat.membersOpen}
                setMembersOpen={chat.setMembersOpen}
                transcriptRef={chat.transcriptRef}
                isSending={chat.isSending}
                commandStatus={chat.commandStatus}
                onSendMessage={chat.sendMessage}
              />
            </Panel>
          </aside>
        </div>
      </Panel>
    </div>
  );

  async function loadSample() {
    await submitEnvelopeAndAwait('Load RPG sample', {
      commandId: createCommandId(),
      gameId,
      type: 'GMFrameGameplayScene',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        seedId: 'rpg_sample_tavern',
      },
    } satisfies CommandEnvelopeInput<'GMFrameGameplayScene'>);
    await gameplayState.refresh();
  }

  async function selectProcedureCommand() {
    await submitEnvelopeAndAwait('Select procedure', {
      commandId: createCommandId(),
      gameId,
      type: 'GMSelectGameplayProcedure',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        procedure,
        actionLabel: actionLabel.trim() || 'Scene action',
        baselineScore: toInt(baselineScore),
        modifiers: toInt(modifiers),
        targetScore: procedure === 'DIFFICULTY_CHECK' ? null : toNullableInt(targetScore),
        difficulty: procedure === 'DIFFICULTY_CHECK' ? toNullableInt(difficulty) : null,
        publicPrompt: publicPrompt.trim() || 'GM selects a procedure.',
        gmPrompt: gmPrompt.trim() || undefined,
      },
    } satisfies CommandEnvelopeInput<'GMSelectGameplayProcedure'>);
    await gameplayState.refresh();
  }

  async function resolveCheckCommand() {
    const resolvedProcedure = procedure === 'COMBAT' || procedure === 'MAGIC' ? 'STANDARD_CHECK' : procedure;
    await submitEnvelopeAndAwait('Resolve check', {
      commandId: createCommandId(),
      gameId,
      type: 'GMResolveGameplayCheck',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        procedure: resolvedProcedure,
        actionLabel: actionLabel.trim() || 'Scene action',
        baselineScore: toInt(baselineScore),
        modifiers: toInt(modifiers),
        targetScore: resolvedProcedure === 'DIFFICULTY_CHECK' ? null : toNullableInt(targetScore),
        difficulty: resolvedProcedure === 'DIFFICULTY_CHECK' ? toNullableInt(difficulty) : null,
        playerRollTotal: resolvedProcedure === 'NO_ROLL' ? null : toNullableInt(playerRollTotal),
        gmRollTotal: resolvedProcedure === 'DIFFICULTY_CHECK' ? toNullableInt(gmRollTotal) : null,
        publicNarration: publicNarration.trim() || 'The fiction moves forward.',
        gmNarration: gmNarration.trim() || undefined,
      },
    } satisfies CommandEnvelopeInput<'GMResolveGameplayCheck'>);
    await gameplayState.refresh();
  }

  async function openCombat() {
    await submitEnvelopeAndAwait('Open combat round', {
      commandId: createCommandId(),
      gameId,
      type: 'GMOpenCombatRound',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        summary: combatSummary.trim() || 'Combat begins.',
      },
    } satisfies CommandEnvelopeInput<'GMOpenCombatRound'>);
    await gameplayState.refresh();
  }

  async function submitCombatAction() {
    if (!currentRound || !gmCombatActorCombatantId) {
      return;
    }

    await submitEnvelopeAndAwait('Declare combat action', {
      commandId: createCommandId(),
      gameId,
      type: 'SubmitCombatAction',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        roundNumber: currentRound.roundNumber,
        actorCombatantId: gmCombatActorCombatantId,
        targetCombatantId: gmCombatTargetCombatantId || null,
        actionType: gmCombatActionType,
        movementMode: gmCombatMovementMode,
        delayToOrderZero: gmCombatDelay,
        summary: gmCombatSummary.trim() || 'Combat action declared.',
      },
    } satisfies CommandEnvelopeInput<'SubmitCombatAction'>);
    setGmCombatSummary('Combat action declared.');
    await gameplayState.refresh();
  }

  async function resolveCombat() {
    if (!currentRound) {
      return;
    }

    await submitEnvelopeAndAwait('Resolve combat turn', {
      commandId: createCommandId(),
      gameId,
      type: 'GMResolveCombatTurn',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        roundNumber: currentRound.roundNumber,
        actionId: resolveActionId || `${resolveActorCombatantId}:${currentRound.roundNumber}`,
        actorCombatantId: resolveActorCombatantId,
        targetCombatantId: resolveTargetCombatantId,
        attackContext: resolveAttackContext,
        attackerBase: toInt(attackerBase),
        attackerRollTotal: toInt(attackerRoll),
        fixedTargetScore: toNullableInt(fixedTargetScore),
        defenderBase: resolveAttackContext === 'CHARACTER_TO_MONSTER' ? null : toNullableInt(defenderBase),
        defenderRollTotal: resolveAttackContext === 'CHARACTER_TO_MONSTER' ? null : toNullableInt(defenderRoll),
        baseDamage: toInt(baseDamage),
        bonusDamage: toInt(bonusDamage),
        defenseValue: toInt(defenseValue),
        damageReduction: toInt(damageReduction),
        narration: combatNarration.trim() || 'A combat turn resolves.',
      },
    } satisfies CommandEnvelopeInput<'GMResolveCombatTurn'>);
    await gameplayState.refresh();
  }

  async function closeCombatCommand() {
    await submitEnvelopeAndAwait('Close combat', {
      commandId: createCommandId(),
      gameId,
      type: 'GMCloseCombat',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {
        summary: closeSummary.trim() || 'Combat closes.',
      },
    } satisfies CommandEnvelopeInput<'GMCloseCombat'>);
    await gameplayState.refresh();
  }
}

function CombatControlStatus(input: {
  combatants: Array<{
    combatantId: string;
    displayName: string;
    side: string;
    status: string;
    lifePoints: number;
    maxLifePoints: number;
  }>;
  declaredActions: Array<{
    actionId: string;
    actorCombatantId: string;
    actionType: string;
    movementMode: string;
    summary: string;
  }>;
  roundNumber: number | null;
  announcementOrder: string[];
  resolutionOrder: string[];
}) {
  return (
    <section className="c-gameplay-status" aria-label="Combat control status">
      <div className="l-row">
        <h3 className="t-h4">Combat Control</h3>
      </div>
      <div className="c-gameplay-status__meta">
        <span className="c-gameplay-card__fact">{input.roundNumber ? `Round ${input.roundNumber}` : 'No combat round open'}</span>
        <span className="c-gameplay-card__fact">Announcement: {input.announcementOrder.join(' -> ') || 'n/a'}</span>
        <span className="c-gameplay-card__fact">Resolution: {input.resolutionOrder.join(' -> ') || 'n/a'}</span>
      </div>
      <div className="c-gameplay-status__grid">
        {input.combatants.map((combatant) => (
          <article key={combatant.combatantId} className={`c-gameplay-status__card c-gameplay-status__card--${combatant.side.toLowerCase()}`}>
            <div className="c-gameplay-status__header">
              <span>{combatant.displayName}</span>
              <span className="t-small">{combatant.side}</span>
            </div>
            <div className="t-small">LP {combatant.lifePoints}/{combatant.maxLifePoints}</div>
            <div className="t-small">Status {combatant.status}</div>
          </article>
        ))}
      </div>
      <div className="c-gameplay-actions-list">
        {input.declaredActions.length === 0 ? (
          <div className="c-gameplay-feed__empty t-small">No declared actions yet.</div>
        ) : (
          input.declaredActions.map((action) => (
            <article key={action.actionId} className="c-gameplay-actions-list__item">
              <div className="c-gameplay-status__header">
                <span>{action.actorCombatantId}</span>
                <span className="t-small">{action.actionType}</span>
              </div>
              <div className="t-small">{action.summary}</div>
              <div className="t-small">Movement {action.movementMode}</div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function NumberField(input: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="c-field">
      <span className="c-field__label">{input.label}</span>
      <input className="c-field__control" inputMode="numeric" value={input.value} disabled={input.disabled} onChange={(event) => input.onChange(event.target.value)} />
    </label>
  );
}

function mapNodeToProcedure(nodeId: GameplayNodeId): GameplayProcedure | null {
  switch (nodeId) {
    case 'NO_ROLL':
      return 'NO_ROLL';
    case 'STANDARD_CHECK':
      return 'STANDARD_CHECK';
    case 'DIFFICULTY_CHECK':
      return 'DIFFICULTY_CHECK';
    case 'COMBAT_ROUND':
    case 'WEAPON_ATTACK':
    case 'DAMAGE':
    case 'AFTERMATH':
      return 'COMBAT';
    case 'MAGIC':
      return 'MAGIC';
    default:
      return null;
  }
}

function readDefaultAttackContext(actorSide: string | null, targetSide: string | null): (typeof attackContextOptions)[number] {
  if (actorSide === 'PLAYER' && targetSide === 'NPC') {
    return 'CHARACTER_TO_MONSTER';
  }
  if (actorSide === 'NPC' && targetSide === 'PLAYER') {
    return 'MONSTER_TO_CHARACTER';
  }
  return 'CHARACTER_TO_CHARACTER';
}

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
