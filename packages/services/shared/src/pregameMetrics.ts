import type { AnyCommandEnvelope, SharedChatArtifact } from '@starter/shared';

export type PregameMetricName =
  | 'CHARACTER_DRAFT_CREATED'
  | 'CHARACTER_DRAFT_SAVED'
  | 'CHARACTER_SUBMITTED_FOR_APPROVAL'
  | 'SHARED_CHARACTER_DRAFT_PUBLISHED'
  | 'GM_PROMPT_PUBLISHED'
  | 'PARTY_ROLE_CLAIM_PUBLISHED'
  | 'SHARED_CHARACTER_DRAFT_REACTION_PUBLISHED';

export interface PregameMetricLogData {
  metricSchema: 'pregame.v1';
  metricKind: 'counter';
  metricName: PregameMetricName;
  metricValue: 1;
  metricUnit: 'Count';
  metricDimensions: Record<string, string>;
  metricContext: Record<string, string | number | boolean | null>;
  metricTrace: {
    requestId: string | null;
    commandId: string | null;
  };
}

export interface PregameMetricEffectsLike {
  writes: ReadonlyArray<{
    kind: string;
    input?: unknown;
  }>;
}

export function buildPregameMetricsFromCommand(input: {
  envelope: AnyCommandEnvelope;
  effects: PregameMetricEffectsLike;
}): PregameMetricLogData[] {
  const metrics: PregameMetricLogData[] = [];
  const baseContext = {
    actorId: input.envelope.actorId,
    gameId: input.envelope.gameId,
    characterId: readCommandCharacterId(input.envelope),
  } satisfies Record<string, string | number | boolean | null>;

  if (input.envelope.type === 'CreateCharacterDraft' && hasCharacterWrite(input.effects)) {
    metrics.push(
      createPregameMetric({
        metricName: 'CHARACTER_DRAFT_CREATED',
        dimensions: {
          commandType: input.envelope.type,
        },
        context: baseContext,
        trace: {
          commandId: input.envelope.commandId,
        },
      })
    );
  }

  if (input.envelope.type === 'SaveCharacterDraft' && hasCharacterWrite(input.effects)) {
    metrics.push(
      createPregameMetric({
        metricName: 'CHARACTER_DRAFT_SAVED',
        dimensions: {
          commandType: input.envelope.type,
        },
        context: baseContext,
        trace: {
          commandId: input.envelope.commandId,
        },
      })
    );
  }

  if (input.envelope.type === 'SubmitCharacterForApproval' && hasCharacterStatusTransition(input.effects, 'PENDING')) {
    metrics.push(
      createPregameMetric({
        metricName: 'CHARACTER_SUBMITTED_FOR_APPROVAL',
        dimensions: {
          commandType: input.envelope.type,
        },
        context: baseContext,
        trace: {
          commandId: input.envelope.commandId,
        },
      })
    );
  }

  if (input.envelope.type !== 'SendGameChatMessage') {
    return metrics;
  }

  const artifact = input.envelope.payload.artifact;
  if (!artifact) {
    return metrics;
  }

  metrics.push(
    ...buildPregameMetricsFromArtifact({
      envelope: input.envelope,
      artifact,
      baseContext,
    })
  );

  return metrics;
}

