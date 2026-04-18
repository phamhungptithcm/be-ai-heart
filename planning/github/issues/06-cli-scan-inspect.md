# Issue 06: CLI Scan and Inspect Commands

## Title

Implement production-grade CLI commands for scan, find, deps, impact, and docs search

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Turn `heart` into a usable daily tool for engineers and agents.

## Scope

- `heart scan`
- `heart find symbol`
- `heart deps`
- `heart impact`
- `heart docs search`
- stable JSON outputs

## Acceptance Criteria

- each command has deterministic JSON mode
- help output is clear and concise
- command tests cover happy path and error path

## Dependencies

- Issue 02
- Issue 03
- Issue 04

## Out of Scope

- fully interactive TUI
