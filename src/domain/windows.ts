import type { ForecastPoint } from '../shared/schemas.js';
import { toIst, rangeLabelIst, addHours } from './time.js';

export interface CleanWindow {
  readonly startUtc: string;
  readonly endUtc: string;
  readonly labelIst: string;
  readonly meanPm25: number;
}

interface WindowCandidate {
  readonly startUtc: string;
  readonly endUtc: string;
  readonly labelIst: string;
  readonly meanPm25: number;
  readonly startIstHour: number;
}

function evaluateCandidate(
  sortedPoints: readonly ForecastPoint[],
  startIndex: number,
  n: number,
  currentHourMs: number,
  cutoffEndMs: number,
): WindowCandidate | null {
  const startPt = sortedPoints[startIndex];
  if (!startPt) {
    return null;
  }
  const startMs = Date.parse(startPt.timeUtc);
  if (startMs < currentHourMs || startMs >= cutoffEndMs) {
    return null;
  }

  let sumPm25 = 0;
  for (let k = 0; k < n; k += 1) {
    const pt = sortedPoints[startIndex + k];
    if (!pt) return null;

    const ptMs = Date.parse(pt.timeUtc);
    if (ptMs !== startMs + k * 3600 * 1000 || ptMs >= cutoffEndMs) {
      return null;
    }
    if (typeof pt.pm25 !== 'number' || !Number.isFinite(pt.pm25) || pt.pm25 < 0) {
      return null;
    }
    sumPm25 += pt.pm25;
  }

  const startUtc = startPt.timeUtc;
  const endUtc = addHours(startUtc, n);
  const ist = toIst(startUtc);

  return {
    startUtc,
    endUtc,
    labelIst: rangeLabelIst(startUtc, endUtc),
    meanPm25: sumPm25 / n,
    startIstHour: ist.hourFraction,
  };
}

function getSortedValidCandidates(
  points: readonly ForecastPoint[] | null | undefined,
  durationMin: number,
  nowUtc: string,
): WindowCandidate[] | null {
  if (!points || points.length === 0) return null;
  const nowMs = Date.parse(nowUtc);
  if (Number.isNaN(nowMs) || !Number.isFinite(durationMin) || durationMin <= 0) {
    throw new RangeError('Invalid durationMin or nowUtc');
  }

  const n = Math.ceil(durationMin / 60);
  const sorted = [...points].sort((a, b) => Date.parse(a.timeUtc) - Date.parse(b.timeUtc));
  const currentHourMs = Math.floor(nowMs / (60 * 60 * 1000)) * (60 * 60 * 1000);
  const cutoffEndMs = currentHourMs + 24 * 60 * 60 * 1000;

  const candidates: WindowCandidate[] = [];
  for (let i = 0; i <= sorted.length - n; i += 1) {
    const candidate = evaluateCandidate(sorted, i, n, currentHourMs, cutoffEndMs);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

/**
 * Finds the cleanest activity window inside the flexible range.
 * Ties pick the earliest start. Returns null if no valid window exists.
 * DOMAIN_MODEL §3.
 */
export function bestWindow(
  points: readonly ForecastPoint[] | null | undefined,
  durationMin: number,
  flexible: { earliestHour: number; latestHour: number } | null | undefined,
  nowUtc: string,
): CleanWindow | null {
  if (!flexible || flexible.latestHour <= flexible.earliestHour) return null;
  const candidates = getSortedValidCandidates(points, durationMin, nowUtc);
  if (!candidates || candidates.length === 0) return null;

  const n = Math.ceil(durationMin / 60);
  let best: WindowCandidate | null = null;

  for (const c of candidates) {
    if (c.startIstHour < flexible.earliestHour || c.startIstHour + n > flexible.latestHour) {
      continue;
    }
    if (!best || c.meanPm25 < best.meanPm25) {
      best = c;
    }
  }

  return best ? { startUtc: best.startUtc, endUtc: best.endUtc, labelIst: best.labelIst, meanPm25: best.meanPm25 } : null;
}

/**
 * Finds the window whose IST start is closest to usualStartHour (ignoring the flexible range).
 * Ties pick the earlier start.
 * DOMAIN_MODEL §3.
 */
export function usualWindow(
  points: readonly ForecastPoint[] | null | undefined,
  durationMin: number,
  usualStartHour: number,
  nowUtc: string,
): CleanWindow | null {
  const candidates = getSortedValidCandidates(points, durationMin, nowUtc);
  if (!candidates || candidates.length === 0) return null;

  let best: WindowCandidate | null = null;
  let minDiff = Infinity;

  for (const c of candidates) {
    const directDiff = Math.abs(c.startIstHour - usualStartHour);
    const circularDiff = Math.min(directDiff, 24 - directDiff);
    if (circularDiff < minDiff) {
      minDiff = circularDiff;
      best = c;
    }
  }

  return best ? { startUtc: best.startUtc, endUtc: best.endUtc, labelIst: best.labelIst, meanPm25: best.meanPm25 } : null;
}

/**
 * Status of the window for the UI.
 * Returns 'ok', 'no-forecast' or 'no-window'.
 * DOMAIN_MODEL §3.
 */
export function windowStatus(
  forecast: readonly ForecastPoint[] | null | undefined,
  window: CleanWindow | null,
): 'ok' | 'no-forecast' | 'no-window' {
  if (!forecast || forecast.length === 0) {
    return 'no-forecast';
  }
  return window !== null ? 'ok' : 'no-window';
}