function buildPregameMetricsFromArtifact(input: {
  envelope: Extract<AnyCommandEnvelope, { type: 'SendGameChatMessage' }>;
  artifact: SharedChatArtifact;
  baseContext: Record<string, string | number | boolean | null>;
}): PregameMetricLogData[] {
  const trace = {
    commandId: input.envelope.commandId,
  };

  if (input.artifact.kind === 'CHARACTER_DRAFT') {
    return [
      createPregameMetric({
        metricName: 'SHARED_CHARACTER_DRAFT_PUBLISHED',
        dimensions: {
          artifactKind: input.artifact.kind,
          shareIntent: input.artifact.shareIntent ?? 'UNSPECIFIED',
        },
        context: {
          ...input.baseContext,
          characterId: input.artifact.characterId,
          snapshotVersion: input.artifact.snapshotVersion,
          promptId: input.artifact.promptId ?? null,
        },
        trace,
      }),
    ];
  }

  if (input.artifact.kind === 'GAME_PROMPT') {
    return [
      createPregameMetric({
        metricName: 'GM_PROMPT_PUBLISHED',
        dimensions: {
          artifactKind: input.artifact.kind,
          suggestedRoleCount: String(input.artifact.suggestedRoles.length),
        },
        context: {
          ...input.baseContext,
          promptId: input.artifact.promptId,
        },
        trace,
      }),
    ];
  }

  if (input.artifact.kind === 'PARTY_ROLE_CLAIM') {
    return [
      createPregameMetric({
        metricName: 'PARTY_ROLE_CLAIM_PUBLISHED',
        dimensions: {
          artifactKind: input.artifact.kind,
          claimedRoleCount: String(input.artifact.roles.length),
        },
        context: {
          ...input.baseContext,
          claimId: input.artifact.claimId,
          characterId: input.artifact.characterId,
          snapshotVersion: input.artifact.snapshotVersion,
        },
        trace,
      }),
    ];
  }

  if (input.artifact.kind === 'CHARACTER_DRAFT_REACTION') {
    return [
      createPregameMetric({
        metricName: 'SHARED_CHARACTER_DRAFT_REACTION_PUBLISHED',
        dimensions: {
          artifactKind: input.artifact.kind,
          reaction: input.artifact.reaction,
        },
        context: {
          ...input.baseContext,
          characterId: input.artifact.characterId,
          snapshotVersion: input.artifact.snapshotVersion,
          targetMessageId: input.artifact.targetMessageId,
        },
        trace,
      }),
    ];
  }

  return [];
}

function createPregameMetric(input: {
  metricName: PregameMetricName;
  dimensions: Record<string, string>;
  context: Record<string, string | number | boolean | null>;
  trace: {
    requestId?: string;
    commandId?: string;
  };
}): PregameMetricLogData {
  return {
    metricSchema: 'pregame.v1',
    metricKind: 'counter',
    metricName: input.metricName,
    metricValue: 1,
    metricUnit: 'Count',
    metricDimensions: input.dimensions,
    metricContext: input.context,
    metricTrace: {
      requestId: input.trace.requestId ?? null,
      commandId: input.trace.commandId ?? null,
    },
  };
}

function hasCharacterWrite(effects: PregameMetricEffectsLike): boolean {
  return effects.writes.some((write) => write.kind === 'PUT_CHARACTER_DRAFT' || write.kind === 'UPDATE_CHARACTER_WITH_VERSION');
}

function hasCharacterStatusTransition(effects: PregameMetricEffectsLike, status: string): boolean {
  return effects.writes.some((write) => {
    if (write.kind === 'PUT_CHARACTER_DRAFT') {
      return readDraftStatus(write.input) === status;
    }
    if (write.kind === 'UPDATE_CHARACTER_WITH_VERSION') {
      return readNextStatus(write.input) === status;
    }
    return false;
  });
}

function readCommandCharacterId(envelope: AnyCommandEnvelope): string | null {
  const payload = envelope.payload as { characterId?: unknown };
  return typeof payload.characterId === 'string' ? payload.characterId : null;
}

function readDraftStatus(input: unknown): string {
  if (!input || typeof input !== 'object') {
    return 'DRAFT';
  }
  const record = input as { status?: unknown };
  return typeof record.status === 'string' ? record.status : 'DRAFT';
}

function readNextStatus(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const next = (input as { next?: unknown }).next;
  if (!next || typeof next !== 'object') {
    return null;
  }
  return typeof (next as { status?: unknown }).status === 'string' ? (next as { status: string }).status : null;
}
