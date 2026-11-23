# Evaluator Sample Files

This directory contains ready-made test files for judges and evaluators to test file uploads in ClearBreath.

> **Honesty & Transparency Rule**:
> In accordance with `PROJECT_CONTEXT.md` §4, §6 and `ARCHITECTURE.md` §5.2, any air quality data provided via upload is **always labelled "uploaded"** in the application interface, never "live" or "measured".

## Files Overview

### 1. `household-custom.json`
- **Kind**: Household Profile JSON (Valid)
- **Description**: Represents a 3-member family in coastal Chennai (parent, teen, child with asthma) with school commute and outdoor cycling. Different from the built-in presets.
- **Expected result**: Parses cleanly and populates the routine planner and indoor simulator.

### 2. `household-invalid.json`
- **Kind**: Household Profile JSON (Malformed)
- **Description**: Intentionally violates the household profile schema: missing required `id` and `cityId`, invalid member types, negative room area, and purifier CADR set without a purifier.
- **Expected result**: Rejected with descriptive field-level error messages.

### 3. `air-severe-episode.csv`
- **Kind**: Hourly Air Quality CSV (Valid — Severe Episode)
- **Description**: 48 hourly readings representing a severe winter smog episode with PM2.5 in range 300–480 µg/m³ and PM10 in range 400–600 µg/m³ with ISO UTC timestamps.
- **Expected result**: Parses cleanly (48 data points); triggers severe exposure warnings and indoor air intervention recommendations.

### 4. `air-clean-day.csv`
- **Kind**: Hourly Air Quality CSV (Valid — Good/Satisfactory Day)
- **Description**: 48 hourly readings representing clean coastal or post-monsoon conditions with PM2.5 in range 12–35 µg/m³ and PM10 in range 30–80 µg/m³.
- **Expected result**: Parses cleanly (48 data points); reflects good/satisfactory air conditions.

### 5. `air-malformed.csv`
- **Kind**: Hourly Air Quality CSV (Malformed / Rejected)
- **Description**: Stress-tests upload validation:
  - Upper-case headers (`TIMESTAMP`, `PM25`, `PM10`) — tolerated by case-insensitive header parsing.
  - Extra column (`EXTRA_COLUMN`) — safely ignored.
  - Row 2 has a negative PM2.5 value (`-25`).
  - Row 3 has a non-ISO date string (`not-a-valid-timestamp`).
  - 2 of 8 rows (25%) are invalid, exceeding the 10% maximum invalid rows threshold.
- **Expected result**: Rejected with specific row numbers and error descriptions.
