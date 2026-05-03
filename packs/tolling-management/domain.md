# Tolling Management Domain

## Purpose

This domain pack gives AI agents durable context for toll road, managed lane, and express lane systems. It helps agents build back-office, roadside, image review, trip posting, support, security, UI, and cloud-cost work without re-learning tolling basics in every task.

## Non-Goals

- It does not train or fine-tune a model.
- It does not define legal policy.
- It does not replace customer-specific toll rates, fee rules, notice rules, collections rules, or retention rules.
- It does not cover full Transportation Management System logistics such as carrier procurement, freight planning, or warehouse fulfillment.

## Core Concepts

- Agency: toll authority, transportation department, or operating entity.
- Facility: toll road, bridge, tunnel, or managed lane network.
- Gantry: roadside tolling point that captures tag reads, plate images, vehicle class, and lane events.
- Transponder: tag used for electronic toll collection.
- Plate image: image evidence used when tag read is missing, invalid, or insufficient.
- Account: customer payment and vehicle relationship used for toll posting.
- Trip: rated movement across one or more tolling points.
- Toll transaction: posted financial event for a trip or segment.
- Invoice: bill for non-tag or unresolved account travel.
- Violation notice: enforcement notice for unpaid or unauthorized travel.
- Dispute: customer challenge to toll, fee, notice, plate, ownership, or account state.
- Home agency: agency that owns the customer account or tag.
- Away agency: agency that observed travel by another agency's customer.

## Product Boundaries

Tolling systems typically split into:

- Roadside systems: lane devices, cameras, tag readers, classifiers, gantries, closures, incident signals.
- Back-office systems: accounts, transactions, rating, invoices, violations, disputes, payments, reconciliation.
- Customer channels: web portal, mobile portal, call center, retail payment, email/mail notices.
- Operations tools: queues, dashboards, audit, image review, exception management, reporting.
- Partner interfaces: DMV/vehicle owner lookup, payment providers, collection providers, interoperability partners, notification vendors.

## Customer Overlay Rules

Customer overlays must own:

- facility names and toll zones
- toll rates and vehicle classes
- payment provider names
- notice windows and legal language
- fee and waiver policy
- retention windows
- image review thresholds
- OCR vendor constraints
- support escalation SLAs
- integration endpoint names

The base pack may describe patterns; it must not encode customer-specific legal or financial values.

## Agent Guidance

When an AI agent receives a tolling task:

1. Identify the workflow: trip posting, image review, invoice, violation, support, roadside, reconciliation, UI, security, or cloud cost.
2. Retrieve the relevant pack sections and customer overlay.
3. Prefer customer policy over base-pack defaults.
4. Avoid inventing toll amounts, deadlines, penalties, legal outcomes, or agency commitments.
5. Preserve auditability when customer money, evidence, disputes, or account status can change.
