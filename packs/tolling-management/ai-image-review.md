# AI Image Review

## Purpose

Image review converts plate evidence into trusted transaction evidence. AI may suggest plate, state, vehicle class, confidence, and reason codes, but low-confidence or high-risk outcomes require human review.

## Queue Inputs

- lane event id
- image reference
- facility, gantry, lane, timestamp
- OCR candidates
- observed vehicle class
- tag read status
- account or DMV match status
- prior corrections

## Review Decisions

- approve OCR candidate
- correct plate or state
- mark unreadable
- mark obstructed
- route trailer/cab ambiguity
- request additional evidence
- escalate to dispute or fraud review

## UI Requirements

- keyboard-first approve, reject, next, previous, zoom, contrast, rotate
- side-by-side image, OCR candidates, plate/account evidence, prior trips
- visible confidence and reason codes
- no raw customer PII beyond what review policy allows
- audit for every correction and approval

## Benchmark Signals

- review time per image
- auto-accept rate above policy threshold
- human correction rate
- false positive and false negative rates
- raw image storage cost
- low-confidence queue age
