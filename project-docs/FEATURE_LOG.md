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
| 11 | 2026-11-25 | Hardening pass: base `/api` rate limiter, enhanced bundle secret scan in `check` & CI, raised coverage thresholds (85/85/80/85, `domain` ≥ 95% lines), WCAG contrast token test, `postIaqExplain` client test, README evidence map | `scripts/check-bundle-secrets.mjs`, `vitest.config.ts`, `src/server/app.ts`, `src/web/styles.test.ts`, `src/web/api/client.test.ts`, `package.json`, `.github/workflows/ci.yml`, `README.md` | 13 / 370 | 95.8% lines, 84.15% branches, 86.68% functions (global); `domain` 95.75% lines | Optional Playwright E2E not requested |
| Fix | 2026-11-25 | Dev white screen fixed (browser API client moved out of the Vite `/api` proxy path, guard test), dev redirect :8080 → :5173, `.env.example` restored, `@google/genai` 0.3 → 3.6 with `responseJsonSchema`, secret-free AI failure logging and no second call on provider errors, Noida + Gurugram cities, bundle scan for AQ.-style keys and real key values | `src/web/lib/apiClient.ts`, `src/web/devServer.test.ts`, `src/server/app.ts`, `src/server/log.ts`, `src/server/ai/retryPolicy.ts`, `src/server/ai/geminiClient.ts`, `src/server/services/*Service.ts`, `src/domain/data/cities.ts`, `scripts/check-bundle-secrets.mjs` | 9 / 379 | 95.84% lines, 84.56% branches, 86.62% functions (global) | Verify Gemini end-to-end with a real key |
| Fix 2 | 2026-11-25 | Gemini resilience: one retry ~1.5 s after a 503 "high demand" error, optional `GEMINI_FALLBACK_MODEL` for overload (503) and quota (429) errors, no retry on other errors | `src/server/ai/geminiClient.ts`, `src/server/ai/geminiClient.test.ts`, `src/server/config.ts`, `src/server/index.ts`, `.env.example` | 12 / 391 | 95.98% lines, 84.85% branches, 86.95% functions (global) | Choose a fallback model id from AI Studio |
| Fix 3 | 2026-11-25 | Gemini timing: 15 s per call and 35 s per request so a slow first model still leaves time for the fallback; a timed-out first call is retried on the fallback; startup rejects speech (-tts) and image (-image) model ids | `src/server/ai/aiClient.ts`, `src/server/ai/geminiClient.ts`, `src/server/config.ts`, `src/server/services/*Service.ts`, `.env.example` | 3 / 394 | 95.99% lines, 84.82% branches, 86.99% functions (global) | – |
| Fix 4 | 2026-11-25 | Gemini backup list: `GEMINI_FALLBACK_MODEL` takes several comma-separated models, tried in order with pauses of 1.5 s, 3 s, 4 s inside the 35 s budget, following Google's troubleshooting advice (back off, switch model) | `src/server/ai/geminiClient.ts`, `src/server/config.ts`, `src/server/index.ts`, `.env.example` | 4 / 398 | 96% lines, 84.77% branches, 87.07% functions (global) | – |
| Fix 5 | 2026-11-25 | Gemini speed and model ids: API version v1beta ("-latest" aliases now resolve), low thinking for Gemini 3 models, 4096 output tokens, 20 s per call / 45 s per request, 404 model ids skipped to the next backup | `src/server/ai/geminiClient.ts`, `src/server/ai/aiClient.ts` | 3 / 401 | 96% lines, 84.85% branches, 87.11% functions (global) | – |
| Fix 6 | 2026-11-25 | Validator false alarms: everyday "one" and the word "two-wheeler" (our own mode label) no longer count as invented numbers; placeholders written as `{{ ID }}` are normalised; prompt lists the allowed words | `src/server/ai/grounding.ts`, `src/server/ai/prompts.ts` | 2 / 403 | 96.01% lines, 84.87% branches, 87.15% functions (global) | – |
| Fix 7 | 2026-11-25 | Lighter Gemini answers: at most 5 indoor and 2 community actions, shorter text, minimal thinking for Gemini 3 Flash models — roughly halves what the model has to write, so plans finish inside the time limit more often | `src/shared/aiSchemas.ts`, `src/domain/fallbackPlan.ts`, `src/server/ai/prompts.ts`, `src/server/ai/geminiClient.ts` | 0 / 403 | 96.01% lines, 84.89% branches, 87.15% functions (global) | – |
| Fix 8 | 2026-11-26 | Diagnosed with `scripts/diagnose-gemini.mjs`: the free tier allows 20 requests per model per day, and a working answer was rejected because Gemini wrote fact ids without braces. Known ids are now wrapped automatically and the prompt says to keep the braces | `src/server/ai/grounding.ts`, `src/server/ai/prompts.ts` | 2 / 405 | 96.02% lines, 84.96% branches, 87.34% functions (global) | Free-tier quota is too small for judging |

## Prompt evolution notes

Record what had to change in a prompt and why (this is the "how prompts evolved" story).

- Step 0: Decided on "numbers from code, words from Gemini" with `{{fact_id}}` placeholders so the
  model can never originate a figure.
- Fix after Step 11: the UI was blank in `npm run dev` because the browser API client lived in
  `src/web/api/`, whose dev URL (`/api/client.ts`) matched the Vite proxy and was sent to Express.
  Tests and the production build could not catch it; a guard test now fails if anything under
  `src/web` starts with "api". The agent had also installed a year-old Gemini SDK; prompts for
  dependency work now say "install the latest version and check the official docs".
- Fix 2: the first real-key test failed with Gemini 503 "model is experiencing high demand". The
  key, model id and request format were fine; the model was overloaded. The client now retries once
  and can switch to a fallback model, so judges see Gemini's explanation more often during peaks.
- Fix 3: a speech model (`-tts`) was set as GEMINI_MODEL by mistake and the fallback model timed
  out under load. Startup now rejects non-text models, and each call gets its own time limit.
- Fix 4: both the main and backup model returned 503 at the same moment. Availability differs per
  model minute to minute, so the client now works through a short list of backups.
- Fix 5: full plans took over 15 s because Gemini 3 models think deeply by default, and
  `gemini-flash-lite-latest` worked in a v1beta speed test but 404'd in the app, which used v1.
- Fix 6: our own label "Two-wheeler" and guidance text "Keep one clean room" contained number
  words, so a faithful Gemini answer could be rejected as an invented number.
- Fix 7: measured the request offline — the prompt is small (about 4k tokens for the Delhi preset)
  but the answer asked for up to 15 explained items. Asking for the 5 most useful indoor actions
  and 2 community actions makes Gemini's answer much shorter and faster.
- Fix 8: a diagnostic script sent the app's exact request four ways. Gemini answered in about 4 s,
  so the request format was fine; failures were the free-tier limit (20 requests per model per
  day) and answers that wrote `act_a1_usual_window` instead of `{{act_a1_usual_window}}`.

## Submissions

| Attempt | Date | Commit | Live URL version | AI evaluation score | Main fixes after it |
| --- | --- | --- | --- | --- | --- |
