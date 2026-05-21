import type { SharedCharacterDraftReaction } from '@starter/shared';
import type { GameChatMessage } from '../../api/ApiClient';

export const CHARACTER_DRAFT_REACTION_OPTIONS: Array<{ value: SharedCharacterDraftReaction; label: string }> = [
  { value: 'PARTY_FIT', label: 'Party fit' },
  { value: 'CURIOUS', label: 'Curious' },
  { value: 'NEEDS_GM_INPUT', label: 'Needs GM input' },
];

export function formatCharacterDraftReaction(reaction: SharedCharacterDraftReaction): string {
  const option = CHARACTER_DRAFT_REACTION_OPTIONS.find((entry) => entry.value === reaction);
  return option?.label ?? reaction;
}

export function collectCharacterDraftReactionCounts(
  messages: readonly GameChatMessage[],
  targetMessageId: string
): Array<{ reaction: SharedCharacterDraftReaction; count: number; label: string }> {
  const counts = new Map<SharedCharacterDraftReaction, number>();

  for (const message of messages) {
    const artifact = message.artifact;
    if (!artifact || artifact.kind !== 'CHARACTER_DRAFT_REACTION' || artifact.targetMessageId !== targetMessageId) {
      continue;
    }
    counts.set(artifact.reaction, (counts.get(artifact.reaction) ?? 0) + 1);
  }

  return CHARACTER_DRAFT_REACTION_OPTIONS
    .map((option) => ({
      reaction: option.value,
      count: counts.get(option.value) ?? 0,
      label: option.label,
    }))
    .filter((entry) => entry.count > 0);
}

export function buildCharacterDraftReactionSummaryLabel(
  messages: readonly GameChatMessage[],
  targetMessageId: string
): string {
  const counts = collectCharacterDraftReactionCounts(messages, targetMessageId);
  if (counts.length === 0) {
    return 'No reactions yet';
  }

  return counts.map((entry) => `${entry.label} ${entry.count}`).join(' | ');
}

export function countCharacterDraftReactions(messages: readonly GameChatMessage[], targetMessageId: string): number {
  return collectCharacterDraftReactionCounts(messages, targetMessageId).reduce((total, entry) => total + entry.count, 0);
}
