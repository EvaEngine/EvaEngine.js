# ADR-0002: Process-global DI and Express app

- Status: Accepted (known limitation)
- Date: codified 2026-08-10

## Context
Early design used `constitute` with a module-level container and a lazy singleton Express app for simple bootstrap and low ceremony.

## Decision
- `DI` is a process-wide static facade over one container (`reset()` rebuilds it).
- `EvaEngine.getApp()` returns one module-level Express application.
- Multiple `EvaEngine` instances in one process are **not** isolation-safe.

## Consequences
- Prefer one engine per process.
- Tests use `--test-concurrency=1`, `DI.reset()`, and/or `registerMockedProviders`.
- Future multi-instance isolation would be a breaking architectural change (new ADR).
