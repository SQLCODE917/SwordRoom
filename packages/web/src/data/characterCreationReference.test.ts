import { describe, expect, it } from 'vitest';
import { rollFormula, rollSubAbilitiesForRace } from './characterCreationReference';

describe('rollFormula', () => {
  it('supports 2D and additive bonus', () => {
    const rng = () => 0;
    expect(rollFormula('2D', rng)).toBe(2);
    expect(rollFormula('2D+6', rng)).toBe(8);
  });

  it('supports 1D and 1/2D forms', () => {
    const rngMin = () => 0;
    const rngMax = () => 0.999;
    expect(rollFormula('1D', rngMin)).toBe(1);
    expect(rollFormula('1D+4', rngMin)).toBe(5);
    expect(rollFormula('1/2D', rngMin)).toBe(1);
    expect(rollFormula('1/2D', rngMax)).toBe(3);
  });
});

describe('rollSubAbilitiesForRace', () => {
  it('rolls all A-H values using race formulas', () => {
    const rolled = rollSubAbilitiesForRace('HUMAN', () => 0);
    expect(rolled).toEqual({ A: 2, B: 2, C: 2, D: 2, E: 2, F: 2, G: 2, H: 2 });
  });
});
