import type { GMInboxItem } from '../../api/ApiClient';

export interface PendingCharacterReviewViewModel {
  key: string;
  characterId: string;
  ownerPlayerId: string;
  submittedAt: string;
  sheetHref: string;
}

export interface InviteActivityViewModel {
  key: string;
  kind: string;
  message: string;
  createdAt: string;
}

export interface GMInboxViewModel {
  pendingReviews: PendingCharacterReviewViewModel[];
  inviteActivity: InviteActivityViewModel[];
  pendingEmptyText: string;
  activityEmptyText: string;
}

export function createGMInboxViewModel(input: {
  gameId: string;
  items: GMInboxItem[];
  loading: boolean;
  error: string | null;
}): GMInboxViewModel {
  const pendingReviews: PendingCharacterReviewViewModel[] = [];
  const inviteActivity: InviteActivityViewModel[] = [];

  for (const item of input.items) {
    const ref = typeof item.ref === 'object' && item.ref !== null ? item.ref : {};
    const key = item.promptId || `${item.kind}:${item.createdAt ?? pendingReviews.length + inviteActivity.length}`;

    if (item.kind === 'PENDING_CHARACTER' && typeof ref.characterId === 'string') {
      pendingReviews.push({
        key,
        characterId: ref.characterId,
        ownerPlayerId: item.ownerPlayerId ?? (typeof ref.playerId === 'string' ? ref.playerId : 'unknown'),
        submittedAt: formatInboxTime(item.submittedAt ?? item.createdAt),
        sheetHref: `/games/${encodeURIComponent(input.gameId)}/characters/${encodeURIComponent(ref.characterId)}`,
      });
      continue;
    }

    inviteActivity.push({
      key,
      kind: formatKind(item.kind),
      message: typeof item.message === 'string' && item.message.trim().length > 0 ? item.message : 'No message.',
      createdAt: formatInboxTime(item.createdAt),
    });
  }

  return {
    pendingReviews,
    inviteActivity,
    pendingEmptyText: input.error
      ? `Unable to load GM inbox: ${input.error}`
      : input.loading
        ? 'Loading pending characters...'
        : 'No pending characters.',
    activityEmptyText: input.error
      ? 'Invite activity unavailable while inbox is in error state.'
      : input.loading
        ? 'Loading invite activity...'
        : 'No invite activity yet.',
  };
}

function formatKind(kind: string): string {
  return kind
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function formatInboxTime(value: string | null | undefined): string {
  if (!value) {
    return 'No time';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
