# Architecture

## 1. Stack

- **Runtime:** Node.js 22 LTS, TypeScript 5 (strict), ES modules.
- **Server:** Express 5, helmet, express-rate-limit, compression, zod 4, lru-cache, @google/genai.
- **Web:** React 19 + Vite, Tailwind CSS v4 via `@tailwindcss/vite` (CSS-first `@theme` tokens,
  **no `tailwind.config.js`**), lucide-react icons, papaparse for CSV. Charts are hand-written SVG
  components (no chart library).
- **Tests:** Vitest + @vitest/coverage-v8, Testing Library (react, dom, user-event, jest-dom),
  jsdom, axe-core, supertest. Optional later: Playwright + @axe-core/playwright.
- **Tooling:** ESLint 9 flat config (typescript-eslint, react-hooks, jsx-a11y), Prettier, tsx
  (dev server), tsup (server build), concurrently.
- **Deploy:** one Docker container on Google Cloud Run (`asia-south1`) serving the API (`/api/*`)
  and the built web app; secrets from Secret Manager.

## 2. Dependencies (allowed list — ask before adding anything else)

- **Runtime:** express, helmet, express-rate-limit, compression, zod, lru-cache, @google/genai,
  react, react-dom, lucide-react, papaparse
- **Dev:** typescript, vite, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite, vitest,
  @vitest/coverage-v8, jsdom, @testing-library/react, @testing-library/dom,
  @testing-library/user-event, @testing-library/jest-dom, axe-core, supertest, @types/supertest,
  @types/express, @types/compression, @types/papaparse, @types/react, @types/react-dom,
  @types/node, tsx, tsup, concurrently, eslint, @eslint/js, typescript-eslint,
  eslint-plugin-react-hooks, eslint-plugin-jsx-a11y, eslint-config-prettier, globals, prettier
