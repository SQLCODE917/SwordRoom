import { describe, expect, it } from 'vitest';
import { describeFailure } from './useCommandStatus';

describe('describeFailure', () => {
  it('preserves backend code and message verbatim for duplicate create draft errors', () => {
    const message = describeFailure({
      errorCode: 'CHARACTER_ID_ALREADY_EXISTS',
      errorMessage: 'Character ID "char-human-1" already exists in game "game-1".',
    });

    expect(message).toBe(
      'Command failed (CHARACTER_ID_ALREADY_EXISTS): Character ID "char-human-1" already exists in game "game-1".'
    );
  });

  it('preserves backend context for other failures', () => {
    const message = describeFailure({
      errorCode: 'EXP_INSUFFICIENT',
      errorMessage: 'Not enough starting EXP to purchase skill bundle.',
    });

    expect(message).toBe('Command failed (EXP_INSUFFICIENT): Not enough starting EXP to purchase skill bundle.');
  });
});
