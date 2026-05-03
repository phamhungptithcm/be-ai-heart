# Back-Office Operations

Back-office operations cover account management, finance, image queues, invoice queues, violation queues, disputes, reconciliation, reporting, and audit.

## Core Queues

- account exceptions
- failed replenishment
- image review
- invoice generation
- violation review
- dispute review
- partner reconciliation
- collections handoff

## Operator Metrics

- queue age
- queue volume
- first-contact resolution
- image review throughput
- failed payment retry rate
- duplicate transaction rate
- settlement imbalance
- support case deflection

## Architecture Guidance

- Keep financial accounting separate from support UI.
- Keep dynamic business rules configurable.
- Keep partner contracts behind interfaces.
- Keep audit immutable.
- Keep reports based on sanitized aggregates by default.
