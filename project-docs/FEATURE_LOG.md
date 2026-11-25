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
| 8 | 2026-11-24 | UI shell, typed API client, 5-min cached useAir hook, en/hi i18n with LanguageToggle, LocationPicker with geolocation, SourceBadge, AqiCard, PollutantTable, 48-h SVG ForecastChart, StatusViews | `src/web/api/client.ts`, `src/web/hooks/useAir.ts`, `src/web/i18n/*`, `src/web/components/*`, `src/web/App.tsx` | 28 / 331 | 95.67% lines, 84.71% branches, 98.46% functions (global) | Visual check in dev server at desktop & 375 px |
| 9 | 2026-11-25 | HouseholdPanel (6 presets, editable summary, notes counter, JSON/CSV uploads), usePlan hook, GroundedText, lazy-loaded PlanView (origin badge, routine cards, See the numbers, ImpactLedger, indoor/community/caveats), App integration | `src/web/components/HouseholdPanel.tsx`, `src/web/components/HouseholdSummaryForm.tsx`, `src/web/hooks/useHouseholdPanelLogic.ts`, `src/web/hooks/usePlan.ts`, `src/web/components/GroundedText.tsx`, `src/web/components/PlanView.tsx`, `src/web/App.tsx` | 15 / 346 | 95.85% lines, 84.14% branches, 88.12% functions (global) | Manual E2E check with real Gemini key on "Delhi — child with asthma" |
| 10 | 2026-11-25 | Indoor air simulator (instant domain calculation, SVG bar comparison, m³/h↔CFM toggle, plants honest check, source warnings) and `POST /api/iaq/explain` with Gemini grounding/cache/fallback | `src/server/services/iaqService.ts`, `src/server/routes/iaq.ts`, `src/web/components/IndoorSimulator.tsx`, `src/web/components/IndoorControls.tsx`, `src/web/components/OriginBadge.tsx`, `src/domain/fallbackPlan.ts`, `src/server/ai/prompts.ts` | 11 / 357 | 95.71% lines, 84.3% branches, 86.64% functions (global) | Manual E2E check with real Gemini key on "Explain my setup" |

## Prompt evolution notes

Record what had to change in a prompt and why (this is the "how prompts evolved" story).

- Step 0: Decided on "numbers from code, words from Gemini" with `{{fact_id}}` placeholders so the
  model can never originate a figure.

## Submissions

| Attempt | Date | Commit | Live URL version | AI evaluation score | Main fixes after it |
| --- | --- | --- | --- | --- | --- |
