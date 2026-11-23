import {
  PM25_BREAKPOINTS,
  PM10_BREAKPOINTS,
  CATEGORIES,
  type Category,
  type CategoryKey,
} from './data/naqiBreakpoints.js';

export type { Category, CategoryKey };

export interface HourlyValue {
  timeUtc: string;
  value: number;
}

export interface NaqiResult {
  value: number;
  category: CategoryKey;
  dominant: 'pm25' | 'pm10';
  basis: '24h' | 'indicative-latest';
  subIndices: { pm25?: number; pm10?: number };
  note: string;
}

export function subIndex(pollutant: 'pm25' | 'pm10', concentration: number): number | null {
  if (typeof concentration !== 'number' || !Number.isFinite(concentration) || concentration < 0) {
    return null;
  }
  const breakpoints = pollutant === 'pm25' ? PM25_BREAKPOINTS : PM10_BREAKPOINTS;
  for (const bp of breakpoints) {
    if (concentration <= bp.cHi) {
      const idx = bp.iLo + ((concentration - bp.cLo) * (bp.iHi - bp.iLo)) / (bp.cHi - bp.cLo);
      return Math.round(idx);
    }
  }
  return 500;
}

export function categoryFor(index: number): Category {
  if (typeof index !== 'number' || !Number.isFinite(index) || index < 0 || index > 500) {
    throw new RangeError('AQI index must be between 0 and 500');
  }
  const rounded = Math.round(index);
  for (const category of CATEGORIES) {
    if (rounded >= category.indexRange[0] && rounded <= category.indexRange[1]) {
      return category;
    }
  }
  throw new RangeError('AQI index must be between 0 and 500');
}

export function average24h(
  values: HourlyValue[],
  nowUtc: string,
): { value: number | null; hoursAvailable: number; sufficient: boolean } {
  const nowMs = Date.parse(nowUtc);
  if (Number.isNaN(nowMs)) {
    throw new RangeError('Invalid nowUtc timestamp');
  }
  const cutoffMs = nowMs - 24 * 60 * 60 * 1000;
  let sum = 0;
  let count = 0;

  for (const item of values) {
    const t = Date.parse(item.timeUtc);
    if (Number.isNaN(t) || t <= cutoffMs || t > nowMs) {
      continue;
    }
    if (typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0) {
      continue;
    }
    sum += item.value;
    count += 1;
  }

  const sufficient = count >= 16;
  return {
    value: sufficient ? sum / count : null,
    hoursAvailable: count,
    sufficient,
  };
}

function resolveDominant(
  sub25: number | null,
  sub10: number | null,
): { value: number; dominant: 'pm25' | 'pm10' } | null {
  if (sub25 !== null && sub10 !== null) {
    return sub25 >= sub10
      ? { value: sub25, dominant: 'pm25' }
      : { value: sub10, dominant: 'pm10' };
  }
  if (sub25 !== null) return { value: sub25, dominant: 'pm25' };
  if (sub10 !== null) return { value: sub10, dominant: 'pm10' };
  return null;
}

function getSubIndex(
  has24h: boolean,
  avg: { sufficient: boolean; value: number | null },
  latest: number | undefined,
  pollutant: 'pm25' | 'pm10',
): number | null {
  if (has24h) {
    return avg.sufficient && avg.value !== null ? subIndex(pollutant, avg.value) : null;
  }
  return typeof latest === 'number' ? subIndex(pollutant, latest) : null;
}

export function computeNaqi(input: {
  pm25: HourlyValue[];
  pm10: HourlyValue[];
  latest: { pm25?: number; pm10?: number };
  nowUtc: string;
}): NaqiResult | null {
  const avg25 = average24h(input.pm25, input.nowUtc);
  const avg10 = average24h(input.pm10, input.nowUtc);
  const has24h = avg25.sufficient || avg10.sufficient;

  const sub25 = getSubIndex(has24h, avg25, input.latest.pm25, 'pm25');
  const sub10 = getSubIndex(has24h, avg10, input.latest.pm10, 'pm10');

  const dominantInfo = resolveDominant(sub25, sub10);
  if (!dominantInfo) return null;

  const subIndices: { pm25?: number; pm10?: number } = {};
  if (sub25 !== null) subIndices.pm25 = sub25;
  if (sub10 !== null) subIndices.pm10 = sub10;

  return {
    value: dominantInfo.value,
    category: categoryFor(dominantInfo.value).key,
    dominant: dominantInfo.dominant,
    basis: has24h ? '24h' : 'indicative-latest',
    subIndices,
    note: 'Based on PM2.5 and PM10 only — indicative',
  };
}
