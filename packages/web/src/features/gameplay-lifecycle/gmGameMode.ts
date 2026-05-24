export type GMGameMode = 'lobby' | 'play' | 'gm-play';

export function readGMGameMode(modeValue: string | null): GMGameMode {
  if (modeValue === 'play' || modeValue === 'gm-play') {
    return modeValue;
  }
  return 'lobby';
}