- **Optional (hardening step only):** @playwright/test, @axe-core/playwright
- **Not allowed:** UI kits (MUI, Chakra, shadcn), chart libraries, state libraries, axios,
  moment/dayjs (use `Intl` + `src/domain/time.ts`), dotenv (use Node's `process.loadEnvFile`),
  any AI SDK other than @google/genai.

## 3. Folder structure

```text
.
├─ AGENTS.md
├─ project-docs/                 # specs (source of truth)
├─ .agents/workflows/finish-step.md
├─ .github/workflows/ci.yml
├─ samples/                      # evaluator uploads: household JSON, air CSV (never imported by code)
├─ scripts/check-bundle-secrets.mjs
├─ src/
│  ├─ shared/                    # zod schemas + inferred types used by server and web
│  │  ├─ schemas.ts
│  │  └─ aiSchemas.ts
│  ├─ domain/                    # PURE functions only: no fetch, no Date.now(), no env, no I/O
│  │  ├─ naqi.ts  geo.ts  time.ts  exposure.ts  windows.ts  commute.ts  indoor.ts
│  │  ├─ uploadedAir.ts  facts.ts  candidates.ts  ledger.ts  fallbackPlan.ts  format.ts
│  │  └─ data/  naqiBreakpoints.ts  inhalationRates.ts  emissionFactors.ts  indoorDefaults.ts
│  │            evidence.ts  cities.ts  presets.ts
│  ├─ server/
│  │  ├─ index.ts                # reads config, starts listening
│  │  ├─ app.ts                  # createApp(deps) — used by tests with fakes
│  │  ├─ config.ts  cache.ts  errors.ts
│  │  ├─ middleware/security.ts
│  │  ├─ adapters/  http.ts  openaq.ts  googleAirQuality.ts  openMeteo.ts  __fixtures__/
│  │  ├─ services/  airService.ts  planService.ts  iaqService.ts
│  │  ├─ ai/  aiClient.ts  geminiClient.ts  prompts.ts  grounding.ts
│  │  └─ routes/  health.ts  cities.ts  air.ts  plan.ts  iaq.ts
│  ├─ web/
│  │  ├─ index.html  main.tsx  App.tsx  styles.css
│  │  ├─ api/client.ts           # typed fetch wrappers, responses validated with shared schemas
│  │  ├─ hooks/  useAir.ts  usePlan.ts
│  │  ├─ i18n/  en.ts  hi.ts  index.ts
│  │  ├─ lib/  parseUpload.ts
│  │  └─ components/ …
│  └─ test/  setup.ts  a11y.ts
├─ tests/e2e/                    # optional Playwright
├─ Dockerfile  .dockerignore  .env.example  .gitignore
├─ eslint.config.js  .prettierrc.json  tsconfig.json  vite.config.ts  vitest.config.ts  tsup.config.ts
└─ README.md
```

Tests are co-located (`foo.ts` → `foo.test.ts`). Fixtures: `src/server/adapters/__fixtures__/*.json`.
No path aliases: use relative imports.

## 4. Request flow

1. Page load → `GET /api/cities`, `GET /api/air?cityId=delhi`.
2. `airService`: OpenAQ (nearest usable station → latest + last 24 h) **in parallel with** the
   forecast (Google → Open-Meteo) → `computeNaqi` → `AirReport` (cached 15 min).
3. The user picks a preset, edits it or uploads files → `POST /api/plan`.
4. `planService`: `AirReport` (live, or built from the upload) → domain computations (windows,
   exposure, commute, indoor scenarios) → facts + candidates + ledger → Gemini (JSON) → grounding
   validator → corrective retry / last-good / deterministic fallback → `PlanResponse`.
5. The browser renders every number from `facts`. AI text is rendered by `GroundedText`, which
   replaces each `{{fact_id}}` with that fact's `display` value.
6. The indoor simulator recomputes scenarios in the browser with the same pure domain functions;
   "Explain my setup" → `POST /api/iaq/explain`.

## 5. Data contracts (zod in `src/shared`; TypeScript types inferred from zod)

### 5.1 Household profile

```ts
type AgeGroup = 'toddler' | 'child' | 'teen' | 'adult' | 'older_adult';
type Sensitivity = 'asthma' | 'copd' | 'heart' | 'pregnant';
type Intensity = 'sedentary' | 'light' | 'moderate' | 'high';
type Mode = 'walk' | 'cycle' | 'two_wheeler' | 'auto' | 'car' | 'cab' | 'bus' | 'metro';
type WindowState = 'sealed' | 'closed' | 'partly_open' | 'open';
type CookingFuel = 'lpg' | 'png' | 'induction' | 'biomass' | 'kerosene';
type Id = string; // /^[a-z0-9_]{1,16}$/  e.g. m1, a2, c1

interface Member { id: Id; label: string /* ≤24 chars */; ageGroup: AgeGroup;
  sensitivities: Sensitivity[] /* unique, ≤4 */ }
interface Activity { id: Id; label: string /* ≤40 */; memberIds: Id[] /* ≥1 */;
  kind: 'outdoor_play' | 'exercise' | 'walk' | 'errand' | 'school_run' | 'other';
  intensity: 'light' | 'moderate' | 'high'; durationMin: number /* 10–240 */;
  usualStartHour: number /* integer 0–23, IST */;
  flexible: { earliestHour: number /* 0–23 */; latestHour: number /* 1–24 */ } | null }
interface Commute { id: Id; label: string /* ≤40 */; memberIds: Id[] /* ≥1 */;
  distanceKm: number /* 0.5–60 */; currentMode: Mode; allowedModes: Mode[] /* ≥1, unique */;
  usualStartHour: number /* 0–23 */; daysPerWeek: number /* integer 1–7 */ }
interface Home { roomAreaM2: number /* 6–80 */; ceilingHeightM: number /* 2.2–4.5 */;
  windowState: WindowState; purifier: { present: boolean; cadrM3h: number /* 0–1500, 0 if absent */ };
  cookingFuel: CookingFuel; kitchenExhaust: boolean; incense: boolean; mosquitoCoil: boolean;
  smokingIndoors: boolean; hoursIndoorsPerDay: number /* 0–24 */; plantsCount: number /* 0–20 */ }
interface Constraints { budget: 'none' | 'low' | 'medium' | 'high'; rented: boolean; mobilityLimited: boolean }
interface HouseholdProfile { id: Id; title: string /* ≤60 */; description?: string /* ≤120 */;
  cityId: string; members: Member[] /* 1–8 */; activities: Activity[] /* 0–10 */;
  commutes: Commute[] /* 0–4 */; home: Home; constraints: Constraints; notes?: string /* ≤300 */ }
```

Cross-field rules (`superRefine`): ids unique per list; every `memberIds` entry exists;
`latestHour > earliestHour`; the activity duration fits inside its flexible range;
`purifier.cadrM3h === 0` when `present` is false.

### 5.2 Air data

```ts
type Freshness = 'fresh' | 'stale' | 'unavailable'; // fresh < 3 h old; stale 3–12 h; older → not used
interface SourceRef { name: string /* "OpenAQ" */; provider?: string /* "CPCB" */; url: string;
  kind: 'measured' | 'forecast' | 'uploaded'; fetchedAtUtc: string; dataTimeUtc?: string }
interface Reading { value: number; unit: 'µg/m³'; atUtc: string }
interface HourlyValue { timeUtc: string; value: number }
interface MeasuredAir { source: SourceRef;
  station: { id: number; name: string; distanceKm: number; isMonitor: boolean };
  latest: { pm25?: Reading; pm10?: Reading };
  series24h: { pm25: HourlyValue[]; pm10: HourlyValue[] }; freshness: Freshness }
interface NaqiResult { value: number; category: CategoryKey; dominant: 'pm25' | 'pm10';
  basis: '24h' | 'indicative-latest'; subIndices: { pm25?: number; pm10?: number }; note: string }
interface ForecastPoint { timeUtc: string; pm25: number | null; pm10: number | null }
interface Forecast { source: SourceRef; points: ForecastPoint[] /* next 48 h, hourly */ }
type WarningCode = 'NO_STATION' | 'STALE_STATION' | 'FORECAST_FALLBACK' | 'FORECAST_UNAVAILABLE'
  | 'INDICATIVE_AQI' | 'UPLOADED_DATA' | 'UNIT_MISMATCH';
interface AirReport { location: { label: string; lat: number; lon: number; cityId?: string };
  measured: MeasuredAir | null; naqi: NaqiResult | null; forecast: Forecast | null;
  warnings: { code: WarningCode; message: string }[]; fetchedAtUtc: string }
interface UploadedSeries { fileName: string /* ≤80 */;
  points: { timeUtc: string; pm25: number | null; pm10: number | null }[] /* 1–500; values 0–2000 */ }
```

### 5.3 Facts and candidates (details in `DOMAIN_MODEL.md` §7–§8)

```ts
type FactKind = 'measured' | 'forecast' | 'computed' | 'reference' | 'assumption' | 'guidance' | 'uploaded';
interface Fact { id: string /* /^[a-z0-9_]{3,80}$/ */; label: string; value: number | string;
  unit?: string; display: string /* localised text users see */; kind: FactKind;
  provenance: string /* e.g. "OpenAQ · CPCB station Anand Vihar" */; asOfUtc?: string }
interface Option { optionId: string; label: string /* never contains digits */; recommended: boolean;
  factIds: string[] }
interface Candidates {
  activities: { itemId: string; label: string; memberIds: string[]; options: Option[] }[];
  commutes: { itemId: string; label: string; memberIds: string[]; options: Option[] }[];
  indoor: { actionId: string; label: string; cost: 'free' | 'low' | 'medium' | 'high'; factIds: string[] }[];
  community: { actionId: string; label: string; factIds: string[] }[];
}
```

### 5.4 API

| Method and path | Request | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/health` | – | `{ status: 'ok', version, time }` | – |
| `GET /api/cities` | – | `{ cities: City[] }` | – |
| `GET /api/air` | `?cityId=` or `?lat=&lon=` | `AirReport` | 400, 422 `OUT_OF_COVERAGE`, 429, 502 (only if measured **and** forecast both failed) |
| `POST /api/plan` | `PlanRequest` | `PlanResponse` | 400, 413, 415, 422, 429, 502 |
| `POST /api/iaq/explain` | `IaqExplainRequest` | `IaqExplainResponse` | 400, 413, 415, 422 `NO_OUTDOOR_DATA`, 429 |

```ts
interface City { id: string; name: string; state: string; lat: number; lon: number; ncr: boolean }
type LocationRef = { cityId: string } | { lat: number; lon: number };
type Language = 'en' | 'hi';
interface PlanRequest { profile: HouseholdProfile; location: LocationRef; upload?: UploadedSeries; language: Language }
interface ResponseMeta { origin: 'gemini' | 'cache' | 'last-good' | 'fallback'; model?: string;
  attempts: number; generatedAtUtc: string; warnings: string[] }
interface PlanResponse { air: AirReport; facts: Fact[]; candidates: Candidates; plan: AiPlan; meta: ResponseMeta }
interface IaqExplainRequest { profile: HouseholdProfile; location: LocationRef; home: Home;
  upload?: UploadedSeries; language: Language }
interface IaqExplainResponse { facts: Fact[]; scenarios: IndoorScenario[];
  explanation: AiIndoorExplanation; meta: ResponseMeta }
```

`AiPlan` and `AiIndoorExplanation` are defined in `AI_CONTRACT.md`; `IndoorScenario` in
`DOMAIN_MODEL.md` §5.

## 6. External data sources

### 6.1 OpenAQ v3 — measured data (required)

- Base `https://api.openaq.org/v3`, header `X-API-Key: <OPENAQ_API_KEY>`. Docs: https://docs.openaq.org
- Nearest stations: `GET /locations?coordinates={lat},{lon}&radius=10000&limit=50`
  (order is **latitude,longitude**, max 4 decimals; radius in metres, max 25000). If no usable
  station, retry once with `radius=25000`.
- Usable station: has a sensor whose `parameter.name` is `pm25` or `pm10`, and its last update
  (`datetimeLast.utc`) is < 12 h old (< 3 h = fresh, 3–12 h = stale). Prefer reference monitors
  (`isMonitor === true` when present), then the nearest (haversine distance from `src/domain/geo.ts`).
- Latest values: `GET /locations/{id}/latest` → match results to sensors by `sensorsId`.
- Last 24 h for the AQI average: the hourly endpoint for each PM sensor
  (`GET /sensors/{sensorId}/hours?datetime_from=…&datetime_to=…`). Confirm the exact path and
  field names in the docs once; parse with zod `.passthrough()` and map to our types in
  `openaq.ts` only.
- Show the provider name (e.g. CPCB) and any licence attribution returned for the location.

### 6.2 Google Air Quality API — forecast (primary)

- `POST https://airquality.googleapis.com/v1/forecast:lookup`, header `X-Goog-Api-Key: <GOOGLE_MAPS_API_KEY>`.
- Body: `{ location: { latitude, longitude }, period: { startTime: <next full hour UTC>, endTime: <startTime + 47 h> }, extraComputations: ["POLLUTANT_CONCENTRATION", "LOCAL_AQI"], pageSize: 48, languageCode: "en" }`
  (`endTime` is inclusive; default page size is 24, so follow `nextPageToken` until 48 points).
- Map `hourlyForecasts[].dateTime` → `timeUtc`; `pollutants[]` with code `pm25` / `pm10` →
  `concentration.value`. Accept only µg/m³ units; otherwise drop the value and add `UNIT_MISMATCH`.
- India's default local index there is `ind_cpcb`; we still compute our own indicative AQI from the
  concentrations so every AQI in the app uses one method.
- Label: "Forecast: Google Air Quality API (model)". Follow the Air Quality API attribution policy.
- Needs billing enabled on the Cloud project (India pricing includes a monthly free usage cap).
  If `GOOGLE_MAPS_API_KEY` is empty or the call fails → Open-Meteo.

### 6.3 Open-Meteo Air Quality — forecast (fallback, no key)

- `GET https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&hourly=pm2_5,pm10&timezone=GMT&forecast_days=3`
- `hourly.time[i]` is GMT without a zone suffix → append `Z`. Keep the next 48 hourly points.
- Label: "Forecast: Open-Meteo (CAMS model)". Free for non-commercial use; attribution required.

### 6.4 Uploaded series

The browser parses CSV/JSON into `UploadedSeries`; the server re-validates it. Both use
`src/domain/uploadedAir.ts` to build an `AirReport` with source kind `uploaded` and warning
`UPLOADED_DATA`. Uploaded data is never labelled live.

## 7. Caching, timeouts and fallbacks

- `AirReport`: LRU (max 200), TTL 15 min, key `air:{lat.toFixed(2)},{lon.toFixed(2)}`.
- Upstream calls: 8 s timeout; one retry after 500 ms for timeouts and 5xx only; never retry 4xx.
- Measured chain: 10 km → 25 km → `measured: null` + `NO_STATION`. A forecast is never shown as measured.
- Forecast chain: Google → Open-Meteo (+ `FORECAST_FALLBACK`) → `forecast: null` +
  `FORECAST_UNAVAILABLE` (time-shifting is then disabled and the UI explains why).
- AI responses: cache 60 min; last-good store 24 h; deterministic fallback (see `AI_CONTRACT.md`).
- Failed loads are never cached for more than 60 s.

## 8. Security model

- Same-origin app: no CORS middleware (cross-origin browser calls are not allowed).
- helmet CSP: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'`.
  Avoid inline `style` attributes (use classes and SVG attributes) so no `unsafe-inline` is needed.
- `express.json({ limit: '256kb' })`; POST routes require `Content-Type: application/json` (else 415).
- Rate limits per IP: `/api/air` 60/min; `/api/plan` and `/api/iaq/explain` 10/min and 100/day.
  429 responses are JSON with `retryAfterSeconds`.
- `app.set('trust proxy', 1)` (Cloud Run) so limits use the client IP.
- Every input validated with zod; errors → 400 with field paths; never return stack traces or
  upstream error bodies.
- Secrets only from env (Secret Manager in production). `config.ts` fails fast in production if
  `GEMINI_API_KEY` or `OPENAQ_API_KEY` is missing.
- Gemini receives no names, coordinates, station ids or raw time series (see `AI_CONTRACT.md`).
- `scripts/check-bundle-secrets.mjs` scans `dist/web` for key patterns; CI fails if found.
- CI runs `npm audit --omit=dev --audit-level=high`.

## 9. Configuration (`.env.example`)

```bash
NODE_ENV=development
PORT=8080
APP_VERSION=dev
GEMINI_API_KEY=
# Current Flash model id from Google's Gemini API docs / AI Studio model list
GEMINI_MODEL=gemini-3.6-flash
# Optional: second model used when the main one is overloaded (503) or out of quota (429)
GEMINI_FALLBACK_MODEL=
OPENAQ_API_KEY=
# Optional: key with ONLY the Air Quality API enabled. Empty = use Open-Meteo for forecasts.
GOOGLE_MAPS_API_KEY=
FORECAST_PROVIDER=google            # google | openmeteo
# Optional Delhi-NCR banner, copied by hand from the latest CAQM order
GRAP_STAGE=
GRAP_AS_OF=
GRAP_SOURCE_URL=
```

In development, `config.ts` loads `.env` with `process.loadEnvFile('.env')` when the file exists
(built into Node 22; no dotenv).

## 10. Build, run, deploy

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite on 5173 (proxies `/api` to 8080) + API on 8080 (tsx watch) |
| `npm run build` | `vite build` → `dist/web`; `tsup` → `dist/server` |
| `npm start` | `node dist/server/index.js` (serves API + `dist/web`) |
| `npm run check` | lint + typecheck + tests with coverage + build (+ bundle secret scan) |

Docker: multi-stage build, `node:22-slim`, runs as user `node`, port 8080. Cloud Run region
`asia-south1`; secrets via `--set-secrets`.

## 11. Error model

`AppError(code, status, message, details?)`; JSON body `{ error: { code, message, details? } }`.

| Code | Status |
| --- | --- |
| `VALIDATION` | 400 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `UNSUPPORTED_MEDIA_TYPE` | 415 |
| `OUT_OF_COVERAGE`, `NO_OUTDOOR_DATA` | 422 |
| `RATE_LIMITED` | 429 |
| `UPSTREAM_UNAVAILABLE` | 502 |
| `INTERNAL` | 500 |
