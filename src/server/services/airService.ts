import { haversineKm } from '../../domain/geo.js';
import { computeNaqi } from '../../domain/naqi.js';
import type { OpenAqAdapter, OpenAqStation } from '../adapters/openaq.js';
import type { GoogleAqAdapter } from '../adapters/googleAirQuality.js';
import type { OpenMeteoAdapter } from '../adapters/openMeteo.js';
import type { TypedCache } from '../cache.js';
import type {
  AirReport,
  MeasuredAir,
  Forecast,
  WarningCode,
} from '../../shared/schemas.js';

const AIR_TTL_MS = 15 * 60 * 1000;
const FRESH_MS = 3 * 60 * 60 * 1000;
const STALE_MAX_MS = 12 * 60 * 60 * 1000;

export interface AirServiceDeps {
  openaq: OpenAqAdapter;
  google?: GoogleAqAdapter;
  openMeteo: OpenMeteoAdapter;
  cache: TypedCache<AirReport>;
  clock: () => string;
}

export interface AirQuery {
  lat: number;
  lon: number;
  label: string;
  cityId?: string;
}

export interface AirService {
  getAirReport(query: AirQuery): Promise<AirReport>;
}

type Warning = { code: WarningCode; message: string };

function getFreshness(lastUtc: string, nowMs: number): 'fresh' | 'stale' | 'unavailable' {
  const ageMs = nowMs - Date.parse(lastUtc);
  if (ageMs < FRESH_MS) return 'fresh';
  if (ageMs < STALE_MAX_MS) return 'stale';
  return 'unavailable';
}

function isUsable(station: OpenAqStation, nowMs: number): boolean {
  const hasPm = station.sensors.some((s) => s.parameterName === 'pm25' || s.parameterName === 'pm10');
  return hasPm && getFreshness(station.lastUpdatedUtc, nowMs) !== 'unavailable';
}

function pickBestStation(
  stations: OpenAqStation[],
  origin: { lat: number; lon: number },
  nowMs: number,
): OpenAqStation | null {
  const candidates = stations
    .filter((s) => isUsable(s, nowMs))
    .map((s) => ({ station: s, dist: haversineKm(origin, { lat: s.lat, lon: s.lon }) }));
  if (candidates.length === 0) return null;
  const monitors = candidates.filter((c) => c.station.isMonitor);
  const pool = monitors.length > 0 ? monitors : candidates;
  pool.sort((a, b) => a.dist - b.dist);
  return pool[0]!.station;
}

async function findNearestStation(
  openaq: OpenAqAdapter,
  lat: number,
  lon: number,
  nowMs: number,
): Promise<OpenAqStation | null> {
  for (const radius of [10_000, 25_000]) {
    const stations = await openaq.findStations(lat, lon, radius);
    const best = pickBestStation(stations, { lat, lon }, nowMs);
    if (best) return best;
  }
  return null;
}

async function fetchSeries(
  openaq: OpenAqAdapter,
  station: OpenAqStation,
  fromUtc: string,
  nowUtc: string,
): Promise<{ pm25: { timeUtc: string; value: number }[]; pm10: { timeUtc: string; value: number }[] }> {
  const pm25Sensor = station.sensors.find((s) => s.parameterName === 'pm25');
  const pm10Sensor = station.sensors.find((s) => s.parameterName === 'pm10');
  const [pm25Result, pm10Result] = await Promise.allSettled([
    pm25Sensor ? openaq.getHours(pm25Sensor.id, fromUtc, nowUtc) : Promise.resolve([]),
    pm10Sensor ? openaq.getHours(pm10Sensor.id, fromUtc, nowUtc) : Promise.resolve([]),
  ]);
  return {
    pm25: pm25Result.status === 'fulfilled' ? pm25Result.value : [],
    pm10: pm10Result.status === 'fulfilled' ? pm10Result.value : [],
  };
}

async function fetchMeasured(
  openaq: OpenAqAdapter,
  lat: number,
  lon: number,
  nowUtc: string,
): Promise<{ measured: MeasuredAir; warnings: Warning[] } | null> {
  const nowMs = Date.parse(nowUtc);
  const station = await findNearestStation(openaq, lat, lon, nowMs);
  if (!station) return null;

  const warnings: Warning[] = [];
  const distanceKm = haversineKm({ lat, lon }, { lat: station.lat, lon: station.lon });
  const freshness = getFreshness(station.lastUpdatedUtc, nowMs);
  if (freshness === 'stale') {
    warnings.push({ code: 'STALE_STATION', message: 'Station data is 3–12 h old.' });
  }

  const from24h = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const [latestResult, series] = await Promise.all([
    openaq.getLatest(station.id).catch(() => ({})),
    fetchSeries(openaq, station, from24h, nowUtc),
  ]);

  const latest = latestResult as Awaited<ReturnType<typeof openaq.getLatest>>;
  const totalHours = series.pm25.length + series.pm10.length;
  if (totalHours > 0 && totalHours < 16) {
    warnings.push({ code: 'INDICATIVE_AQI', message: 'Fewer than 16 hourly values; AQI is indicative.' });
  }

  const attrUrl = station.attribution[0]?.url ?? `https://openaq.org/locations/${station.id}`;
  const measured: MeasuredAir = {
    source: {
      name: 'OpenAQ',
      provider: station.provider,
      url: attrUrl,
      kind: 'measured',
      fetchedAtUtc: nowUtc,
      dataTimeUtc: station.lastUpdatedUtc,
    },
    station: { id: station.id, name: station.name, distanceKm, isMonitor: station.isMonitor },
    latest: {
      pm25: latest.pm25 ? { value: latest.pm25.value, unit: 'µg/m³', atUtc: latest.pm25.atUtc } : undefined,
      pm10: latest.pm10 ? { value: latest.pm10.value, unit: 'µg/m³', atUtc: latest.pm10.atUtc } : undefined,
    },
    series24h: series,
    freshness,
  };
  return { measured, warnings };
}

