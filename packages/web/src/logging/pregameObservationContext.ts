import {
  buildPregameObservationHeaders,
  type PregameObservationContext,
} from '@starter/shared';
import { logWebFlow } from './flowLog';

let activeContext: PregameObservationContext | null = null;

export function activatePregameObservationContext(context: Omit<PregameObservationContext, 'sessionStart'>): void {
  const next: PregameObservationContext = {
    ...context,
    sessionStart: true,
  };
  activeContext = next;
  logWebFlow('WEB_PREGAME_CREATOR_SESSION_START', {
    creatorSessionId: next.sessionId,
    creatorSessionStartedAt: next.sessionStartedAt,
    entrySource: next.entrySource,
    entryFocus: next.entryFocus,
    wizardMode: next.wizardMode,
    draftMode: next.draftMode,
    gameId: next.gameId,
    characterId: next.characterId,
  });
}

export function deactivatePregameObservationContext(sessionId: string): void {
  if (!activeContext || activeContext.sessionId !== sessionId) {
    return;
  }
  const finishedAt = new Date().toISOString();
  logWebFlow('WEB_PREGAME_CREATOR_SESSION_END', {
    creatorSessionId: activeContext.sessionId,
    creatorSessionStartedAt: activeContext.sessionStartedAt,
    creatorSessionFinishedAt: finishedAt,
    entrySource: activeContext.entrySource,
    entryFocus: activeContext.entryFocus,
    wizardMode: activeContext.wizardMode,
    draftMode: activeContext.draftMode,
    gameId: activeContext.gameId,
    characterId: activeContext.characterId,
  });
  activeContext = null;
}

export function readActivePregameObservationHeaders(): Record<string, string> {
  if (!activeContext) {
    return {};
  }
  const headers = buildPregameObservationHeaders(activeContext);
  activeContext = {
    ...activeContext,
    sessionStart: false,
  };
  return headers;
}
