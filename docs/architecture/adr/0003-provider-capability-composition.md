# ADR-0003: Providers as capability composition boundary

- Status: Accepted
- Date: codified 2026-08-10

## Context
Apps need replaceable infra (Redis, JWT, HTTP clients) without rewriting business code.

## Decision
- `ServiceProvider` / middleware providers register capabilities into DI (`bindClass` / `bindMethod` / `bindValue`).
- Stable **names** (e.g. `config`, `logger`, `jwt`, `auth`) are the extension surface.
- Implementations may switch by config (e.g. `token.provider === 'kong'`).
- Provider lifecycle today is essentially `register()` only.

## Consequences
- Extend via new providers or `set*ServiceProviders*` / `setMiddlewareProviders`.
- Do not put domain logic in providers.
- Registration order matters when providers depend on each other; document prerequisites.
