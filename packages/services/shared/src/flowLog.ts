export interface FlowLoggerInput {
  enabled: boolean;
  service: 'api' | 'dispatcher';
  event: string;
  data?: Record<string, unknown>;
}

export function logServiceFlow(input: FlowLoggerInput): void {
  if (!input.enabled) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      svc: input.service,
      event: input.event,
      ...(input.data ?? {}),
    })
  );
}

export function summarizeCommandEnvelope(envelope: unknown): Record<string, unknown> {
  if (!envelope || typeof envelope !== 'object') {
    return {};
  }

  const record = envelope as Record<string, unknown>;
  const payload = toRecord(record.payload);
  const type = typeof record.type === 'string' ? record.type : null;

  return {
    commandId: typeof record.commandId === 'string' ? record.commandId : null,
    type,
    gameId: typeof record.gameId === 'string' ? record.gameId : null,
    actorId: typeof record.actorId === 'string' ? record.actorId : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : null,
    characterId: typeof payload.characterId === 'string' ? payload.characterId : null,
    ...summarizePayload(type, payload),
  };
}

export function summarizeError(error: unknown): Record<string, unknown> {
  return {
    errorCode:
      error && typeof error === 'object' && typeof (error as { code?: string }).code === 'string'
        ? (error as { code: string }).code
        : 'UNEXPECTED_ERROR',
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

function summarizePayload(type: string | null, payload: Record<string, unknown>): Record<string, unknown> {
  if (type === 'CreateCharacterDraft') {
    return {
      race: typeof payload.race === 'string' ? payload.race : null,
      raisedBy: typeof payload.raisedBy === 'string' || payload.raisedBy === null ? payload.raisedBy : null,
    };
  }

  if (type === 'SetCharacterSubAbilities') {
    return {
      subAbility: isSubAbility(payload.subAbility) ? payload.subAbility : null,
    };
  }

  if (type === 'ApplyStartingPackage') {
    return {
      backgroundRoll2dTotal: readNumber(payload.backgroundRoll2dTotal, payload.backgroundRoll2d),
      startingMoneyRoll2dTotal: readNumber(payload.startingMoneyRoll2dTotal),
      useOrdinaryCitizenShortcut: typeof payload.useOrdinaryCitizenShortcut === 'boolean' ? payload.useOrdinaryCitizenShortcut : null,
    };
  }

  if (type === 'SpendStartingExp') {
    const purchases = Array.isArray(payload.purchases)
      ? payload.purchases
          .map((purchase) => {
            const record = toRecord(purchase);
            const skill = typeof record.skill === 'string' ? record.skill : null;
            const targetLevel = typeof record.targetLevel === 'number' ? record.targetLevel : null;
            return skill ? `${skill}:${targetLevel}` : null;
          })
          .filter((value): value is string => value !== null)
      : [];

    return {
      purchases,
      purchaseCount: purchases.length,
    };
  }

  if (type === 'PurchaseStarterEquipment') {
    const cart = toRecord(payload.cart);
    return {
      cartWeapons: toStringArray(cart.weapons),
      cartArmor: toStringArray(cart.armor),
      cartShields: toStringArray(cart.shields),
      cartGear: toStringArray(cart.gear),
    };
  }

  if (type === 'ConfirmCharacterAppearanceUpload') {
    return {
      s3Key: typeof payload.s3Key === 'string' ? payload.s3Key : null,
    };
  }

  if (type === 'SubmitCharacterForApproval') {
    const identity = toRecord(payload.identity);
    return {
      noteToGmPresent: typeof payload.noteToGm === 'string' ? payload.noteToGm.trim().length > 0 : false,
      identityNamePresent: typeof identity.name === 'string' ? identity.name.trim().length > 0 : false,
    };
  }

  if (type === 'GMReviewCharacter') {
    return {
      decision: typeof payload.decision === 'string' ? payload.decision : null,
      gmNotePresent: typeof payload.gmNote === 'string' ? payload.gmNote.trim().length > 0 : false,
    };
  }

  return {};
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function readNumber(primary: unknown, fallback?: unknown): number | null {
  if (typeof primary === 'number') {
    return primary;
  }
  if (typeof fallback === 'number') {
    return fallback;
  }
  return null;
}

function isSubAbility(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].every((key) => typeof record[key] === 'number');
}
