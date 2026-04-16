import { describe, expect, it } from 'vitest';
import { gameplayLoopGraph } from '@starter/shared';
import type { GameplayView } from '../api/ApiClient';
import { deriveGmControlModel, readGmPlayUiState } from './gmControlModel';

function createGameplayView(overrides?: Partial<GameplayView['session']>): GameplayView {
  return {
    gameId: 'game-1',
    gameName: 'Dungeon Delvers',
    view: 'GM',
    graph: {
      nodes: [...gameplayLoopGraph.nodes],
      edges: [...gameplayLoopGraph.edges],
    },
    participants: [
      {
        playerId: 'gm-1',
        displayName: 'GM',
        role: 'GM',
        characterId: null,
      },
    ],
    session: {
      sessionId: 'main',
      scenarioId: 'rpg_sample_tavern',
      graphVersion: gameplayLoopGraph.version,
      currentNodeId: 'SCENE_FRAME',
      status: 'ACTIVE',
      sceneTitle: 'Tavern At Sundown',
      sceneSummary: 'The Brando family is making trouble in the tavern.',
      focusPrompt: 'What do the heroes do?',
      selectedProcedure: null,
      pendingIntentId: null,
      activeCheck: null,
      combatants: [
        {
          combatantId: 'char-1',
          actorId: 'player-1',
          characterId: 'char-1',
          displayName: 'Asha',
          side: 'PLAYER',
          status: 'READY',
          lifePoints: 18,
          maxLifePoints: 18,
          stats: {
            intelligence: 12,
            agility: 11,
            attackBase: 8,
            evasionBase: 7,
            bonusDamage: 2,
            damageReduction: 1,
            strikeBase: 7,
            defenseValue: 1,
          },
        },
        {
          combatantId: 'npc-1',
          actorId: null,
          characterId: null,
          displayName: 'Brando Boss',
          side: 'NPC',
          status: 'READY',
          lifePoints: 10,
          maxLifePoints: 18,
          stats: {
            intelligence: 8,
            agility: 9,
            attackBase: 7,
            evasionBase: 9,
            bonusDamage: 2,
            damageReduction: 0,
            strikeBase: 7,
            defenseValue: 1,
          },
        },
      ],
      combat: null,
      updatedAt: '2026-04-10T00:00:00.000Z',
      version: 1,
      ...overrides,
    },
    publicEvents: [
      {
        eventId: 'evt-public-1',
        gameId: 'game-1',
        audience: 'PUBLIC',
        eventKind: 'INTENT_SUBMITTED',
        nodeId: 'PLAYER_INTENT',
        actorId: 'player-1',
        title: 'Asha declares an intent',
        body: 'Step between the thugs and the poster girl.',
        detail: {
          characterId: 'char-1',
        },
        createdAt: '2026-04-10T00:00:00.000Z',
      },
    ],
    gmOnlyEvents: [
      {
        eventId: 'evt-gm-1',
        gameId: 'game-1',
        audience: 'GM_ONLY',
        eventKind: 'PROCEDURE_SELECTED',
        nodeId: 'STANDARD_CHECK',
        actorId: 'gm-1',
        title: 'GM procedure details',
        body: 'baseline=4, modifiers=0, target=10',
        detail: {},
        createdAt: '2026-04-10T00:01:00.000Z',
      },
    ],
  };
}

describe('readGmPlayUiState', () => {
  it('defaults and normalizes missing or invalid params', () => {
    expect(readGmPlayUiState(new URLSearchParams())).toEqual({
      state: {
        mode: 'control',
        panel: 'step',
        utility: null,
        transcript: 'public',
      },
      needsNormalization: true,
    });

    expect(readGmPlayUiState(new URLSearchParams('mode=nope&panel=bad&utility=zzz&transcript=ghost'))).toEqual({
      state: {
        mode: 'control',
        panel: 'step',
        utility: null,
        transcript: 'public',
      },
      needsNormalization: true,
    });
  });

  it('accepts valid UI params without normalization', () => {
    expect(readGmPlayUiState(new URLSearchParams('mode=chat&panel=graph&utility=status&transcript=gm'))).toEqual({
      state: {
        mode: 'chat',
        panel: 'graph',
        utility: 'status',
        transcript: 'gm',
      },
      needsNormalization: false,
    });
  });
});

