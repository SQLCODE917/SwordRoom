import type { CharacterItem, GameChatMessage, GameChatParticipant } from '../../api/ApiClient';
import { formatPregameRoleList } from '../pregame-planning/labels.js';
import type { PregameLobbyState } from './usePregameLobby';

export type PregameLobbyViewModel =
  | {
      status: 'loading';
      title: string;
      subtitle: string;
      noticeTone: 'info';
      notice: string;
      actions: LobbyAction[];
    }
  | {
      status: 'error';
      title: string;
      subtitle: string;
      noticeTone: 'error';
      notice: string;
      actions: LobbyAction[];
    }
  | {
      status: 'ready';
      title: string;
      subtitle: string;
      noticeTone: 'info';
      notice: string;
      actions: LobbyAction[];
      summaryLines: string[];
      promptLines: string[];
      partyNeedsLines: string[];
      rosterRows: LobbyRosterRow[];
      recentActivityRows: LobbyActivityRow[];
    };

export interface LobbyAction {
  label: string;
  to: string;
  disabled?: boolean;
  disabledReason?: string | null;
}

export interface LobbyRosterRow {
  key: string;
  displayName: string;
  roleLabel: string;
  characterLabel: string;
  characterTo: string | null;
}

export interface LobbyActivityRow {
  key: string;
  actorLabel: string;
  body: string;
  createdAtLabel: string;
}

export function createPregameLobbyViewModel(state: PregameLobbyState): PregameLobbyViewModel {
  if (state.status === 'loading') {
    return {
      status: 'loading',
      title: 'Pregame Lobby',
      subtitle: `Game ${state.gameId}`,
      noticeTone: 'info',
      notice: 'Loading pregame planning context...',
      actions: [
        { label: 'Home', to: '/' },
      ],
    };
  }

  if (state.status === 'error') {
    return {
      status: 'error',
      title: 'Pregame Lobby',
      subtitle: `Game ${state.gameId}`,
      noticeTone: 'error',
      notice: state.message,
      actions: [
        { label: 'Home', to: '/' },
      ],
    };
  }

  const ownCharacter = state.myCharacters.find((item) => item.gameId === state.game.gameId) ?? null;
  const ownParticipant = state.chat.participants.find((participant) => participant.playerId === state.actorContext.actorId) ?? null;
  const canEditOwnCharacter = ownCharacter ? ownCharacter.status !== 'PENDING' && ownCharacter.status !== 'APPROVED' : false;

  const summaryLines = [
    ownCharacter
      ? `Your current character is ${readCharacterName(ownCharacter)} (${ownCharacter.status}).`
      : 'You do not have a character in this game yet.',
    state.actorContext.isGameMaster
      ? 'You are coordinating the pregame planning loop for this table.'
      : 'Use this lobby to move between your draft, the party conversation, and your sheet.',
    state.chat.messages.length > 0
      ? `Recent chat is active with ${state.chat.messages.length} message${state.chat.messages.length === 1 ? '' : 's'}.`
      : 'No pregame chat messages have been posted yet.',
  ];

  const partyNeedsLines = buildPartyNeedsLines(state, ownCharacter);
  const promptLines = buildPromptLines(state);

  return {
    status: 'ready',
    title: 'Pregame Lobby',
    subtitle: `${state.game.name} (${state.game.gameId})`,
    noticeTone: 'info',
    notice: ownParticipant
      ? `Signed in as ${ownParticipant.displayName}. No session date is scheduled yet, so this lobby is optimized for short async planning check-ins.`
      : 'No session date is scheduled yet, so this lobby is optimized for short async planning check-ins.',
    actions: buildActions({
      gameId: state.game.gameId,
      ownCharacter,
      canEditOwnCharacter,
      isGameMaster: state.actorContext.isGameMaster,
    }),
    summaryLines,
    promptLines,
    partyNeedsLines,
    rosterRows: state.chat.participants.map((participant) => buildRosterRow(state.game.gameId, participant, ownCharacter)),
    recentActivityRows: state.chat.messages.slice(-3).reverse().map(buildActivityRow),
  };
}

