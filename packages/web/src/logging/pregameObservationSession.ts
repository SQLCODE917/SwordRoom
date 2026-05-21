import type {
  PregameObservationContext,
  PregameObservationSessionSummary,
} from '@starter/shared';
import { logWebFlow } from './flowLog';

const creatorIdleTimeoutMs = 30_000;

export interface PregameObservationSessionController {
  finish(reason: 'unmount' | 'pagehide'): PregameObservationSessionSummary | null;
}

export function beginPregameObservationSession(input: {
  context: Omit<PregameObservationContext, 'sessionStart'>;
  onSummary(summary: PregameObservationSessionSummary): void;
}): PregameObservationSessionController {
  const tracker = new CreatorActiveTimeTracker(input.context.sessionStartedAt);
  const onInteraction = () => tracker.markInteraction();
  const onVisibilityChange = () => tracker.setVisibility(!document.hidden);
  const onPageHide = () => {
    const summary = finishSession('pagehide');
    if (summary) {
      input.onSummary(summary);
    }
  };

  tracker.start();
  window.addEventListener('pointerdown', onInteraction, true);
  window.addEventListener('keydown', onInteraction, true);
  window.addEventListener('focus', onInteraction, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  let finished = false;

  const finishSession = (reason: 'unmount' | 'pagehide'): PregameObservationSessionSummary | null => {
    if (finished) {
      return null;
    }
    finished = true;
    window.removeEventListener('pointerdown', onInteraction, true);
    window.removeEventListener('keydown', onInteraction, true);
    window.removeEventListener('focus', onInteraction, true);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    const summary = tracker.finish(reason);
    if (!summary) {
      return null;
    }
    return {
      ...input.context,
      completedAt: summary.completedAt,
      activeDurationMs: summary.activeDurationMs,
      elapsedDurationMs: summary.elapsedDurationMs,
      completionReason: summary.completionReason,
    };
  };

  return {
    finish(reason) {
      return finishSession(reason);
    },
  };
}

class CreatorActiveTimeTracker {
  private readonly startedAtMs: number;
  private activeSinceMs: number | null = null;
  private activeDurationMs = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private visible = true;
  private finished = false;

  constructor(startedAt: string) {
    this.startedAtMs = Date.parse(startedAt) || Date.now();
    this.visible = typeof document === 'undefined' ? true : !document.hidden;
  }

  start(): void {
    if (this.visible) {
      this.activeSinceMs = Date.now();
      this.scheduleIdleTimeout();
    }
  }

  markInteraction(): void {
    if (this.finished || !this.visible) {
      return;
    }
    const now = Date.now();
    if (this.activeSinceMs === null) {
      this.activeSinceMs = now;
    }
    this.scheduleIdleTimeout();
  }

  setVisibility(visible: boolean): void {
    if (this.finished || this.visible === visible) {
      return;
    }
    this.visible = visible;
    if (!visible) {
      this.pauseAt(Date.now());
      return;
    }
    this.activeSinceMs = Date.now();
    this.scheduleIdleTimeout();
  }

  finish(reason: 'unmount' | 'pagehide'): {
    completedAt: string;
    activeDurationMs: number;
    elapsedDurationMs: number;
    completionReason: 'unmount' | 'pagehide';
  } | null {
    if (this.finished) {
      return null;
    }
    this.finished = true;
    this.pauseAt(Date.now());
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    const completedAt = new Date().toISOString();
    const elapsedDurationMs = Math.max(0, Date.now() - this.startedAtMs);
    logWebFlow('WEB_PREGAME_CREATOR_SESSION_SUMMARY_READY', {
      completedAt,
      activeDurationMs: this.activeDurationMs,
      elapsedDurationMs,
      completionReason: reason,
    });
    return {
      completedAt,
      activeDurationMs: this.activeDurationMs,
      elapsedDurationMs,
      completionReason: reason,
    };
  }

  private scheduleIdleTimeout(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.pauseAt(Date.now());
    }, creatorIdleTimeoutMs);
  }

  private pauseAt(nowMs: number): void {
    if (this.activeSinceMs !== null) {
      this.activeDurationMs += Math.max(0, nowMs - this.activeSinceMs);
      this.activeSinceMs = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
