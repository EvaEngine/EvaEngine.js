# ADR-0004: Command as CLI/Cron entry adapter

- Status: Accepted
- Date: codified 2026-08-10

## Context
Non-HTTP entries need a uniform, nameable, argv-driven unit of work.

## Decision
- Subclass `Command` with static `getName`, `getDescription`, `getSpec` and instance `run()`.
- Engine maps names → classes; yargs parses argv for CLI/cron/string runners.
- Commands should stay thin adapters (use cases live in the app).

## Consequences
- Same command class can run from CLI, cron, or `runCommand`.
- Spec shape follows yargs; exotic types are best-effort.
