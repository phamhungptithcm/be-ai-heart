# Tolling Business Rules

## Rule Ownership

The base pack defines rule categories. Customer overlays define actual values.

Customer-owned values include:

- toll rates
- vehicle class mapping
- HOV or managed-lane eligibility
- account replenishment thresholds
- failed payment retry policy
- invoice due windows
- violation fee amounts
- waiver eligibility
- dispute and appeal windows
- collections handoff criteria
- image retention periods
- OCR confidence thresholds
- partner settlement cutoffs

## Default Engineering Rules

- Every money-changing action requires audit.
- Every evidence-changing action requires audit.
- Event ingestion and transaction posting must be idempotent.
- Duplicate detection runs before posting.
- Account state changes require effective dates.
- Plate, owner, account, image, and payment fields are sensitive by default.
- Legal text and customer-facing deadlines must come from customer policy.
- Agents must cite policy before giving support guidance.

## Exception Rules

Route to exception queues when:

- OCR confidence is below customer threshold.
- plate and state conflict with account or DMV data.
- transponder and plate resolve to different accounts.
- vehicle class conflicts with observed class.
- duplicate transaction confidence is high.
- failed payment retry limit is reached.
- dispute changes legal or financial state.
- interoperability partner rejects or delays acknowledgement.

## Cost Rules

- Store raw images only as long as policy requires.
- Generate thumbnails for review UI.
- Cache rate tables and static facility metadata.
- Batch OCR/enrichment when real-time latency is not required.
- Track cost per 1,000 lane events, cost per image reviewed, cost per support case deflected, and cloud spend per facility.
