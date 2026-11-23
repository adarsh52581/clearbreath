import type { Mode, Intensity } from '../../shared/schemas.js';

export interface ReferenceSource {
  readonly kind: 'reference';
  readonly source: string;
  readonly url: string;
}

export interface AssumptionSource {
  readonly kind: 'assumption';
  readonly note: string;
}

/**
 * CO2 emissions per passenger-km by mode for Delhi.
 * Source: TERI (2023), "Emission saving made by a passenger by choosing to travel by Delhi Metro".
 * DOMAIN_MODEL §4.
 */
export const CO2_EMISSIONS_SOURCE: ReferenceSource = {
  kind: 'reference',
  source:
    'TERI (2023), Emission saving made by a passenger by choosing to travel by Delhi Metro, Delhi estimates',
  url: 'https://teriin.org/sites/default/transport/Per_passenger_emission_in_Delhi_Different_Modes.pdf',
} as const;

export const CO2_PER_PASSENGER_KM: Readonly<Record<Mode, number>> = {
  metro: 29.29,
  bus: 29.48,
  two_wheeler: 41.29,
  auto: 64.1,
  car: 87.73,
  cab: 98.58,
  walk: 0,
  cycle: 0,
} as const;

/**
 * Assumed door-to-door urban speeds in km/h.
 * DOMAIN_MODEL §4.
 */
export const SPEED_ASSUMPTION_METADATA: AssumptionSource = {
  kind: 'assumption',
  note: 'Assumed door-to-door urban speeds when the user gives no duration',
} as const;

export const ASSUMED_SPEEDS_KMH: Readonly<Record<Mode, number>> = {
  walk: 4.5,
  cycle: 12,
  two_wheeler: 22,
  auto: 18,
  car: 20,
  cab: 20,
  bus: 14,
  metro: 30,
} as const;

/**
 * Metro access walk time in minutes.
 * DOMAIN_MODEL §2 and §4.
 */
export const METRO_ACCESS_METADATA: AssumptionSource = {
  kind: 'assumption',
  note: 'Metro adds 10 min of walking access at light intensity',
} as const;

export const METRO_ACCESS_MINUTES = 10;

/**
 * Commute recommendation thresholds.
 * DOMAIN_MODEL §4.
 */
export const RECOMMENDATION_THRESHOLDS_METADATA: AssumptionSource = {
  kind: 'assumption',
  note: '1.5x minimum dose threshold for non-sensitive modes; 5% tie tolerance for sensitive',
} as const;

export const COMMUTE_RECOMMENDATION_THRESHOLDS = {
  doseMultiplierMax: 1.5,
  sensitiveDoseTieThresholdPct: 0.05,
} as const;

/**
 * Physical activity intensity associated with each commute mode.
 * DOMAIN_MODEL §2.
 */
export const COMMUTE_MODE_INTENSITY: Readonly<Record<Mode, Intensity>> = {
  walk: 'light',
  cycle: 'moderate',
  two_wheeler: 'sedentary',
  auto: 'sedentary',
  car: 'sedentary',
  cab: 'sedentary',
  bus: 'sedentary',
  metro: 'sedentary',
} as const;

export const PRIVATE_MODES: ReadonlySet<Mode> = new Set(['car', 'cab', 'two_wheeler', 'auto']);
export const PUBLIC_OR_ACTIVE_MODES: ReadonlySet<Mode> = new Set(['walk', 'cycle', 'bus', 'metro']);
