# Domain model — formulas, constants and sources

Everything here is implemented as pure functions in `src/domain`. Do not change a constant
without updating this file and its source note. Every constant has a `kind`:
`reference` (published source), `assumption` (our documented choice) or `computed`.

## 0. Conventions

- Concentrations in µg/m³ (PM2.5, PM10). Inhaled dose in µg. CO2 in g or kg. Distance in km.
- Data timestamps are UTC ISO strings. Display time is IST (UTC+05:30, no daylight saving) via
  `src/domain/time.ts`. Never use the machine's local time zone. `now` is always a function argument.
- Invalid numeric input (NaN, ±Infinity, negative where not allowed) → throw `RangeError`,
  except where a function is specified to return `null`.

## 1. Indian National AQI (CPCB method, PM2.5 and PM10 only)

| Category | Index | PM2.5 (µg/m³, 24-h) | PM10 (µg/m³, 24-h) |
| --- | --- | --- | --- |
| Good | 0–50 | 0–30 | 0–50 |
| Satisfactory | 51–100 | 31–60 | 51–100 |
| Moderate | 101–200 | 61–90 | 101–250 |
| Poor | 201–300 | 91–120 | 251–350 |
| Very Poor | 301–400 | 121–250 | 351–430 |
| Severe | 401–500 | 250+ | 430+ |

**Sub-index (continuous bands):** `I = I_lo + (C − C_lo) × (I_hi − I_lo) / (C_hi − C_lo)`

Band edges `C_lo→C_hi : I_lo→I_hi`:

- PM2.5: `0→30:0→50`, `30→60:50→100`, `60→90:100→200`, `90→120:200→300`, `120→250:300→400`,
  `250→380:400→500` (Severe extends the Very Poor slope).
- PM10: `0→50:0→50`, `50→100:50→100`, `100→250:100→200`, `250→350:200→300`, `350→430:300→400`,
  `430→510:400→500`.

Rules:

- Round the sub-index to the nearest integer; concentrations above the last edge → 500.
- Invalid input (NaN, ±Infinity, negative) → `null`.
- A 24-hour average needs **≥ 16 valid hourly values** within (now − 24 h, now]. Otherwise use the
  latest hourly value and set `basis: 'indicative-latest'`.
- Overall index = max of available sub-indices; dominant pollutant = argmax (tie → `pm25`).
- The official AQI needs ≥ 3 pollutants including PM2.5 or PM10. We use PM only, so every result
  carries the note "Based on PM2.5 and PM10 only — indicative".
- Category by rounded index: 0–50 good, 51–100 satisfactory, 101–200 moderate, 201–300 poor,
  301–400 very_poor, 401–500 severe.

**Test vectors (must all pass):**

- PM2.5 → index: 15→25, 30→50, 45→75, 60→100, 75→150, 90→200, 105→250, 120→300, 185→350,
  250→400, 315→450, 380→500, 900→500.
- PM10 → index: 25→25, 50→50, 100→100, 175→150, 250→200, 300→250, 350→300, 390→350, 430→400,
  470→450, 510→500.

**Categories (swatch colours are the commonly used CPCB palette; swatches only, never text colour):**

| key | EN label | HI label | Swatch | Health note EN (paraphrased from CPCB) | Health note HI |
| --- | --- | --- | --- | --- | --- |
| good | Good | अच्छा | #00B050 | Minimal impact. | न्यूनतम प्रभाव। |
| satisfactory | Satisfactory | संतोषजनक | #92D050 | Minor breathing discomfort for sensitive people. | संवेदनशील लोगों को साँस लेने में हल्की तकलीफ़ हो सकती है। |
| moderate | Moderate | मध्यम | #FFFF00 | Breathing discomfort for people with lung disease such as asthma; discomfort for people with heart disease, children and older adults. | अस्थमा जैसी फेफड़ों की बीमारी वाले लोगों को साँस लेने में तकलीफ़; हृदय रोगियों, बच्चों और बुज़ुर्गों को असुविधा। |
| poor | Poor | ख़राब | #FF9900 | Breathing discomfort for most people on prolonged exposure; discomfort for people with heart disease. | लंबे समय तक संपर्क में रहने पर अधिकतर लोगों को साँस लेने में तकलीफ़; हृदय रोगियों को असुविधा। |
| very_poor | Very Poor | बहुत ख़राब | #FF0000 | Respiratory illness possible on prolonged exposure; stronger effects in people with lung and heart disease. | लंबे संपर्क से साँस की बीमारी हो सकती है; फेफड़े और हृदय रोगियों पर अधिक असर। |
| severe | Severe | गंभीर | #C00000 | Affects healthy people; serious impact on people with existing disease, even during light activity. | स्वस्थ लोगों पर भी असर; बीमार लोगों पर गंभीर प्रभाव, हल्की गतिविधि में भी। |

