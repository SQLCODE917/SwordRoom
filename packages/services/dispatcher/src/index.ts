import {
  COMMAND_TYPES,
  anyCommandEnvelopeSchema,
  loadVerticalSliceFixtures,
  type AnyCommandEnvelope,
  type CommandType,
  type CharacterDraft,
  type CharacterItem,
} from '@starter/shared';
import {
  applyStartingPackage,
  computeAbilitiesAndBonuses,
  createDraftState,
  finalizeCharacter,
  purchaseEquipment,
  spendStartingExp,
  submitForApproval,
  type CharacterCreationState,
  type EquipmentCart,
  type StartingPackageTables,
} from '@starter/engine';
import type { DbAccess } from '@starter/services-shared';

export interface DispatcherDependencies {
  db: DbAccess;
}

export interface DispatchResult {
  commandId: string;
  outcome: 'NOOP_ALREADY_PROCESSED' | 'PROCESSED' | 'FAILED';
  errorCode?: string;
}

export const registeredTypes: ReadonlyArray<CommandType> = COMMAND_TYPES;

export function listRegisteredCommandTypes(): ReadonlyArray<CommandType> {
  return registeredTypes;
}

export function createDispatcher(deps: DispatcherDependencies) {
  return {
    async dispatch(envelopeInput: unknown): Promise<DispatchResult> {
      const parsed = anyCommandEnvelopeSchema.parse(envelopeInput);
      const existing = await deps.db.commandLogRepository.get(parsed.commandId);

      if (existing?.status === 'PROCESSED') {
        return { commandId: parsed.commandId, outcome: 'NOOP_ALREADY_PROCESSED' };
      }

      try {
        await deps.db.commandLogRepository.markProcessing(parsed.commandId, nowIso());

        await dispatchByType(deps, parsed);

        await deps.db.commandLogRepository.markProcessed(parsed.commandId, nowIso());
        return { commandId: parsed.commandId, outcome: 'PROCESSED' };
      } catch (error) {
        const errorCode = extractErrorCode(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        await deps.db.commandLogRepository.markFailed(parsed.commandId, nowIso(), errorCode, errorMessage);
        return { commandId: parsed.commandId, outcome: 'FAILED', errorCode };
      }
    },
  };
}

async function dispatchByType(deps: DispatcherDependencies, envelope: AnyCommandEnvelope): Promise<void> {
  switch (envelope.type) {
    case 'CreateCharacterDraft':
      await handleCreateCharacterDraft(deps, envelope);
      return;
    case 'SetCharacterSubAbilities':
      await handleSetCharacterSubAbilities(deps, envelope);
      return;
    case 'ApplyStartingPackage':
      await handleApplyStartingPackage(deps, envelope);
      return;
    case 'SpendStartingExp':
      await handleSpendStartingExp(deps, envelope);
      return;
    case 'PurchaseStarterEquipment':
      await handlePurchaseStarterEquipment(deps, envelope);
      return;
    case 'SubmitCharacterForApproval':
      await handleSubmitCharacterForApproval(deps, envelope);
      return;
    case 'GMReviewCharacter':
      await handleGmReviewCharacter(deps, envelope);
      return;
    default: {
      const neverType: never = envelope;
      throw new Error(`unsupported command type: ${String((neverType as AnyCommandEnvelope).type)}`);
    }
  }
}

async function handleCreateCharacterDraft(
  deps: DispatcherDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'CreateCharacterDraft' }>
): Promise<void> {
  const payload = envelope.payload;
  const draft = emptyCharacterDraft(payload.race, payload.raisedBy ?? null);

  await deps.db.characterRepository.putCharacterDraft({
    gameId: envelope.gameId,
    characterId: payload.characterId,
    ownerPlayerId: envelope.actorId,
    draft,
    createdAt: envelope.createdAt,
    updatedAt: nowIso(),
    status: 'DRAFT',
  });
}

