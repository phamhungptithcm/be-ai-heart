# Safe Demo Data

All records are fake and intentionally obvious. Do not replace them with production data.

## Data Rules

- Account IDs start with `DEMO-ACCT` or `DEMO-FLEET`.
- Plate values use `DEMO`, `SAMPLE`, or `FAKE`.
- Transponder IDs start with `TAG-DEMO`.
- Payment references use token placeholders only.
- Addresses, email, phone, and attachments are omitted or replaced with fake labels.
- Amounts are demo-only and must not be presented as agency toll rates.

## Sample Accounts

| Account ID | Customer label | Type | Status | Balance | Notes |
|---|---|---|---|---:|---|
| DEMO-ACCT-1001 | Jordan Demo | Personal | Good standing | 42.75 | Primary Account 360 example. |
| DEMO-ACCT-1002 | Avery Sample | Personal | Payment update needed | 0.00 | Failed replenishment scenario. |
| DEMO-FLEET-2040 | Northline Demo Fleet | Fleet | Review queue | 318.20 | Fleet overlay and RFP scenario. |

## Sample Vehicles And Plates

| Vehicle | Plate | Jurisdiction | Transponder | Status |
|---|---|---|---|---|
| Demo Sedan 01 | DEMO123 | Demo State | TAG-DEMO-0001 | Active |
| Demo Pickup 07 | SAMPLE9 | Demo State | TAG-DEMO-0007 | Tag not reading |
| Demo Fleet Van 12 | FAKE404 | Demo State | TAG-DEMO-0042 | Fulfillment pending |

## Sample Trips And Invoices

| Trip ID | Facility label | Event summary | Charge | State |
|---|---|---|---:|---|
| TRIP-DEMO-7001 | Demo North Express | Tag read, plate confirmed | 4.25 | Posted |
| TRIP-DEMO-7002 | Demo Managed Lane | Plate image reviewed | 8.40 | Invoice line |
| TRIP-DEMO-7003 | Demo Connector | Replay event detected | 0.00 | Duplicate candidate |

| Invoice | Account | Amount | State | Demo purpose |
|---|---|---:|---|---|
| INV-DEMO-9001 | DEMO-ACCT-1001 | 12.65 | Open | Pay bill flow. |
| INV-DEMO-9002 | DEMO-ACCT-1002 | 28.10 | Notice pending | Failed payment scenario. |

## Sample Payments

| Payment ref | Method | Amount | State | Notes |
|---|---|---:|---|---|
| PAY-DEMO-OK-01 | Hosted token `tok_demo_visa_01` | 25.00 | Captured | Safe token placeholder. |
| PAY-DEMO-FAIL-01 | Hosted token `tok_demo_expired_02` | 40.00 | Failed | Customer update needed. |
| REF-DEMO-NEEDS-APPROVAL | Prior payment reference | 18.00 | Approval needed | Refund threshold scenario. |

## Sample Cases

| Case | Type | State | SLA | Scenario |
|---|---|---|---|---|
| CASE-DEMO-301 | Dispute | Open | 2 days | Customer disputes a managed lane charge. |
| CASE-DEMO-302 | Transponder issue | Waiting on fulfillment | 1 day | Replacement tag order. |
| CASE-DEMO-303 | Scam report | Resolved | Same day | Customer received unknown toll text. |

## Sample Inventory And Notifications

| Item | SKU | State | Location |
|---|---|---|---|
| TAG-DEMO-0101 | SKU-DEMO-STICKER | Available | Demo Warehouse A |
| TAG-DEMO-0102 | SKU-DEMO-STICKER | Reserved | Demo Warehouse A |
| TAG-DEMO-0103 | SKU-DEMO-HARDCASE | Returned | Demo Warehouse B |

| Notification | Channel | State | Safety note |
|---|---|---|---|
| NOTIF-DEMO-EMAIL-01 | Email | Sent | Includes official payment guidance. |
| NOTIF-DEMO-SMS-01 | SMS | Opted out | No payment link sent. |
| NOTIF-DEMO-MAIL-01 | Letter | Queued | Uses invoice notice template. |

