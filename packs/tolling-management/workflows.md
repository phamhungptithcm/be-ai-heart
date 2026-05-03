# Tolling Workflows

## Tag-Based Trip Posting

Trigger: a gantry or lane emits an event with a tag read.

Flow:

1. Accept lane event through an idempotent ingestion key.
2. Normalize facility, gantry, lane, timestamp, direction, and vehicle class.
3. Match transponder to home or away agency.
4. Validate account, tag, vehicle, and payment state.
5. Assemble trip or trip segment.
6. Rate against customer-owned rate policy.
7. Deduplicate against matching lane events, tag, plate, class, and time window.
8. Post toll transaction.
9. Emit audit and reconciliation events.

Edge cases:

- inactive tag
- negative balance
- transponder mounted incorrectly
- duplicate read
- mismatched vehicle class
- away-agency tag
- delayed settlement
- lane clock drift

## Video Toll / Pay-By-Plate

Trigger: a lane event lacks a valid tag match or policy requires plate evidence.

Flow:

1. Capture plate image and metadata.
2. Run OCR and vehicle-class enrichment.
3. Route high-confidence matches to auto-processing when customer policy allows it.
4. Route low-confidence, obstructed, ambiguous, or high-risk matches to image review.
5. Resolve plate to account, fleet/rental owner, DMV owner, or invoice workflow.
6. Post to account, issue invoice, or create violation path based on customer rules.

Edge cases:

- unreadable plate
- obstructed plate
- trailer/cab plate ambiguity
- temporary plate
- out-of-state owner
- rental fleet plate
- sold or stolen vehicle claim
- stale DMV address

## Invoice, Violation, Dispute, And Waiver

Flow:

1. Create invoice from eligible unpaid transactions.
2. Issue invoice through customer-owned channel policy.
3. Track due status.
4. Create violation notice when policy criteria are met.
5. Accept dispute or waiver request.
6. Review evidence, account state, payment history, and customer statement.
7. Draft recommendation.
8. Require authorized human or system approval for outcome.
9. Record audit and update case state.

Rules:

- Fee amounts, notice windows, and collections language live in customer overlay.
- AI may classify, summarize, and recommend.
- AI must not silently waive fees, dismiss violations, or move cases to collections.

## Customer Support

Supported intents:

- account recovery
- add or remove vehicle
- update plate, address, or payment method
- failed replenishment
- invoice lookup
- violation dispute
- transponder replacement
- toll text scam concern
- accessible support or language support

Agent behavior:

- Cite source or customer policy.
- Ask for human escalation when identity, payment, legal, or evidence review is involved.
- Never request raw card or bank data.
- Direct users to official agency websites or known phone numbers for suspicious toll texts.

## Roadside Operations

This pack includes only the TMS bridge needed for tolling operations.

Flow:

1. Intake incident, disabled vehicle, debris, lane closure, or safety concern.
2. Link event to facility, segment, gantry, lane, and current lane status.
3. Dispatch roadside support or notify operations.
4. Update customer messaging when lanes or facility availability change.
5. Close incident with audit trail and operational metrics.

## Interoperability And Settlement

Flow:

1. Identify whether the tag or account is home agency or away agency.
2. Exchange valid tag and plate lists through partner interface contracts.
3. Send and acknowledge away-agency transactions.
4. Reconcile accepted, rejected, duplicate, adjusted, and delayed settlement records.
5. Route exceptions to partner-specific queues.

Architecture rule:

- Partner rules belong behind interfaces. Do not scatter agency-specific conditions across trip posting, invoicing, support, or UI code.
