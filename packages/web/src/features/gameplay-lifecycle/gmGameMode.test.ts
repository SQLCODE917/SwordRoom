import { describe, expect, it } from 'vitest';
import { readGMGameMode } from './gmGameMode';

describe('readGMGameMode', () => {
  it('returns lobby by default', () => {
    expect(readGMGameMode(null)).toBe('lobby');
    expect(readGMGameMode('')).toBe('lobby');
    expect(readGMGameMode('unknown')).toBe('lobby');
  });

  it('returns play when mode is play', () => {
    expect(readGMGameMode('play')).toBe('play');
  });

  it('returns gm-play when mode is gm-play', () => {
    expect(readGMGameMode('gm-play')).toBe('gm-play');
  });
});
