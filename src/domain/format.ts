import type { Language } from '../shared/schemas.js';
import { toIst } from './time.js';

/**
 * Localised display formatting for values users and Gemini see.
 * Implements DOMAIN_MODEL §7. Uses Latin digits in both en and hi.
 */

/** Formats PM2.5 or PM10 concentration as an integer µg/m³ */
export function formatUgM3(val: number): string {
  if (!Number.isFinite(val)) return '0 µg/m³';
  return `${Math.round(val)} µg/m³`;
}

/** Formats inhaled dose rounded to nearest 10 µg with en-IN number grouping */
export function formatDose(val: number, lang: Language = 'en'): string {
  if (!Number.isFinite(val) || val <= 0) {
    return lang === 'hi' ? '0 माइक्रोग्राम' : '0 µg';
  }
  const rounded = Math.round(val / 10) * 10;
  const formatted = new Intl.NumberFormat('en-IN').format(rounded);
  return lang === 'hi' ? `${formatted} माइक्रोग्राम` : `${formatted} µg`;
}

/** Formats CO2 in kg with 1 decimal */
export function formatCo2Kg(val: number, lang: Language = 'en'): string {
  if (!Number.isFinite(val) || Math.abs(val) < 0.01) {
    return lang === 'hi' ? '0.0 किग्रा CO2' : '0.0 kg CO2';
  }
  const formatted = Math.abs(val).toFixed(1);
  return lang === 'hi' ? `${formatted} किग्रा CO2` : `${formatted} kg CO2`;
}

/** Formats duration in minutes as "38 min" / "38 मिनट" */
export function formatMinutes(mins: number, lang: Language = 'en'): string {
  const rounded = Math.round(mins);
  return lang === 'hi' ? `${rounded} मिनट` : `${rounded} min`;
}

/** Formats a UTC timestamp as "HH:mm IST" */
export function formatIstTime(utcIso: string): string {
  const ist = toIst(utcIso);
  return `${ist.hhmm} IST`;
}

/**
 * Describes percentage change relative to baseline:
 * |change| < 3% -> "about the same" / "लगभग उतना ही"
 * change < 0 -> "X% lower" / "X% कम"
 * change > 0 -> "X% higher" / "X% ज़्यादा"
 */
export function describeChange(pctChange: number | null, lang: Language = 'en'): string {
  if (pctChange === null || !Number.isFinite(pctChange)) {
    return lang === 'hi' ? 'लागू नहीं' : 'N/A';
  }
  const rounded = Math.round(pctChange);
  if (Math.abs(rounded) < 3) {
    return lang === 'hi' ? 'लगभग उतना ही' : 'about the same';
  }
  if (rounded < 0) {
    const absVal = Math.abs(rounded);
    return lang === 'hi' ? `${absVal}% कम` : `${absVal}% lower`;
  }
  return lang === 'hi' ? `${rounded}% ज़्यादा` : `${rounded}% higher`;
}
