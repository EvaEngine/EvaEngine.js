# ADR-0007: Commit package-lock.json; no package-lock:false

- Status: Accepted
- Date: 2026-08-10

## Context
`package.json` had `"package-lock": false` while the repo and CI still used `package-lock.json` + npm cache — inconsistent with common npm library practice.

## Decision
- Remove `"package-lock": false`.
- Keep **`package-lock.json` committed**.
- Install/CI via `npm install` / lockfile-aware workflows.

## Consequences
- Reproducible CI installs.
- Aligns with npm default and this repo’s existing lock + Actions cache.
