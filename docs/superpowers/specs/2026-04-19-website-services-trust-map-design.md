# Website Services Trust Map Design

## Goal

Redesign the `WebsiteServicesVisual` block so the six BeHeart services feel like a credible enterprise service catalog instead of a soft feature list.

The block should help a first-time website visitor understand, within a few seconds:

- BeHeart provides six concrete services
- each service has a clear operating responsibility
- the overall product feels governed, trustworthy, and enterprise-ready

## Context

Today the service-map block appears in the public website service flows:

- `/services`
- `/services/[slug]`

The current block uses rounded cards with light subtitles such as `Symbols, dependencies, impact paths`. The result is readable only after effort, and the visual hierarchy does not strongly support the product story BeHeart wants to sell:

- durable project memory
- governed AI delivery
- measurable ROI

This hurts first impression quality because the user sees a set of soft pills instead of a serious operating-layer catalog.

## Problem Statement

The current service-map block has three issues:

1. Weak hierarchy
   Service titles, category labels, and subtitles compete visually. The eye does not know what to read first.

2. Weak trust signal
   The current rounded presentation feels more like generic website chrome than an enterprise-grade operating surface.

3. Weak service framing
   The current subtitle style reads like attribute fragments instead of service-level jobs-to-be-done.

## User-Approved Direction

The redesign will follow the approved `A. Trust-First Catalog` direction.

This direction optimizes for:

- clearer service comprehension
- stronger enterprise and trust posture
- enough product character to feel premium without becoming decorative

It does not optimize for:

- dramatic storytelling visuals
- dense audit-table presentation
- re-architecting the broader `/services` page

## Design Principles

1. Trust through structure
   The block should feel reliable because the hierarchy, alignment, and labels are disciplined.

2. Services before categories
   The service name and service responsibility should dominate. Category remains supporting metadata.

3. Short operating-language copy
   Each service overview should read like a controlled module with a specific job, not a vague marketing fragment list.

4. Enterprise-clean, not sterile
   The visual should be crisp, premium, and productized without looking cold or overdesigned.

5. Scope discipline
   Only the overview block and the data it consumes should change in this task.

## Recommended Visual System

### Overall Pattern

Turn each item into a compact service module with three visible layers:

1. `Service title`
2. `Short descriptor`
3. `Trust tag`

The visual should move away from soft pills and closer to a structured enterprise catalog:

- stronger border definition
- cleaner surface separation
- clearer row and card rhythm
- less dependence on faint text for meaning

### Layout

- Keep the existing two-column desktop grid and one-column mobile behavior.
- Preserve equal-height card rhythm where feasible.
- Preserve the existing `Browse all services` CTA.
- Keep the block reusable for both `/services` and `/services/[slug]`.

### Hierarchy

Each service card should read in this order:

1. title
2. responsibility descriptor
3. trust or operating tag
4. category metadata if still shown

`Category` should no longer sit in the strongest position.

### Tone

Use a visual language closer to enterprise infrastructure or financial-product trust references:

- structured light surfaces
- crisp border treatment
- restrained emphasis
- minimal hover lift
- no heavy glow treatment

## Content Model Changes

The existing `subtitle` values are too fragment-like for this block. The redesign should introduce or repurpose data so the visual can show short responsibility descriptors.

Each service overview in the visual should expose:

- `title`
- `descriptor`
- `trustTag`
- `category` as optional supporting metadata

### Descriptor Examples

- `Code Graph`: `Maps repository structure, dependencies, and likely impact`
- `Document Memory`: `Keeps requirements, ADRs, and design context retrievable`
- `Policy Rails`: `Applies governed boundaries, exclusions, and reuse paths`
- `CLI + MCP Runtime`: `Delivers local-first memory into agent workflows`
- `Portal + Admin Surfaces`: `Separates tenant workspace from internal control plane`
- `Benchmark ROI`: `Turns savings and cleanup claims into measurable proof`

### Trust Tag Examples

- `Core memory`
- `Governed`
- `Deterministic`
- `Tenant-safe`
- `Auditable`
- `Measured`

The exact tag wording can be refined during implementation as long as tags stay short and operational.

## Interaction And States

### Default

Each card must clearly expose:

- the service name
- the one-line descriptor
- the trust tag

The default state must already be useful without hover.

### Hover

Hover should only:

- raise the card slightly
- strengthen border or accent treatment
- clarify that the whole block is clickable

Hover must not rely on decorative glow or large motion.

### Active

On `/services/[slug]`, the active service should be visually obvious through:

- stronger border or header emphasis
- active label or tag if needed
- higher contrast title treatment

The active state must remain readable without breaking the overall grid rhythm.

### Focus And Accessibility

- Entire card remains a link target.
- Focus ring must be visible and keyboard-friendly.
- Descriptor contrast must be materially higher than the current implementation.
- Trust tags must not be the sole indicator of state.

## Responsive Behavior

### Desktop

- Two-column layout remains.
- Card heights should stay visually balanced.
- Long names such as `Portal + Admin Surfaces` must wrap cleanly.

### Mobile

- Collapse to one column.
- Descriptor and trust tag must stack cleanly without cramped horizontal compression.
- Touch target remains the full card.

## Implementation Scope

### Files To Update

- `apps/website/components/WebsiteServicesVisual.jsx`
- `apps/website/src/services.js`
- `apps/website/app/globals.css`

### In Scope

- restructure the visual markup for service overview cards
- adjust service overview copy for clearer descriptors
- add or derive trust-tag metadata for the visual
- improve hover, active, focus, and responsive states

### Out Of Scope

- redesigning the full `/services` catalog cards
- changing the large page layout of `/services` or `/services/[slug]`
- changing service detail content architecture
- rewriting all service marketing copy beyond what the visual needs

## Validation

The redesign is successful when:

1. a first-time user can identify that BeHeart has six concrete services without reading dense page copy
2. the visual reads as enterprise-grade and trustworthy, not soft or generic
3. the descriptor text is easier to scan than the current subtitle fragments
4. the block remains usable on both `/services` and `/services/[slug]`
5. hover, focus, and active states remain clear and accessible

## Risks And Tradeoffs

### Risk: Too much metadata per card

If title, descriptor, category, and trust tag all compete, the redesign will recreate the current problem.

Mitigation:

- keep only three strong layers in the default reading path
- demote or remove category from the strongest visual position

### Risk: Overcorrecting into sterile enterprise UI

If the block becomes too table-like, the page may lose product energy.

Mitigation:

- keep card-based presentation
- retain light motion and polish
- use disciplined but not harsh surfaces

### Risk: Copy gets too long

Long descriptors will make the grid uneven and harder to scan.

Mitigation:

- keep descriptors to one short sentence
- keep trust tags to one or two words where possible
