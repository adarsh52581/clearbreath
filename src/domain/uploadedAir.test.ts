import { describe, it, expect } from 'vitest';
import { buildUploadedAirReport } from './uploadedAir.js';
import type { UploadedSeries } from '../shared/schemas.js';

const NOW = '2026-11-23T10:00:00Z';

const LOCATION = { label: 'Test City', lat: 28.6, lon: 77.2 };

function makeSeries(pastPoints = 10, futurePoints = 5): UploadedSeries {
  const nowMs = Date.parse(NOW);
  const past = Array.from({ length: pastPoints }, (_, i) => ({
    timeUtc: new Date(nowMs - (pastPoints - i) * 60 * 60 * 1000).toISOString(),
    pm25: 75 + i,
    pm10: 150 + i * 2,
  }));
  const future = Array.from({ length: futurePoints }, (_, i) => ({
    timeUtc: new Date(nowMs + (i + 1) * 60 * 60 * 1000).toISOString(),
    pm25: 70 - i,
    pm10: 140 - i * 2,
  }));
  return { fileName: 'test.csv', points: [...past, ...future] };
}

describe('buildUploadedAirReport', () => {
  it('source kind is "uploaded", never "measured"', () => {
    const report = buildUploadedAirReport(makeSeries(), LOCATION, NOW);
    expect(report.measured).toBeNull();
    expect(report.forecast?.source.kind).toBe('uploaded');
  });

  it('always has UPLOADED_DATA warning', () => {
    const report = buildUploadedAirReport(makeSeries(), LOCATION, NOW);
    expect(report.warnings.some((w) => w.code === 'UPLOADED_DATA')).toBe(true);
  });

  it('computes naqi from uploaded points', () => {
    const report = buildUploadedAirReport(makeSeries(20, 0), LOCATION, NOW);
    expect(report.naqi).not.toBeNull();
  });

  it('forecast = future points after nowUtc', () => {
    const report = buildUploadedAirReport(makeSeries(10, 5), LOCATION, NOW);
    expect(report.forecast).not.toBeNull();
    expect(report.forecast!.points).toHaveLength(5);
    for (const pt of report.forecast!.points) {
      expect(Date.parse(pt.timeUtc)).toBeGreaterThan(Date.parse(NOW));
    }
  });

  it('forecast is null when no future points', () => {
    const report = buildUploadedAirReport(makeSeries(10, 0), LOCATION, NOW);
    expect(report.forecast).toBeNull();
  });

  it('location is set correctly', () => {
    const report = buildUploadedAirReport(makeSeries(), LOCATION, NOW);
    expect(report.location.label).toBe('Test City');
    expect(report.location.lat).toBe(28.6);
    expect(report.location.lon).toBe(77.2);
  });
});
