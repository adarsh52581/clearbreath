import { describe, it, expect } from 'vitest';
import { subIndex, categoryFor, average24h, computeNaqi, type HourlyValue } from './naqi.js';

describe('naqi - subIndex test vectors from DOMAIN_MODEL §1', () => {
  const pm25Vectors: [concentration: number, expectedIndex: number][] = [
    [15, 25],
    [30, 50],
    [45, 75],
    [60, 100],
    [75, 150],
    [90, 200],
    [105, 250],
    [120, 300],
    [185, 350],
    [250, 400],
    [315, 450],
    [380, 500],
    [900, 500],
  ];

  it.each(pm25Vectors)(
    'calculates PM2.5 sub-index for %d µg/m³ -> %d',
    (concentration, expectedIndex) => {
      expect(subIndex('pm25', concentration)).toBe(expectedIndex);
    },
  );

  const pm10Vectors: [concentration: number, expectedIndex: number][] = [
    [25, 25],
    [50, 50],
    [100, 100],
    [175, 150],
    [250, 200],
    [300, 250],
    [350, 300],
    [390, 350],
    [430, 400],
    [470, 450],
    [510, 500],
  ];

  it.each(pm10Vectors)(
    'calculates PM10 sub-index for %d µg/m³ -> %d',
    (concentration, expectedIndex) => {
      expect(subIndex('pm10', concentration)).toBe(expectedIndex);
    },
  );

  it('handles edge cases: negative, NaN, Infinity return null; above last edge returns 500', () => {
    expect(subIndex('pm25', -1)).toBeNull();
    expect(subIndex('pm25', Number.NaN)).toBeNull();
    expect(subIndex('pm25', Number.POSITIVE_INFINITY)).toBeNull();
    expect(subIndex('pm25', Number.NEGATIVE_INFINITY)).toBeNull();
    expect(subIndex('pm10', -10)).toBeNull();
    expect(subIndex('pm10', Number.NaN)).toBeNull();
    expect(subIndex('pm10', Number.POSITIVE_INFINITY)).toBeNull();

    expect(subIndex('pm25', 1000)).toBe(500);
    expect(subIndex('pm10', 800)).toBe(500);
  });
});

