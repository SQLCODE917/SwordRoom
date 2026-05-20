import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { PregameRole, SharedCharacterDraftArtifact, SharedCharacterDraftIntent, SharedPartyRoleClaimArtifact } from '@starter/shared';
import type { CharacterItem, CommandEnvelopeInput, CommandStatusResponse, CommandType } from '../../api/ApiClient';
import { describeFailure } from '../../hooks/useCommandStatus';
import { logWebFlow, summarizeError } from '../../logging/flowLog';
import { buildSaveCharacterDraftEnvelope, buildShareCharacterDraftEnvelope, buildSubmitCharacterForApprovalEnvelope } from './commands.js';
import { buildSharePartyRoleClaimEnvelope } from '../pregame-planning/commands.js';
import { PREGAME_ROLE_LABELS } from '../pregame-planning/labels.js';
import { hydrateWizardStateFromCharacter, serializeWizardState } from './state.js';
import type { CharacterSnapshot, SaveButtonState, WizardMode, WizardState, WizardStepKey } from './types.js';
import type { createCharacterWizardViewModel } from './viewModel.js';

const initialSaveButtonState: Record<WizardStepKey, SaveButtonState> = {
  race: 'idle',
  dice: 'idle',
  background: 'idle',
  identity: 'idle',
  exp: 'idle',
  equipment: 'idle',
  submit: 'idle',
};

type CharacterWizardViewModel = ReturnType<typeof createCharacterWizardViewModel>;

