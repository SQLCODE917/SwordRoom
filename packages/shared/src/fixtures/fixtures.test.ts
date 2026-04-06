import { describe, expect, it } from 'vitest';
import {
  getGameplayLoopFixture,
  loadGameplayLoopFixtures,
  loadGameplayLoopFixturesYamlText,
  loadVerticalSliceFixtures,
  loadVerticalSliceFixturesYamlText,
  normalizeFixtures,
  verticalSliceFixturesDocumentSchema,
} from './index.js';

describe('fixture loader', () => {
  it('loads YAML text from /fixtures source-of-truth', () => {
    const raw = loadVerticalSliceFixturesYamlText();
    expect(raw).toContain('doc_type: fixtures');
    expect(raw).toContain('fixtures:');
  });

  it('loads gameplay-loop YAML text from /fixtures source-of-truth', () => {
    const raw = loadGameplayLoopFixturesYamlText();
    expect(raw).toContain('slice: gameplay_loop_vertical_slice');
    expect(raw).toContain('Tavern At Sundown');
  });

  it('parses YAML into structured object with runtime schema validation', () => {
    const doc = loadVerticalSliceFixtures();
    expect(doc.doc_type).toBe('fixtures');
    expect(Array.isArray(doc.fixtures)).toBe(true);
    expect(doc.fixtures.length).toBeGreaterThan(0);
  });

  it('fails validation for malformed fixture docs', () => {
    const invalid = {
      doc_type: 'fixtures',
      slice: 'character_creation_vertical_slice',
      version: 1,
      fixtures: [{ id: 'bad.case' }],
    };

    const result = verticalSliceFixturesDocumentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('normalizes fixture structs for tests', () => {
    const normalized = normalizeFixtures(loadVerticalSliceFixtures());
    expect(normalized.byId['good.human_rune_master_sorcerer_starter']).toBeTruthy();
    expect(normalized.byId['bad.sorcerer_only_discount_when_neither'].expectedErrorCodes).toContain(
      'SORCERER_SAGE_BUNDLE_REQUIRED'
    );
  });

  it('loads the gameplay tavern seed fixture', () => {
    const doc = loadGameplayLoopFixtures();
    expect(doc.fixtures.length).toBeGreaterThan(0);
    const fixture = getGameplayLoopFixture('rpg_sample_tavern');
    expect(fixture.scene.title).toBe('Tavern At Sundown');
    expect(fixture.gm_only_transcript_contains).toContain('Brando family');
  });
});
