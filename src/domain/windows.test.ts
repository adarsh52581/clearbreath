import { describe, it, expect } from 'vitest';
import { bestWindow, usualWindow, windowStatus } from './windows.js';
import type { ForecastPoint } from '../shared/schemas.js';

describe('windows - Clean-window finder and usualWindow', () => {
  const baseDate = '2026-11-23T04:00:00.000Z'; // 09:30 IST

  // Generates 24 consecutive hourly points starting at baseDate
  const generateSeries = (
    pm25Values: (number | null)[],
    startUtc = baseDate,
  ): ForecastPoint[] => {
    const startMs = Date.parse(startUtc);
    return pm25Values.map((val, idx) => ({
      timeUtc: new Date(startMs + idx * 3600 * 1000).toISOString(),
      pm25: val,
      pm10: null,
    }));
  };

  it('finds the known minimum window within flexible range', () => {
    // 10:00 UTC = 15:30 IST (hourFraction 15.5)
    // 11:00 UTC = 16:30 IST (hourFraction 16.5)
    // 12:00 UTC = 17:30 IST (hourFraction 17.5)
    const points = generateSeries([120, 110, 90, 80, 45, 100, 150]);
    // Index 4 is startUtc + 4 hours (08:00 UTC = 13:30 IST), val 45
    // Let's set flexible range [13, 17] for a 1-hour activity (durationMin = 60)
    const result = bestWindow(points, 60, { earliestHour: 13, latestHour: 17 }, baseDate);

    expect(result).not.toBeNull();
    expect(result?.meanPm25).toBe(45);
    expect(result?.labelIst).toBe('13:30–14:30 IST');
  });

  it('breaks ties by choosing the earliest start', () => {
    // Points at 14:30 IST (idx 5) and 16:30 IST (idx 7) both have min pm25 = 40
    const vals = [100, 100, 100, 100, 100, 40, 90, 40, 100];
    const points = generateSeries(vals);
    const result = bestWindow(points, 60, { earliestHour: 14, latestHour: 18 }, baseDate);

    expect(result).not.toBeNull();
    expect(result?.meanPm25).toBe(40);
    expect(result?.labelIst).toBe('14:30–15:30 IST');
  });

  it('blocks a candidate window if any hour in the sequence has a gap or missing value', () => {
    // 2-hour duration (120 min) -> needs 2 consecutive hours
    // idx 1 is null, so window starting at idx 0 is invalid
    const points = generateSeries([50, null, 80, 90]);
    // idx 2 starts at 11:30 IST (11.5) and ends at 13:30 IST (13.5), so latestHour must be >= 14
    const result = bestWindow(points, 120, { earliestHour: 9, latestHour: 14 }, baseDate);

    expect(result).not.toBeNull();
    // Earliest valid 2-hour window is idx 2 and idx 3 (80 + 90) / 2 = 85
    expect(result?.meanPm25).toBe(85);
  });

  it('blocks windows when consecutive hours have a timestamp gap', () => {
    const points: ForecastPoint[] = [
      { timeUtc: '2026-11-23T05:00:00.000Z', pm25: 30, pm10: null },
      // gap: 06:00 is missing, jumps to 07:00
      { timeUtc: '2026-11-23T07:00:00.000Z', pm25: 30, pm10: null },
    ];
    // Needs 2 hours (120 min)
    const result = bestWindow(points, 120, { earliestHour: 10, latestHour: 14 }, '2026-11-23T05:00:00.000Z');
    expect(result).toBeNull();
  });

  it('returns null when activity duration is longer than the flexible range', () => {
    const points = generateSeries([50, 40, 30, 20]);
    // Duration 180 min (3 h), but range [10, 12] is only 2 hours
    const result = bestWindow(points, 180, { earliestHour: 10, latestHour: 12 }, baseDate);
    expect(result).toBeNull();
  });

  it('checks IST :30 fractional starts strictly against earliestHour and latestHour', () => {
    // baseDate is 04:00 UTC = 09:30 IST (hourFraction 9.5)
    const points = generateSeries([30, 40, 50]);
    // 9.5 start with n = 1 -> end is 10.5.
    // If earliestHour is 10, 9.5 < 10 -> excluded!
    const excludedStart = bestWindow(points, 60, { earliestHour: 10, latestHour: 12 }, baseDate);
    expect(excludedStart?.labelIst).toBe('10:30–11:30 IST'); // idx 1 starts at 10:30

    // If latestHour is 10, 9.5 + 1 = 10.5 > 10 -> excluded!
    const excludedEnd = bestWindow(points, 60, { earliestHour: 9, latestHour: 10 }, baseDate);
    expect(excludedEnd).toBeNull();
  });

  it('returns null when points are null, undefined or empty', () => {
    expect(bestWindow(null, 60, { earliestHour: 10, latestHour: 12 }, baseDate)).toBeNull();
    expect(bestWindow([], 60, { earliestHour: 10, latestHour: 12 }, baseDate)).toBeNull();
  });

  it('usualWindow picks the sequence closest to usualStartHour (tie -> earlier start)', () => {
    // baseDate: 04:00 UTC = 09:30 IST
    // Point 0: 09:30 IST (hourFraction 9.5). Distance to 10: 0.5.
    // Point 1: 10:30 IST (hourFraction 10.5). Distance to 10: 0.5.
    // Tie between 9.5 and 10.5 should pick 09:30 (earlier start)
    const points = generateSeries([100, 20, 100]);
    const usual = usualWindow(points, 60, 10, baseDate);

    expect(usual).not.toBeNull();
    expect(usual?.labelIst).toBe('09:30–10:30 IST');
  });

  it('reports correct windowStatus: ok, no-forecast, no-window', () => {
    const dummyWindow = {
      startUtc: '2026-11-23T10:00:00Z',
      endUtc: '2026-11-23T11:00:00Z',
      labelIst: '15:30–16:30 IST',
      meanPm25: 50,
    };
    const validPoints = generateSeries([50]);

    expect(windowStatus(null, null)).toBe('no-forecast');
    expect(windowStatus([], null)).toBe('no-forecast');
    expect(windowStatus(validPoints, null)).toBe('no-window');
    expect(windowStatus(validPoints, dummyWindow)).toBe('ok');
  });

  it('throws RangeError when durationMin is <= 0 or nowUtc is invalid', () => {
    const points = generateSeries([50]);
    expect(() => bestWindow(points, 0, { earliestHour: 10, latestHour: 12 }, baseDate)).toThrow(
      RangeError,
    );
    expect(() => bestWindow(points, -10, { earliestHour: 10, latestHour: 12 }, baseDate)).toThrow(
      RangeError,
    );
    expect(() => bestWindow(points, 60, { earliestHour: 10, latestHour: 12 }, 'invalid-date')).toThrow(
      RangeError,
    );
  });

  it('ignores forecast points from past hours or beyond 24h cutoff', () => {
    // Points in the past (before currentHourMs)
    const pastPoint: ForecastPoint = {
      timeUtc: '2026-11-23T01:00:00.000Z',
      pm25: 10,
      pm10: null,
    };
    // Point beyond 24h
    const farPoint: ForecastPoint = {
      timeUtc: '2026-11-25T01:00:00.000Z',
      pm25: 10,
      pm10: null,
    };
    const validPoint: ForecastPoint = {
      timeUtc: '2026-11-23T04:00:00.000Z',
      pm25: 50,
      pm10: null,
    };
    const points = [pastPoint, validPoint, farPoint];
    const result = bestWindow(points, 60, { earliestHour: 9, latestHour: 11 }, baseDate);
    expect(result).not.toBeNull();
    expect(result?.meanPm25).toBe(50);
  });
});
