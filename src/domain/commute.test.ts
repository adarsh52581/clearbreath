import { describe, it, expect } from 'vitest';
import { commuteOptions } from './commute.js';
import {
  CO2_EMISSIONS_SOURCE,
  SPEED_ASSUMPTION_METADATA,
  METRO_ACCESS_METADATA,
} from './data/emissionFactors.js';
import type { Commute, Member } from '../shared/schemas.js';

describe('commute - options, emissions, doses and recommendation logic', () => {
  it('exposes metadata with correct source references and assumptions', () => {
    expect(CO2_EMISSIONS_SOURCE.kind).toBe('reference');
    expect(CO2_EMISSIONS_SOURCE.url).toContain('Per_passenger_emission_in_Delhi_Different_Modes.pdf');
    expect(SPEED_ASSUMPTION_METADATA.kind).toBe('assumption');
    expect(METRO_ACCESS_METADATA.kind).toBe('assumption');
  });

  const adultNonSensitive: Member = {
    id: 'm1',
    label: 'Rohan',
    ageGroup: 'adult',
    sensitivities: [],
  };

  const adultSensitive: Member = {
    id: 'm2',
    label: 'Aditi',
    ageGroup: 'adult',
    sensitivities: ['asthma'],
  };

  const childSensitive: Member = {
    id: 'm3',
    label: 'Aarav',
    ageGroup: 'child',
    sensitivities: [],
  };

  const standardCommute: Commute = {
    id: 'c1',
    label: 'Work commute',
    memberIds: ['m1'],
    distanceKm: 10,
    currentMode: 'car',
    allowedModes: ['car', 'metro', 'bus', 'cycle', 'walk'],
    usualStartHour: 8,
    daysPerWeek: 5,
  };

  it('calculates exact 10 km, car -> metro, 5 days, 1 traveller CO2 savings of 5.844 kg', () => {
    // (87.73 − 29.29) × 10 × 2 × 5 / 1000 = 5.844 kg CO2 per week
    const options = commuteOptions(standardCommute, [adultNonSensitive], 100);
    const carOpt = options.find((o) => o.mode === 'car');
    const metroOpt = options.find((o) => o.mode === 'metro');

    expect(carOpt).toBeDefined();
    expect(metroOpt).toBeDefined();
    expect(carOpt?.weeklyCo2Kg).toBe(8.773);
    expect(metroOpt?.weeklyCo2Kg).toBe(2.929);
    expect(metroOpt?.co2SavedKg).toBe(5.844);
    expect(carOpt?.co2SavedKg).toBe(0);
  });

  it('verifies cycling dose > car dose at the same concentration', () => {
    const options = commuteOptions(standardCommute, [adultNonSensitive], 100);
    const carOpt = options.find((o) => o.mode === 'car');
    const cycleOpt = options.find((o) => o.mode === 'cycle');

    expect(cycleOpt?.doseUg).toBeGreaterThan(carOpt?.doseUg ?? 0);
  });

  it('sets walk and cycle weekly CO2 to 0', () => {
    const options = commuteOptions(standardCommute, [adultNonSensitive], 100);
    const walkOpt = options.find((o) => o.mode === 'walk');
    const cycleOpt = options.find((o) => o.mode === 'cycle');

    expect(walkOpt?.weeklyCo2Kg).toBe(0);
    expect(cycleOpt?.weeklyCo2Kg).toBe(0);
  });

  it('calculates vehicle-km avoided only when leaving a private vehicle for public/active', () => {
    // Private vehicle current mode: 'car'
    const options = commuteOptions(standardCommute, [adultNonSensitive], 100);
    // 10 km * 2 * 5 = 100 km avoided
    expect(options.find((o) => o.mode === 'metro')?.vehicleKmAvoidedWeek).toBe(100);
    expect(options.find((o) => o.mode === 'bus')?.vehicleKmAvoidedWeek).toBe(100);
    expect(options.find((o) => o.mode === 'cycle')?.vehicleKmAvoidedWeek).toBe(100);
    expect(options.find((o) => o.mode === 'walk')?.vehicleKmAvoidedWeek).toBe(100);
    expect(options.find((o) => o.mode === 'car')?.vehicleKmAvoidedWeek).toBe(0);

    // If current mode is 'metro', moving to bus or walk does NOT avoid vehicle-km
    const metroCommute: Commute = {
      ...standardCommute,
      currentMode: 'metro',
    };
    const metroOptions = commuteOptions(metroCommute, [adultNonSensitive], 100);
    expect(metroOptions.find((o) => o.mode === 'bus')?.vehicleKmAvoidedWeek).toBe(0);
    expect(metroOptions.find((o) => o.mode === 'walk')?.vehicleKmAvoidedWeek).toBe(0);
  });

  it('recommends the lowest-dose option when any traveller is sensitive', () => {
    const commute: Commute = {
      ...standardCommute,
      memberIds: ['m2'], // adult with asthma
      allowedModes: ['car', 'bus', 'cycle', 'metro'],
    };
    const options = commuteOptions(commute, [adultSensitive], 100);
    const recommended = options.find((o) => o.recommended);

    const minDose = Math.min(...options.map((o) => o.doseUg));
    // Recommended must have dose within 5% of minDose
    expect(recommended?.doseUg).toBeLessThanOrEqual(minDose * 1.05);
  });

  it('recommends the lowest CO2 mode within 1.5x minimum dose for non-sensitive travellers', () => {
    const commute: Commute = {
      ...standardCommute,
      allowedModes: ['car', 'bus'],
    };
    const options = commuteOptions(commute, [adultNonSensitive], 100);
    const minDose = Math.min(...options.map((o) => o.doseUg));
    const bus = options.find((o) => o.mode === 'bus');
    const recommended = options.find((o) => o.recommended);

    // If bus dose <= 1.5 * minDose, bus should win because bus CO2 (29.48) < car CO2 (87.73)
    if (bus && bus.doseUg <= minDose * 1.5) {
      expect(recommended?.mode).toBe('bus');
    }
  });

  it('includes currentMode even if omitted from allowedModes', () => {
    const commute: Commute = {
      ...standardCommute,
      currentMode: 'cab',
      allowedModes: ['metro'],
    };
    const options = commuteOptions(commute, [adultNonSensitive], 100);
    expect(options.some((o) => o.mode === 'cab')).toBe(true);
    expect(options.some((o) => o.mode === 'metro')).toBe(true);
  });

  it('handles multiple travellers averaging doses', () => {
    const commute: Commute = {
      ...standardCommute,
      memberIds: ['m1', 'm3'], // adult and child
    };
    const options = commuteOptions(commute, [adultNonSensitive, childSensitive], 100);
    expect(options.length).toBeGreaterThan(0);
    // Since child is sensitive, recommendation prioritises lowest dose
    const recommended = options.find((o) => o.recommended);
    const minDose = Math.min(...options.map((o) => o.doseUg));
    expect(recommended?.doseUg).toBeLessThanOrEqual(minDose * 1.05);
  });

  it('breaks CO2 ties using shortest travel time', () => {
    // Both walk and cycle have 0 CO2. Cycle is 12 km/h, walk is 4.5 km/h -> cycle is faster.
    const commute: Commute = {
      ...standardCommute,
      distanceKm: 2,
      currentMode: 'walk',
      allowedModes: ['walk', 'cycle'],
    };
    // At concentration 0, doses are all 0 so CO2 tie-breaker selects cycle due to shorter duration
    const options = commuteOptions(commute, [adultNonSensitive], 0);
    const recommended = options.find((o) => o.recommended);
    expect(recommended?.mode).toBe('cycle');
  });

  it('throws RangeError on invalid input values', () => {
    expect(() => commuteOptions({ ...standardCommute, distanceKm: -1 }, [adultNonSensitive], 100)).toThrow(
      RangeError,
    );
    expect(() => commuteOptions({ ...standardCommute, daysPerWeek: 0 }, [adultNonSensitive], 100)).toThrow(
      RangeError,
    );
    expect(() => commuteOptions(standardCommute, [adultNonSensitive], -50)).toThrow(RangeError);
    expect(() => commuteOptions(standardCommute, [], 100)).toThrow(RangeError);
  });
});
