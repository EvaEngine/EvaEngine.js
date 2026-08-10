# ADR-0001: Runtime-first multi-entry application model

- Status: Accepted
- Date: 2016–2026 (codified 2026-08-10)

## Context
Apps need HTTP, CLI, and scheduled jobs sharing config, logging, cache, DB, and auth. Duplicating bootstrap per entry causes inconsistent lifecycle and hard tests.

## Decision
EvaEngine is an **Application Runtime**, not an Express facade. Entries share one engine, DI, and provider model; adapters differ by mode (`web` / `cli`) and run APIs (`run`, `runCLI`, `runCrontab`).

## Consequences
- Capabilities are composed via providers; business code should depend on DI names, not ad-hoc clients.
- HTTP is one entry among several.
- Cross-cutting features stay in middleware/services, not copied into each handler.
