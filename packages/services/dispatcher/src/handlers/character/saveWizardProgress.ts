import type { CharacterDraft, CharacterItem } from '@starter/shared';
import type { CommandHandler } from '../types.js';
import {
  applyStartingAndValidate,
  computeAndValidate,
  emptyCharacterDraft,
  purchaseAndValidate,
  spendExpAndValidate,
  toCharacterDraft,
  toEngineState,
} from './shared.js';

export const saveDraftHandler: CommandHandler<'SaveCharacterDraft'> = async (ctx, envelope) => {
  const existing = await ctx.db.characterRepository.getCharacter(envelope.gameId, envelope.payload.characterId);
  if (existing && existing.ownerPlayerId !== envelope.actorId) {
    const error = new Error(`character "${existing.characterId}" is not owned by actor "${envelope.actorId}"`);
    (error as Error & { code?: string }).code = 'CHARACTER_OWNER_REQUIRED';
    throw error;
  }
  if (existing && (existing.status === 'PENDING' || existing.status === 'APPROVED')) {
    const error = new Error(`character "${existing.characterId}" is not editable in status "${existing.status}"`);
    (error as Error & { code?: string }).code = 'CHARACTER_NOT_EDITABLE';
    throw error;
  }
  if (
    existing &&
    envelope.payload.expectedVersion !== undefined &&
    envelope.payload.expectedVersion !== null &&
    existing.version !== envelope.payload.expectedVersion
  ) {
    const error = new Error(
      `stale character version for "${existing.characterId}": expected ${envelope.payload.expectedVersion}, actual ${existing.version}`
    );
    (error as Error & { code?: string }).code = 'STALE_CHARACTER_VERSION';
    throw error;
  }

  const previous = createBaseCharacter(existing, envelope);
  let engineState = toEngineState(previous);

  engineState = computeAndValidate({
    ...engineState,
    race: previous.draft.race,
    raisedBy: previous.draft.raisedBy,
    subAbility: envelope.payload.subAbility,
    identity: {
      name: envelope.payload.identity.name,
      age: envelope.payload.identity.age ?? null,
      gender: envelope.payload.identity.gender ?? null,
    },
  });

  if (
    typeof envelope.payload.backgroundRoll2dTotal === 'number' ||
    typeof envelope.payload.startingMoneyRoll2dTotal === 'number'
  ) {
    engineState = applyStartingAndValidate(engineState, {
      backgroundRoll2dTotal: envelope.payload.backgroundRoll2dTotal,
      startingMoneyRoll2dTotal: envelope.payload.startingMoneyRoll2dTotal,
      craftsmanSkill: envelope.payload.craftsmanSkill,
      merchantScholarChoice: envelope.payload.merchantScholarChoice,
      generalSkillName: envelope.payload.generalSkillName,
    });
  }

  engineState = spendExpAndValidate(engineState, {
    purchases: envelope.payload.purchases,
  });

  engineState = purchaseAndValidate(engineState, {
    weapons: toStringArray(envelope.payload.cart.weapons),
    armor: toStringArray(envelope.payload.cart.armor),
    shields: toStringArray(envelope.payload.cart.shields),
    gear: toStringArray(envelope.payload.cart.gear),
  });

  const nextDraft: CharacterDraft = {
    ...toCharacterDraft(previous, engineState),
    background:
      engineState.startingPackage?.source === 'BACKGROUND_TABLE_1_5'
        ? {
            kind: toSavedBackgroundKind(engineState.startingPackage.backgroundName, engineState.startingPackage.startingSkills),
            roll2d: envelope.payload.backgroundRoll2dTotal ?? previous.draft.background.roll2d,
          }
        : previous.draft.background,
    starting: engineState.startingPackage
      ? {
          expTotal: engineState.startingPackage.startingExpTotal,
          expUnspent: engineState.startingPackage.expUnspent,
          moneyGamels: engineState.startingPackage.startingMoneyGamels,
          moneyRoll2d: envelope.payload.startingMoneyRoll2dTotal ?? previous.draft.starting.moneyRoll2d,
          startingSkills: engineState.startingPackage.startingSkills,
        }
      : previous.draft.starting,
    identity: envelope.payload.identity
      ? {
          name: envelope.payload.identity.name,
          age: envelope.payload.identity.age ?? null,
          gender: envelope.payload.identity.gender ?? null,
        }
      : previous.draft.identity,
    noteToGm:
      typeof envelope.payload.noteToGm === 'string' ? envelope.payload.noteToGm : (previous.draft.noteToGm ?? null),
    appearance: previous.draft.appearance,
    gmNote: previous.draft.gmNote,
  };

  const nextStatus = existing?.status ?? 'DRAFT';
  if (existing && isSameDraft(existing.draft, nextDraft) && existing.status === nextStatus) {
    return {
      writes: [],
      inbox: [],
      notifications: [],
    };
  }

  if (!existing) {
    return {
      writes: [
        {
          kind: 'PUT_CHARACTER_DRAFT',
          input: {
            gameId: envelope.gameId,
            characterId: envelope.payload.characterId,
            ownerPlayerId: envelope.actorId,
            draft: nextDraft,
            createdAt: envelope.createdAt,
            updatedAt: ctx.nowIso(),
            status: 'DRAFT',
            submittedAt: null,
            submittedDraftVersion: null,
          },
        },
      ],
      inbox: [],
      notifications: [],
    };
  }

  return {
    writes: [
      {
        kind: 'UPDATE_CHARACTER_WITH_VERSION',
        input: {
          gameId: existing.gameId,
          characterId: existing.characterId,
          expectedVersion: existing.version,
          next: {
            ownerPlayerId: existing.ownerPlayerId,
            draft: nextDraft,
            status: existing.status,
            updatedAt: ctx.nowIso(),
            submittedAt: existing.submittedAt ?? null,
            submittedDraftVersion: existing.submittedDraftVersion ?? null,
          },
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};

function createBaseCharacter(
  existing: CharacterItem | null,
  envelope: Parameters<CommandHandler<'SaveCharacterDraft'>>[1]
): CharacterItem {
  const now = new Date().toISOString();
  const baseDraft = emptyCharacterDraft(envelope.payload.race, envelope.payload.raisedBy ?? null);
  const preservedIdentity = existing?.draft.identity ?? baseDraft.identity;
  const preservedAppearance = existing?.draft.appearance ?? baseDraft.appearance;
  const preservedGmNote = existing?.draft.gmNote ?? baseDraft.gmNote;

  return {
    pk: existing?.pk ?? `GAME#${envelope.gameId}`,
    sk: existing?.sk ?? `CHAR#${envelope.payload.characterId}`,
    type: 'Character',
    gameId: envelope.gameId,
    characterId: envelope.payload.characterId,
    ownerPlayerId: existing?.ownerPlayerId ?? envelope.actorId,
    status: existing?.status ?? 'DRAFT',
    draft: {
      ...baseDraft,
      identity: preservedIdentity,
      noteToGm: existing?.draft.noteToGm ?? baseDraft.noteToGm,
      appearance: preservedAppearance,
      gmNote: preservedGmNote,
    },
    createdAt: existing?.createdAt ?? envelope.createdAt,
    updatedAt: existing?.updatedAt ?? now,
    submittedAt: existing?.submittedAt ?? null,
    submittedDraftVersion: existing?.submittedDraftVersion ?? null,
    version: existing?.version ?? 1,
  };
}

function isSameDraft(left: CharacterDraft, right: CharacterDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function toSavedBackgroundKind(
  backgroundName: string | undefined,
  startingSkills: Array<{ skill: string; level: number }>
): CharacterDraft['background']['kind'] {
  if (!backgroundName) {
    return null;
  }

  const normalized = backgroundName.trim().toUpperCase();
  if (normalized === 'MERCHANT / SCHOLAR' || normalized === 'MERCHANT/SCHOLAR') {
    return startingSkills.some((skill) => skill.skill === 'Merchant') ? 'MERCHANT' : 'SCHOLAR';
  }

  return normalized.replace(/\s+/g, '_') as CharacterDraft['background']['kind'];
}