describe('deriveGmControlModel', () => {
  it('disables combat resolution prep when a round has no declared actions', () => {
    const gameplay = createGameplayView({
      currentNodeId: 'COMBAT_ROUND',
      status: 'IN_COMBAT',
      selectedProcedure: 'COMBAT',
      combat: {
        currentRoundNumber: 1,
        aftermathSummary: null,
        rounds: [
          {
            roundNumber: 1,
            announcementOrder: ['char-1', 'npc-1'],
            resolutionOrder: ['char-1', 'npc-1'],
            declaredActions: [],
            resolvedActionIds: [],
            openedAt: '2026-04-10T00:02:00.000Z',
          },
        ],
      },
    });

    const model = deriveGmControlModel({
      gameplay,
      commandStatus: {
        state: 'Idle',
        commandId: null,
        message: 'No command submitted yet.',
        errorCode: null,
        errorMessage: null,
      },
      recentCommandStatuses: [],
    });

    expect(model.currentStep.kind).toBe('combat_round');
    if (model.currentStep.kind !== 'combat_round') {
      return;
    }
    expect(model.currentStep.primaryActions.find((action) => action.id === 'PREPARE_COMBAT_RESOLUTION')).toMatchObject({
      enabled: false,
      disabledReason: 'Declare actions before resolving the round.',
    });
    expect(model.currentStep.nextSteps.find((step) => step.nodeId === 'WEAPON_ATTACK')).toMatchObject({
      enabled: false,
    });
  });

  it('builds a damage-step summary from gameplay events and combatants', () => {
    const gameplay = createGameplayView({
      currentNodeId: 'DAMAGE',
      status: 'IN_COMBAT',
      selectedProcedure: 'COMBAT',
      combat: {
        currentRoundNumber: 1,
        aftermathSummary: null,
        rounds: [
          {
            roundNumber: 1,
            announcementOrder: ['char-1', 'npc-1'],
            resolutionOrder: ['char-1', 'npc-1'],
            declaredActions: [
              {
                actionId: 'char-1:1',
                roundNumber: 1,
                actorCombatantId: 'char-1',
                actorId: 'player-1',
                targetCombatantId: 'npc-1',
                actionType: 'ATTACK',
                movementMode: 'NORMAL',
                delayToOrderZero: false,
                summary: 'Asha charges Brando Boss.',
                announcedAt: '2026-04-10T00:02:10.000Z',
              },
            ],
            resolvedActionIds: [],
            openedAt: '2026-04-10T00:02:00.000Z',
          },
        ],
      },
    });
    gameplay.publicEvents = [
      ...gameplay.publicEvents,
      {
        eventId: 'evt-public-2',
        gameId: 'game-1',
        audience: 'PUBLIC',
        eventKind: 'COMBAT_TURN_RESOLVED',
        nodeId: 'WEAPON_ATTACK',
        actorId: 'gm-1',
        title: 'Combat turn resolved',
        body: 'Asha drives Brando Boss back across the tavern floor.',
        detail: {},
        createdAt: '2026-04-10T00:03:00.000Z',
      },
    ];

    const model = deriveGmControlModel({
      gameplay,
      commandStatus: {
        state: 'Processed',
        commandId: 'cmd-1',
        message: 'Resolved combat turn.',
        errorCode: null,
        errorMessage: null,
      },
      recentCommandStatuses: [
        {
          state: 'Processed',
          commandId: 'cmd-0',
          message: 'Opened combat round.',
          errorCode: null,
          errorMessage: null,
          capturedAt: '2026-04-10T00:02:00.000Z',
        },
      ],
    });

    expect(model.utilityCounts.status).toBe(2);
    expect(model.currentStep.kind).toBe('damage');
    if (model.currentStep.kind !== 'damage') {
      return;
    }
    expect(model.currentStep.latestResolution?.body).toContain('Asha drives Brando Boss back');
    expect(model.currentStep.combatSnapshot).toHaveLength(2);
  });
});
