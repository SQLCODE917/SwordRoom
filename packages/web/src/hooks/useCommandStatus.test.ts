import { describe, expect, it } from 'vitest';
import { describeFailure } from './useCommandStatus';

describe('describeFailure', () => {
  it('includes duplicate character hint for conditional check failures', () => {
    const message = describeFailure({
      errorCode: 'UNEXPECTED_ERROR',
      errorMessage: 'Transaction cancelled, please refer cancellation reasons for specific reasons [ConditionalCheckFailed, None]',
    });

    expect(message).toContain('characterId is already taken');
    expect(message).toContain('UNEXPECTED_ERROR');
    expect(message).toContain('ConditionalCheckFailed');
  });

  it('preserves backend context for other failures', () => {
    const message = describeFailure({
      errorCode: 'EXP_INSUFFICIENT',
      errorMessage: 'Not enough starting EXP to purchase skill bundle.',
    });

    expect(message).toBe('Command failed (EXP_INSUFFICIENT): Not enough starting EXP to purchase skill bundle.');
  });
});
