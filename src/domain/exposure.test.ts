import { describe, it, expect } from 'vitest';
import { inhalationRate, doseUg, percentChange, isSensitive } from './exposure.js';
import { INHALATION_RATES_METADATA } from './data/inhalationRates.js';
import type { AgeGroup, Intensity, Member } from '../shared/schemas.js';

describe('exposure - inhalation rates, doses, percentChange, and sensitivity', () => {
  it('has reference metadata pointing to EPA EFH Table 6-2', () => {
    expect(INHALATION_RATES_METADATA.kind).toBe('reference');
    expect(INHALATION_RATES_METADATA.url).toContain('efh-chapter06.pdf');
  });

  const ageGroups: AgeGroup[] = ['toddler', 'child', 'teen', 'adult', 'older_adult'];
  const intensities: Intensity[] = ['sedentary', 'light', 'moderate', 'high'];

  describe('inhalationRate table - covers all 5x4 cells from DOMAIN_MODEL §2', () => {
    const tableValues: Record<AgeGroup, Record<Intensity, number>> = {
      toddler: { sedentary: 0.28, light: 0.72, moderate: 1.26, high: 2.28 },
      child: { sedentary: 0.29, light: 0.66, moderate: 1.32, high: 2.52 },
      teen: { sedentary: 0.32, light: 0.78, moderate: 1.5, high: 2.94 },
      adult: { sedentary: 0.26, light: 0.72, moderate: 1.62, high: 2.94 },
      older_adult: { sedentary: 0.29, light: 0.72, moderate: 1.56, high: 2.82 },
    };

    for (const age of ageGroups) {
      for (const intensity of intensities) {
        it(`returns ${tableValues[age][intensity]} for ${age} + ${intensity}`, () => {
          expect(inhalationRate(age, intensity)).toBe(tableValues[age][intensity]);
        });
      }
    }

    it('throws RangeError for invalid ageGroup or intensity', () => {
      // @ts-expect-error testing invalid input
      expect(() => inhalationRate('infant', 'sedentary')).toThrow(RangeError);
      // @ts-expect-error testing invalid input
      expect(() => inhalationRate('adult', 'extreme')).toThrow(RangeError);
    });
  });

  describe('doseUg - inhaled dose calculation', () => {
    it('computes dose = concentration * rate * hours correctly', () => {
      // 100 µg/m³ * 0.72 m³/h * 2 h = 144 µg
      expect(doseUg({ concentration: 100, ratePerHour: 0.72, hours: 2 })).toBeCloseTo(144, 5);
    });

    it('handles 0 hours and 0 concentration returning 0 µg', () => {
      expect(doseUg({ concentration: 100, ratePerHour: 0.72, hours: 0 })).toBe(0);
      expect(doseUg({ concentration: 0, ratePerHour: 0.72, hours: 2 })).toBe(0);
    });

    it('throws RangeError on negative, NaN, or infinite numbers', () => {
      expect(() => doseUg({ concentration: -10, ratePerHour: 0.72, hours: 1 })).toThrow(RangeError);
      expect(() => doseUg({ concentration: 100, ratePerHour: -0.5, hours: 1 })).toThrow(RangeError);
      expect(() => doseUg({ concentration: 100, ratePerHour: 0.72, hours: -1 })).toThrow(RangeError);
      expect(() => doseUg({ concentration: NaN, ratePerHour: 0.72, hours: 1 })).toThrow(RangeError);
      expect(() => doseUg({ concentration: 100, ratePerHour: NaN, hours: 1 })).toThrow(RangeError);
      expect(() => doseUg({ concentration: 100, ratePerHour: 0.72, hours: Infinity })).toThrow(
        RangeError,
      );
    });
  });

  describe('percentChange - (value - baseline) / baseline * 100', () => {
    it.each([
      [100, 50, -50],
      [100, 150, 50],
      [100, 100, 0],
      [200, 250, 25],
      [80, 70, -12], // (70 - 80) / 80 * 100 = -12.5 -> Math.round(-12.5) is -12
    ])('computes percent change from %d to %d -> %d', (baseline, value, expected) => {
      const result = percentChange(baseline, value);
      expect(result).toBe(expected);
    });

    it('returns null when baseline <= 0 or inputs are non-finite', () => {
      expect(percentChange(0, 50)).toBeNull();
      expect(percentChange(-10, 50)).toBeNull();
      expect(percentChange(NaN, 50)).toBeNull();
      expect(percentChange(100, NaN)).toBeNull();
      expect(percentChange(Infinity, 50)).toBeNull();
    });
  });

  describe('isSensitive - determines vulnerable individuals', () => {
    const baseMember = (partial: Partial<Member>): Member => ({
      id: 'm1',
      label: 'Person',
      ageGroup: 'adult',
      sensitivities: [],
      ...partial,
    });

    it('identifies sensitive age groups (toddler, child, older_adult)', () => {
      expect(isSensitive(baseMember({ ageGroup: 'toddler' }))).toBe(true);
      expect(isSensitive(baseMember({ ageGroup: 'child' }))).toBe(true);
      expect(isSensitive(baseMember({ ageGroup: 'older_adult' }))).toBe(true);
      expect(isSensitive(baseMember({ ageGroup: 'teen' }))).toBe(false);
      expect(isSensitive(baseMember({ ageGroup: 'adult' }))).toBe(false);
    });

    it('identifies sensitivity conditions (asthma, copd, heart, pregnant)', () => {
      expect(isSensitive(baseMember({ ageGroup: 'adult', sensitivities: ['asthma'] }))).toBe(true);
      expect(isSensitive(baseMember({ ageGroup: 'adult', sensitivities: ['copd'] }))).toBe(true);
      expect(isSensitive(baseMember({ ageGroup: 'teen', sensitivities: ['heart'] }))).toBe(true);
      expect(isSensitive(baseMember({ ageGroup: 'adult', sensitivities: ['pregnant'] }))).toBe(true);
    });
  });
});
