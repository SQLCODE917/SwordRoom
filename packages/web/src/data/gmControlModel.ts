import {
  gameplayLoopGraphNodes,
  gameplayStepDescriptorByNodeId,
  type GameplayCombatAction,
  type GameplayGmActionId,
  type GameplayInfoTopicId,
  type GameplayNodeId,
  type GameplayProcedure,
} from '@starter/shared';
import type { GameplayEventView, GameplayView } from '../api/ApiClient';
import type { CommandStatusViewModel } from '../hooks/useCommandStatus';

export const GM_PLAY_MODES = ['control', 'chat'] as const;
export const GM_CONTROL_PANELS = ['step', 'graph'] as const;
export const GM_UTILITY_IDS = ['timeseries', 'transcript', 'status'] as const;
export const GM_TRANSCRIPT_MODES = ['public', 'gm'] as const;

export type GmPlayMode = (typeof GM_PLAY_MODES)[number];
export type GmControlPanelId = (typeof GM_CONTROL_PANELS)[number];
export type GmUtilityId = (typeof GM_UTILITY_IDS)[number];
export type GmTranscriptMode = (typeof GM_TRANSCRIPT_MODES)[number];

export interface GmPlayUiState {
  mode: GmPlayMode;
  panel: GmControlPanelId;
  utility: GmUtilityId | null;
  transcript: GmTranscriptMode;
}

export interface GmPlayUiParseResult {
  state: GmPlayUiState;
  needsNormalization: boolean;
}

export interface RecentCommandStatusEntry extends CommandStatusViewModel {
  capturedAt: string;
}

export interface GmActionViewModel {
  id: GameplayGmActionId;
  label: string;
  description: string;
  enabled: boolean;
  disabledReason?: string;
}

export interface GmNextStepViewModel {
  nodeId: GameplayNodeId;
  label: string;
  description: string;
  enabled: boolean;
  disabledReason?: string;
}

interface GmStepBase<TKind extends string, TNodeId extends GameplayNodeId | null> {
  kind: TKind;
  nodeId: TNodeId;
  title: string;
  description: string;
  infoTopicId: GameplayInfoTopicId | null;
  nextSteps: GmNextStepViewModel[];
  primaryActions: GmActionViewModel[];
  secondaryActions: GmActionViewModel[];
}

export interface GmNoSessionStepModel extends GmStepBase<'no_session', null> {}

export interface GmSceneFrameStepModel extends GmStepBase<'scene_frame', 'SCENE_FRAME'> {
  recentEvents: GameplayEventView[];
}

export interface GmPlayerIntentStepModel extends GmStepBase<'player_intent', 'PLAYER_INTENT'> {
  recentIntents: GameplayEventView[];
  pendingIntentId: string | null;
}

export interface GmProcedureSelectionStepModel extends GmStepBase<'procedure_selection', 'PROCEDURE_SELECTION'> {
  recentIntents: GameplayEventView[];
  selectedProcedure: GameplayProcedure | null;
}

export interface GmNoRollStepModel extends GmStepBase<'no_roll', 'NO_ROLL'> {
  activeCheckLabel: string | null;
}

export interface GmStandardCheckStepModel extends GmStepBase<'standard_check', 'STANDARD_CHECK'> {
  activeCheckLabel: string | null;
}

export interface GmDifficultyCheckStepModel extends GmStepBase<'difficulty_check', 'DIFFICULTY_CHECK'> {
  activeCheckLabel: string | null;
}

export interface GmCombatRoundStepModel extends GmStepBase<'combat_round', 'COMBAT_ROUND'> {
  roundNumber: number | null;
  announcementOrder: string[];
  resolutionOrder: string[];
  declaredActions: GameplayCombatAction[];
  unresolvedActions: GameplayCombatAction[];
}

export interface GmWeaponAttackStepModel extends GmStepBase<'weapon_attack', 'WEAPON_ATTACK'> {
  roundNumber: number | null;
  selectedAction: GameplayCombatAction | null;
  unresolvedActions: GameplayCombatAction[];
}

export interface GmDamageStepModel extends GmStepBase<'damage', 'DAMAGE'> {
  latestResolution: GameplayEventView | null;
  combatSnapshot: Array<{
    combatantId: string;
    displayName: string;
    lifePoints: number;
    maxLifePoints: number;
    status: string;
    side: string;
  }>;
  unresolvedActions: GameplayCombatAction[];
}

