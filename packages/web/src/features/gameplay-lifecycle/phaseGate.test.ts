import { describe, expect, it } from 'vitest';
import { deriveGameplayPhaseGate } from './phaseGate';

describe('deriveGameplayPhaseGate', () => {
  it('defaults to pregame when lifecycle is missing', () => {
    const gate = deriveGameplayPhaseGate(null);
    expect(gate.phase).toBe('PREGAME');
    expect(gate.isPregame).toBe(true);
    expect(gate.isLive).toBe(false);
    expect(gate.shouldLoadGameplay).toBe(false);
  });

  it('returns live when lifecycle is live', () => {
    const gate = deriveGameplayPhaseGate({ phase: 'LIVE' });
    expect(gate.phase).toBe('LIVE');
    expect(gate.isPregame).toBe(false);
    expect(gate.isLive).toBe(true);
    expect(gate.shouldLoadGameplay).toBe(true);
  });
});
