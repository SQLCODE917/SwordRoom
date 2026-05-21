import type { CharacterWizardEntryContext } from './entryContext.js';

export interface CharacterPlanningFocusViewModel {
  headline: string;
  detail: string;
  lines: string[];
}

export function createCharacterPlanningFocusViewModel(input: {
  entryContext: CharacterWizardEntryContext;
  isEditMode: boolean;
  characterName: string;
  activeStepTitle: string;
  isDraftReadyForCheckpointShare: boolean;
  activePromptTitle: string | null;
  activePromptPrompt: string | null;
  openRoleLabels: string[];
}): CharacterPlanningFocusViewModel {
  const headline = readHeadline(input);
  const detail = readDetail(input.entryContext);
  const lines = [
    `Current checkpoint: ${input.activeStepTitle}`,
    input.activePromptTitle ? `GM prompt: ${input.activePromptTitle}` : 'GM prompt: no active prompt',
    input.openRoleLabels.length > 0 ? `Open roles: ${input.openRoleLabels.join(', ')}` : 'Open roles: none called out right now',
    input.isDraftReadyForCheckpointShare
      ? 'Share ready: yes, this checkpoint can go to chat now'
      : 'Share ready: not yet, finish the required draft fields first',
    input.isEditMode ? `Working draft: ${input.characterName}` : `Starting draft: ${input.characterName}`,
  ];

  if (input.entryContext.focus === 'prompt' && input.activePromptPrompt) {
    lines.splice(2, 0, `Prompt detail: ${input.activePromptPrompt}`);
  }

  return {
    headline,
    detail,
    lines,
  };
}

function readHeadline(input: {
  entryContext: CharacterWizardEntryContext;
  activePromptTitle: string | null;
  openRoleLabels: string[];
}): string {
  if (input.entryContext.focus === 'prompt' && input.activePromptTitle) {
    return `Answer the GM prompt: ${input.activePromptTitle}`;
  }
  if (input.entryContext.focus === 'role' && input.openRoleLabels.length > 0) {
    return `Draft toward ${input.openRoleLabels[0]}`;
  }
  if (input.entryContext.focus === 'review') {
    return 'Carry review feedback back into the draft';
  }
  if (input.entryContext.focus === 'revise') {
    return 'Revise this draft and share the next checkpoint';
  }
  if (input.entryContext.focus === 'start') {
    return 'Start a draft that can enter the pregame loop quickly';
  }
  return 'Resume this draft and keep the pregame loop moving';
}

function readDetail(entryContext: CharacterWizardEntryContext): string {
  if (entryContext.entrySource === 'lobby') {
    return 'Opened from Lobby so the game need stays visible while you draft.';
  }
  if (entryContext.entrySource === 'chat') {
    return 'Opened from Chat so you can revise in response to the current conversation.';
  }
  if (entryContext.entrySource === 'characters') {
    return 'Opened from Characters so inspection feedback can turn into a draft change quickly.';
  }
  if (entryContext.entrySource === 'inbox') {
    return 'Opened from Inbox as the shortest path back into active planning work.';
  }
  if (entryContext.entrySource === 'home') {
    return 'Opened from Home to get you into the pregame loop with minimal navigation.';
  }
  return 'Use Create to draft, share, and revise without leaving the pregame loop.';
}