async function tryGoogle(
  google: GoogleAqAdapter,
  lat: number,
  lon: number,
  nowUtc: string,
): Promise<{ forecast: Forecast; warnings: Warning[] }> {
  const result = await google.forecast48h(lat, lon, nowUtc);
  const warnings: Warning[] = [];
  if (result.hadUnitMismatch) {
    warnings.push({ code: 'UNIT_MISMATCH', message: 'Some forecast values had unexpected units and were dropped.' });
  }
  return {
    forecast: {
      source: {
        name: 'Forecast: Google Air Quality API (model)',
        kind: 'forecast',
        fetchedAtUtc: nowUtc,
        url: 'https://developers.google.com/maps/documentation/air-quality',
      },
      points: result.points,
    },
    warnings,
  };
}

async function fetchForecast(
  google: GoogleAqAdapter | undefined,
  openMeteo: OpenMeteoAdapter,
  lat: number,
  lon: number,
  nowUtc: string,
): Promise<{ forecast: Forecast; warnings: Warning[] }> {
  const warnings: Warning[] = [];

  if (google) {
    try {
      return await tryGoogle(google, lat, lon, nowUtc);
    } catch {
      warnings.push({ code: 'FORECAST_FALLBACK', message: 'Google Air Quality unavailable; using Open-Meteo.' });
    }
  }

  const points = await openMeteo.forecast48h(lat, lon, nowUtc);
  return {
    forecast: {
      source: {
        name: 'Forecast: Open-Meteo (CAMS model)',
        kind: 'forecast',
        fetchedAtUtc: nowUtc,
        url: 'https://open-meteo.com',
      },
      points,
    },
    warnings,
  };
}

export function createAirService({
  openaq,
  google,
  openMeteo,
  cache,
  clock,
}: AirServiceDeps): AirService {
  async function getAirReport({ lat, lon, label, cityId }: AirQuery): Promise<AirReport> {
    const cacheKey = `air:${lat.toFixed(2)},${lon.toFixed(2)}`;

    return cache.getOrSet(cacheKey, AIR_TTL_MS, async () => {
      const nowUtc = clock();
      const warnings: Warning[] = [];

      const [measuredResult, forecastResult] = await Promise.allSettled([
        fetchMeasured(openaq, lat, lon, nowUtc),
        fetchForecast(google, openMeteo, lat, lon, nowUtc),
      ]);

      let measured: MeasuredAir | null = null;
      if (measuredResult.status === 'fulfilled') {
        if (measuredResult.value === null) {
          warnings.push({ code: 'NO_STATION', message: 'No usable monitoring station found within 25 km.' });
        } else {
          measured = measuredResult.value.measured;
          warnings.push(...measuredResult.value.warnings);
        }
      } else {
        warnings.push({ code: 'NO_STATION', message: 'Could not reach measurement provider.' });
      }

      let forecast: Forecast | null = null;
      if (forecastResult.status === 'fulfilled') {
        forecast = forecastResult.value.forecast;
        warnings.push(...forecastResult.value.warnings);
      } else {
        warnings.push({ code: 'FORECAST_UNAVAILABLE', message: 'All forecast providers failed.' });
      }

      const latestPm25 = measured?.latest.pm25?.value;
      const latestPm10 = measured?.latest.pm10?.value;
      const naqi = measured
        ? computeNaqi({
            pm25: measured.series24h.pm25,
            pm10: measured.series24h.pm10,
            latest: { pm25: latestPm25, pm10: latestPm10 },
            nowUtc,
          })
        : null;

      if (naqi?.basis === 'indicative-latest' && !warnings.some((w) => w.code === 'INDICATIVE_AQI')) {
        warnings.push({ code: 'INDICATIVE_AQI', message: 'Fewer than 16 hourly values; AQI is indicative.' });
      }

      return { location: { label, lat, lon, cityId }, measured, naqi, forecast, warnings, fetchedAtUtc: nowUtc };
    });
  }

  return { getAirReport };
}
