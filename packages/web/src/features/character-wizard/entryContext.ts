export type CharacterWizardEntrySource = 'direct' | 'home' | 'inbox' | 'digest' | 'lobby' | 'chat' | 'characters';

export type CharacterWizardEntryFocus = 'start' | 'resume' | 'prompt' | 'role' | 'revise' | 'review';

export interface CharacterWizardEntryContext {
  entrySource: CharacterWizardEntrySource;
  focus: CharacterWizardEntryFocus;
}

export function appendCharacterWizardEntryContext(path: string, context: {
  entrySource: Exclude<CharacterWizardEntrySource, 'direct'>;
  focus: CharacterWizardEntryFocus;
}): string {
  const url = new URL(path, 'https://swordworld.local');
  url.searchParams.set('entry', context.entrySource);
  url.searchParams.set('focus', context.focus);
  return `${url.pathname}${url.search}`;
}

export function readCharacterWizardEntryContext(searchParams: URLSearchParams): CharacterWizardEntryContext {
  const entrySource = readEntrySource(searchParams.get('entry'));
  const focus = readEntryFocus(searchParams.get('focus'));
  return {
    entrySource,
    focus,
  };
}

export function getCharacterWizardReturnPath(gameId: string, entrySource: CharacterWizardEntrySource): string | null {
  if (entrySource === 'lobby') {
    return `/games/${encodeURIComponent(gameId)}`;
  }
  if (entrySource === 'chat') {
    return `/games/${encodeURIComponent(gameId)}/chat`;
  }
  if (entrySource === 'characters') {
    return `/games/${encodeURIComponent(gameId)}/characters`;
  }
  if (entrySource === 'inbox' || entrySource === 'digest') {
    return '/inbox?mode=player';
  }
  if (entrySource === 'home') {
    return '/';
  }
  return null;
}

function readEntrySource(value: string | null): CharacterWizardEntrySource {
  if (value === 'home' || value === 'inbox' || value === 'digest' || value === 'lobby' || value === 'chat' || value === 'characters') {
    return value;
  }
  return 'direct';
}

function readEntryFocus(value: string | null): CharacterWizardEntryFocus {
  if (value === 'start' || value === 'resume' || value === 'prompt' || value === 'role' || value === 'revise' || value === 'review') {
    return value;
  }
  return 'resume';
}
