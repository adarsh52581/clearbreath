import { z } from 'zod';
import { fetchJson } from './http.js';
import type { HourlyValue } from '../../shared/schemas.js';

type FetchFn = typeof fetch;

const OPENAQ_BASE = 'https://api.openaq.org/v3';

// --- Zod schemas (passthrough keeps unknown fields; we map only what we need) ---

const coordinatesSchema = z
  .object({ latitude: z.number(), longitude: z.number() })
  .passthrough();

const parameterSchema = z
  .object({ name: z.string(), units: z.string() })
  .passthrough();

const sensorRefSchema = z.object({ id: z.number(), name: z.string(), parameter: parameterSchema }).passthrough();

const datetimeSchema = z.object({ utc: z.string() }).passthrough();

const ownerSchema = z.object({ name: z.string() }).passthrough();
const providerSchema = z.object({ name: z.string() }).passthrough();

const attributionItemSchema = z.object({ name: z.string(), url: z.string().optional() }).passthrough();

const locationSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    isMonitor: z.boolean().default(false),
    coordinates: coordinatesSchema,
    datetimeLast: datetimeSchema.nullable().optional(),
    sensors: z.array(sensorRefSchema).default([]),
    owner: ownerSchema.optional(),
    provider: providerSchema.optional(),
    attribution: z.array(attributionItemSchema).default([]),
  })
  .passthrough();

const locationsResponseSchema = z
  .object({ results: z.array(locationSchema) })
  .passthrough();

const latestResultSchema = z
  .object({
    sensorsId: z.number(),
    value: z.number(),
    parameter: parameterSchema,
    datetime: datetimeSchema,
  })
  .passthrough();

const latestResponseSchema = z
  .object({ results: z.array(latestResultSchema) })
  .passthrough();

const hourlyResultSchema = z
  .object({
    value: z.number(),
    parameter: parameterSchema,
    period: z.object({ datetimeFrom: datetimeSchema }).passthrough(),
  })
  .passthrough();

const hoursResponseSchema = z
  .object({ results: z.array(hourlyResultSchema) })
  .passthrough();

// --- Exported types ---

export interface OpenAqStation {
  id: number;
  name: string;
  isMonitor: boolean;
  lat: number;
  lon: number;
  lastUpdatedUtc: string;
  sensors: Array<{ id: number; parameterName: string }>;
  provider: string;
  attribution: Array<{ name: string; url?: string }>;
}

export interface OpenAqLatest {
  pm25?: { value: number; atUtc: string };
  pm10?: { value: number; atUtc: string };
}

export interface OpenAqAdapter {
  findStations(lat: number, lon: number, radiusM: number): Promise<OpenAqStation[]>;
  getLatest(locationId: number): Promise<OpenAqLatest>;
  getHours(sensorId: number, fromUtc: string, toUtc: string): Promise<HourlyValue[]>;
}

// --- Adapter factory ---

export function createOpenAqAdapter({
  apiKey,
  fetchFn = fetch,
}: {
  apiKey: string;
  fetchFn?: FetchFn;
}): OpenAqAdapter {
  const headers: Record<string, string> = { 'X-API-Key': apiKey };

  function roundCoord(n: number): string {
    return n.toFixed(4);
  }

  async function findStations(lat: number, lon: number, radiusM: number): Promise<OpenAqStation[]> {
    const coords = `${roundCoord(lat)},${roundCoord(lon)}`;
    const url = `${OPENAQ_BASE}/locations?coordinates=${coords}&radius=${radiusM}&limit=50`;
    const raw = await fetchJson<unknown>(url, { headers }, { fetchFn });
    const parsed = locationsResponseSchema.parse(raw);
    return parsed.results.map((loc) => ({
      id: loc.id,
      name: loc.name,
      isMonitor: loc.isMonitor,
      lat: loc.coordinates.latitude,
      lon: loc.coordinates.longitude,
      lastUpdatedUtc: loc.datetimeLast?.utc ?? '',
      sensors: loc.sensors.map((s) => ({ id: s.id, parameterName: s.parameter.name })),
      provider: loc.provider?.name ?? loc.owner?.name ?? 'Unknown',
      attribution: loc.attribution,
    }));
  }

  async function getLatest(locationId: number): Promise<OpenAqLatest> {
    const url = `${OPENAQ_BASE}/locations/${locationId}/latest`;
    const raw = await fetchJson<unknown>(url, { headers }, { fetchFn });
    const parsed = latestResponseSchema.parse(raw);
    const result: OpenAqLatest = {};
    for (const item of parsed.results) {
      const pName = item.parameter.name;
      if (pName === 'pm25') {
        result.pm25 = { value: item.value, atUtc: item.datetime.utc };
      } else if (pName === 'pm10') {
        result.pm10 = { value: item.value, atUtc: item.datetime.utc };
      }
    }
    return result;
  }

  async function getHours(sensorId: number, fromUtc: string, toUtc: string): Promise<HourlyValue[]> {
    const url =
      `${OPENAQ_BASE}/sensors/${sensorId}/hours` +
      `?datetime_from=${encodeURIComponent(fromUtc)}&datetime_to=${encodeURIComponent(toUtc)}`;
    const raw = await fetchJson<unknown>(url, { headers }, { fetchFn });
    const parsed = hoursResponseSchema.parse(raw);
    return parsed.results.map((item) => ({
      timeUtc: item.period.datetimeFrom.utc,
      value: item.value,
    }));
  }

  return { findStations, getLatest, getHours };
}