export function useCharacterWizardWorkflow(input: {
  api: {
    getCharacter(gameId: string, characterId: string): Promise<CharacterItem | null>;
    getOwnedCharacter(playerId: string, characterId: string): Promise<CharacterItem | null>;
  };
  routePlayerId: string | null;
  wizardMode: WizardMode;
  state: WizardState;
  snapshot: CharacterSnapshot | null;
  view: CharacterWizardViewModel;
  setState: Dispatch<SetStateAction<WizardState>>;
  setSnapshot: Dispatch<SetStateAction<CharacterSnapshot | null>>;
  setLastSavedFingerprint: Dispatch<SetStateAction<string | null>>;
  setStepError: Dispatch<SetStateAction<string>>;
  submitEnvelopeAndAwait: <T extends CommandType>(
    label: string,
    envelope: CommandEnvelopeInput<T>
  ) => Promise<CommandStatusResponse>;
  revealCommandStatus?: () => void;
  onPregamePlanningChanged?: () => Promise<void> | void;
}) {
  const [saveStateByStep, setSaveStateByStep] = useState<Record<WizardStepKey, SaveButtonState>>(() => initialSaveButtonState);
  const [shareState, setShareState] = useState<SaveButtonState>('idle');
  const shareResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveResetTimersRef = useRef<Record<WizardStepKey, ReturnType<typeof setTimeout> | null>>({
    race: null,
    dice: null,
    background: null,
    identity: null,
    exp: null,
    equipment: null,
    submit: null,
  });

  useEffect(() => {
    return () => {
      for (const timer of Object.values(saveResetTimersRef.current)) {
        if (timer) {
          clearTimeout(timer);
        }
      }
      if (shareResetTimerRef.current) {
        clearTimeout(shareResetTimerRef.current);
      }
    };
  }, []);

  const setSaveButtonState = useCallback((stepKey: WizardStepKey, nextState: SaveButtonState) => {
    const existingTimer = saveResetTimersRef.current[stepKey];
    if (existingTimer) {
      clearTimeout(existingTimer);
      saveResetTimersRef.current[stepKey] = null;
    }

    setSaveStateByStep((prev) => ({
      ...prev,
      [stepKey]: nextState,
    }));

    if (nextState === 'saved') {
      saveResetTimersRef.current[stepKey] = setTimeout(() => {
        setSaveStateByStep((prev) => ({
          ...prev,
          [stepKey]: 'idle',
        }));
        saveResetTimersRef.current[stepKey] = null;
      }, 1400);
    }
  }, []);

  const setShareButtonState = useCallback((nextState: SaveButtonState) => {
    if (shareResetTimerRef.current) {
      clearTimeout(shareResetTimerRef.current);
      shareResetTimerRef.current = null;
    }
    setShareState(nextState);
    if (nextState === 'saved') {
      shareResetTimerRef.current = setTimeout(() => {
        setShareState('idle');
        shareResetTimerRef.current = null;
      }, 1400);
    }
  }, []);

  const refreshSnapshot = useCallback(
    async (options?: { syncWizardState?: boolean }): Promise<CharacterSnapshot | null> => {
      logWebFlow('WEB_CHARACTER_WIZARD_SNAPSHOT_REFRESH_START', {
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        wizardMode: input.wizardMode,
      });
      try {
        const item =
          input.wizardMode === 'library' && input.routePlayerId
            ? await input.api.getOwnedCharacter(input.routePlayerId, input.state.characterId)
            : await input.api.getCharacter(input.state.gameId, input.state.characterId);
        if (!item) {
          input.setSnapshot(null);
          input.setLastSavedFingerprint(null);
          logWebFlow('WEB_CHARACTER_WIZARD_SNAPSHOT_REFRESH_MISS', {
            gameId: input.state.gameId,
            characterId: input.state.characterId,
            wizardMode: input.wizardMode,
          });
          return null;
        }

        const hydratedState = hydrateWizardStateFromCharacter(item, input.state);
        if (options?.syncWizardState) {
          input.setState(hydratedState);
        }
        input.setLastSavedFingerprint(serializeWizardState(hydratedState));
        const nextSnapshot = toCharacterWizardSnapshot(item);
        input.setSnapshot(nextSnapshot);
        logWebFlow('WEB_CHARACTER_WIZARD_SNAPSHOT_REFRESH_OK', {
          gameId: input.state.gameId,
          characterId: input.state.characterId,
          wizardMode: input.wizardMode,
          status: nextSnapshot.status,
          version: nextSnapshot.version,
        });
        return nextSnapshot;
      } catch (error) {
        logWebFlow('WEB_CHARACTER_WIZARD_SNAPSHOT_REFRESH_FAILED', {
          gameId: input.state.gameId,
          characterId: input.state.characterId,
          wizardMode: input.wizardMode,
          ...summarizeError(error),
        });
        throw error;
      }
    },
    [input]
  );

  const submitCommandAndAwait = useCallback(
    async <T extends CommandType>(label: string, envelope: CommandEnvelopeInput<T>) => {
      logWebFlow('WEB_CHARACTER_WIZARD_STEP_SUBMIT_START', {
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        label,
      });
      const terminal = await input.submitEnvelopeAndAwait(label, envelope);
      if (terminal.status === 'PROCESSED') {
        logWebFlow('WEB_CHARACTER_WIZARD_STEP_SUBMIT_OK', {
          gameId: input.state.gameId,
          characterId: input.state.characterId,
          label,
          commandId: terminal.commandId,
        });
        return terminal;
      }

      logWebFlow('WEB_CHARACTER_WIZARD_STEP_SUBMIT_FAILED', {
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        label,
        commandId: terminal.commandId,
        errorCode: terminal.errorCode,
        errorMessage: terminal.errorMessage,
      });
      throw new Error(
        describeFailure({
          errorCode: terminal.errorCode,
          errorMessage: terminal.errorMessage,
        })
      );
    },
    [input]
  );

  const saveCurrentDraft = useCallback(
    async (stepKey: WizardStepKey): Promise<CharacterSnapshot> => {
      const payload = buildWizardSaveProgressPayload({
        state: input.state,
        snapshot: input.snapshot,
        stepKey,
        backgroundEligible: input.view.backgroundEligible,
        isDwarfPath: input.view.isDwarfPath,
        equipmentCart: input.view.equipmentCart,
      });
      const envelope = buildSaveCharacterDraftEnvelope({
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        ...payload,
      });
      const terminal = await submitCommandAndAwait(`Save ${stepKey}`, envelope);
      if (terminal.status !== 'PROCESSED') {
        throw new Error(describeFailure(terminal));
      }

      const refreshed = await refreshSnapshot({ syncWizardState: true });
      if (!refreshed) {
        throw new Error('Character snapshot missing after save.');
      }
      logWebFlow('WEB_CHARACTER_WIZARD_SAVE_OK', {
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        stepKey,
        commandId: terminal.commandId,
      });
      return refreshed;
    },
    [input, refreshSnapshot, submitCommandAndAwait]
  );

  const saveStepProgress = useCallback(
    async (stepKey: WizardStepKey) => {
      input.setStepError(' ');
      input.revealCommandStatus?.();
      setSaveButtonState(stepKey, 'saving');
      logWebFlow('WEB_CHARACTER_WIZARD_SAVE_START', {
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        stepKey,
      });

      try {
        await saveCurrentDraft(stepKey);
        setSaveButtonState(stepKey, 'saved');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSaveButtonState(stepKey, 'idle');
        input.setStepError(message);
        logWebFlow('WEB_CHARACTER_WIZARD_SAVE_FAILED', {
          gameId: input.state.gameId,
          characterId: input.state.characterId,
          stepKey,
          ...summarizeError(error),
        });
      }
    },
    [input, saveCurrentDraft, setSaveButtonState]
  );

  const executeFinalAction = useCallback(async () => {
    input.setStepError(' ');
    input.revealCommandStatus?.();
    logWebFlow('WEB_CHARACTER_WIZARD_EXECUTE_START', {
      gameId: input.state.gameId,
      characterId: input.state.characterId,
      wizardMode: input.wizardMode,
      race: input.state.race,
      raisedBy: input.state.raisedBy,
      backgroundRoll2dTotal: input.state.backgroundRoll2dTotal,
      moneyRoll2dTotal: input.state.moneyRoll2dTotal,
      purchases: input.state.purchases.map((entry) => `${entry.skill}:${entry.targetLevel}`),
      cart: input.view.equipmentCart,
      namePresent: input.state.name.trim().length > 0,
      noteToGmPresent: input.state.submitNoteToGm.trim().length > 0,
      expectedVersion: input.snapshot?.version ?? null,
    });
    try {
      if (!input.view.isDraftReadyForSubmit) {
        throw new Error(
          input.view.previewErrors[0] ??
            (input.wizardMode === 'library'
              ? 'Complete the required fields before creating the character.'
              : 'Complete the required fields before submitting for approval.')
        );
      }

      setSaveButtonState('submit', 'saving');
      const nextSnapshot = await saveCurrentDraft('submit');
      setSaveButtonState('submit', 'saved');

      if (input.wizardMode === 'apply') {
        if (!nextSnapshot.version) {
          throw new Error('Draft save did not return a versioned character snapshot.');
        }

        await submitCommandAndAwait(
          'Submit for approval',
          buildSubmitCharacterForApprovalEnvelope({
            gameId: input.state.gameId,
            characterId: input.state.characterId,
            expectedVersion: nextSnapshot.version,
          })
        );

        await refreshSnapshot({ syncWizardState: true });
      }
      logWebFlow('WEB_CHARACTER_WIZARD_EXECUTE_OK', {
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        wizardMode: input.wizardMode,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveButtonState('submit', 'idle');
      logWebFlow('WEB_CHARACTER_WIZARD_EXECUTE_FAILED', {
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        wizardMode: input.wizardMode,
        ...summarizeError(error),
      });
      input.setStepError(message);
    }
  }, [input, refreshSnapshot, saveCurrentDraft, setSaveButtonState, submitCommandAndAwait]);

  const shareDraftToChat = useCallback(async (shareInput?: { intent?: SharedCharacterDraftIntent; contextNote?: string; promptId?: string | null }) => {
    input.setStepError(' ');
    input.revealCommandStatus?.();
    const shareIntent = shareInput?.intent ?? 'DRAFT_SNAPSHOT';
    const contextNote = shareInput?.contextNote?.trim() ?? '';
    const promptId = shareInput?.promptId?.trim() ?? '';
    logWebFlow('WEB_CHARACTER_WIZARD_SHARE_START', {
      gameId: input.state.gameId,
      characterId: input.state.characterId,
      wizardMode: input.wizardMode,
      namePresent: input.state.name.trim().length > 0,
      shareIntent,
      hasContextNote: contextNote.length > 0,
      hasPromptId: promptId.length > 0,
    });
    try {
      if (input.wizardMode !== 'apply') {
        throw new Error('Only game-scoped character drafts can be shared to chat.');
      }
      if (!input.view.isDraftReadyForCheckpointShare) {
        throw new Error(input.view.previewErrors[0] ?? 'Complete the current checkpoint before sharing this draft to chat.');
      }
      if (shareIntent === 'ASK_QUESTION' && contextNote.length === 0) {
        throw new Error('Enter the question you want the party or GM to answer.');
      }
      if (shareIntent === 'COMPARE_DIRECTIONS' && contextNote.length === 0) {
        throw new Error('Describe the two directions you want the party to compare.');
      }
      if (shareIntent === 'ANSWER_GM_PROMPT' && promptId.length === 0) {
        throw new Error('No active GM prompt is available for this share intent.');
      }

      setShareButtonState('saving');
      const nextSnapshot = await saveCurrentDraft('submit');
      if (!nextSnapshot.version) {
        throw new Error('Draft save did not return a versioned character snapshot.');
      }

      const artifact = buildSharedCharacterDraftArtifact({
        state: input.state,
        view: input.view,
        snapshot: nextSnapshot,
        shareIntent,
        contextNote: contextNote || null,
        promptId: promptId || null,
      });
      const body = buildSharedDraftChatBody({
        characterName: artifact.characterName,
        shareIntent,
      });

      await submitCommandAndAwait(
        'Share draft to chat',
        buildShareCharacterDraftEnvelope({
          gameId: input.state.gameId,
          body,
          artifact,
        })
      );

      await input.onPregamePlanningChanged?.();
      setShareButtonState('saved');
      logWebFlow('WEB_CHARACTER_WIZARD_SHARE_OK', {
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        snapshotVersion: nextSnapshot.version,
        shareIntent,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setShareButtonState('idle');
      input.setStepError(message);
      logWebFlow('WEB_CHARACTER_WIZARD_SHARE_FAILED', {
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        ...summarizeError(error),
      });
    }
  }, [input, saveCurrentDraft, setShareButtonState, submitCommandAndAwait]);

  const claimPartyRoleInChat = useCallback(
    async (role: PregameRole) => {
      input.setStepError(' ');
      input.revealCommandStatus?.();
      logWebFlow('WEB_CHARACTER_WIZARD_ROLE_CLAIM_START', {
        gameId: input.state.gameId,
        characterId: input.state.characterId,
        role,
      });
      try {
        if (input.wizardMode !== 'apply') {
          throw new Error('Only game-scoped character drafts can claim party roles.');
        }
        if (!input.view.isDraftReadyForSubmit) {
          throw new Error(input.view.previewErrors[0] ?? 'Complete the required fields before claiming a party role.');
        }

        setShareButtonState('saving');
        const nextSnapshot = await saveCurrentDraft('submit');
        if (!nextSnapshot.version) {
          throw new Error('Draft save did not return a versioned character snapshot.');
        }

        const artifact = buildPartyRoleClaimArtifact({
          state: input.state,
          snapshot: nextSnapshot,
          role,
        });

        await submitCommandAndAwait(
          'Claim party role',
          buildSharePartyRoleClaimEnvelope({
            gameId: input.state.gameId,
            body: buildRoleClaimChatBody({
              characterName: artifact.characterName,
              roles: artifact.roles,
            }),
            artifact,
          })
        );

        await input.onPregamePlanningChanged?.();
        setShareButtonState('saved');
        logWebFlow('WEB_CHARACTER_WIZARD_ROLE_CLAIM_OK', {
          gameId: input.state.gameId,
          characterId: input.state.characterId,
          role,
          snapshotVersion: nextSnapshot.version,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setShareButtonState('idle');
        input.setStepError(message);
        logWebFlow('WEB_CHARACTER_WIZARD_ROLE_CLAIM_FAILED', {
          gameId: input.state.gameId,
          characterId: input.state.characterId,
          role,
          ...summarizeError(error),
        });
      }
    },
    [input, saveCurrentDraft, setShareButtonState, submitCommandAndAwait]
  );

  return {
    saveStateByStep,
    shareState,
    saveStepProgress,
    executeFinalAction,
    shareDraftToChat,
    claimPartyRoleInChat,
    refreshSnapshot,
  };
}

export function buildWizardSaveProgressPayload(input: {
  state: WizardState;
  snapshot: CharacterSnapshot | null;
  stepKey: WizardStepKey;
  backgroundEligible: boolean;
  isDwarfPath: boolean;
  equipmentCart: CharacterWizardViewModel['equipmentCart'];
}): Omit<Parameters<typeof buildSaveCharacterDraftEnvelope>[0], 'gameId' | 'characterId'> {
  logWebFlow('WEB_CHARACTER_WIZARD_SAVE_PAYLOAD_BUILT', {
    gameId: input.state.gameId,
    characterId: input.state.characterId,
    stepKey: input.stepKey,
    expectedVersion: input.snapshot?.version ?? null,
    backgroundApplied: input.backgroundEligible || input.isDwarfPath,
    noteToGmPresent: input.state.submitNoteToGm.trim().length > 0,
    purchases: input.state.purchases.map((entry) => `${entry.skill}:${entry.targetLevel}`),
    cart: input.equipmentCart,
  });

  const payload: Omit<Parameters<typeof buildSaveCharacterDraftEnvelope>[0], 'gameId' | 'characterId'> = {
    expectedVersion: input.snapshot?.version ?? null,
    race: input.state.race,
    raisedBy: input.state.raisedBy,
    subAbility: input.state.subAbility,
    startingMoneyRoll2dTotal: input.state.moneyRoll2dTotal,
    craftsmanSkill: input.state.craftsmanSkill.trim() || undefined,
    merchantScholarChoice: input.state.merchantScholarChoice || undefined,
    generalSkillName: input.state.generalSkillName.trim() || undefined,
    identity: {
      name: input.state.name,
      age: parseOptionalNumber(input.state.age),
      gender: input.state.gender.trim() ? input.state.gender.trim() : null,
    },
    purchases: input.state.purchases,
    cart: input.equipmentCart,
    noteToGm: input.state.submitNoteToGm,
  };

  if (input.backgroundEligible) {
    payload.backgroundRoll2dTotal = input.state.backgroundRoll2dTotal;
  }

  return payload;
}

export function toCharacterWizardSnapshot(item: CharacterItem): CharacterSnapshot {
  const record = item as Record<string, unknown>;
  const draft = record.draft && typeof record.draft === 'object' ? (record.draft as Record<string, unknown>) : null;

  return {
    status: String(record.status ?? 'UNKNOWN'),
    version: typeof record.version === 'number' ? record.version : null,
    subAbility: draft && typeof draft.subAbility === 'object' ? ((draft.subAbility as WizardState['subAbility']) ?? null) : null,
    ability: draft && typeof draft.ability === 'object' ? ((draft.ability as Record<string, number>) ?? null) : null,
    skills:
      draft && Array.isArray(draft.skills)
        ? ((draft.skills as Array<{ skill: string; level: number }>) ?? [])
        : [],
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSharedCharacterDraftArtifact(input: {
  state: WizardState;
  view: CharacterWizardViewModel;
  snapshot: CharacterSnapshot;
  shareIntent: SharedCharacterDraftIntent;
  contextNote: string | null;
  promptId: string | null;
}): SharedCharacterDraftArtifact {
  return {
    kind: 'CHARACTER_DRAFT',
    characterId: input.state.characterId,
    snapshotVersion: input.snapshot.version ?? 0,
    characterName: input.state.name.trim() || input.state.characterId,
    race: input.state.race,
    status: input.snapshot.status,
    shareIntent: input.shareIntent,
    contextNote: input.contextNote ?? undefined,
    promptId: input.promptId ?? undefined,
    abilitySummary: [
      `STR ${input.view.derived.STR}`,
      `DEX ${input.view.derived.DEX}`,
      `MP ${input.view.derived.MP}`,
    ],
    skillSummary: input.snapshot.skills
      .slice()
      .sort((left, right) => right.level - left.level || left.skill.localeCompare(right.skill))
      .slice(0, 3)
      .map((entry) => `${entry.skill} ${entry.level}`),
  };
}

function buildSharedDraftChatBody(input: { characterName: string; shareIntent: SharedCharacterDraftIntent }): string {
  if (input.shareIntent === 'ASK_QUESTION') {
    return `${input.characterName} is asking for draft feedback.`;
  }
  if (input.shareIntent === 'COMPARE_DIRECTIONS') {
    return `${input.characterName} is comparing two build directions.`;
  }
  if (input.shareIntent === 'ANSWER_GM_PROMPT') {
    return `${input.characterName} answered the GM prompt with a draft update.`;
  }
  return `Sharing ${input.characterName} for party feedback.`;
}

function buildPartyRoleClaimArtifact(input: {
  state: WizardState;
  snapshot: CharacterSnapshot;
  role: PregameRole;
}): SharedPartyRoleClaimArtifact {
  return {
    kind: 'PARTY_ROLE_CLAIM',
    claimId: input.snapshot.version ? `${input.state.characterId}:v${input.snapshot.version}:${input.role}` : `${input.state.characterId}:${input.role}`,
    characterId: input.state.characterId,
    snapshotVersion: input.snapshot.version ?? 0,
    characterName: input.state.name.trim() || input.state.characterId,
    roles: [input.role],
    note: `Current plan is to cover ${PREGAME_ROLE_LABELS[input.role]}.`,
  };
}

function buildRoleClaimChatBody(input: { characterName: string; roles: readonly PregameRole[] }): string {
  const roleText = input.roles.map((role) => PREGAME_ROLE_LABELS[role]).join(', ');
  return `${input.characterName} is claiming ${roleText} for the party.`;
}
