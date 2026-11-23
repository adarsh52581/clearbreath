# Coding rules

## 1. TypeScript and structure

- Strict mode. No `any`, no `@ts-ignore`. Narrow `unknown` with zod or type guards.
- Types come from zod schemas (`z.infer`) — do not duplicate interfaces by hand.
- Exported functions have explicit return types.
- `src/domain` is pure: no `fetch`, `Date.now()`, `Math.random()`, `process.env` or I/O. Time and
  randomness are arguments.
- Server code receives dependencies through `createApp(deps)` / `createXService(deps)`
  (adapters, cache, clock, AI client) so tests pass fakes.
- Size limits: functions ≤ 80 lines (≤ 40 in `src/domain`), files ≤ 300 lines, cyclomatic
  complexity ≤ 12. Split instead of growing.
- Naming: camelCase for functions and variables, PascalCase for components and types, React
  component files `PascalCase.tsx`, other files `camelCase.ts`.
- Comments explain *why* and cite sources for constants. No commented-out code.
- Errors: the server throws `AppError`; domain functions throw `RangeError` on invalid numbers;
  never swallow errors silently.

## 2. React and UI

- Function components and hooks only. No global state library; lift state or use context sparingly.
- Every user-visible string comes from `src/web/i18n` (`en` and `hi`).
- Data fetching only through `src/web/api/client.ts` and hooks; validate responses with the
  shared zod schemas.
- Never render HTML strings; never use `dangerouslySetInnerHTML`. AI text goes through `GroundedText`.
- Loading, error, empty and stale states are designed for every data-driven component.
- Lazy-load heavy, below-the-fold views (`PlanView`, `IndoorSimulator`) with `React.lazy`.

## 3. Styling (Tailwind CSS v4)

- `src/web/styles.css` starts with `@import "tailwindcss";` and defines tokens in `@theme`.
  There is no `tailwind.config.js`.
- Components use token utilities only (e.g. `bg-surface`, `text-ink`, `ring-focus`). No hardcoded
  hex/rgb values in components and no inline `style` attributes (CSP).
- Tokens (light theme):

| Token | Value | Use |
| --- | --- | --- |
| `--color-ink` | `#1A1D21` | body text |
| `--color-ink-muted` | `#4A5160` | secondary text |
| `--color-surface` | `#FFFFFF` | page/card background |
| `--color-surface-2` | `#F3F5F7` | subtle panels |
| `--color-accent` | `#0A5C86` | primary buttons, links |
| `--color-danger` | `#B42318` | errors |
| `--color-warning-ink` | `#7A4A00` | warning text |
| `--color-focus` | `#1D4ED8` | focus ring |
| `--color-aqi-good` … `--color-aqi-severe` | CPCB swatches (DOMAIN_MODEL §1) | swatches/bars only, with a 1 px `ink-muted` border |

- Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI component borders). A unit test computes
  the contrast ratio of each text/background token pair.
- Mobile-first; min 44 × 44 px touch targets; visible focus ring on every interactive element;
  respect `prefers-reduced-motion`. System font stack (no web fonts).

## 4. Accessibility checklist (WCAG 2.2 AA)

- Landmarks: `header`, `nav` (if any), `main#main`, `footer`; a "Skip to content" link first.
- One `h1`; headings in order.
- Every input has a visible `<label>`; hints and errors linked with `aria-describedby`;
  invalid fields get `aria-invalid="true"`.
- Status and AQI updates announced through one polite `aria-live` region (not every re-render).
- Buttons are `<button>`, links are `<a href>`; icon-only buttons have `aria-label`; decorative
  icons `aria-hidden="true"`.
- Charts: `role="img"` + `<title>` + a text summary, plus an accessible data table.
- Colour is never the only signal (AQI category always shown as text).
- `<html lang>` follows the language toggle (`en` / `hi`).
- Works at 200 % zoom and 320 px width without horizontal scrolling.