export interface GmAftermathStepModel extends GmStepBase<'aftermath', 'AFTERMATH'> {
  aftermathSummary: string | null;
}

export interface GmMagicStepModel extends GmStepBase<'magic', 'MAGIC'> {
  selectedProcedure: GameplayProcedure | null;
}

export type GmCurrentStepModel =
  | GmNoSessionStepModel
  | GmSceneFrameStepModel
  | GmPlayerIntentStepModel
  | GmProcedureSelectionStepModel
  | GmNoRollStepModel
  | GmStandardCheckStepModel
  | GmDifficultyCheckStepModel
  | GmCombatRoundStepModel
  | GmWeaponAttackStepModel
  | GmDamageStepModel
  | GmAftermathStepModel
  | GmMagicStepModel;

export interface GmTimeseriesEntry extends GameplayEventView {
  audience: 'PUBLIC' | 'GM_ONLY';
}

export interface GmControlModel {
  currentStep: GmCurrentStepModel;
  utilityCounts: {
    timeseries: number;
    publicTranscript: number;
    gmTranscript: number;
    status: number;
  };
  timeseries: GmTimeseriesEntry[];
  publicTranscript: GameplayEventView[];
  gmTranscript: GameplayEventView[];
}

const graphNodeMetaById = Object.fromEntries(
  gameplayLoopGraphNodes.map((node) => [
    node.id,
    {
      label: node.label,
      description: node.description,
    },
  ])
) as Record<GameplayNodeId, { label: string; description: string }>;

const defaultUiState: GmPlayUiState = {
  mode: 'control',
  panel: 'step',
  utility: null,
  transcript: 'public',
};

export function readGmPlayUiState(searchParams: URLSearchParams): GmPlayUiParseResult {
  const mode = GM_PLAY_MODES.includes(searchParams.get('mode') as GmPlayMode)
    ? (searchParams.get('mode') as GmPlayMode)
    : defaultUiState.mode;
  const panel = GM_CONTROL_PANELS.includes(searchParams.get('panel') as GmControlPanelId)
    ? (searchParams.get('panel') as GmControlPanelId)
    : defaultUiState.panel;
  const utility = GM_UTILITY_IDS.includes(searchParams.get('utility') as GmUtilityId)
    ? (searchParams.get('utility') as GmUtilityId)
    : null;
  const transcript = GM_TRANSCRIPT_MODES.includes(searchParams.get('transcript') as GmTranscriptMode)
    ? (searchParams.get('transcript') as GmTranscriptMode)
    : defaultUiState.transcript;
  const state: GmPlayUiState = { mode, panel, utility, transcript };
  const normalized = createGmPlaySearchParams(state).toString();
  const current = searchParams.toString();
  return {
    state,
    needsNormalization: normalized !== current,
  };
}

export function createGmPlaySearchParams(state: GmPlayUiState): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set('mode', state.mode);
  searchParams.set('panel', state.panel);
  if (state.utility) {
    searchParams.set('utility', state.utility);
  }
  searchParams.set('transcript', state.transcript);
  return searchParams;
}