function buildActions(input: {
  gameId: string;
  ownCharacter: CharacterItem | null;
  canEditOwnCharacter: boolean;
  isGameMaster: boolean;
}): LobbyAction[] {
  const actions: LobbyAction[] = [];

  if (input.ownCharacter) {
    if (input.canEditOwnCharacter) {
      actions.push({
        label: 'Continue Character',
        to: `/games/${encodeURIComponent(input.gameId)}/characters/${encodeURIComponent(input.ownCharacter.characterId)}/edit`,
      });
    }
    actions.push({
      label: 'Character Sheet',
      to: `/games/${encodeURIComponent(input.gameId)}/characters/${encodeURIComponent(input.ownCharacter.characterId)}`,
    });
  } else {
    actions.push({
      label: 'New Character',
      to: `/games/${encodeURIComponent(input.gameId)}/character/new`,
    });
  }

  actions.push({ label: 'Chat', to: `/games/${encodeURIComponent(input.gameId)}/chat` });
  actions.push({ label: 'Player Inbox', to: '/me/inbox' });

  if (input.isGameMaster) {
    actions.push({ label: 'GM Inbox', to: `/gm/${encodeURIComponent(input.gameId)}/inbox` });
  }

  return actions;
}

function buildPromptLines(state: Extract<PregameLobbyState, { status: 'ready' }>): string[] {
  const lines: string[] = [];

  if (state.planning.activePrompt) {
    lines.push(`${state.planning.activePrompt.senderDisplayName}: ${state.planning.activePrompt.title}`);
    lines.push(state.planning.activePrompt.prompt);
    if (state.planning.activePrompt.suggestedRoles.length > 0) {
      lines.push(`Suggested roles: ${formatPregameRoleList(state.planning.activePrompt.suggestedRoles)}.`);
    }
  } else if (state.actorContext.isGameMaster) {
    lines.push('No GM planning prompt is active yet.');
    lines.push('Use Chat or the GM tools to set party direction before the session begins.');
  } else {
    lines.push('No GM planning prompt is active yet.');
    lines.push('Share your current draft or review party needs to help the table converge.');
  }

  return lines;
}

function buildPartyNeedsLines(
  state: Extract<PregameLobbyState, { status: 'ready' }>,
  ownCharacter: CharacterItem | null
): string[] {
  const lines: string[] = [];
  const playerCount = state.chat.participants.filter((participant) => participant.role === 'PLAYER').length;
  const playersWithoutCharacterCount = state.chat.participants.filter(
    (participant) => participant.role === 'PLAYER' && participant.characterId === null
  ).length;

  if (playerCount === 0) {
    lines.push('No players have joined this game yet.');
  } else if (playersWithoutCharacterCount === 0) {
    lines.push('Every listed player currently has a character attached.');
  } else if (playersWithoutCharacterCount === 1) {
    lines.push('One player still needs a character before the party is fully represented.');
  } else {
    lines.push(`${playersWithoutCharacterCount} players still need characters before the party is fully represented.`);
  }

  for (const need of state.planning.partyNeeds) {
    lines.push(
      need.isOpen
        ? `${need.label}: open`
        : `${need.label}: claimed by ${need.claimedBy.join(', ')}`
    );
  }

  if (!ownCharacter) {
    lines.push('Your next useful move is to create a character draft or review the party conversation first.');
  } else if (ownCharacter.status === 'PENDING') {
    lines.push('Your character is pending GM review. Use chat to coordinate with the table while you wait.');
  } else if (ownCharacter.status === 'APPROVED') {
    lines.push('Your character is approved. Use chat to align on party composition and opening plans.');
  } else {
    lines.push('Your character is still editable. Share updates in chat as you iterate on the draft.');
  }

  return lines;
}

function buildRosterRow(gameId: string, participant: GameChatParticipant, ownCharacter: CharacterItem | null): LobbyRosterRow {
  const ownCharacterName =
    ownCharacter && ownCharacter.characterId === participant.characterId ? readCharacterName(ownCharacter) : null;
  const characterLabel =
    participant.characterId === null ? 'No character yet' : ownCharacterName ?? participant.characterId;

  return {
    key: participant.playerId,
    displayName: participant.displayName,
    roleLabel: participant.role === 'GM' ? 'GM' : 'Player',
    characterLabel,
    characterTo:
      participant.characterId === null
        ? null
        : `/games/${encodeURIComponent(gameId)}/characters/${encodeURIComponent(participant.characterId)}`,
  };
}

function buildActivityRow(message: GameChatMessage): LobbyActivityRow {
  return {
    key: message.messageId,
    actorLabel: message.senderDisplayName,
    body: message.body,
    createdAtLabel: formatTimestamp(message.createdAt),
  };
}

function readCharacterName(character: CharacterItem): string {
  const draft = typeof character.draft === 'object' && character.draft !== null ? (character.draft as Record<string, unknown>) : null;
  const identity = draft && typeof draft.identity === 'object' && draft.identity !== null ? (draft.identity as Record<string, unknown>) : null;
  const name = typeof identity?.name === 'string' ? identity.name.trim() : '';
  return name || character.characterId;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
