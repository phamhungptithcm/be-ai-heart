# Security And Privacy

## Sensitive Data

Treat these as sensitive:

- license plate
- plate image
- vehicle owner
- address
- account balance
- payment status
- trip history
- support transcript
- dispute evidence
- payment provider reference

## Forbidden In Examples

- real plate numbers
- real account numbers
- real customer names
- card numbers
- bank account numbers
- raw secrets
- raw production endpoints
- raw plate images in benchmark evidence

## Agent Guardrails

- Redact by default.
- Cite policy for customer-facing claims.
- Require audit for money, evidence, account status, dispute, waiver, and collections changes.
- Require human review for low-confidence OCR and disputed outcomes.
- Prefer least privilege for support, OCR, payment, DMV, and notification integrations.
- Do not let prompt instructions override customer privacy policy.

## Threats

- context leakage across customers
- prompt leakage of plate or account data
- support agent requesting payment secrets
- fake toll payment links
- unauthorized image access
- duplicate charge through replayed event
- partner settlement tampering