describe('naqi - categoryFor', () => {
  const categoryTestCases: [index: number, expectedKey: string][] = [
    [0, 'good'],
    [50, 'good'],
    [51, 'satisfactory'],
    [100, 'satisfactory'],
    [101, 'moderate'],
    [200, 'moderate'],
    [201, 'poor'],
    [300, 'poor'],
    [301, 'very_poor'],
    [400, 'very_poor'],
    [401, 'severe'],
    [500, 'severe'],
  ];

  it.each(categoryTestCases)('maps index %d to category %s', (index, expectedKey) => {
    const category = categoryFor(index);
    expect(category.key).toBe(expectedKey);
    expect(category.enLabel).toBeDefined();
    expect(category.hiLabel).toBeDefined();
    expect(category.swatchToken).toMatch(/^--color-aqi-/);
    expect(category.healthNoteEn).toBeDefined();
    expect(category.healthNoteHi).toBeDefined();
  });

  it('throws RangeError for invalid index values', () => {
    expect(() => categoryFor(-1)).toThrow(RangeError);
    expect(() => categoryFor(501)).toThrow(RangeError);
    expect(() => categoryFor(Number.NaN)).toThrow(RangeError);
    expect(() => categoryFor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('naqi - average24h', () => {
  const now = '2026-11-23T12:00:00.000Z';
  const nowMs = Date.parse(now);

  it('requires at least 16 hours for sufficiency (15 vs 16 hours)', () => {
    const createSeries = (count: number): HourlyValue[] =>
      Array.from({ length: count }, (_, i) => ({
        timeUtc: new Date(nowMs - (i + 1) * 3600000).toISOString(),
        value: 50,
      }));

    const result15 = average24h(createSeries(15), now);
    expect(result15.hoursAvailable).toBe(15);
    expect(result15.sufficient).toBe(false);
    expect(result15.value).toBeNull();

    const result16 = average24h(createSeries(16), now);
    expect(result16.hoursAvailable).toBe(16);
    expect(result16.sufficient).toBe(true);
    expect(result16.value).toBe(50);
  });

  it('ignores values older than 24h and values in future', () => {
    const values: HourlyValue[] = [
      { timeUtc: new Date(nowMs - 25 * 3600000).toISOString(), value: 100 }, // >24h old
      { timeUtc: new Date(nowMs + 1 * 3600000).toISOString(), value: 100 }, // future
      { timeUtc: new Date(nowMs - 2 * 3600000).toISOString(), value: 40 },
      { timeUtc: new Date(nowMs - 3 * 3600000).toISOString(), value: 60 },
    ];

    const result = average24h(values, now);
    expect(result.hoursAvailable).toBe(2);
    expect(result.sufficient).toBe(false);
  });

  it('skips invalid numbers (NaN, negative, infinite)', () => {
    const values: HourlyValue[] = [
      { timeUtc: new Date(nowMs - 1 * 3600000).toISOString(), value: 50 },
      { timeUtc: new Date(nowMs - 2 * 3600000).toISOString(), value: -10 },
      { timeUtc: new Date(nowMs - 3 * 3600000).toISOString(), value: Number.NaN },
      { timeUtc: new Date(nowMs - 4 * 3600000).toISOString(), value: Number.POSITIVE_INFINITY },
    ];

    const result = average24h(values, now);
    expect(result.hoursAvailable).toBe(1);
    expect(result.sufficient).toBe(false);
  });

  it('throws RangeError on invalid timestamp', () => {
    expect(() => average24h([], 'not-a-timestamp')).toThrow(RangeError);
  });
});

describe('naqi - computeNaqi', () => {
  const now = '2026-11-23T12:00:00.000Z';
  const nowMs = Date.parse(now);

  const makeHourly = (count: number, val: number): HourlyValue[] =>
    Array.from({ length: count }, (_, i) => ({
      timeUtc: new Date(nowMs - (i + 1) * 3600000).toISOString(),
      value: val,
    }));

  it('uses 24h basis when >= 16 hourly values available', () => {
    const result = computeNaqi({
      pm25: makeHourly(16, 60), // PM2.5 concentration 60 -> sub-index 100
      pm10: makeHourly(16, 50), // PM10 concentration 50 -> sub-index 50
      latest: { pm25: 15, pm10: 25 },
      nowUtc: now,
    });

    expect(result).not.toBeNull();
    expect(result?.basis).toBe('24h');
    expect(result?.value).toBe(100);
    expect(result?.dominant).toBe('pm25');
    expect(result?.category).toBe('satisfactory');
    expect(result?.subIndices.pm25).toBe(100);
    expect(result?.subIndices.pm10).toBe(50);
    expect(result?.note).toBe('Based on PM2.5 and PM10 only — indicative');
  });

  it('uses 24h basis when PM10 is dominant over PM2.5', () => {
    const result = computeNaqi({
      pm25: makeHourly(16, 30), // PM2.5 concentration 30 -> sub-index 50
      pm10: makeHourly(16, 250), // PM10 concentration 250 -> sub-index 200
      latest: {},
      nowUtc: now,
    });

    expect(result?.dominant).toBe('pm10');
    expect(result?.value).toBe(200);
    expect(result?.subIndices.pm25).toBe(50);
    expect(result?.subIndices.pm10).toBe(200);
  });

  it('uses 24h basis when only pm25 has sufficient readings', () => {
    const result = computeNaqi({
      pm25: makeHourly(18, 60),
      pm10: makeHourly(8, 50), // insufficient
      latest: { pm10: 100 },
      nowUtc: now,
    });

    expect(result?.basis).toBe('24h');
    expect(result?.dominant).toBe('pm25');
    expect(result?.value).toBe(100);
    expect(result?.subIndices.pm25).toBe(100);
    expect(result?.subIndices.pm10).toBeUndefined();
  });

  it('switches to indicative-latest basis when < 16 hourly values available', () => {
    const result = computeNaqi({
      pm25: makeHourly(10, 60),
      pm10: makeHourly(5, 50),
      latest: { pm25: 75, pm10: 175 }, // PM2.5 75 -> 150, PM10 175 -> 150
      nowUtc: now,
    });

    expect(result).not.toBeNull();
    expect(result?.basis).toBe('indicative-latest');
    expect(result?.value).toBe(150);
    expect(result?.dominant).toBe('pm25'); // tie-break to pm25
    expect(result?.category).toBe('moderate');
  });

  it('indicative-latest handles PM10 dominant', () => {
    const result = computeNaqi({
      pm25: [],
      pm10: [],
      latest: { pm25: 15, pm10: 100 }, // PM2.5 -> 25, PM10 -> 100
      nowUtc: now,
    });

    expect(result?.dominant).toBe('pm10');
    expect(result?.value).toBe(100);
  });

  it('tie-break defaults dominant pollutant to pm25', () => {
    const result = computeNaqi({
      pm25: [],
      pm10: [],
      latest: { pm25: 60, pm10: 100 }, // both sub-index 100
      nowUtc: now,
    });

    expect(result?.dominant).toBe('pm25');
    expect(result?.value).toBe(100);
  });

  it('handles pm10-only input correctly', () => {
    const result = computeNaqi({
      pm25: [],
      pm10: makeHourly(18, 250), // PM10 250 -> sub-index 200
      latest: {},
      nowUtc: now,
    });

    expect(result).not.toBeNull();
    expect(result?.basis).toBe('24h');
    expect(result?.dominant).toBe('pm10');
    expect(result?.value).toBe(200);
    expect(result?.subIndices.pm25).toBeUndefined();
    expect(result?.subIndices.pm10).toBe(200);
  });

  it('returns null when both pollutants have no valid data', () => {
    const result = computeNaqi({
      pm25: [],
      pm10: [],
      latest: {},
      nowUtc: now,
    });

    expect(result).toBeNull();
  });
});
