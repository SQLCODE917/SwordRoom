import type { CharacterItem, GameChatMessage } from '../../api/ApiClient';
import { appendCharacterWizardEntryContext } from '../character-wizard';
import type { PregameCharactersState } from './usePregameCharacters';
import {
  buildCharacterDraftReactionSummaryLabel,
  countCharacterDraftReactions,
} from '../pregame-planning/reactions';

export type PregameCharactersViewModel =
  | {
      status: 'loading';
      title: string;
      subtitle: string;
      noticeTone: 'info';
      notice: string;
      workflow: PregameCharactersWorkflow;
    }
  | {
      status: 'error';
      title: string;
      subtitle: string;
      noticeTone: 'error';
      notice: string;
      workflow: PregameCharactersWorkflow;
    }
  | {
      status: 'ready';
      title: string;
      subtitle: string;
      noticeTone: 'info';
      notice: string;
      workflow: PregameCharactersWorkflow;
      summaryLines: string[];
      mineRows: CharacterWorkbenchMineRow[];
      sharedRows: CharacterWorkbenchSharedRow[];
      approvedRows: CharacterWorkbenchApprovedRow[];
    };

export interface PregameCharactersWorkflow {
  createTo: string;
  charactersTo: string;
}

export interface CharacterWorkbenchMineRow {
  key: string;
  characterName: string;
  status: string;
  shareLabel: string;
  sheetTo: string;
  editTo: string | null;
}

export interface CharacterWorkbenchSharedRow {
  key: string;
  characterName: string;
  sharedBy: string;
  sharedAtLabel: string;
  snapshotLabel: string;
  shareIntentLabel: string;
  contextNote: string | null;
  abilitySummaryLabel: string;
  skillSummaryLabel: string;
  discussionLabel: string;
  reactionSummaryLabel: string;
  sheetTo: string;
  chatTo: string;
}

export interface CharacterWorkbenchApprovedRow {
  key: string;
  characterName: string;
  ownerLabel: string;
  status: string;
  sheetTo: string;
}

export function createPregameCharactersViewModel(state: PregameCharactersState): PregameCharactersViewModel {
  const defaultWorkflow: PregameCharactersWorkflow = {
    createTo: appendCharacterWizardEntryContext(`/games/${encodeURIComponent(state.gameId)}/character/new`, {
      entrySource: 'characters',
      focus: 'review',
    }),
    charactersTo: `/games/${encodeURIComponent(state.gameId)}/characters`,
  };

  if (state.status === 'loading') {
    return {
      status: 'loading',
      title: 'Characters Workbench',
      subtitle: `Game ${state.gameId}`,
      noticeTone: 'info',
      notice: 'Loading game-scoped character workbench...',
      workflow: defaultWorkflow,
    };
  }

  if (state.status === 'error') {
    return {
      status: 'error',
      title: 'Characters Workbench',
      subtitle: `Game ${state.gameId}`,
      noticeTone: 'error',
      notice: state.message,
      workflow: defaultWorkflow,
    };
  }

  const latestShareByCharacterId = new Map<string, GameChatMessage>();
  for (const message of state.sharedMessages) {
    const artifact = message.artifact;
    if (!artifact || artifact.kind !== 'CHARACTER_DRAFT') {
      continue;
    }
    const current = latestShareByCharacterId.get(artifact.characterId);
    if (!current || current.createdAt < message.createdAt) {
      latestShareByCharacterId.set(artifact.characterId, message);
    }
  }

  const summaryLines = [
    state.myCharacters.length > 0
      ? `You have ${state.myCharacters.length} game-scoped character ${state.myCharacters.length === 1 ? 'draft' : 'drafts'} here.`
      : 'You do not have a game-scoped character in this table yet.',
    state.sharedMessages.length > 0
      ? `${state.sharedMessages.length} shared character update${state.sharedMessages.length === 1 ? '' : 's'} are available for review.`
      : 'No character updates have been shared into chat yet.',
    state.gameCharacters.filter((character) => character.status === 'APPROVED').length > 0
      ? `${state.gameCharacters.filter((character) => character.status === 'APPROVED').length} character${state.gameCharacters.filter((character) => character.status === 'APPROVED').length === 1 ? ' is' : 's are'} already approved for play.`
      : 'No characters are approved for play yet.',
  ];

  return {
    status: 'ready',
    title: 'Characters Workbench',
    subtitle: `${state.game.name} (${state.game.gameId})`,
    noticeTone: 'info',
    notice: 'Use this workbench to review your own draft, inspect shared concepts, and check which characters are already ready for play.',
    workflow: {
      createTo:
        state.myCharacters.length > 0 && canEditCharacter(state.myCharacters[0]!)
          ? appendCharacterWizardEntryContext(
              `/games/${encodeURIComponent(state.game.gameId)}/characters/${encodeURIComponent(state.myCharacters[0]!.characterId)}/edit`,
              { entrySource: 'characters', focus: 'review' }
            )
          : appendCharacterWizardEntryContext(`/games/${encodeURIComponent(state.game.gameId)}/character/new`, {
              entrySource: 'characters',
              focus: 'review',
            }),
      charactersTo: `/games/${encodeURIComponent(state.game.gameId)}/characters`,
    },
    summaryLines,
    mineRows: state.myCharacters.map((character) => buildMineRow(character, latestShareByCharacterId.get(character.characterId) ?? null)),
    sharedRows: Array.from(latestShareByCharacterId.values())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((message) => buildSharedRow(state.game.gameId, state.chatMessages, message)),
    approvedRows: state.gameCharacters
      .filter((character) => character.status === 'APPROVED')
      .map((character) => ({
        key: character.characterId,
        characterName: readCharacterName(character),
        ownerLabel: readOwnerLabel(character),
        status: character.status,
        sheetTo: `/games/${encodeURIComponent(state.game.gameId)}/characters/${encodeURIComponent(character.characterId)}`,
      })),
  };
}

