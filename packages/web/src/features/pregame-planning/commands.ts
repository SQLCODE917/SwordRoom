import type { PregameRole, SharedGamePromptArtifact, SharedPartyRoleClaimArtifact } from '@starter/shared';
import type { CommandEnvelopeInput } from '../../api/ApiClient';
import { createCommandId } from '../../hooks/useCommandStatus';
import { formatPregameRoleList } from './labels.js';

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

export function buildSuggestedGamePromptArtifact(input: {
  suggestedRoles: PregameRole[];
}): { body: string; artifact: SharedGamePromptArtifact } {
  const promptId = createCommandId();
  const rolesText = formatPregameRoleList(input.suggestedRoles);
  const prompt =
    input.suggestedRoles.length > 0
      ? `We still need ${rolesText}. Please share a draft or revise your current build if you can cover one of those roles.`
      : 'Share your current draft, compare plans, and post what role you want to bring to the table.';

  return {
    body: 'GM posted a new pregame planning prompt.',
    artifact: {
      kind: 'GAME_PROMPT',
      promptId,
      title: input.suggestedRoles.length > 0 ? `Party needs ${rolesText}` : 'General party planning',
      prompt,
      suggestedRoles: input.suggestedRoles,
    },
  };
}
