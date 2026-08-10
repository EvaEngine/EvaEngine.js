# ADR-0006: Consumer documentation is README-only

- Status: Accepted
- Date: 2026-08-10

## Context
Downstream humans and coding agents need a single, npm-visible contract. Long in-repo guides (`docs/`, former `.ai` contracts) do not ship reliably and duplicate quickly.

## Decision
- **npm consumers** use **README.md** as the sole required usage document (public API, config, DI names, recipes).
- **Repo `docs/`** is for maintainers of EvaEngine.js (components, development, ADRs) and is not a consumer dependency.
- Package contents remain governed by `.npmignore` (README is included).

## Consequences
- Public behavior changes must update README (and tests).
- Do not tell consumers to read `docs/` to operate the library.