export function deriveGmControlModel(input: {
  gameplay: GameplayView | null;
  commandStatus: CommandStatusViewModel;
  recentCommandStatuses: RecentCommandStatusEntry[];
}): GmControlModel {
  const publicTranscript = [...(input.gameplay?.publicEvents ?? [])].sort(compareAscending);
  const gmTranscript = [...(input.gameplay?.gmOnlyEvents ?? [])].sort(compareAscending);
  const timeseries = [...publicTranscript.map(asTimeseries('PUBLIC')), ...gmTranscript.map(asTimeseries('GM_ONLY'))].sort(compareDescending);
  const utilityCounts = {
    timeseries: timeseries.length,
    publicTranscript: publicTranscript.length,
    gmTranscript: gmTranscript.length,
    status: input.recentCommandStatuses.length + (input.commandStatus.commandId ? 1 : 0),
  };

  if (!input.gameplay) {
    return {
      currentStep: {
        kind: 'no_session',
        nodeId: null,
        title: 'Seed Gameplay',
        description: 'Load the sample scene to begin the GM play loop for this game.',
        infoTopicId: null,
        nextSteps: [],
        primaryActions: [buildAction('LOAD_SAMPLE')],
        secondaryActions: [buildAction('OPEN_CHAT_MODE'), buildAction('OPEN_STATUS_UTILITY')],
      },
      utilityCounts,
      timeseries,
      publicTranscript,
      gmTranscript,
    };
  }

  const session = input.gameplay.session;
  const descriptor = gameplayStepDescriptorByNodeId[session.currentNodeId];
  const currentRound = session.combat?.rounds[session.combat.rounds.length - 1] ?? null;
  const unresolvedActions =
    currentRound?.declaredActions.filter((action) => !currentRound.resolvedActionIds.includes(action.actionId)) ?? [];
  const selectedAction = unresolvedActions[0] ?? currentRound?.declaredActions[currentRound.declaredActions.length - 1] ?? null;
  const recentEvents = publicTranscript.slice(-4).reverse();
  const recentIntents = [...publicTranscript]
    .filter((event) => event.eventKind === 'INTENT_SUBMITTED')
    .slice(-4)
    .reverse();
  const combatResolutionEvents = publicTranscript.filter((event) => event.eventKind === 'COMBAT_TURN_RESOLVED');
  const latestResolution = combatResolutionEvents[combatResolutionEvents.length - 1] ?? null;

  const nextSteps = descriptor.nextNodeIds.map((nodeId) => buildNextStep(session.currentNodeId, nodeId, unresolvedActions.length));
  const secondaryActions = buildSharedSecondaryActions(session.currentNodeId);

  switch (session.currentNodeId) {
    case 'SCENE_FRAME':
      return {
        currentStep: {
          kind: 'scene_frame',
          nodeId: 'SCENE_FRAME',
          title: graphNodeMetaById.SCENE_FRAME.label,
          description: 'Hold the current fiction steady, review the latest state, and guide the table toward the next intent.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [buildAction('FOCUS_PLAYER_INTENT')],
          secondaryActions,
          recentEvents,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
    case 'PLAYER_INTENT':
      return {
        currentStep: {
          kind: 'player_intent',
          nodeId: 'PLAYER_INTENT',
          title: graphNodeMetaById.PLAYER_INTENT.label,
          description: 'Collect what the characters want to do next and move smoothly into procedure selection.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [buildAction('SELECT_PROCEDURE')],
          secondaryActions,
          recentIntents,
          pendingIntentId: session.pendingIntentId,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
    case 'PROCEDURE_SELECTION':
      return {
        currentStep: {
          kind: 'procedure_selection',
          nodeId: 'PROCEDURE_SELECTION',
          title: graphNodeMetaById.PROCEDURE_SELECTION.label,
          description: 'Choose the procedure that matches the fiction, then enter only the inputs that procedure needs.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [buildAction('SELECT_PROCEDURE')],
          secondaryActions,
          recentIntents,
          selectedProcedure: session.selectedProcedure,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
    case 'NO_ROLL':
      return {
        currentStep: {
          kind: 'no_roll',
          nodeId: 'NO_ROLL',
          title: graphNodeMetaById.NO_ROLL.label,
          description: 'Resolve the fiction directly, then move the table back into the scene.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [buildAction('RESOLVE_NO_ROLL')],
          secondaryActions,
          activeCheckLabel: session.activeCheck?.actionLabel ?? null,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
    case 'STANDARD_CHECK':
      return {
        currentStep: {
          kind: 'standard_check',
          nodeId: 'STANDARD_CHECK',
          title: graphNodeMetaById.STANDARD_CHECK.label,
          description: 'Run a public target check with only the visible math the table needs.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [buildAction('RESOLVE_STANDARD_CHECK')],
          secondaryActions,
          activeCheckLabel: session.activeCheck?.actionLabel ?? null,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
    case 'DIFFICULTY_CHECK':
      return {
        currentStep: {
          kind: 'difficulty_check',
          nodeId: 'DIFFICULTY_CHECK',
          title: graphNodeMetaById.DIFFICULTY_CHECK.label,
          description: 'Run the hidden target check and keep the public narration in-fiction.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [buildAction('RESOLVE_DIFFICULTY_CHECK')],
          secondaryActions,
          activeCheckLabel: session.activeCheck?.actionLabel ?? null,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
    case 'COMBAT_ROUND':
      return {
        currentStep: {
          kind: 'combat_round',
          nodeId: 'COMBAT_ROUND',
          title: graphNodeMetaById.COMBAT_ROUND.label,
          description: 'Run the round: declarations, current order, unresolved actions, and close-combat authority.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [
            buildAction('OPEN_COMBAT'),
            buildAction('DECLARE_COMBAT_ACTION', currentRound ? null : 'Open a combat round before declaring actions.'),
            buildAction('PREPARE_COMBAT_RESOLUTION', unresolvedActions.length === 0 ? 'Declare actions before resolving the round.' : null),
            buildAction('CLOSE_COMBAT', currentRound ? null : 'Open a combat round before closing combat.'),
          ],
          secondaryActions,
          roundNumber: currentRound?.roundNumber ?? null,
          announcementOrder: currentRound?.announcementOrder ?? [],
          resolutionOrder: currentRound?.resolutionOrder ?? [],
          declaredActions: currentRound?.declaredActions ?? [],
          unresolvedActions,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
    case 'WEAPON_ATTACK':
      return {
        currentStep: {
          kind: 'weapon_attack',
          nodeId: 'WEAPON_ATTACK',
          title: graphNodeMetaById.WEAPON_ATTACK.label,
          description: 'Take one unresolved attack through hit context and damage inputs without opening the whole round dashboard.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [buildAction('RESOLVE_COMBAT_TURN', selectedAction ? null : 'Select or declare a combat action first.')],
          secondaryActions,
          roundNumber: currentRound?.roundNumber ?? null,
          selectedAction,
          unresolvedActions,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
    case 'DAMAGE':
      return {
        currentStep: {
          kind: 'damage',
          nodeId: 'DAMAGE',
          title: graphNodeMetaById.DAMAGE.label,
          description: 'Review the outcome that just landed, then continue the combat round with the updated table state.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [
            buildAction('CONTINUE_COMBAT_ROUND'),
            buildAction('PREPARE_COMBAT_RESOLUTION', unresolvedActions.length === 0 ? 'No unresolved combat actions remain in this round.' : null),
            buildAction('CLOSE_COMBAT'),
          ],
          secondaryActions,
          latestResolution,
          combatSnapshot: session.combatants.map((combatant) => ({
            combatantId: combatant.combatantId,
            displayName: combatant.displayName,
            lifePoints: combatant.lifePoints,
            maxLifePoints: combatant.maxLifePoints,
            status: combatant.status,
            side: combatant.side,
          })),
          unresolvedActions,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
    case 'AFTERMATH':
      return {
        currentStep: {
          kind: 'aftermath',
          nodeId: 'AFTERMATH',
          title: graphNodeMetaById.AFTERMATH.label,
          description: 'Capture the aftermath, keep the consequences visible, and ease the table back into scene play.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [buildAction('RESUME_SCENE')],
          secondaryActions,
          aftermathSummary: session.combat?.aftermathSummary ?? null,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
    case 'MAGIC':
      return {
        currentStep: {
          kind: 'magic',
          nodeId: 'MAGIC',
          title: graphNodeMetaById.MAGIC.label,
          description: 'Treat magic as a guided decision point that branches into standard checks or combat without new backend rules.',
          infoTopicId: descriptor.infoTopicId,
          nextSteps,
          primaryActions: [buildAction('SELECT_PROCEDURE'), buildAction('OPEN_COMBAT')],
          secondaryActions,
          selectedProcedure: session.selectedProcedure,
        },
        utilityCounts,
        timeseries,
        publicTranscript,
        gmTranscript,
      };
  }
}

export function readGmActionMeta(actionId: GameplayGmActionId): { label: string; description: string } {
  return actionMetaById[actionId];
}

function buildSharedSecondaryActions(nodeId: GameplayNodeId): GmActionViewModel[] {
  const descriptor = gameplayStepDescriptorByNodeId[nodeId];
  return descriptor.gmActionIds
    .filter((actionId) =>
      actionId === 'OPEN_CHAT_MODE' ||
      actionId === 'OPEN_TRANSCRIPT_UTILITY' ||
      actionId === 'OPEN_TIMESERIES_UTILITY' ||
      actionId === 'OPEN_STATUS_UTILITY'
    )
    .map((actionId) => buildAction(actionId));
}

function buildNextStep(
  currentNodeId: GameplayNodeId,
  nodeId: GameplayNodeId,
  unresolvedActionCount: number
): GmNextStepViewModel {
  const meta = graphNodeMetaById[nodeId];
  const disabledReason =
    currentNodeId === 'COMBAT_ROUND' && nodeId === 'WEAPON_ATTACK' && unresolvedActionCount === 0
      ? 'Declare at least one combat action before moving into attack resolution.'
      : undefined;
  return {
    nodeId,
    label: meta.label,
    description: meta.description,
    enabled: !disabledReason,
    disabledReason,
  };
}

function buildAction(actionId: GameplayGmActionId, disabledReason?: string | null): GmActionViewModel {
  const meta = actionMetaById[actionId];
  return {
    id: actionId,
    label: meta.label,
    description: meta.description,
    enabled: !disabledReason,
    disabledReason: disabledReason ?? undefined,
  };
}

function asTimeseries(audience: 'PUBLIC' | 'GM_ONLY') {
  return (event: GameplayEventView): GmTimeseriesEntry => ({
    ...event,
    audience,
  });
}

function compareAscending(left: { createdAt: string }, right: { createdAt: string }): number {
  return left.createdAt.localeCompare(right.createdAt);
}

function compareDescending(left: { createdAt: string }, right: { createdAt: string }): number {
  return right.createdAt.localeCompare(left.createdAt);
}

const actionMetaById: Record<GameplayGmActionId, { label: string; description: string }> = {
  LOAD_SAMPLE: {
    label: 'Load RPG Sample',
    description: 'Seed the tavern sample for this game.',
  },
  OPEN_CHAT_MODE: {
    label: 'Open Chat',
    description: 'Switch to the GM table chat view.',
  },
  OPEN_TIMESERIES_UTILITY: {
    label: 'Open Timeseries',
    description: 'Inspect the merged operational event stream.',
  },
  OPEN_TRANSCRIPT_UTILITY: {
    label: 'Open Transcript',
    description: 'Inspect the public or GM-only transcript.',
  },
  OPEN_STATUS_UTILITY: {
    label: 'Open Status',
    description: 'Inspect command state and recent command history.',
  },
  FOCUS_PLAYER_INTENT: {
    label: 'Focus Player Intent',
    description: 'Move attention toward the next player-driven action.',
  },
  SELECT_PROCEDURE: {
    label: 'Choose Procedure',
    description: 'Open the procedure controls for the current fiction.',
  },
  RESOLVE_NO_ROLL: {
    label: 'Resolve No-Roll Outcome',
    description: 'Narrate the direct outcome and return to the scene.',
  },
  RESOLVE_STANDARD_CHECK: {
    label: 'Resolve Standard Check',
    description: 'Apply the public check math and narrate the result.',
  },
  RESOLVE_DIFFICULTY_CHECK: {
    label: 'Resolve Hidden Check',
    description: 'Apply the hidden target and narrate only what the characters perceive.',
  },
  OPEN_COMBAT: {
    label: 'Open Combat Round',
    description: 'Start combat using the existing round command.',
  },
  DECLARE_COMBAT_ACTION: {
    label: 'Declare GM/NPC Action',
    description: 'Submit a combat declaration for an NPC or GM-controlled combatant.',
  },
  PREPARE_COMBAT_RESOLUTION: {
    label: 'Pick Action To Resolve',
    description: 'Choose the next unresolved action and load its combat math defaults.',
  },
  RESOLVE_COMBAT_TURN: {
    label: 'Resolve Combat Turn',
    description: 'Run one combat action through hit and damage resolution.',
  },
  CONTINUE_COMBAT_ROUND: {
    label: 'Continue Round',
    description: 'Review the next unresolved action or close combat if the round is done.',
  },
  CLOSE_COMBAT: {
    label: 'Close Combat',
    description: 'End combat and move into aftermath.',
  },
  RESUME_SCENE: {
    label: 'Resume Scene Play',
    description: 'Return attention to scene-level play and the next player intent.',
  },
};
