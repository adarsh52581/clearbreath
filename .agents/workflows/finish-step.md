---
description: Close out a ClearBreath build step — verify, log, commit
---

# /finish-step

1. Run these in order and stop at the first failure: `npm run lint`, `npm run typecheck`,
   `npm run test:coverage`, `npm run build`. If one fails, fix only that failure (smallest change,
   no new features, never weaken or delete tests) and run the sequence again.
2. Run `git status --short`. Make sure nothing from `node_modules/`, `dist/`, `coverage/`, `.env`
   or any other secret file is staged. If something is, unstage it and fix `.gitignore`.
3. Append one row to the "Build log" table in `project-docs/FEATURE_LOG.md`: step number and
   title, today's date, what was built (one line), key files, tests added / total, line coverage
   from the coverage summary, known gaps. If the step's prompt had to be changed or repeated, add
   one line under "Prompt evolution notes" explaining why.
4. Stage and commit with a Conventional Commit message, for example
   `feat(step-5): live air data adapters and /api/air`. Do not push.
5. Reply with: a 3-bullet summary, each command run with pass/fail, the coverage percentages,
   anything I must check by hand, and the next step name from the playbook.
