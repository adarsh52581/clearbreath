import type { AgeGroup, Intensity, Member } from '../shared/schemas.js';
import { INHALATION_RATES } from './data/inhalationRates.js';

/**
 * Returns the mean short-term inhalation rate in m³/h for an age group and intensity.
 * Throws RangeError if the ageGroup or intensity is invalid.
 * DOMAIN_MODEL §2.
 */
export function inhalationRate(ageGroup: AgeGroup, intensity: Intensity): number {
  const rate = INHALATION_RATES[ageGroup]?.[intensity];
  if (typeof rate !== 'number') {
    throw new RangeError(`Unknown ageGroup (${ageGroup}) or intensity (${intensity})`);
  }
  return rate;
}

/**
 * Computes inhaled dose in µg: C (µg/m³) × R (m³/h) × t (h).
 * Throws RangeError on negative numbers, NaN or ±Infinity.
 * DOMAIN_MODEL §2.
 */
export function doseUg(params: {
  concentration: number;
  ratePerHour: number;
  hours: number;
}): number {
  const { concentration, ratePerHour, hours } = params;
  if (
    typeof concentration !== 'number' ||
    !Number.isFinite(concentration) ||
    concentration < 0 ||
    typeof ratePerHour !== 'number' ||
    !Number.isFinite(ratePerHour) ||
    ratePerHour < 0 ||
    typeof hours !== 'number' ||
    !Number.isFinite(hours) ||
    hours < 0
  ) {
    throw new RangeError('concentration, ratePerHour, and hours must be finite non-negative numbers');
  }
  return concentration * ratePerHour * hours;
}

/**
 * Computes percent change: (value − baseline) / baseline × 100, rounded to an integer.
 * Returns null if baseline ≤ 0 or if either input is invalid.
 * DOMAIN_MODEL §2.
 */
export function percentChange(baseline: number, value: number): number | null {
  if (
    typeof baseline !== 'number' ||
    !Number.isFinite(baseline) ||
    baseline <= 0 ||
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return null;
  }
  return Math.round(((value - baseline) / baseline) * 100);
}

/**
 * Checks whether a member is sensitive to air pollution.
 * Sensitive: has any sensitivity (asthma, copd, heart, pregnant) or is toddler, child, older_adult.
 * DOMAIN_MODEL §4.
 */
export function isSensitive(member: Member): boolean {
  if (member.sensitivities.length > 0) {
    return true;
  }
  return (
    member.ageGroup === 'toddler' ||
    member.ageGroup === 'child' ||
    member.ageGroup === 'older_adult'
  );
}
