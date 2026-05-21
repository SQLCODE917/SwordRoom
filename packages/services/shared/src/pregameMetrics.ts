import type {
  AnyCommandEnvelope,
  PregameObservationContext,
  PregameObservationSessionSummary,
  SharedChatArtifact,
} from '@starter/shared';

export type PregameMetricName =
  | 'CREATOR_SESSION_STARTED'
  | 'CREATOR_SESSION_COMPLETED'
  | 'CREATOR_ACTIVE_MILLISECONDS_RECORDED'
  | 'CHARACTER_DRAFT_CREATED'
  | 'CHARACTER_DRAFT_SAVED'
  | 'CHARACTER_SUBMITTED_FOR_APPROVAL'
  | 'SHARED_CHARACTER_DRAFT_PUBLISHED'
  | 'SHARED_CHARACTER_DRAFT_REPLY_PUBLISHED'
  | 'GM_PROMPT_PUBLISHED'
  | 'GM_PROMPT_RESPONSE_PUBLISHED'
  | 'PARTY_ROLE_CLAIM_PUBLISHED'
  | 'SHARED_CHARACTER_DRAFT_REACTION_PUBLISHED';

export interface PregameMetricLogData {
  metricSchema: 'pregame.v1';
  metricKind: 'counter' | 'duration';
  metricName: PregameMetricName;
  metricValue: number;
  metricUnit: 'Count' | 'Milliseconds';
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
  const replyTarget = input.envelope.payload.replyTarget;

  if (artifact) {
    metrics.push(
      ...buildPregameMetricsFromArtifact({
        envelope: input.envelope,
        artifact,
        baseContext,
      })
    );
  }

  if (replyTarget) {
    metrics.push(
      ...buildPregameMetricsFromReplyTarget({
        envelope: input.envelope,
        replyTarget,
        artifact: artifact ?? null,
        baseContext,
      })
    );
  } else if (artifact?.kind === 'CHARACTER_DRAFT' && artifact.shareIntent === 'ANSWER_GM_PROMPT' && artifact.promptId) {
    metrics.push(
      createPregameMetric({
        metricName: 'GM_PROMPT_RESPONSE_PUBLISHED',
        dimensions: {
          responseKind: 'DRAFT_ANSWER',
        },
        context: {
          ...baseContext,
          characterId: artifact.characterId,
          snapshotVersion: artifact.snapshotVersion,
          promptId: artifact.promptId,
        },
        trace: {
          commandId: input.envelope.commandId,
        },
      })
    );
  }

  return metrics;
}

export function buildPregameMetricsFromObservation(input: {
  observation: PregameObservationContext;
  actorId: string;
  requestId: string;
  path: string;
}): PregameMetricLogData[] {
  if (input.observation.surface !== 'creator' || !input.observation.sessionStart) {
    return [];
  }

  return [
    createPregameMetric({
      metricName: 'CREATOR_SESSION_STARTED',
      dimensions: {
        surface: input.observation.surface,
        entrySource: input.observation.entrySource,
        entryFocus: input.observation.entryFocus,
        wizardMode: input.observation.wizardMode,
        draftMode: input.observation.draftMode,
      },
      context: {
        actorId: input.actorId,
        gameId: input.observation.gameId,
        characterId: input.observation.characterId,
        creatorSessionId: input.observation.sessionId,
        creatorSessionStartedAt: input.observation.sessionStartedAt,
        path: input.path,
      },
      trace: {
        requestId: input.requestId,
      },
    }),
  ];
}

