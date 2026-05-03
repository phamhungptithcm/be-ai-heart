# Changelog

## 0.1.0 - Unreleased

### Release Scope

- Local `heart` CLI and interactive workbench
- Local MCP server and tool registry
- Code graph, document memory, context packs, domain packs, and benchmark reports
- Guided website, customer portal, and internal admin surfaces for private pilots

### Release Gates

- Test suite must pass through `npm run check`
- `npm run e2e` must pass hosted-auth, CLI smoke, and artifact safety checks
- Production API must start only with complete hosted env config
- Paid public release remains gated until live billing, webhook verification, idempotency, and entitlement sync are validated
