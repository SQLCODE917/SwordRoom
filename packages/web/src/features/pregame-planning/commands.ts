import type { SharedGamePromptArtifact, SharedPartyRoleClaimArtifact } from '@starter/shared';
import type { CommandEnvelopeInput } from '../../api/ApiClient';
import { createCommandId } from '../../hooks/useCommandStatus';

export const DEFAULT_GM_PREGAME_PROMPT_TEXT =
  'Share your current draft, compare plans, and post what role you want to bring to the table.';

export function buildSharePartyRoleClaimEnvelope(input: {
  gameId: string;
  body: string;
  artifact: SharedPartyRoleClaimArtifact;
}): CommandEnvelopeInput<'SendGameChatMessage'> {
  return {
    commandId: createCommandId(),
    gameId: input.gameId,
    type: 'SendGameChatMessage',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    payload: {
      body: input.body,
      artifact: input.artifact,
    },
  };
}

export function buildPostGamePromptEnvelope(input: {
  gameId: string;
  body: string;
  artifact: SharedGamePromptArtifact;
}): CommandEnvelopeInput<'SendGameChatMessage'> {
  return {
    commandId: createCommandId(),
    gameId: input.gameId,
    type: 'SendGameChatMessage',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    payload: {
      body: input.body,
      artifact: input.artifact,
    },
  };
}

export function buildGamePromptArtifact(input: { prompt: string }): { body: string; artifact: SharedGamePromptArtifact } {
  const promptId = createCommandId();
  const prompt = normalizePromptText(input.prompt);
  const title = buildPromptTitle(prompt);

  return {
    body: 'GM posted a new pregame planning prompt.',
    artifact: {
      kind: 'GAME_PROMPT',
      promptId,
      title,
      prompt,
      suggestedRoles: [],
    },
  };
}

function normalizePromptText(prompt: string): string {
  const trimmed = prompt.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_GM_PREGAME_PROMPT_TEXT;
}

function buildPromptTitle(prompt: string): string {
  const firstLine = prompt
    .split(/\r?\n/u)
    .find((line) => line.trim().length > 0)
    ?.trim();
  const normalized = firstLine && firstLine.length > 0 ? firstLine : 'General party planning';
  if (normalized.length <= 80) {
    return normalized;
  }
  return `${normalized.slice(0, 77).trimEnd()}...`;
}
