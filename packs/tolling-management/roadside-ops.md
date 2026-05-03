# Roadside Operations

This file is the Tolling v1 bridge to Transportation Management. It covers only roadside operations needed by toll roads, managed lanes, and express lanes.

## Events

- disabled vehicle
- debris
- lane closure
- wrong-way or safety alert
- gantry equipment outage
- crash or emergency
- roadside assistance request

## Flow

1. Intake event.
2. Classify safety risk.
3. Link to facility, segment, gantry, lane, and timestamp.
4. Dispatch safety patrol or escalate to emergency process.
5. Update lane status and customer messaging when policy allows.
6. Close event with audit and metrics.

## Agent Safety

AI may summarize, classify, route, and draft messages. AI must not override emergency procedures, issue unsafe driving instructions, or suppress safety escalation.
