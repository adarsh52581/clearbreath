# Project context

## 1. The challenge

**PromptWars Virtual — Challenge 6: Urban Air Quality Assistant.** Build a GenAI-powered assistant
that helps families and communities navigate severe winter smog and urban air pollution: suggest
low-emission daily routines, indoor air-quality hacks and sustainable alternatives tailored to their
location and lifestyle, while clearly explaining the direct impact of their choices.

- Deadline: **Sunday 29 Nov 2026, 11:59 PM IST.** Maximum 3 submission attempts.
- Deliverables: public GitHub repo (< 10 MB), live deployed URL, demo video (< 4 min),
  LinkedIn post, "GenAI services used" text (≤ 1,024 chars), "deployed version updates" text.
- AI code evaluation parameters: Code Quality, Security, Efficiency, Testing, Accessibility,
  Problem Statement Alignment. Human judges then test the live app.

### Subject-matter-expert guidance (explainer session)

- Do not build a generic AQI dashboard or a chatbot wrapper.
- AQI/PM2.5/PM10 must come from live, reliable public APIs (OpenAQ / CPCB). No Gemini-generated,
  random or static pollution values.
- Show the data source name and timestamp in the UI.
- Support multiple Indian cities and ground advice in that city's data.
- GenAI must do real reasoning that could not be replaced by simple if/else rules.
- Give evaluators ready-made sample profiles/datasets; a CSV/JSON upload is a plus.

## 2. Persona

Urban Indian households during winter smog: parents of school-age children, daily commuters,
older adults, and anyone with asthma, COPD, heart disease or pregnancy.

Cities: Delhi, Noida, Gurugram (Delhi-NCR), Mumbai, Kolkata, Bengaluru, Chennai, Kochi,
Lucknow, Patna.

## 3. Product promise

> Tell us who lives in your home and what your day looks like. Using live air data, ClearBreath
> shows the lowest-exposure version of your day, how to clean the air indoors, and exactly how
> much each change helps.

## 4. Features mapped to the brief

| Pillar | Feature | Gemini's role | Code's role |
| --- | --- | --- | --- |
| Live context | **Live air panel**: measured PM2.5/PM10 from the nearest monitor (OpenAQ), Indian AQI (CPCB method), 48-hour forecast (Google Air Quality API; Open-Meteo fallback), source + timestamp badge, freshness state | none | fetch, validate, compute AQI |
| 1. Low-emission routines | **Routine planner**: move outdoor activities to the cleanest forecast window, compare commute modes, combine errands (trip-chaining) | chooses and ranks options, explains trade-offs for this family | dose per member per option, best windows, CO2 per passenger-km |
| 2. Indoor air | **Indoor actions + simulator**: windows, purifier size, honest plants check, source control (cooking, incense, mosquito coils) | prioritises actions for budget and constraints, explains | steady-state indoor PM2.5 model, purifier sizing |
| 3. Sustainable alternatives + impact | **Family impact ledger**: each member's estimated PM2.5 intake (usual vs recommended), CO2 saved, vehicle-km avoided; up to 3 community actions | explains why it matters | every number |
| Testability | 6 presets including edge cases; upload household JSON or air-quality CSV (always labelled "uploaded", never "live") | none | parse and validate |
| Inclusion | English and Hindi explanations | writes in the chosen language | numbers identical in both |

## 5. Non-goals (do not build)

Accounts or login, databases, map tiles or geocoding search, push notifications, a free-form chat
UI, medical diagnosis or medication advice, our own AQI forecasting model, GRAP enforcement logic
(an optional, dated GRAP banner for Delhi-NCR is allowed).

## 6. Honesty rules (visible in the UI)

- Label every number's kind: measured, forecast (model), computed, reference, assumption, uploaded.
- An AQI computed from fewer than 3 pollutants or from fewer than 16 hourly values is
  "indicative"; say so.
- Potted plants: show their real, near-zero effect on PM2.5, with the citation.
- Health text is general guidance from CPCB categories, not medical advice.
- When Gemini is unavailable, say so and show ClearBreath's computed ranking instead.
- Uploaded data is never presented as live data.

## 7. Demo story (drives the video and the presets)

1. Open the app: Delhi loads with live AQI and the source badge (station, distance, time).
2. Choose the preset "Delhi — child with asthma". Type a short note live. Build the plan.
3. Routine cards: "Move park time to …" — open "See the numbers" to show every figure's source.
4. Impact ledger: the child's estimated intake today vs a usual day; metro vs car CO2 per week.
5. Indoor simulator: close windows + right-sized purifier → estimate drops; add 10 plants → ≈ 0 %
   change, with citation. "Explain my setup".
6. Switch to Hindi: same numbers, Hindi explanation.
7. Edge cases: upload the severe-episode CSV (labelled "uploaded"); upload the malformed CSV
   (clear errors); minimal preset (empty states).