## 5. Security checklist

- Keys only in server env; never `VITE_`-prefixed; never logged; never in responses.
- helmet CSP and headers per `ARCHITECTURE.md` §8; `x-powered-by` disabled.
- zod validation on every query, body, upload and third-party response; 256 kb JSON limit;
  415 for non-JSON POST bodies.
- Rate limits on all `/api` routes; `trust proxy` = 1.
- Errors return safe messages only (no stack traces, no upstream bodies).
- Uploaded files are parsed in the browser with size/row limits and re-validated on the server.
- Prompt-injection defence per `AI_CONTRACT.md` §4; AI output rendered as text only.
- `scripts/check-bundle-secrets.mjs` + `npm audit --omit=dev --audit-level=high` in CI.

## 6. Performance checklist

- Main JS bundle ≤ 200 KB gzip (print sizes after `npm run build`).
- `compression` middleware; `Cache-Control: public, max-age=31536000, immutable` for hashed
  assets, `no-cache` for `index.html`.
- Server caches per `ARCHITECTURE.md` §7; client avoids duplicate fetches (5-min in-memory cache
  in `useAir`); memoise derived data.
- No chart or UI libraries; SVG drawn by hand.

## 7. Testing rules

- Vitest, co-located `*.test.ts(x)`. Web tests start with `// @vitest-environment jsdom`.
- Table-driven tests for domain functions. Query the DOM by role and label, not test ids.
- No network in tests: inject `fetchFn`, `clock` and `AiClient`. Fixtures only in `__fixtures__/`.
- axe checks with `expectNoA11yViolations(container)` from `src/test/a11y.ts` (colour-contrast rule
  disabled in jsdom; contrast is covered by the token unit test and Lighthouse/Playwright).
- Coverage thresholds: start at lines 70 / functions 70 / branches 60 / statements 70; the
  hardening step raises them to 85 / 85 / 80 / 85, with `src/domain` ≥ 95 % lines.
- Never delete, skip or weaken a test to make it pass. If a test contradicts the spec, stop and ask.

### Edge-case catalogue (each item needs at least one test)

- **AQI:** NaN, negative, ±Infinity, 0, every band edge, above the cap, 15 vs 16 hourly values,
  missing PM2.5 or PM10, both missing.
- **Windows:** no forecast, gaps, duration longer than the range, ties, IST half-hour offsets,
  usual time outside the flexible range, date rollover at 18:30 UTC.
- **Dose and commute:** zero duration, maximum duration, walking/cycling CO2 = 0, vehicle-km only
  when leaving a private vehicle, sensitive vs non-sensitive recommendation rule.
- **Indoor:** zero or negative volume, CADR 0, very large CADR, plants 0 and 20, monotonicity,
  scenarios omitted when not applicable.
- **Adapters:** empty results, stale station (> 3 h and > 12 h), 429, 500, timeout, malformed
  JSON, unexpected units, pagination.
- **Routes:** missing/invalid params, outside India (422), oversized body (413), wrong content
  type (415), rate limit (429), production error bodies have no stack.
- **AI:** invalid JSON, schema mismatch, unknown fact/candidate id, ASCII and Devanagari digits,
  number words, prompt injection in notes, timeout, cache hit, last-good, fallback.
- **Uploads:** empty file, missing columns, > 500 rows, non-ISO timestamps, negative values, BOM,
  upper-case headers, extra columns ignored, > 10 % invalid rows, JSON of the wrong shape.
- **UI:** loading, error + retry, stale, no station, forecast unavailable, uploaded banner,
  fallback banner, Hindi toggle, keyboard-only flow.

## 8. Git

- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`), one logical
  change per commit, `npm run check` before committing.
- Never commit `.env*` (except `.env.example`), `dist/`, `coverage/`, `node_modules/` or large files.
- If a key is ever committed, rotate it immediately — deleting the commit is not enough.
