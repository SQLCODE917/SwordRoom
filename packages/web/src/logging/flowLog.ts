const sessionId = createSessionId();

export function logWebFlow(event: string, data: Record<string, unknown> = {}): void {
  if (!isFlowLogEnabled()) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      svc: 'web',
      sessionId,
      event,
      ...data,
    })
  );
}

export function summarizeCommandEnvelope(envelope: {
  commandId: string;
  gameId?: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
}): Record<string, unknown> {
  const payload = envelope.payload ?? {};

  return {
    commandId: envelope.commandId,
    type: envelope.type,
    gameId: envelope.gameId ?? null,
    createdAt: envelope.createdAt,
    characterId: typeof payload.characterId === 'string' ? payload.characterId : null,
    race: typeof payload.race === 'string' ? payload.race : null,
    raisedBy: typeof payload.raisedBy === 'string' || payload.raisedBy === null ? payload.raisedBy : null,
    decision: typeof payload.decision === 'string' ? payload.decision : null,
    expectedVersion: typeof payload.expectedVersion === 'number' ? payload.expectedVersion : null,
    noteToGmPresent: typeof payload.noteToGm === 'string' ? payload.noteToGm.trim().length > 0 : false,
    gmNotePresent: typeof payload.gmNote === 'string' ? payload.gmNote.trim().length > 0 : false,
    s3Key: typeof payload.s3Key === 'string' ? payload.s3Key : null,
    identityNamePresent:
      payload.identity && typeof payload.identity === 'object' && typeof (payload.identity as Record<string, unknown>).name === 'string'
        ? ((payload.identity as Record<string, unknown>).name as string).trim().length > 0
        : false,
    backgroundRoll2dTotal: readNumber(payload.backgroundRoll2dTotal, payload.backgroundRoll2d),
    startingMoneyRoll2dTotal: readNumber(payload.startingMoneyRoll2dTotal),
    purchases: summarizePurchases(payload.purchases),
    cart: summarizeCart(payload.cart),
  };
}

export function summarizeError(error: unknown): Record<string, unknown> {
  return {
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

function summarizePurchases(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const skill = typeof record.skill === 'string' ? record.skill : null;
      const targetLevel = typeof record.targetLevel === 'number' ? record.targetLevel : null;
      return skill ? `${skill}:${targetLevel}` : null;
    })
    .filter((entry): entry is string => entry !== null);
}

function summarizeCart(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') {
    return {
      weapons: [],
      armor: [],
      shields: [],
      gear: [],
    };
  }

  const record = value as Record<string, unknown>;
  return {
    weapons: toStringArray(record.weapons),
    armor: toStringArray(record.armor),
    shields: toStringArray(record.shields),
    gear: toStringArray(record.gear),
  };
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

function isFlowLogEnabled(): boolean {
  return (import.meta.env.DEV && !import.meta.env.VITEST) || import.meta.env.VITE_FLOW_LOG === '1';
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `web-${Date.now().toString(16)}`;
}
