import type { AgeGroup, Intensity } from '../../shared/schemas.js';

export interface InhalationRatesMetadata {
  readonly kind: 'reference';
  readonly source: string;
  readonly url: string;
}

/**
 * Mean short-term inhalation rates in m³/h (EFH m³/min × 60).
 * Source: US EPA Exposure Factors Handbook (2011), Chapter 6, Table 6-2.
 * DOMAIN_MODEL §2.
 */
export const INHALATION_RATES_METADATA: InhalationRatesMetadata = {
  kind: 'reference',
  source: 'US EPA Exposure Factors Handbook (2011), Chapter 6, Table 6-2 (m³/min × 60)',
  url: 'https://www.epa.gov/sites/production/files/2015-09/documents/efh-chapter06.pdf',
} as const;

export const INHALATION_RATES: Readonly<Record<AgeGroup, Readonly<Record<Intensity, number>>>> = {
  toddler: {
    sedentary: 0.28,
    light: 0.72,
    moderate: 1.26,
    high: 2.28,
  },
  child: {
    sedentary: 0.29,
    light: 0.66,
    moderate: 1.32,
    high: 2.52,
  },
  teen: {
    sedentary: 0.32,
    light: 0.78,
    moderate: 1.5,
    high: 2.94,
  },
  adult: {
    sedentary: 0.26,
    light: 0.72,
    moderate: 1.62,
    high: 2.94,
  },
  older_adult: {
    sedentary: 0.29,
    light: 0.72,
    moderate: 1.56,
    high: 2.82,
  },
} as const;
