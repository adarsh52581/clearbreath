# ClearBreath

GenAI urban air-quality assistant for Indian families (PromptWars Virtual — Challenge 6).

## What it does

ClearBreath helps urban Indian households navigate winter smog and high-pollution episodes by combining live outdoor air data, deterministic exposure & indoor air models, and grounded Gemini explanations in English and Hindi:

- **Live air panel**: Station PM2.5/PM10 (OpenAQ v3), Indian National AQI (CPCB 2014 method), and 48-hour hourly forecast (Google Air Quality API with Open-Meteo fallback).
- **Routine planner & Family impact ledger**: Recommends cleaner forecast windows for outdoor activities, compares commute modes (inhaled PM2.5 dose, weekly CO2, vehicle-km avoided), and computes each member's usual vs. plan intake.
- **Indoor air simulator**: Instant browser-side steady-state mass-balance model for room size, window state, purifier CADR (`m³/h` ↔ `CFM`), honest potted-plants reality check, and source warnings, plus `/api/iaq/explain`.
- **Evaluator presets & uploads**: 6 household presets plus JSON household and CSV air-quality uploaders (always labelled "Uploaded — not live data").

## Live demo

<!-- Add live demo URL once deployed -->

## Demo video

<!-- Add link to product walkthrough / demo video -->

## How the numbers are made

**Golden rule: numbers from code, words from Gemini.**

Every number shown to the user is fetched from a live API in `src/server/adapters` or computed by pure, unit-tested TypeScript in `src/domain`:

1. **Indian National AQI (`src/domain/naqi.ts`)**: CPCB 2014 continuous sub-index breakpoints for PM2.5 and PM10; 24-hour average when ≥ 16 valid hourly values exist, otherwise indicative latest hour.
2. **Inhaled dose (`src/domain/exposure.ts`)**: `dose (µg) = C (µg/m³) × R (m³/h) × t (h)` using age-band and activity-intensity inhalation rates from the US EPA Exposure Factors Handbook (2011), Chapter 6, Table 6-2.
3. **Clean-window finder (`src/domain/windows.ts`)**: Scans consecutive hourly forecast points in IST (UTC+05:30) inside each activity's flexible range to find the lowest-PM2.5 window.
4. **Commute & emissions (`src/domain/commute.ts`)**: Door-to-door urban speeds and TERI (2023) Delhi per-passenger-km CO2 factors (`g CO2 / passenger-km`).
5. **Indoor steady-state model (`src/domain/indoor.ts`)**: `C_in = (P × a × C_out) / (a + k + CADR / V)`, with purifier sizing at 5 ACH (`5 × V m³/h`) and potted-plant CADR upper bound `0.023 m³/h` per plant (Cummings & Waring 2020).
6. **AI grounding (`src/server/ai/grounding.ts`, `src/web/components/GroundedText.tsx`)**: Gemini receives `{ id, label, display }` facts and pre-computed candidates, and may only reference numbers via `{{fact_id}}` placeholders. Responses with raw digits, number words, or unknown IDs are rejected and retried once, falling back to last-good cache or deterministic `fallbackPlan` / `fallbackIndoorExplanation`.

## Data sources and attribution

- **OpenAQ v3** (`https://api.openaq.org/v3`): Live station PM2.5 and PM10 measurements sourced from CPCB and state pollution control boards.
- **Google Air Quality API** (`https://airquality.googleapis.com/v1/forecast:lookup`): Primary 48-hour hourly particulate forecast.
- **Open-Meteo Air Quality (CAMS model)** (`https://air-quality-api.open-meteo.com/v1/air-quality`): Fallback 48-hour hourly forecast when Google Air Quality is unavailable or unconfigured.
- **Reference constants**: CPCB National Air Quality Index (2014); US EPA Exposure Factors Handbook (2011) Table 6-2; TERI (2023) Delhi transport emission factors; Cummings & Waring (2020) *J Expo Sci Environ Epidemiol* (potted plants CADR); Liu et al. (2003) *Environ Health Perspect* (mosquito coil PM2.5).

## Run locally

```bash
cp .env.example .env   # add GEMINI_API_KEY and OPENAQ_API_KEY
npm ci
npm run dev            # Vite on :5173 + Express API on :8080
```

## Tests

```bash
npm run check          # lint + typecheck + vitest coverage + build + bundle secret scan
```

## Deploy

Multi-stage `Dockerfile` (`node:22-slim`, non-root user `node`, port `8080`) builds `dist/web` and `dist/server` for Cloud Run (`asia-south1`).

## Assumptions and limitations

- **PM-only AQI**: Computed from PM2.5 and PM10 only (official CPCB AQI requires ≥ 3 pollutants); every AQI is labelled indicative.
- **In-vehicle exposure**: In-vehicle concentration factor is `1.0` across all commute modes (no cabin filtration credit claimed).
- **Emissions factors**: TERI CO2/km values are Delhi estimates and labelled accordingly for other cities.
- **Indoor steady-state**: Assumes well-mixed single-zone air with no indoor smoke sources; cooking without exhaust, incense, mosquito coils, and smoking indoors make the estimate a lower bound and trigger explicit warnings.
- **Not medical advice**: Health text paraphrases CPCB categories; hours outside listed activities, commutes, and `hoursIndoorsPerDay` (e.g., school/office) are not counted.

## Evaluation evidence map

| Criterion | Evidence in codebase | Tests |
| --- | --- | --- |
| **Code Quality** | Strict TypeScript, zod schemas (`src/shared/`), pure `src/domain/`, ESLint complexity ≤ 12 & function size ≤ 80 (`eslint.config.js`) | `npm run lint`, `npm run typecheck`, `src/shared/schemas.test.ts` |
| **Security** | Helmet CSP & headers (`src/server/middleware/security.ts`), 256 KB JSON limit, 415 checks, rate limits on `/api`, `sanitizeNotes` (`src/server/ai/prompts.ts`), `scripts/check-bundle-secrets.mjs` | `src/server/app.test.ts`, `src/server/routes/*.test.ts`, `src/server/ai/prompts.test.ts`, `src/server/config.test.ts` |
| **Efficiency** | Route-level `React.lazy` (`PlanView`, `IndoorSimulator`), gzip `compression()`, immutable `/assets` cache headers (`src/server/app.ts`), 5-min client `useAir` cache, 15-min/60-min server LRU caches | `npm run build` (main bundle < 200 KB gzip), `src/web/hooks/useAir.test.ts` |
| **Testing** | Co-located Vitest suites with injected fakes (`fetchFn`, `clock`, `AiClient`), coverage thresholds (85/85/80/85, `src/domain` ≥ 95% lines) | `npm run test:coverage` |
| **Accessibility** | Semantic landmarks, skip link, `aria-live`, `aria-describedby` + `aria-invalid`, keyboard flows, EN/HI `<html lang>`, SVG `<title>` + data tables | `axe-core` checks (`src/test/a11y.ts`) in web tests, WCAG contrast test (`src/web/styles.test.ts`) |
| **Problem Statement Alignment** | Live OpenAQ + forecast AQI, routine clean-window & commute optimizer, family impact ledger, indoor simulator with honest plants check, EN/HI | `src/domain/*.test.ts`, `src/server/services/*.test.ts`, `src/web/components/*.test.tsx` |
