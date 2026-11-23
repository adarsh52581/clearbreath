import type { Commute, Member, Mode } from '../shared/schemas.js';
import {
  ASSUMED_SPEEDS_KMH,
  CO2_PER_PASSENGER_KM,
  COMMUTE_MODE_INTENSITY,
  COMMUTE_RECOMMENDATION_THRESHOLDS,
  METRO_ACCESS_MINUTES,
  PRIVATE_MODES,
  PUBLIC_OR_ACTIVE_MODES,
} from './data/emissionFactors.js';
import { doseUg, inhalationRate, isSensitive } from './exposure.js';

export interface CommuteOption {
  readonly mode: Mode;
  readonly minutes: number;
  readonly dosePerTravellerUg: number;
  readonly doseUg: number;
  readonly weeklyCo2Kg: number;
  readonly co2SavedKg: number;
  readonly vehicleKmAvoidedWeek: number;
  readonly recommended: boolean;
}

function calculateTravelMinutes(distanceKm: number, mode: Mode): number {
  const speed = ASSUMED_SPEEDS_KMH[mode];
  const minutes = (distanceKm / speed) * 60;
  return mode === 'metro' ? Math.round(minutes) + METRO_ACCESS_MINUTES : Math.round(minutes);
}

function calculateDosePerTraveller(
  distanceKm: number,
  mode: Mode,
  concentration: number,
  travellers: readonly Member[],
): number {
  let total = 0;
  for (const m of travellers) {
    if (mode === 'metro') {
      const accessRate = inhalationRate(m.ageGroup, 'light');
      const accessDose = doseUg({
        concentration,
        ratePerHour: accessRate,
        hours: METRO_ACCESS_MINUTES / 60,
      });
      const inMetroRate = inhalationRate(m.ageGroup, 'sedentary');
      const inMetroDose = doseUg({
        concentration,
        ratePerHour: inMetroRate,
        hours: distanceKm / 30,
      });
      total += accessDose + inMetroDose;
    } else {
      const speed = ASSUMED_SPEEDS_KMH[mode];
      const intensity = COMMUTE_MODE_INTENSITY[mode];
      const rate = inhalationRate(m.ageGroup, intensity);
      total += doseUg({
        concentration,
        ratePerHour: rate,
        hours: distanceKm / speed,
      });
    }
  }
  return total / travellers.length;
}

function pickRecommendedMode(
  options: readonly { mode: Mode; minutes: number; doseUg: number; weeklyCo2Kg: number }[],
  hasSensitive: boolean,
): Mode {
  const minDose = Math.min(...options.map((o) => o.doseUg));
  const candidates = hasSensitive
    ? options.filter(
        (o) =>
          o.doseUg <=
          minDose * (1 + COMMUTE_RECOMMENDATION_THRESHOLDS.sensitiveDoseTieThresholdPct),
      )
    : options.filter(
        (o) => o.doseUg <= minDose * COMMUTE_RECOMMENDATION_THRESHOLDS.doseMultiplierMax,
      );

  candidates.sort((a, b) => {
    if (a.weeklyCo2Kg !== b.weeklyCo2Kg) return a.weeklyCo2Kg - b.weeklyCo2Kg;
    return a.minutes - b.minutes;
  });

  const fallbackMode = options[0]?.mode ?? 'walk';
  return candidates[0]?.mode ?? fallbackMode;
}

function validateCommuteInputs(
  commute: Commute,
  concentration: number,
  members: readonly Member[],
): void {
  if (!Number.isFinite(commute.distanceKm) || commute.distanceKm <= 0) {
    throw new RangeError(`Invalid commute distance: ${commute.distanceKm}`);
  }
  if (!Number.isFinite(commute.daysPerWeek) || commute.daysPerWeek < 1 || commute.daysPerWeek > 7) {
    throw new RangeError(`Invalid daysPerWeek: ${commute.daysPerWeek}`);
  }
  if (!Number.isFinite(concentration) || concentration < 0) {
    throw new RangeError(`Invalid concentration: ${concentration}`);
  }
  if (!members || members.length === 0) {
    throw new RangeError('Members list cannot be empty');
  }
}

/**
 * Computes commute comparison options with doses, CO2 and recommendation.
 * DOMAIN_MODEL §4.
 */
export function commuteOptions(
  commute: Commute,
  members: readonly Member[],
  concentration: number,
): CommuteOption[] {
  validateCommuteInputs(commute, concentration, members);

  const matched = members.filter((m) => commute.memberIds.includes(m.id));
  const travellers = matched.length > 0 ? matched : members;
  const hasSensitive = travellers.some((m) => isSensitive(m));

  const modeSet = new Set(commute.allowedModes);
  modeSet.add(commute.currentMode);
  const modes = Array.from(modeSet);

  const baselineFactor = CO2_PER_PASSENGER_KM[commute.currentMode];
  const baselineCo2Kg =
    Math.round(baselineFactor * commute.distanceKm * 2 * commute.daysPerWeek * travellers.length) /
    1000;

  const rawOptions = modes.map((mode) => {
    const minutes = calculateTravelMinutes(commute.distanceKm, mode);
    const dose = calculateDosePerTraveller(commute.distanceKm, mode, concentration, travellers);
    const factor = CO2_PER_PASSENGER_KM[mode];
    const weeklyCo2Kg =
      Math.round(factor * commute.distanceKm * 2 * commute.daysPerWeek * travellers.length) / 1000;
    const co2SavedKg = Math.round((baselineCo2Kg - weeklyCo2Kg) * 1000) / 1000;
    const isLeavingPrivate =
      PRIVATE_MODES.has(commute.currentMode) && PUBLIC_OR_ACTIVE_MODES.has(mode);
    const vehicleKmAvoidedWeek = isLeavingPrivate ? commute.distanceKm * 2 * commute.daysPerWeek : 0;

    return {
      mode,
      minutes,
      dosePerTravellerUg: dose,
      doseUg: dose,
      weeklyCo2Kg,
      co2SavedKg,
      vehicleKmAvoidedWeek,
    };
  });

  const recommendedMode = pickRecommendedMode(rawOptions, hasSensitive);
  return rawOptions.map((opt) => ({ ...opt, recommended: opt.mode === recommendedMode }));
}