async function handleSetCharacterSubAbilities(
  deps: DispatcherDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'SetCharacterSubAbilities' }>
): Promise<void> {
  const character = await requireCharacter(deps.db, envelope.gameId, envelope.payload.characterId);
  const state = toEngineState(character);

  state.subAbility = envelope.payload.subAbility;
  const computed = computeAbilitiesAndBonuses(state);
  throwOnEngineErrors(computed.errors);

  await persistEngineState(deps.db, character, computed.state, 'DRAFT');
}

async function handleApplyStartingPackage(
  deps: DispatcherDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'ApplyStartingPackage' }>
): Promise<void> {
  const character = await requireCharacter(deps.db, envelope.gameId, envelope.payload.characterId);
  const state = toEngineState(character);
  const result = applyStartingPackage(
    state,
    {
      backgroundRoll2dTotal:
        (envelope.payload as { backgroundRoll2dTotal?: number; backgroundRoll2d?: number }).backgroundRoll2dTotal ??
        (envelope.payload as { backgroundRoll2dTotal?: number; backgroundRoll2d?: number }).backgroundRoll2d,
      startingMoneyRoll2dTotal: (envelope.payload as { startingMoneyRoll2dTotal?: number }).startingMoneyRoll2dTotal,
      useOrdinaryCitizenShortcut: envelope.payload.useOrdinaryCitizenShortcut,
    },
    loadStartingPackageTables()
  );
  throwOnEngineErrors(result.errors);

  await persistEngineState(deps.db, character, result.state, 'DRAFT');
}

async function handleSpendStartingExp(
  deps: DispatcherDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'SpendStartingExp' }>
): Promise<void> {
  const character = await requireCharacter(deps.db, envelope.gameId, envelope.payload.characterId);
  const state = toEngineState(character);
  const result = spendStartingExp(state, { purchases: envelope.payload.purchases });
  throwOnEngineErrors(result.errors);

  await persistEngineState(deps.db, character, result.state, 'DRAFT');
}

async function handlePurchaseStarterEquipment(
  deps: DispatcherDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'PurchaseStarterEquipment' }>
): Promise<void> {
  const character = await requireCharacter(deps.db, envelope.gameId, envelope.payload.characterId);
  const state = toEngineState(character);
  const result = purchaseEquipment(
    state,
    { cart: toEquipmentCart(envelope.payload.cart) },
    loadItemCatalog()
  );
  throwOnEngineErrors(result.errors);

  await persistEngineState(deps.db, character, result.state, 'DRAFT');
}

async function handleSubmitCharacterForApproval(
  deps: DispatcherDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'SubmitCharacterForApproval' }>
): Promise<void> {
  const character = await requireCharacter(deps.db, envelope.gameId, envelope.payload.characterId);
  const state = toEngineState(character);

  const finalized = finalizeCharacter(state, { requireIdentityName: false });
  throwOnEngineErrors(finalized.errors);

  const submitted = submitForApproval(finalized.state);
  throwOnEngineErrors(submitted.errors);

  await persistEngineState(deps.db, character, submitted.state, 'PENDING');

  await deps.db.inboxRepository.addGmInboxItem({
    gameId: envelope.gameId,
    characterId: envelope.payload.characterId,
    ownerPlayerId: character.ownerPlayerId,
    submittedAt: envelope.createdAt,
  });
}

async function handleGmReviewCharacter(
  deps: DispatcherDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'GMReviewCharacter' }>
): Promise<void> {
  const character = await requireCharacter(deps.db, envelope.gameId, envelope.payload.characterId);

  const nextStatus = envelope.payload.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const updatedDraft: CharacterDraft = {
    ...character.draft,
    gmNote: envelope.payload.gmNote ?? null,
  };

  await deps.db.characterRepository.updateCharacterWithVersion({
    gameId: character.gameId,
    characterId: character.characterId,
    expectedVersion: character.version,
    next: {
      ownerPlayerId: character.ownerPlayerId,
      draft: updatedDraft,
      status: nextStatus,
      updatedAt: nowIso(),
    },
  });

  const gmItems = await deps.db.inboxRepository.queryGmInbox(envelope.gameId);
  const gmItem = gmItems.find((item) => item.characterId === envelope.payload.characterId);
  if (gmItem) {
    await (deps.db.inboxRepository as { resolveGmInboxItem?: (g: string, s: string, c: string) => Promise<void> })
      .resolveGmInboxItem?.(envelope.gameId, gmItem.submittedAt, gmItem.characterId);
  }

  await deps.db.inboxRepository.addPlayerInboxItem({
    playerId: character.ownerPlayerId,
    promptId: envelope.commandId,
    gameId: envelope.gameId,
    kind: nextStatus === 'APPROVED' ? 'CHAR_APPROVED' : 'CHAR_REJECTED',
    ref: { characterId: character.characterId, commandId: envelope.commandId },
    message: nextStatus === 'APPROVED' ? 'Character approved' : 'Character rejected',
    createdAt: envelope.createdAt,
    readAt: null,
  });
}