Source: CPCB National Air Quality Index (2014). Hindi text: have a native speaker review it.

## 2. Inhaled dose

`dose_µg = C (µg/m³) × R (m³/h) × t (h)`

R = mean short-term inhalation rate, US EPA Exposure Factors Handbook (2011), Chapter 6,
Table 6-2 (m³/min × 60). `kind: reference`. Verify against the table before submission:
https://www.epa.gov/sites/production/files/2015-09/documents/efh-chapter06.pdf

| Age group (EFH band) | Sedentary | Light | Moderate | High |
| --- | --- | --- | --- | --- |
| toddler (1 to <2 y) | 0.28 | 0.72 | 1.26 | 2.28 |
| child (6 to <11 y) | 0.29 | 0.66 | 1.32 | 2.52 |
| teen (11 to <16 y) | 0.32 | 0.78 | 1.50 | 2.94 |
| adult (31 to <41 y) | 0.26 | 0.72 | 1.62 | 2.94 |
| older_adult (61 to <71 y) | 0.29 | 0.72 | 1.56 | 2.82 |

- Activity intensity comes from the profile (light / moderate / high).
- Commute intensity by mode: walk = light; cycle = moderate; two_wheeler, auto, car, cab, bus,
  metro = sedentary. Metro adds 10 min of walking access at light intensity (`assumption`).
- In-vehicle concentration factor = 1.0 for every mode (`assumption`: we do not claim any cabin
  filtering benefit). Gemini may mention cabin recirculation qualitatively only.
- Percent change = `(value − baseline) / baseline × 100`, rounded to an integer; baseline ≤ 0 → `null`.

## 3. Clean-window finder

Input: hourly forecast points (UTC, `pm25`), activity duration (minutes → `n = ceil(min / 60)`
hours), flexible range `[earliestHour, latestHour]` in IST, `now`.

1. Consider points with `timeUtc ≥` the current hour and within the next 24 h.
2. A start index is valid when the next `n` points are consecutive (exactly 1 h apart, no gaps),
   the IST start time (fractional hours — IST starts fall on :30 because of the +5:30 offset) is
   ≥ `earliestHour`, and IST start + n ≤ `latestHour`.
3. Score = mean `pm25` over the n points. Pick the minimum; ties → earliest start.
4. Usual window = the valid sequence whose IST start is closest to `usualStartHour` (ignoring the
   flexible range; tie → the earlier start).
5. Return `{ startUtc, endUtc, labelIst: "15:30–16:30 IST", meanPm25 }` or `null`.
6. Status for the UI: `ok`, `no-forecast` (forecast null) or `no-window` (no valid sequence).

## 4. Commute and emissions

Assumed door-to-door urban speeds when the user gives no duration (`assumption`, shown in the UI):
walk 4.5, cycle 12, two_wheeler 22, auto 18, car 20, cab 20, bus 14, metro 30 km/h (+10 min access).

