import { describe, it, expect } from 'vitest';
import { HOUSEHOLD_PRESETS, getPresetById } from './presets.js';
import { householdProfileSchema } from '../../shared/schemas.js';

describe('Household Presets (src/domain/data/presets.ts)', () => {
  it('contains exactly six presets', () => {
    expect(HOUSEHOLD_PRESETS).toHaveLength(6);
  });

  it('all presets have unique ids', () => {
    const ids = HOUSEHOLD_PRESETS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(6);
  });

  it('all presets have unique titles and titles match specification', () => {
    const expectedTitles = [
      'Delhi — child with asthma',
      'Noida — senior couple, one with COPD',
      'Mumbai — young commuting couple',
      'Kolkata — joint family with a toddler',
      'Bengaluru — single adult (minimal)',
      'Delhi — large household (stress test)',
    ];
    const actualTitles = HOUSEHOLD_PRESETS.map((p) => p.title);
    expect(actualTitles).toEqual(expectedTitles);
  });

  it('each preset passes householdProfileSchema without errors', () => {
    for (const preset of HOUSEHOLD_PRESETS) {
      const result = householdProfileSchema.safeParse(preset);
      expect(result.success, `Preset ${preset.id} failed schema: ${!result.success ? JSON.stringify(result.error) : ''}`).toBe(true);
    }
  });

  it('each preset has a judge description <= 120 characters', () => {
    for (const preset of HOUSEHOLD_PRESETS) {
      expect(preset.description).toBeDefined();
      expect(preset.description!.length).toBeLessThanOrEqual(120);
    }
  });

  it('contains no pollution values anywhere in any preset', () => {
    const json = JSON.stringify(HOUSEHOLD_PRESETS).toLowerCase();
    expect(json).not.toContain('aqi');
    expect(json).not.toContain('pm25');
    expect(json).not.toContain('pm10');
    expect(json).not.toContain('concentration');
  });

  it('max-household hits each schema maximum', () => {
    const maxPreset = getPresetById('max-household');
    expect(maxPreset).toBeDefined();
    if (!maxPreset) return;

    // Schema limits: members max 8, activities max 10, commutes max 4
    expect(maxPreset.members).toHaveLength(8);
    expect(maxPreset.activities).toHaveLength(10);
    expect(maxPreset.commutes).toHaveLength(4);

    // Includes pregnant adult and older adult with heart disease
    const pregnant = maxPreset.members.find((m) => m.sensitivities.includes('pregnant'));
    const heart = maxPreset.members.find((m) => m.sensitivities.includes('heart'));
    expect(pregnant).toBeDefined();
    expect(heart).toBeDefined();
  });

  it('getPresetById returns preset or undefined for unknown id', () => {
    expect(getPresetById('delhi-asthma-child')?.title).toBe('Delhi — child with asthma');
    expect(getPresetById('unknown-preset')).toBeUndefined();
  });
});
