# ADR-0005: EventManager is in-process only

- Status: Accepted
- Date: codified 2026-08-10

## Context
Apps need decoupled callbacks without implying durable messaging.

## Decision
Built-in `event_manager` is process-local. No persistence, cross-process delivery, retry, or DLQ.

## Consequences
- Safe for soft decoupling inside one runtime.
- Reliable integration requires an external message system; do not “fix” EventManager into a bus.