async function requireCharacter(db: DbAccess, gameId: string, characterId: string): Promise<CharacterItem> {
  const character = await db.characterRepository.getCharacter(gameId, characterId);
  if (!character) {
    throw new Error(`character not found: ${gameId}/${characterId}`);
  }
  return character;
}

async function persistEngineState(
  db: DbAccess,
  previous: CharacterItem,
  nextState: CharacterCreationState,
  status: CharacterItem['status']
): Promise<void> {
  await db.characterRepository.updateCharacterWithVersion({
    gameId: previous.gameId,
    characterId: previous.characterId,
    expectedVersion: previous.version,
    next: {
      ownerPlayerId: previous.ownerPlayerId,
      draft: toCharacterDraft(previous, nextState),
      status,
      updatedAt: nowIso(),
    },
  });
}

function toCharacterDraft(previous: CharacterItem, state: CharacterCreationState): CharacterDraft {
  return {
    ...previous.draft,
    race: state.race ?? previous.draft.race,
    raisedBy: state.raisedBy ?? previous.draft.raisedBy,
    subAbility: state.subAbility ?? previous.draft.subAbility,
    ability: state.ability ?? previous.draft.ability,
    bonus: state.bonus ?? previous.draft.bonus,
    starting: state.startingPackage
      ? {
          expTotal: state.startingPackage.startingExpTotal,
          expUnspent: state.startingPackage.expUnspent,
          moneyGamels: state.startingPackage.startingMoneyGamels,
          moneyRoll2d: state.startingPackage.backgroundRoll2dTotal ?? null,
          startingSkills: state.startingPackage.startingSkills,
        }
      : previous.draft.starting,
    skills: state.skills,
    purchases: state.equipmentCart
      ? toPurchaseDraft(state.equipmentCart, loadItemCatalogRaw())
      : previous.draft.purchases,
    identity: {
      ...previous.draft.identity,
      name: state.identity?.name ?? previous.draft.identity.name,
      age: state.identity?.age ?? previous.draft.identity.age,
      gender: state.identity?.gender ?? previous.draft.identity.gender,
    },
  };
}

function toEngineState(character: CharacterItem): CharacterCreationState {
  return {
    characterId: character.characterId,
    race: character.draft.race,
    raisedBy: character.draft.raisedBy,
    subAbility: character.draft.subAbility,
    ability: character.draft.ability,
    bonus: character.draft.bonus,
    skills: character.draft.skills,
    identity: character.draft.identity,
    status: character.status,
    completeness: character.status !== 'DRAFT',
    equipmentCart: {
      weapons: character.draft.purchases.weapons.map((item) => item.itemId),
      armor: character.draft.purchases.armor.map((item) => item.itemId),
      shields: character.draft.purchases.shields.map((item) => item.itemId),
      gear: character.draft.purchases.gear.map((item) => item.itemId),
    },
    startingPackage: {
      source: 'BACKGROUND_TABLE_1_5',
      startingSkills: character.draft.starting.startingSkills,
      startingExpTotal: character.draft.starting.expTotal,
      expUnspent: character.draft.starting.expUnspent,
      startingMoneyGamels: character.draft.starting.moneyGamels,
      backgroundRoll2dTotal: character.draft.background.roll2d ?? undefined,
      backgroundName: character.draft.background.kind ?? undefined,
      restrictions: [],
    },
  };
}