function buildMineRow(character: CharacterItem, latestShare: GameChatMessage | null): CharacterWorkbenchMineRow {
  return {
    key: character.characterId,
    characterName: readCharacterName(character),
    status: character.status,
    shareLabel: latestShare ? `Shared ${formatShortTimestamp(latestShare.createdAt)}` : 'Not shared yet',
    sheetTo: `/games/${encodeURIComponent(character.gameId)}/characters/${encodeURIComponent(character.characterId)}`,
    editTo: canEditCharacter(character)
      ? appendCharacterWizardEntryContext(
          `/games/${encodeURIComponent(character.gameId)}/characters/${encodeURIComponent(character.characterId)}/edit`,
          { entrySource: 'characters', focus: 'review' }
        )
      : null,
  };
}

function buildSharedRow(gameId: string, allChatMessages: readonly GameChatMessage[], message: GameChatMessage): CharacterWorkbenchSharedRow {
  const artifact = message.artifact;
  if (!artifact || artifact.kind !== 'CHARACTER_DRAFT') {
    throw new Error('Shared row requires a character draft artifact.');
  }

  const replyCount = allChatMessages.filter((entry) => {
    if (entry.createdAt <= message.createdAt || entry.senderPlayerId === message.senderPlayerId) {
      return false;
    }
    return entry.artifact?.kind !== 'CHARACTER_DRAFT_REACTION';
  }).length;
  const reactionCount = countCharacterDraftReactions(allChatMessages, message.messageId);
  const discussionLabel =
    replyCount > 0 || reactionCount > 0
      ? [
          replyCount > 0 ? `${replyCount} follow-up ${replyCount === 1 ? 'message' : 'messages'}` : null,
          reactionCount > 0 ? `${reactionCount} reaction${reactionCount === 1 ? '' : 's'}` : null,
        ]
          .filter((entry): entry is string => entry !== null)
          .join(' · ')
      : 'No follow-up yet';

  return {
    key: message.messageId,
    characterName: artifact.characterName,
    sharedBy: message.senderDisplayName,
    sharedAtLabel: formatShortTimestamp(message.createdAt),
    snapshotLabel: `Snapshot v${artifact.snapshotVersion} · ${artifact.status}`,
    shareIntentLabel: formatCharacterDraftIntent(artifact),
    contextNote: artifact.contextNote ?? null,
    abilitySummaryLabel: artifact.abilitySummary.join(' | ') || 'No ability summary.',
    skillSummaryLabel: artifact.skillSummary.length > 0 ? `Skills: ${artifact.skillSummary.join(', ')}` : 'Skills: none yet',
    discussionLabel,
    reactionSummaryLabel: buildCharacterDraftReactionSummaryLabel(allChatMessages, message.messageId),
    sheetTo: `/games/${encodeURIComponent(gameId)}/characters/${encodeURIComponent(artifact.characterId)}`,
    chatTo: buildSharedArtifactChatTo(gameId, artifact.characterName, artifact.snapshotVersion),
  };
}

function buildSharedArtifactChatTo(gameId: string, characterName: string, snapshotVersion: number): string {
  const searchParams = new URLSearchParams();
  searchParams.set('draft', `About ${characterName} v${snapshotVersion}: `);
  return `/games/${encodeURIComponent(gameId)}/chat?${searchParams.toString()}`;
}

function formatCharacterDraftIntent(artifact: Extract<NonNullable<GameChatMessage['artifact']>, { kind: 'CHARACTER_DRAFT' }>): string {
  if (artifact.shareIntent === 'ASK_QUESTION') {
    return 'Ask a question';
  }
  if (artifact.shareIntent === 'COMPARE_DIRECTIONS') {
    return 'Compare directions';
  }
  if (artifact.shareIntent === 'ANSWER_GM_PROMPT') {
    return 'Answer GM prompt';
  }
  return 'Draft snapshot';
}

function readCharacterName(character: CharacterItem): string {
  const draft = typeof character.draft === 'object' && character.draft !== null ? (character.draft as Record<string, unknown>) : null;
  const identity = draft && typeof draft.identity === 'object' && draft.identity !== null ? (draft.identity as Record<string, unknown>) : null;
  const name = typeof identity?.name === 'string' ? identity.name.trim() : '';
  return name || character.characterId;
}

function readOwnerLabel(character: CharacterItem): string {
  return typeof character.ownerPlayerId === 'string' && character.ownerPlayerId.trim() !== '' ? character.ownerPlayerId : 'Unknown player';
}

function canEditCharacter(character: CharacterItem): boolean {
  return character.status !== 'PENDING' && character.status !== 'APPROVED';
}

function formatShortTimestamp(value: string): string {
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
