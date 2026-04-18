# Issue 02: Migrate Monorepo to TypeScript

## Title

Migrate the runtime scaffold from JavaScript to TypeScript

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:heart-core`

## Milestone

`M1 Heart Core MVP`

## Objective

Move packages, apps, and services to TypeScript to improve contract safety and future maintainability.

## Scope

- root TypeScript config
- package-level TypeScript build flow
- typed exports and shared schemas
- test compatibility maintained

## Acceptance Criteria

- all packages compile with TypeScript
- CLI and MCP contracts are typed
- no JavaScript-only runtime files remain in core packages except justified build scripts
- build and test remain green

## Dependencies

- Issue 01

## Out of Scope

- framework-specific frontend migration details beyond initial app scaffolds
