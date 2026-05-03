# Trip Posting

## Purpose

Trip posting turns lane events into financial transactions. The highest-risk failures are duplicate charges, missed charges, wrong account, wrong vehicle class, wrong rate, and settlement mismatch.

## Posting Flow

1. Ingest lane event idempotently.
2. Normalize facility, gantry, lane, timestamp, direction, class, tag, and plate.
3. Match tag or plate to account or partner.
4. Assemble trip segments.
5. Rate trip through customer-owned rate policy.
6. Check duplicate candidates before posting.
7. Post transaction or create exception.
8. Emit audit, account update, and reconciliation event.

## Dedupe Keys

Use a combination of:

- agency id
- facility id
- gantry id
- lane id
- timestamp window
- tag id
- plate id
- vehicle class
- source event id
- correlation id

## Exceptions

- duplicate candidate
- missing rate
- account mismatch
- tag and plate conflict
- away-agency reject
- failed payment
- delayed event
- lane outage

## Tests To Prefer

- same event replay does not double post
- same tag within duplicate window creates one charge
- tag/plate conflict routes to exception
- away-agency transaction waits for acknowledgement
- reversal keeps audit and original transaction reference
