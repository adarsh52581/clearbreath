# Feature log

Evidence of spec-driven, AI-assisted development (useful for the judges, the README and the
LinkedIn post). The agent appends one row per step via `/finish-step`; humans add notes.

## Build log

| Step | Date | What was built | Key files | Tests added / total | Line coverage | Known gaps |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 2026-11-23 | Spec pack: rules + project docs written before any code | `AGENTS.md`, `project-docs/*` | – | – | – |

## Prompt evolution notes

Record what had to change in a prompt and why (this is the "how prompts evolved" story).

- Step 0: Decided on "numbers from code, words from Gemini" with `{{fact_id}}` placeholders so the
  model can never originate a figure.

## Submissions

| Attempt | Date | Commit | Live URL version | AI evaluation score | Main fixes after it |
| --- | --- | --- | --- | --- | --- |
