# ClearBreath — agent rules (always on)

You are helping build **ClearBreath**, a GenAI urban air-quality assistant for Indian families
(PromptWars Virtual, Challenge 6). These rules apply to every task in this repository.

## Golden rule: numbers from code, words from Gemini

- Every number a user sees (AQI, concentrations, times, doses, percentages, emissions, distances)
  is either fetched from a live API in `src/server/adapters` or computed by tested, pure
  TypeScript in `src/domain`.
- Gemini never creates numbers. It only ranks options that code already computed and explains
  them with `{{fact_id}}` placeholders (see `project-docs/AI_CONTRACT.md`).
- Never invent, hardcode, randomise or "mock" air-quality values in production code. If data is
  missing, show an explicit empty/error state. Test fixtures live only in `__fixtures__/` folders
  and are never imported by production code.

## Source of truth (read the relevant files before planning)

| File | Use it for |
| --- | --- |
| `project-docs/PROJECT_CONTEXT.md` | problem, persona, features, scope, honesty rules |
| `project-docs/ARCHITECTURE.md` | stack, allowed dependencies, folders, API contracts, data sources, security, env vars |
| `project-docs/DOMAIN_MODEL.md` | formulas, constants, fact ids, candidates, fallback templates |
| `project-docs/AI_CONTRACT.md` | Gemini prompts, output schemas, grounding validator, retry and fallback |
| `project-docs/CODING_RULES.md` | code style, UI, accessibility, security, testing rules, edge-case catalogue |
| `project-docs/FEATURE_LOG.md` | what has already been built |

If a request conflicts with these files, stop and ask instead of guessing.

## How to work on every task

1. Plan first: list the files you will create or change, the tests you will add and the commands
   you will run. Keep the plan short.
2. Stay in scope: only touch files the task names. No drive-by refactors, no renamed exports.
3. Dependencies: only the packages listed in `ARCHITECTURE.md` §2. Ask before adding anything.
4. Tests are part of the task: every new function, component and route gets tests in the same task.
5. Verify before saying "done": `npm run lint`, `npm run typecheck`, `npm test` and
   `npm run build` must pass. Paste their summary lines.
6. Close the task with the `/finish-step` workflow (`.agents/workflows/finish-step.md`).

## Hard constraints

- TypeScript strict. No `any`, no `@ts-ignore`, no `!` non-null assertions without a comment.
- Secrets only on the server via environment variables. Never use `VITE_`-prefixed variables for
  keys, never send keys to the browser, never log keys or request headers.
- Validate every external input with zod: query strings, bodies, uploads and third-party API responses.
- Render user text and AI text as plain text. Never use `dangerouslySetInnerHTML`.
- Accessibility is a requirement: semantic HTML, labels, keyboard support, visible focus, never
  colour alone.
- Keep the repository under 10 MB: never commit `node_modules`, `dist`, `coverage`, `.env*`
  (except `.env.example`) or large binaries.
- Do not browse the web unless the task names an official documentation URL to check.
- Never run destructive commands (`rm -rf`, `git reset --hard`, `git push --force`, deleting
  branches) without asking first.
- Tests never call real APIs. Inject `fetchFn`, `clock` and AI clients so tests use fakes.

## Protected files (edit only when the task explicitly says so)

`AGENTS.md`, everything in `project-docs/` except `FEATURE_LOG.md`, constants in
`src/domain/data/`, and existing passing tests (you may add tests, never weaken or delete them).
