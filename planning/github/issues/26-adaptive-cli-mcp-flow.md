# Issue 26: Adaptive CLI and MCP Flow

## Title

Ship local-first CLI and MCP workflows for reflection review, proposal benchmark, and promotion

## Labels

- `type:feature`
- `type:backend`
- `priority:p1`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Make the adaptive skill loop usable in a daily engineering workflow before building a heavier team UI.

## Scope

- `heart reflect summary`
- `heart skill status`
- `heart skill propose`
- `heart skill benchmark`
- `heart skill promote`
- MCP tools for reflection summary and benchmark status
- explicit local promotion log with rollback-friendly metadata

## Acceptance Criteria

- a user can review reflections, inspect a proposal, benchmark it, and promote or reject it locally
- MCP clients can read reflection and proposal status without giant payloads
- promotions are explicit, versioned, and reversible
- contract tests cover JSON outputs for the new CLI and MCP surfaces

## Dependencies

- Issue 08
- Issue 24
- Issue 25

## Out of Scope

- team approval UI
- org-wide rollout controls
