import type { PlayerInboxItem, PregameDigestEntry } from '../../api/ApiClient';
import { appendCharacterWizardEntryContext } from '../character-wizard';

export interface InboxRow {
  key: string;
  kind: string;
  message: string;
  createdAt: string;
  gameId: string;
  characterId: string | null;
  inviteId: string | null;
}

export interface PlayerInboxViewModel {
  resume: PregameResumeViewModel;
  digestItems: PregameDigestItemViewModel[];
  digestEmptyText: string;
  inboxItems: InboxFeedItemViewModel[];
  inboxEmptyText: string;
}

export interface PregameResumeViewModel {
  headline: string;
  detail: string;
  primaryAction: LinkActionViewModel;
  secondaryActions: ResumeSecondaryActionViewModel[];
}

export interface ResumeSecondaryActionViewModel extends LinkActionViewModel {
  meta: string;
}

export interface PregameDigestItemViewModel {
  key: string;
  gameName: string;
  headline: string;
  detail: string;
  timeLabel: string;
  action: LinkActionViewModel;
}

export interface InboxFeedItemViewModel {
  key: string;
  kindLabel: string;
  message: string;
  timeLabel: string;
  actions: InboxActionViewModel[];
}

export type InboxActionViewModel =
  | LinkActionViewModel
  | {
      kind: 'invite-command';
      key: string;
      label: string;
      commandType: 'AcceptGameInvite' | 'RejectGameInvite';
      gameId: string;
      inviteId: string;
      disabled: boolean;
    };

export interface LinkActionViewModel {
  kind: 'link';
  key: string;
  label: string;
  to: string;
}

interface InboxRef {
  characterId?: unknown;
  inviteId?: unknown;
}

interface InboxItemLike extends Record<string, unknown> {
  kind?: unknown;
  message?: unknown;
  createdAt?: unknown;
  gameId?: unknown;
  promptId?: unknown;
  ref?: InboxRef;
}

export function createPlayerInboxViewModel(input: {
  rows: InboxRow[];
  pregameDigest: PregameDigestEntry[];
  loading: boolean;
  error: string | null;
  activeInviteId: string | null;
}): PlayerInboxViewModel {
  return {
    resume: createPregameResumeViewModel(input.pregameDigest),
    digestItems: input.pregameDigest.slice(1).map(createPregameDigestItem),
    digestEmptyText: input.loading
      ? 'Loading pregame digest...'
      : input.pregameDigest.length > 0
        ? 'No additional pregame re-entry items.'
        : 'No active pregame re-entry items.',
    inboxItems: input.rows.map((row) =>
      createInboxFeedItem({ row, activeInviteId: input.activeInviteId }),
    ),
    inboxEmptyText: input.error
      ? `Error loading inbox: ${input.error}`
      : input.loading
        ? 'Loading inbox...'
        : 'No inbox items yet.',
  };
}

export function normalizeRows(items: PlayerInboxItem[]): InboxRow[] {
  const rows: InboxRow[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as InboxItemLike;
    const kind = typeof candidate.kind === 'string' ? candidate.kind : '';
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : '';
    const gameId = typeof candidate.gameId === 'string' ? candidate.gameId : '';
    const ref = typeof candidate.ref === 'object' && candidate.ref !== null
      ? candidate.ref
      : null;
    const characterId = ref && typeof ref.characterId === 'string'
      ? ref.characterId
      : null;
    const inviteId = ref && typeof ref.inviteId === 'string'
      ? ref.inviteId
      : null;
    const promptId = typeof candidate.promptId === 'string'
      ? candidate.promptId
      : `${kind}:${createdAt}:${message}`;

    if (!kind || !message || !createdAt || !gameId) {
      continue;
    }

    rows.push({
      key: promptId,
      kind,
      message,
      createdAt,
      gameId,
      characterId,
      inviteId,
    });
  }

  return rows;
}

