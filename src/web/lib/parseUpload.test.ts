import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseHouseholdJson, parseAirCsv } from './parseUpload.js';
import { uploadedSeriesSchema } from '../../shared/schemas.js';

const SAMPLES_DIR = path.resolve(process.cwd(), 'samples');

describe('parseUpload - parseHouseholdJson', () => {
  it('parses valid household sample file (household-custom.json)', () => {
    const filePath = path.join(SAMPLES_DIR, 'household-custom.json');
    const content = fs.readFileSync(filePath, 'utf-8');

    const result = parseHouseholdJson(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.id).toBe('chennai-custom-home');
    expect(result.value.cityId).toBe('chennai');
    expect(result.value.members).toHaveLength(3);
    expect(result.value.activities).toHaveLength(1);
    expect(result.value.commutes).toHaveLength(1);
  });

  it('rejects invalid household sample file (household-invalid.json)', () => {
    const filePath = path.join(SAMPLES_DIR, 'household-invalid.json');
    const content = fs.readFileSync(filePath, 'utf-8');

    const result = parseHouseholdJson(content);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.toLowerCase().includes('id'))).toBe(true);
  });

  it('rejects JSON exceeding 100 KB limit', () => {
    // Generate valid JSON structure that exceeds 100 KB
    const largeNotes = 'x'.repeat(101 * 1024);
    const text = JSON.stringify({ notes: largeNotes });

    const result = parseHouseholdJson(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors[0]).toContain('100 KB limit');
  });

  it('rejects non-JSON text', () => {
    const text = 'not a valid json { broken: true ';
    const result = parseHouseholdJson(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors[0]).toContain('Invalid JSON');
  });

  it('strips UTF-8 BOM before parsing JSON', () => {
    const validJson = JSON.stringify({
      id: 'bom_profile',
      title: 'BOM Test Profile',
      cityId: 'delhi',
      members: [{ id: 'm1', label: 'Person', ageGroup: 'adult', sensitivities: [] }],
      activities: [],
      commutes: [],
      home: {
        roomAreaM2: 20,
        ceilingHeightM: 2.8,
        windowState: 'closed',
        purifier: { present: false, cadrM3h: 0 },
        cookingFuel: 'png',
        kitchenExhaust: true,
        incense: false,
        mosquitoCoil: false,
        smokingIndoors: false,
        hoursIndoorsPerDay: 16,
        plantsCount: 0,
      },
      constraints: { budget: 'low', rented: false, mobilityLimited: false },
    });
    const withBom = '\uFEFF' + validJson;

    const result = parseHouseholdJson(withBom);
    expect(result.ok).toBe(true);
  });
});