CO2 per passenger-km (`reference`: TERI 2023, "Emission saving made by a passenger by choosing to
travel by Delhi Metro", Delhi estimates —
https://teriin.org/sites/default/transport/Per_passenger_emission_in_Delhi_Different_Modes.pdf):

| Mode | g CO2 / passenger-km |
| --- | --- |
| metro | 29.29 (TERI upper bound; their lower bound is 20.73) |
| bus | 29.48 |
| two_wheeler | 41.29 |
| auto | 64.10 |
| car | 87.73 |
| cab | 98.58 |
| walk, cycle | 0 |

- Weekly CO2 (kg) = factor × distanceKm × 2 (round trip) × daysPerWeek × travellers ÷ 1000.
- CO2 saved = weekly CO2 (current mode) − weekly CO2 (option).
- Vehicle-km avoided per week (proxy for local exhaust and road-dust resuspension): when moving
  from car, cab, two_wheeler or auto to walk, cycle, bus or metro = distanceKm × 2 × daysPerWeek;
  otherwise 0.
- The factors are Delhi estimates; for other cities label them "Delhi estimate (TERI)".

**Recommended commute option (default shown in the ledger; Gemini may argue otherwise):**

- If any traveller is sensitive (asthma, copd, heart, pregnant, toddler, child or older_adult):
  pick the lowest dose; tie (within 5 %) → lowest CO2.
- Otherwise: among modes whose dose is ≤ 1.5 × the minimum dose (`assumption`), pick the lowest
  CO2; tie → shortest time.

## 5. Indoor air (single-zone steady state, no indoor sources)

`C_in = (P × a × C_out) / (a + k + CADR / V)`

| Symbol | Meaning | Value | Kind |
| --- | --- | --- | --- |
| P | PM2.5 penetration factor | 0.8 (typical range 0.6–1.0) | assumption |
| a | air exchange rate (1/h) by windowState | sealed 0.3, closed 0.6, partly_open 2.0, open 5.0 | assumption |
| k | PM2.5 deposition rate (1/h) | 0.2 (typical range 0.1–0.4) | assumption |
| CADR | purifier clean-air delivery rate (m³/h); 1 CFM = 1.699 m³/h | from profile | input |
| V | room volume (m³) = roomAreaM2 × ceilingHeightM | from profile | computed |

- Indoor sources (cooking without exhaust, incense, mosquito coils, smoking) are **not** modelled
  numerically. When present, the estimate is a lower bound and the UI says so, with guidance.
- Recommended purifier CADR = 5 air changes per hour = 5 × V m³/h (`reference`: equivalent to the
  AHAM rule of thumb "CADR ≥ 2/3 of floor area in ft²" for 8-ft ceilings).
- Plants: each potted plant adds at most 0.023 m³/h of effective CADR (`reference`: median
  single-plant clean-air delivery rate for VOCs, Cummings & Waring 2020). PM2.5 removal by potted
  plants is not established, so this is an optimistic upper bound and the UI says so.
- Monotonicity (tested): more CADR never raises `C_in`; more air exchange never lowers `C_in`
  (no indoor sources).

**Scenarios** (`IndoorScenario = { id, label, cIn, pctVsBaseline, pctVsOutdoor, doseByMember }`):

| id | Applies when | Change from baseline |
| --- | --- | --- |
| baseline | always | current home settings (incl. current purifier and plants) |
| close_windows | windowState is partly_open or open | windowState → closed |
| sealed | windowState is closed | windowState → sealed (draught-proofing; low cost) |
| purifier_recommended | no purifier, or CADR < recommended | CADR → recommended |
| sealed_plus_purifier | purifier_recommended applies | sealed + recommended CADR |
| plants_plus_10 | always | baseline + 10 more plants |

Indoor dose per member per day = `C_in × sedentary rate × indoorHours`, where
`indoorHours = max(0, hoursIndoorsPerDay − that member's activity and commute hours)`.

Ventilation trade-off: closing windows also traps CO2 and cooking fumes. Always pair it with
"air out briefly at the cleanest forecast hour" and "use the kitchen exhaust while cooking".

## 6. Evidence and guidance entries (`src/domain/data/evidence.ts`)

| id | kind | Finding (short, paraphrased) | Citation |
| --- | --- | --- | --- |
| ref_plants | reference | A potted plant's median clean-air delivery rate is about 0.023 m³/h (VOCs); 10–1,000 plants per m² of floor would be needed to match normal building air exchange. | Cummings BE, Waring MS. *Potted plants do not improve indoor air quality: a review and analysis of reported VOC removal efficiencies.* J Expo Sci Environ Epidemiol (2020). https://www.nature.com/articles/s41370-019-0175-9 |
| ref_mosquito_coil | reference | In lab tests, burning one mosquito coil released PM2.5 mass comparable to 75–137 cigarettes. | Liu W et al. *Mosquito coil emissions and health implications.* Environ Health Perspect 111(12), 2003. |
| ref_purifier_rule | reference | Size a purifier for about five air changes per hour (AHAM "2/3 rule"). | AHAM Verifide room-size guidance |
| ref_inhalation | reference | Breathing rates by age and activity. | US EPA Exposure Factors Handbook (2011), Table 6-2 |
| ref_emissions | reference | CO2 per passenger-km by mode in Delhi. | TERI (2023), link in §4 |
| tip_incense | guidance | Incense and dhoop release fine particles indoors; skip them on high-AQI days or burn them by an open window. | general guidance (no figure) |
| tip_cooking_exhaust | guidance | Run the chimney/exhaust fan while cooking and for a few minutes after. | general guidance |
| tip_wet_mop | guidance | Wet-mop instead of dry sweeping to avoid stirring up settled dust. | general guidance |
| tip_mask | guidance | For unavoidable outdoor time, a well-fitted N95 respirator reduces inhaled particles; cloth masks do little. | general guidance |
| tip_report_burning | guidance | Report open garbage or leaf burning through your city's official pollution-complaint channels. | general guidance |
| tip_clean_room | guidance | Keep one "clean room" with the purifier and closed windows for the most vulnerable person. | general guidance |

Guidance entries never carry numbers.

## 7. Facts: ids, kinds and display

`Fact = { id, label, value, unit?, display, kind, provenance, asOfUtc? }` — see `ARCHITECTURE.md` §5.3.
ids match `^[a-z0-9_]{3,80}$`. `display` is localised (`en` / `hi`) by `src/domain/format.ts`:
integers for µg/m³; doses rounded to the nearest 10 µg with en-IN grouping; CO2 kg with 1 decimal;
minutes as "38 min" / "38 मिनट"; times as "15:30 IST"; changes as "38% lower" / "12% higher" /
"about the same" (|change| < 3 %), Hindi "38% कम" / "12% ज़्यादा" / "लगभग उतना ही".
Latin digits in both languages. Fact `label`s never contain digits except the allowed tokens
PM2.5, PM10, N95 and CO2 (tested), because labels are sent to Gemini.

| Group | Fact ids |
| --- | --- |
| Air | `air_naqi_now`, `air_category_now`, `air_naqi_basis`, `air_pm25_now`, `air_pm10_now`, `air_station`, `air_station_distance`, `air_updated`, `air_forecast_source`, `air_cleanest_hour_next24`, `air_cleanest_pm25_next24`, `air_worst_hour_next24`, `air_worst_pm25_next24`, optional `air_grap_stage` |
| Activity `{a}` | `act_{a}_usual_window`, `act_{a}_usual_pm25`, `act_{a}_best_window`, `act_{a}_best_pm25`, `act_{a}_dose_change`, `act_{a}_indoor_pm25`, `act_{a}_indoor_dose_change`, `act_{a}_{m}_dose_saved` |
| Commute `{c}`, mode `{x}` | `com_{c}_{x}_minutes`, `com_{c}_{x}_dose_change`, `com_{c}_{x}_co2_week`, `com_{c}_{x}_co2_saved_week`, `com_{c}_{x}_vehicle_km_avoided_week` |
| Trip chain | `chain_best_window`, `chain_dose_change`, `chain_trips_saved` |
| Indoor scenario `{s}` | `in_{s}_pm25`, `in_{s}_change`, `in_baseline_vs_outdoor`, `in_recommended_cadr`, `in_room_volume` |
| Ledger member `{m}` | `led_{m}_usual`, `led_{m}_plan`, `led_{m}_change`, `led_household_co2_saved_week` |
| Option labels | `opt_{optionId}_label` (e.g. "15:30–16:30 IST", "Metro") |
| Evidence | every id in §6 (`display` = the short finding) |

## 8. Candidates and recommended options (`src/domain/candidates.ts`)

Candidate and option `label`s never contain digits (tested). User-provided labels have digits
removed before they reach Gemini.

- **Activities** — options `{a}_usual`; `{a}_best` when a best window exists and is ≥ 10 % lower
  dose than usual; `{a}_indoor` when intensity is high or a participant is sensitive **and** the
  current category is poor or worse (dose uses the baseline indoor concentration). Recommended:
  the lowest-dose option. No forecast → only `{a}_usual`, plus a note fact.
- **Commutes** — one option per allowed mode (`{c}_{mode}`, current mode included). Recommended:
  rule in §4.
- **Trip chain** (optional item `chain`) — when ≥ 2 activities of kind errand/walk/other share
  the same members and one window can hold both durations back-to-back inside both flexible
  ranges: option `chain_best` with `chain_*` facts.
- **Indoor actions** (only those that apply), with cost tier: `close_windows` (free),
  `short_airing` (free, uses `air_cleanest_hour_next24`), `seal_gaps` (low),
  `add_or_upgrade_purifier` (medium), `clean_room` (free), `kitchen_exhaust` (low, if cooking
  without exhaust), `skip_incense` (free, if incense), `replace_mosquito_coil` (low, nets/screens,
  if coil), `wet_mop` (free), `plants_reality_check` (free, always offered as an honest note).
- **Community** (max 3): `carpool_pod` (if any commute is by car or cab; computed with 3
  occupants), `report_burning`, `shared_clean_room`.

## 9. Family exposure ledger (`src/domain/ledger.ts`)

For each member: **usual** = sum of usual activity and current-mode commute doses + baseline indoor
dose; **plan** = sum of recommended options + indoor dose of the best **free** scenario
(close_windows if it applies, else baseline). Facts `led_*`, plus
`led_household_co2_saved_week` from the recommended commute options. The UI caption says
"estimated with recommended options; not a medical measurement". Hours not covered by
activities, commutes or `hoursIndoorsPerDay` (e.g. school, office) are not counted — say so.

## 10. Deterministic fallback plan (`src/domain/fallbackPlan.ts`)

Used when Gemini is unavailable or fails validation twice. Text uses only placeholders and
digit-free labels, and must pass the grounding validator.

- Summary EN: "Air quality now: {{air_category_now}} ({{air_naqi_basis}}). AI explanations are
  unavailable right now, so these are ClearBreath's computed lowest-exposure options."
- Summary HI: "अभी वायु गुणवत्ता: {{air_category_now}} ({{air_naqi_basis}})। AI व्याख्या अभी
  उपलब्ध नहीं है, इसलिए ये ClearBreath के गणना किए गए सबसे कम-संपर्क वाले विकल्प हैं।"
- Routine item: headline "<item label>: {{opt_<recommended optionId>_label}}"; why for activities
  "Estimated intake for this activity: {{act_<a>_dose_change}}."; for commutes "Exposure
  {{com_<c>_<x>_dose_change}} than now; CO2 saved per week {{com_<c>_<x>_co2_saved_week}}."
- Indoor: scenario-backed actions first (largest reduction), then free guidance actions.
- Community: label + guidance placeholder.
- Caveat: "Estimates use live outdoor data and published breathing rates; they are not medical
  measurements." (Hindi equivalent.)

## 11. Optional: GRAP banner (Delhi-NCR only)

If `GRAP_STAGE` is set and the city has `ncr: true`, show "GRAP Stage <X> in force (as of
<GRAP_AS_OF>, source)" with the CAQM link, and add fact `air_grap_stage`. Never infer the stage
from AQI and never describe stage restrictions in AI text.