function createPregameResumeViewModel(
  entries: readonly PregameDigestEntry[],
): PregameResumeViewModel {
  const primary = entries[0] ?? null;
  if (!primary) {
    return {
      headline: 'No active pregame re-entry items',
      detail: 'When a game needs your attention, the next planning move will appear here.',
      primaryAction: {
        kind: 'link',
        key: 'resume:home',
        label: 'Open Home',
        to: '/',
      },
      secondaryActions: [],
    };
  }

  return {
    headline: primary.gameName,
    detail: primary.headline,
    primaryAction: {
      ...createPregameDigestAction(primary),
      key: `${primary.digestId}:primary`,
    },
    secondaryActions: entries.slice(1, 3).map((entry) => ({
      ...createPregameDigestAction(entry),
      key: `${entry.digestId}:secondary`,
      meta: `${formatInboxTime(entry.createdAt)} ${entry.gameName} - ${entry.headline}`,
    })),
  };
}

function createPregameDigestItem(
  entry: PregameDigestEntry,
): PregameDigestItemViewModel {
  return {
    key: entry.digestId,
    gameName: entry.gameName,
    headline: entry.headline,
    detail: entry.detail,
    timeLabel: formatInboxTime(entry.createdAt),
    action: createPregameDigestAction(entry),
  };
}

function createPregameDigestAction(entry: PregameDigestEntry): LinkActionViewModel {
  return {
    kind: 'link',
    key: `${entry.digestId}:action`,
    label: readPregameDigestActionLabel(entry),
    to: toPregameDigestPath(entry),
  };
}

function createInboxFeedItem(input: {
  row: InboxRow;
  activeInviteId: string | null;
}): InboxFeedItemViewModel {
  const actions: InboxActionViewModel[] = [];

  if (input.row.characterId) {
    actions.push({
      kind: 'link',
      key: `${input.row.key}:open-character`,
      label: 'Open Character',
      to: `/games/${encodeURIComponent(input.row.gameId)}/characters/${encodeURIComponent(input.row.characterId)}`,
    });
  }

  if (input.row.kind === 'GAME_INVITE' && input.row.inviteId) {
    const disabled = input.activeInviteId === input.row.inviteId;
    actions.push({
      kind: 'invite-command',
      key: `${input.row.key}:accept`,
      label: 'Accept',
      commandType: 'AcceptGameInvite',
      gameId: input.row.gameId,
      inviteId: input.row.inviteId,
      disabled,
    });
    actions.push({
      kind: 'invite-command',
      key: `${input.row.key}:reject`,
      label: 'Reject',
      commandType: 'RejectGameInvite',
      gameId: input.row.gameId,
      inviteId: input.row.inviteId,
      disabled,
    });
  }

  return {
    key: input.row.key,
    kindLabel: formatKindLabel(input.row.kind),
    message: input.row.message,
    timeLabel: formatInboxTime(input.row.createdAt),
    actions,
  };
}

function toPregameDigestPath(entry: PregameDigestEntry): string {
  if (entry.destination === 'CHAT') {
    return `/games/${encodeURIComponent(entry.gameId)}/chat`;
  }
  if (entry.destination === 'CREATE_CHARACTER') {
    return appendCharacterWizardEntryContext(
      `/games/${encodeURIComponent(entry.gameId)}/character/new`,
      {
        entrySource: 'digest',
        focus: 'resume',
      },
    );
  }
  if (entry.destination === 'EDIT_CHARACTER' && entry.characterId) {
    return appendCharacterWizardEntryContext(
      `/games/${encodeURIComponent(entry.gameId)}/characters/${encodeURIComponent(entry.characterId)}/edit`,
      { entrySource: 'digest', focus: 'resume' },
    );
  }
  return `/games/${encodeURIComponent(entry.gameId)}`;
}

function readPregameDigestActionLabel(entry: PregameDigestEntry): string {
  if (entry.destination === 'CHAT') {
    return 'Open Chat';
  }
  if (entry.destination === 'CREATE_CHARACTER') {
    return '+ Create Character';
  }
  if (entry.destination === 'EDIT_CHARACTER') {
    return 'Edit Draft';
  }
  return 'Open Lobby';
}

function formatKindLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function formatInboxTime(value: string): string {
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