describe('parseUpload - parseAirCsv', () => {
  it('parses air-severe-episode.csv (48 hourly rows, pm25 300-480, pm10 400-600)', () => {
    const filePath = path.join(SAMPLES_DIR, 'air-severe-episode.csv');
    const content = fs.readFileSync(filePath, 'utf-8');

    const result = parseAirCsv(content, 'air-severe-episode.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.fileName).toBe('air-severe-episode.csv');
    expect(result.value.points).toHaveLength(48);

    for (const pt of result.value.points) {
      expect(pt.pm25).toBeGreaterThanOrEqual(300);
      expect(pt.pm25).toBeLessThanOrEqual(480);
      expect(pt.pm10).not.toBeNull();
      expect(pt.pm10!).toBeGreaterThanOrEqual(400);
      expect(pt.pm10!).toBeLessThanOrEqual(600);
      expect(pt.timeUtc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }

    // Passes uploadedSeriesSchema
    expect(() => uploadedSeriesSchema.parse(result.value)).not.toThrow();
  });

  it('parses air-clean-day.csv (48 rows, pm25 12-35, pm10 30-80)', () => {
    const filePath = path.join(SAMPLES_DIR, 'air-clean-day.csv');
    const content = fs.readFileSync(filePath, 'utf-8');

    const result = parseAirCsv(content, 'air-clean-day.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.points).toHaveLength(48);
    for (const pt of result.value.points) {
      expect(pt.pm25).toBeGreaterThanOrEqual(12);
      expect(pt.pm25).toBeLessThanOrEqual(35);
      expect(pt.pm10!).toBeGreaterThanOrEqual(30);
      expect(pt.pm10!).toBeLessThanOrEqual(80);
    }

    expect(() => uploadedSeriesSchema.parse(result.value)).not.toThrow();
  });

  it('parses air-malformed.csv and reports negative values with row numbers and >10% rejection', () => {
    const filePath = path.join(SAMPLES_DIR, 'air-malformed.csv');
    const content = fs.readFileSync(filePath, 'utf-8');

    const result = parseAirCsv(content, 'air-malformed.csv');
    expect(result.ok).toBe(false);
    if (result.ok) return;

    // Must be rejected because > 10% invalid rows (2 of 8 = 25%)
    expect(result.errors.some((e) => e.includes('10%'))).toBe(true);

    // Negative value reported with row number (Row 2 in file line)
    const negativeError = result.errors.find((e) => e.includes('negative') && e.includes('Row 2'));
    expect(negativeError).toBeDefined();

    // Invalid timestamp reported with row number (Row 3)
    const timestampError = result.errors.find(
      (e) => e.includes('invalid ISO timestamp') && e.includes('Row 3')
    );
    expect(timestampError).toBeDefined();
  });

  it('strips UTF-8 BOM from CSV content', () => {
    const csvWithBom = '\uFEFFtimestamp,pm25,pm10\n2026-11-20T00:00:00Z,45,80\n';
    const result = parseAirCsv(csvWithBom, 'bom.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toHaveLength(1);
    const firstPoint = result.value.points[0];
    expect(firstPoint).toBeDefined();
    expect(firstPoint?.pm25).toBe(45);
  });

  it('parses case-insensitive headers (upper case and mixed case)', () => {
    const csv = 'TIMESTAMP,PM25,PM10\n2026-11-20T00:00:00Z,50,90\n2026-11-20T01:00:00Z,60,110\n';
    const result = parseAirCsv(csv, 'caps.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toHaveLength(2);
    const firstPoint = result.value.points[0];
    expect(firstPoint).toBeDefined();
    expect(firstPoint?.pm25).toBe(50);
  });

  it('ignores extra columns in CSV', () => {
    const csv =
      'timestamp,pm25,pm10,extra_notes,confidence\n2026-11-20T00:00:00Z,50,90,Sensor reading,high\n';
    const result = parseAirCsv(csv, 'extra.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toHaveLength(1);
    const firstPoint = result.value.points[0];
    expect(firstPoint).toBeDefined();
    expect(firstPoint?.pm25).toBe(50);
  });

  it('rejects CSV exceeding 500 rows limit (501 rows rejected)', () => {
    const header = 'timestamp,pm25,pm10\n';
    const rows = Array.from(
      { length: 501 },
      (_, i) => `2026-11-20T00:00:00Z,${(i % 100) + 10},${(i % 100) + 20}\n`
    ).join('');
    const csv = header + rows;

    const result = parseAirCsv(csv, 'large.csv');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('500 rows limit'))).toBe(true);
  });

  it('rejects file when more than 10% of rows are invalid', () => {
    // 10 rows: 2 invalid (20% > 10%)
    const header = 'timestamp,pm25,pm10\n';
    const validRows = Array.from(
      { length: 8 },
      (_, i) => `2026-11-20T0${i}:00:00Z,50,100\n`
    ).join('');
    const invalidRows = '2026-11-20T08:00:00Z,-10,100\n2026-11-20T09:00:00Z,invalid_num,100\n';
    const csv = header + validRows + invalidRows;

    const result = parseAirCsv(csv, 'invalid_ratio.csv');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('10%'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Row 10') && e.includes('negative'))).toBe(true);
  });

  it('accepts file when invalid rows are <= 10% (drops invalid row, returns valid ones)', () => {
    // 20 rows: 1 invalid (5% <= 10%)
    const header = 'timestamp,pm25,pm10\n';
    const validRows = Array.from(
      { length: 19 },
      (_, i) => `2026-11-20T${String(i).padStart(2, '0')}:00:00Z,50,100\n`
    ).join('');
    const invalidRow = '2026-11-20T20:00:00Z,-10,100\n';
    const csv = header + validRows + invalidRow;

    const result = parseAirCsv(csv, 'mild_errors.csv');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.points).toHaveLength(19);
  });

  it('rejects CSV with missing required columns', () => {
    const noPm25 = 'timestamp,pm10\n2026-11-20T00:00:00Z,80\n';
    const result1 = parseAirCsv(noPm25, 'no_pm25.csv');
    expect(result1.ok).toBe(false);
    if (!result1.ok) {
      expect(result1.errors[0]).toContain('pm25');
    }

    const noTime = 'pm25,pm10\n50,80\n';
    const result2 = parseAirCsv(noTime, 'no_time.csv');
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.errors[0]).toContain('timestamp');
    }
  });

  it('rejects CSV with empty content or no data rows', () => {
    const emptyHeader = 'timestamp,pm25,pm10\n';
    const result = parseAirCsv(emptyHeader, 'empty.csv');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('no data rows');
    }
  });

  it('rejects CSV exceeding 500 KB limit', () => {
    const bigString = 'timestamp,pm25,pm10\n' + '2026-11-20T00:00:00Z,50,90,'.padEnd(505 * 1024, 'x');
    const result = parseAirCsv(bigString, 'huge.csv');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('500 KB limit');
    }
  });
});