function emptyCharacterDraft(race: string, raisedBy: string | null): CharacterDraft {
  return {
    race: toRaceCode(race),
    raisedBy: toRaisedBy(raisedBy),
    subAbility: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0 },
    ability: { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 },
    bonus: { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 },
    background: { kind: null, roll2d: null },
    starting: {
      expTotal: 0,
      expUnspent: 0,
      moneyGamels: 0,
      moneyRoll2d: null,
      startingSkills: [],
    },
    skills: [],
    purchases: { weapons: [], armor: [], shields: [], gear: [] },
    identity: { name: 'Unnamed', age: null, gender: null },
    gmNote: null,
  };
}

function toRaceCode(race: string): CharacterDraft['race'] {
  if (race === 'HUMAN' || race === 'DWARF' || race === 'GRASSRUNNER' || race === 'ELF' || race === 'HALF_ELF') {
    return race;
  }
  throw new Error(`invalid race: ${race}`);
}

function toRaisedBy(raisedBy: string | null): CharacterDraft['raisedBy'] {
  if (raisedBy === 'HUMANS' || raisedBy === 'ELVES' || raisedBy === null) {
    return raisedBy;
  }
  return null;
}

function throwOnEngineErrors(errors: Array<{ code: string; message: string }>): void {
  if (errors.length > 0) {
    const first = errors[0];
    const error = new Error(first.message);
    (error as Error & { code?: string }).code = first.code;
    throw error;
  }
}

function extractErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && typeof (error as { code?: string }).code === 'string') {
    return (error as { code: string }).code;
  }
  return 'UNEXPECTED_ERROR';
}

function toEquipmentCart(cart: Record<string, unknown>): EquipmentCart {
  return {
    weapons: toStringArray(cart.weapons),
    armor: toStringArray(cart.armor),
    shields: toStringArray(cart.shields),
    gear: toStringArray(cart.gear),
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function toPurchaseDraft(
  cart: EquipmentCart,
  itemCatalog: Record<string, { req_str?: number; cost_g?: number }>
): CharacterDraft['purchases'] {
  const mapItem = (itemId: string) => ({
    itemId,
    reqStr: Number(itemCatalog[itemId]?.req_str ?? 0),
    costGamels: Number(itemCatalog[itemId]?.cost_g ?? 0),
  });

  return {
    weapons: cart.weapons.map(mapItem),
    armor: cart.armor.map(mapItem),
    shields: cart.shields.map(mapItem),
    gear: cart.gear.map((itemId) => ({ itemId, qty: 1, costGamels: Number(itemCatalog[itemId]?.cost_g ?? 0) })),
  };
}

function loadStartingPackageTables(): StartingPackageTables {
  const fixtures = loadVerticalSliceFixtures() as Record<string, unknown>;
  const refs = fixtures.rulebook_context_refs as Record<string, any>;
  return {
    backgroundsRows: (refs.backgrounds_table_1_5?.rows ?? {}) as Record<string, any>,
    raceRows: (refs.starting_experience_by_race_table_1_6?.rows ?? {}) as Record<string, any>,
  };
}

function loadItemCatalogRaw(): Record<string, { category: string; req_str?: number; cost_g?: number; tags?: string[] }> {
  const fixtures = loadVerticalSliceFixtures() as Record<string, unknown>;
  const engineContract = fixtures.engine_contract as Record<string, any>;
  const rules = engineContract.minimal_item_catalog_rules_for_slice as Record<string, any>;
  return (rules.items ?? {}) as Record<string, { category: string; req_str?: number; cost_g?: number; tags?: string[] }>;
}

function loadItemCatalog(): Record<string, { category: string; req_str?: number; tags?: string[] }> {
  const raw = loadItemCatalogRaw();
  const out: Record<string, { category: string; req_str?: number; tags?: string[] }> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = { category: value.category, req_str: value.req_str, tags: value.tags };
  }
  return out;
}

function nowIso(): string {
  return new Date().toISOString();
}
