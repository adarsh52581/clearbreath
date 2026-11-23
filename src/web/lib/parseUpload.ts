import Papa from 'papaparse';
import {
  householdProfileSchema,
  type HouseholdProfile,
  type UploadedSeries,
} from '../../shared/schemas.js';

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const MAX_JSON_BYTES = 100 * 1024; // 100 KB
const MAX_CSV_BYTES = 500 * 1024; // 500 KB
const MAX_CSV_ROWS = 500;
const MAX_ROW_ERRORS = 20;
const MAX_INVALID_RATIO = 0.1; // 10%

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

function isValidIsoTimestamp(str: string): boolean {
  if (typeof str !== 'string' || !str) return false;
  const isoPattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i;
  if (!isoPattern.test(str)) return false;
  const d = new Date(str);
  return !Number.isNaN(d.getTime());
}

/**
 * Parses and validates a JSON string as a HouseholdProfile.
 * Enforces size <= 100 KB and strips BOM.
 */
export function parseHouseholdJson(text: string): ParseResult<HouseholdProfile> {
  const clean = stripBom(text);
  const bytes = new TextEncoder().encode(clean).length;
  if (bytes > MAX_JSON_BYTES) {
    return {
      ok: false,
      errors: [`File size (${Math.round(bytes / 1024)} KB) exceeds 100 KB limit.`],
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(clean);
  } catch (err) {
    return {
      ok: false,
      errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const result = householdProfileSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    return { ok: false, errors };
  }

  return { ok: true, value: result.data };
}

interface RowValidationResult {
  valid: boolean;
  point?: { timeUtc: string; pm25: number; pm10: number | null };
  errors: string[];
}

function parsePollutant(
  rawVal: string | undefined,
  name: string,
  rowNumber: number,
  required: boolean
): { value: number | null; error?: string } {
  const trimmed = rawVal?.trim();
  if (!trimmed) {
    return required
      ? { value: null, error: `Row ${rowNumber}: missing ${name} value.` }
      : { value: null };
  }
  const val = Number(trimmed);
  if (Number.isNaN(val)) {
    return { value: null, error: `Row ${rowNumber}: ${name} must be a number, got "${trimmed}".` };
  }
  if (val < 0) {
    return { value: null, error: `Row ${rowNumber}: negative ${name} value (${val}). Must be >= 0.` };
  }
  if (val > 2000) {
    return { value: null, error: `Row ${rowNumber}: ${name} value (${val}) exceeds 2000 µg/m³ cap.` };
  }
  return { value: val };
}

function validateRow(
  row: Record<string, string>,
  rowNumber: number,
  timeKey: string,
  pm25Key: string,
  pm10Key?: string
): RowValidationResult {
  const errors: string[] = [];

  const rawTime = row[timeKey]?.trim();
  if (!rawTime || !isValidIsoTimestamp(rawTime)) {
    errors.push(`Row ${rowNumber}: invalid ISO timestamp "${rawTime ?? ''}".`);
  }

  const pm25Res = parsePollutant(row[pm25Key], 'PM2.5', rowNumber, true);
  if (pm25Res.error) errors.push(pm25Res.error);

  const pm10Res = pm10Key
    ? parsePollutant(row[pm10Key], 'PM10', rowNumber, false)
    : { value: null };
  if (pm10Res.error) errors.push(pm10Res.error);

  if (errors.length > 0 || pm25Res.value === null || !rawTime) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    point: {
      timeUtc: new Date(rawTime).toISOString(),
      pm25: pm25Res.value,
      pm10: pm10Res.value,
    },
    errors: [],
  };
}

function findHeaderKeys(firstRow: Record<string, string>): {
  timeKey?: string;
  pm25Key?: string;
  pm10Key?: string;
} {
  const headers = Object.keys(firstRow);
  return {
    timeKey: headers.find((h) => h === 'timestamp' || h === 'time_utc' || h === 'time'),
    pm25Key: headers.find((h) => h === 'pm25' || h === 'pm2.5' || h === 'pm_25'),
    pm10Key: headers.find((h) => h === 'pm10' || h === 'pm_10'),
  };
}

function validateCsvLimits(
  bytes: number,
  rows: Record<string, string>[]
): { error?: string } {
  if (bytes > MAX_CSV_BYTES) {
    return { error: `File size (${Math.round(bytes / 1024)} KB) exceeds 500 KB limit.` };
  }
  if (rows.length === 0) {
    return { error: 'CSV file contains no data rows.' };
  }
  if (rows.length > MAX_CSV_ROWS) {
    return { error: `CSV row count (${rows.length}) exceeds 500 rows limit.` };
  }
  return {};
}

function processRows(
  rows: Record<string, string>[],
  timeKey: string,
  pm25Key: string,
  pm10Key?: string
): {
  validPoints: Array<{ timeUtc: string; pm25: number; pm10: number | null }>;
  rowErrors: string[];
  invalidCount: number;
} {
  const rowErrors: string[] = [];
  const validPoints: Array<{ timeUtc: string; pm25: number; pm10: number | null }> = [];
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const res = validateRow(row, i + 2, timeKey, pm25Key, pm10Key);
    if (res.valid && res.point) {
      validPoints.push(res.point);
    } else {
      invalidCount++;
      if (rowErrors.length < MAX_ROW_ERRORS) {
        rowErrors.push(...res.errors);
      }
    }
  }

  return { validPoints, rowErrors, invalidCount };
}

/**
 * Parses and validates an air quality CSV string.
 * Uses PapaParse with header: true, skipEmptyLines: true, and case-insensitive headers.
 * Limits: <= 500 KB, <= 500 rows, rejects if > 10% of rows are invalid.
 */
export function parseAirCsv(text: string, fileName: string): ParseResult<UploadedSeries> {
  const clean = stripBom(text);
  const bytes = new TextEncoder().encode(clean).length;

  const parsed = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  const rows = parsed.data;
  const limitCheck = validateCsvLimits(bytes, rows);
  if (limitCheck.error) {
    return { ok: false, errors: [limitCheck.error] };
  }

  const { timeKey, pm25Key, pm10Key } = findHeaderKeys(rows[0] ?? {});
  if (!timeKey || !pm25Key) {
    const missing: string[] = [];
    if (!timeKey) missing.push('Missing required column: "timestamp"');
    if (!pm25Key) missing.push('Missing required column: "pm25"');
    return { ok: false, errors: missing };
  }

  const { validPoints, rowErrors, invalidCount } = processRows(rows, timeKey, pm25Key, pm10Key);
  const invalidRatio = invalidCount / rows.length;
  if (invalidRatio > MAX_INVALID_RATIO) {
    const pct = Math.round(invalidRatio * 100);
    return {
      ok: false,
      errors: [
        `File rejected: ${invalidCount} of ${rows.length} rows (${pct}%) are invalid (threshold is 10%).`,
        ...rowErrors.slice(0, MAX_ROW_ERRORS),
      ],
    };
  }

  return {
    ok: true,
    value: {
      fileName: fileName.slice(0, 80),
      points: validPoints,
    },
  };
}
