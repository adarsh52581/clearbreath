# Feature log

Evidence of spec-driven, AI-assisted development (useful for the judges, the README and the
LinkedIn post). The agent appends one row per step via `/finish-step`; humans add notes.

## Build log

| Step | Date | What was built | Key files | Tests added / total | Line coverage | Known gaps |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 2026-11-23 | Spec pack: rules + project docs written before any code | `AGENTS.md`, `project-docs/*` | – | – | – |
| 1 | 2026-11-23 | Repository scaffold, Express 5 foundation, React 19 shell, Tailwind v4, CI, Docker | `package.json`, `src/server/app.ts`, `src/web/App.tsx`, `Dockerfile` | 17 / 17 | 93.62% | None (foundation step) |
| 2 | 2026-11-23 | CPCB Indian National AQI engine, breakpoints, 24-h averaging, haversine | `src/domain/data/naqiBreakpoints.ts`, `src/domain/naqi.ts`, `src/domain/geo.ts` | 54 / 71 | 97.39% (naqi.ts: 98.01% lines, 98.21% branches) | None |
| 3 | 2026-11-23 | Exposure dose, IST time, clean-window finder, commute comparison & emissions | `src/shared/schemas.ts`, `src/domain/time.ts`, `src/domain/exposure.ts`, `src/domain/windows.ts`, `src/domain/commute.ts` | 88 / 159 | 98.73% (src/domain: 99.08% lines, src/shared: 100% lines) | None |
| 4 | 2026-11-23 | Indoor air engine: steady-state mass balance, purifier sizing, plant CADR (evidence-based), scenarios, source warnings | `src/domain/data/indoorDefaults.ts`, `src/domain/data/evidence.ts`, `src/domain/indoor.ts`, `src/domain/indoor.test.ts`, `src/shared/schemas.ts` | 36 / 195 | 100% lines, 83.67% branches (indoor.ts); global 92.14% lines | Branch coverage for rare NaN paths in edge loops |
| 5 | 2026-11-23 | Live data adapters (OpenAQ v3, Google Air Quality, Open-Meteo), LRU cache, airService with station selection/freshness/fallback chain, uploadedAir domain function, cities data, /api/cities and /api/air routes with rate-limit | `src/server/adapters/http.ts`, `openaq.ts`, `googleAirQuality.ts`, `openMeteo.ts`, `src/server/cache.ts`, `src/server/services/airService.ts`, `src/domain/data/cities.ts`, `src/domain/uploadedAir.ts`, `src/server/routes/cities.ts`, `src/server/routes/air.ts`, `src/shared/schemas.ts` (+AirReport/City/UploadedSeries) | 41 / 236 | 93.69% lines, 89.89% branches, 96.47% functions (global) | cache.ts branch coverage 71% (error-entry path not hit in routes test); airService 80.95% branches (some fallback sub-paths) |
| 6 | 2026-11-23 | Six Household presets, evaluator upload samples (JSON/CSV), browser upload parser (PapaParse) with limits and BOM handling | `src/domain/data/presets.ts`, `src/web/lib/parseUpload.ts`, `src/shared/schemas.ts`, `samples/*` | 25 / 261 | 94.87% lines, 89.21% branches, 96.87% functions (global) | None |

## Prompt evolution notes

Record what had to change in a prompt and why (this is the "how prompts evolved" story).

- Step 0: Decided on "numbers from code, words from Gemini" with `{{fact_id}}` placeholders so the
  model can never originate a figure.

## Submissions

| Attempt | Date | Commit | Live URL version | AI evaluation score | Main fixes after it |
| --- | --- | --- | --- | --- | --- |
