export const PREGAME_OBSERVABILITY_HEADERS = {
  surface: 'x-swordworld-pregame-surface',
  sessionId: 'x-swordworld-pregame-session-id',
  sessionStartedAt: 'x-swordworld-pregame-session-started-at',
  sessionStart: 'x-swordworld-pregame-session-start',
  entrySource: 'x-swordworld-pregame-entry-source',
  entryFocus: 'x-swordworld-pregame-entry-focus',
  wizardMode: 'x-swordworld-pregame-wizard-mode',
  draftMode: 'x-swordworld-pregame-draft-mode',
  gameId: 'x-swordworld-pregame-game-id',
  characterId: 'x-swordworld-pregame-character-id',
} as const;

export type PregameObservationSurface = 'creator';

export type PregameObservationEntrySource =
  | 'direct'
  | 'home'
  | 'inbox'
  | 'digest'
  | 'lobby'
  | 'chat'
  | 'characters';

export type PregameObservationEntryFocus = 'start' | 'resume' | 'prompt' | 'role' | 'revise' | 'review';

export type PregameObservationWizardMode = 'apply' | 'library';

export type PregameObservationDraftMode = 'new' | 'existing';

export interface PregameObservationContext {
  surface: PregameObservationSurface;
  sessionId: string;
  sessionStartedAt: string;
  sessionStart: boolean;
  entrySource: PregameObservationEntrySource;
  entryFocus: PregameObservationEntryFocus;
  wizardMode: PregameObservationWizardMode;
  draftMode: PregameObservationDraftMode;
  gameId: string | null;
  characterId: string | null;
}

export function buildPregameObservationHeaders(context: PregameObservationContext): Record<string, string> {
  const headers: Record<string, string> = {
    [PREGAME_OBSERVABILITY_HEADERS.surface]: context.surface,
    [PREGAME_OBSERVABILITY_HEADERS.sessionId]: context.sessionId,
    [PREGAME_OBSERVABILITY_HEADERS.sessionStartedAt]: context.sessionStartedAt,
    [PREGAME_OBSERVABILITY_HEADERS.sessionStart]: context.sessionStart ? '1' : '0',
    [PREGAME_OBSERVABILITY_HEADERS.entrySource]: context.entrySource,
    [PREGAME_OBSERVABILITY_HEADERS.entryFocus]: context.entryFocus,
    [PREGAME_OBSERVABILITY_HEADERS.wizardMode]: context.wizardMode,
    [PREGAME_OBSERVABILITY_HEADERS.draftMode]: context.draftMode,
  };

  if (context.gameId) {
    headers[PREGAME_OBSERVABILITY_HEADERS.gameId] = context.gameId;
  }
  if (context.characterId) {
    headers[PREGAME_OBSERVABILITY_HEADERS.characterId] = context.characterId;
  }

  return headers;
}

export function readPregameObservationContext(
  headers: Readonly<Record<string, string | string[] | undefined>>
): PregameObservationContext | null {
  const surface = readHeader(headers, PREGAME_OBSERVABILITY_HEADERS.surface);
  const sessionId = readHeader(headers, PREGAME_OBSERVABILITY_HEADERS.sessionId);
  const sessionStartedAt = readHeader(headers, PREGAME_OBSERVABILITY_HEADERS.sessionStartedAt);
  const entrySource = readHeader(headers, PREGAME_OBSERVABILITY_HEADERS.entrySource);
  const entryFocus = readHeader(headers, PREGAME_OBSERVABILITY_HEADERS.entryFocus);
  const wizardMode = readHeader(headers, PREGAME_OBSERVABILITY_HEADERS.wizardMode);
  const draftMode = readHeader(headers, PREGAME_OBSERVABILITY_HEADERS.draftMode);

  if (
    surface !== 'creator' ||
    !sessionId ||
    !sessionStartedAt ||
    !isPregameObservationEntrySource(entrySource) ||
    !isPregameObservationEntryFocus(entryFocus) ||
    !isPregameObservationWizardMode(wizardMode) ||
    !isPregameObservationDraftMode(draftMode)
  ) {
    return null;
  }

  return {
    surface,
    sessionId,
    sessionStartedAt,
    sessionStart: readHeader(headers, PREGAME_OBSERVABILITY_HEADERS.sessionStart) === '1',
    entrySource,
    entryFocus,
    wizardMode,
    draftMode,
    gameId: readHeader(headers, PREGAME_OBSERVABILITY_HEADERS.gameId) ?? null,
    characterId: readHeader(headers, PREGAME_OBSERVABILITY_HEADERS.characterId) ?? null,
  };
}

function readHeader(headers: Readonly<Record<string, string | string[] | undefined>>, name: string): string | null {
  const value = headers[name];
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' && value[0].trim() !== '' ? value[0] : null;
  }
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function isPregameObservationEntrySource(value: string | null): value is PregameObservationEntrySource {
  return value === 'direct' || value === 'home' || value === 'inbox' || value === 'digest' || value === 'lobby' || value === 'chat' || value === 'characters';
}

function isPregameObservationEntryFocus(value: string | null): value is PregameObservationEntryFocus {
  return value === 'start' || value === 'resume' || value === 'prompt' || value === 'role' || value === 'revise' || value === 'review';
}

function isPregameObservationWizardMode(value: string | null): value is PregameObservationWizardMode {
  return value === 'apply' || value === 'library';
}

function isPregameObservationDraftMode(value: string | null): value is PregameObservationDraftMode {
  return value === 'new' || value === 'existing';
}