export function buildPregameMetricsFromObservationSessionSummary(input: {
  summary: PregameObservationSessionSummary;
  actorId: string;
  requestId: string;
}): PregameMetricLogData[] {
  return [
    createPregameMetric({
      metricName: 'CREATOR_SESSION_COMPLETED',
      metricKind: 'counter',
      metricValue: 1,
      metricUnit: 'Count',
      dimensions: {
        surface: input.summary.surface,
        entrySource: input.summary.entrySource,
        entryFocus: input.summary.entryFocus,
        wizardMode: input.summary.wizardMode,
        draftMode: input.summary.draftMode,
        completionReason: input.summary.completionReason,
      },
      context: {
        actorId: input.actorId,
        gameId: input.summary.gameId,
        characterId: input.summary.characterId,
        creatorSessionId: input.summary.sessionId,
        creatorSessionStartedAt: input.summary.sessionStartedAt,
        creatorSessionCompletedAt: input.summary.completedAt,
        activeDurationMs: input.summary.activeDurationMs,
        elapsedDurationMs: input.summary.elapsedDurationMs,
      },
      trace: {
        requestId: input.requestId,
      },
    }),
    createPregameMetric({
      metricName: 'CREATOR_ACTIVE_MILLISECONDS_RECORDED',
      metricKind: 'duration',
      metricValue: input.summary.activeDurationMs,
      metricUnit: 'Milliseconds',
      dimensions: {
        surface: input.summary.surface,
        entrySource: input.summary.entrySource,
        entryFocus: input.summary.entryFocus,
        wizardMode: input.summary.wizardMode,
        draftMode: input.summary.draftMode,
      },
      context: {
        actorId: input.actorId,
        gameId: input.summary.gameId,
        characterId: input.summary.characterId,
        creatorSessionId: input.summary.sessionId,
        creatorSessionStartedAt: input.summary.sessionStartedAt,
        creatorSessionCompletedAt: input.summary.completedAt,
        elapsedDurationMs: input.summary.elapsedDurationMs,
        completionReason: input.summary.completionReason,
      },
      trace: {
        requestId: input.requestId,
      },
    }),
  ];
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

function buildPregameMetricsFromReplyTarget(input: {
  envelope: Extract<AnyCommandEnvelope, { type: 'SendGameChatMessage' }>;
  replyTarget: NonNullable<Extract<AnyCommandEnvelope, { type: 'SendGameChatMessage' }>['payload']['replyTarget']>;
  artifact: SharedChatArtifact | null;
  baseContext: Record<string, string | number | boolean | null>;
}): PregameMetricLogData[] {
  const trace = {
    commandId: input.envelope.commandId,
  };

  if (input.replyTarget.kind === 'CHARACTER_DRAFT') {
    return [
      createPregameMetric({
        metricName: 'SHARED_CHARACTER_DRAFT_REPLY_PUBLISHED',
        dimensions: {
          responseKind: input.artifact?.kind === 'CHARACTER_DRAFT' ? 'SHARED_ARTIFACT' : 'CHAT_REPLY',
        },
        context: {
          ...input.baseContext,
          targetMessageId: input.replyTarget.targetMessageId,
          characterId: input.replyTarget.characterId,
          snapshotVersion: input.replyTarget.snapshotVersion,
        },
        trace,
      }),
    ];
  }

  return [
    createPregameMetric({
      metricName: 'GM_PROMPT_RESPONSE_PUBLISHED',
      dimensions: {
        responseKind: input.artifact?.kind === 'CHARACTER_DRAFT' ? 'DRAFT_ANSWER' : 'CHAT_REPLY',
      },
      context: {
        ...input.baseContext,
        targetMessageId: input.replyTarget.targetMessageId,
        promptId: input.replyTarget.promptId,
      },
      trace,
    }),
  ];
}

function createPregameMetric(input: {
  metricName: PregameMetricName;
  metricKind?: 'counter' | 'duration';
  metricValue?: number;
  metricUnit?: 'Count' | 'Milliseconds';
  dimensions: Record<string, string>;
  context: Record<string, string | number | boolean | null>;
  trace: {
    requestId?: string;
    commandId?: string;
  };
}): PregameMetricLogData {
  return {
    metricSchema: 'pregame.v1',
    metricKind: input.metricKind ?? 'counter',
    metricName: input.metricName,
    metricValue: input.metricValue ?? 1,
    metricUnit: input.metricUnit ?? 'Count',
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
