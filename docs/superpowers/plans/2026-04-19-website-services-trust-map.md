# Website Services Trust Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the website services overview block so the six BeHeart services read as a trust-first enterprise catalog with clearer service jobs, stronger hierarchy, and accessible active or hover states.

**Architecture:** Keep the change tightly scoped to the website service overview surface. Extend the service catalog data with lightweight visual metadata in `apps/website/src/services.js`, consume that metadata in `WebsiteServicesVisual.jsx`, and restyle the existing card grid in `apps/website/app/globals.css` without changing the broader `/services` or `/services/[slug]` layouts.

**Tech Stack:** Next.js App Router, React JSX components, shared website CSS in `apps/website/app/globals.css`, Node.js built-in `node:test`, `npm run website:build`

---

## File Map

- `apps/website/src/services.js`
  Canonical service catalog data. Add compact service-visual metadata that can power the trust-first overview without disrupting existing detail-page copy.

- `tests/website-services.test.js`
  Contract coverage for the website service catalog. Extend it to assert the new metadata exists, remains short enough for the overview cards, and keeps the approved copy stable for the first service.

- `apps/website/components/WebsiteServicesVisual.jsx`
  Render the overview cards with a stronger reading order: title, descriptor, trust tag, then supporting category metadata. Preserve active-state support for detail pages.

- `apps/website/app/globals.css`
  Convert the current soft card styling into a crisper enterprise catalog with clearer text contrast, restrained motion, visible focus rings, and responsive tag wrapping.

### Task 1: Add Trust-First Service Metadata Contract

**Files:**
- Modify: `tests/website-services.test.js`
- Modify: `apps/website/src/services.js`

- [ ] **Step 1: Write the failing metadata contract tests**

```js
// tests/website-services.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { getWebsiteServiceBySlug, listWebsiteServices } from "../apps/website/src/services.js";

test("website services catalog exposes trust-first overview metadata", () => {
  const services = listWebsiteServices();

  assert.equal(services.length, 6);

  for (const service of services) {
    assert.ok(service.slug);
    assert.ok(service.title);
    assert.ok(service.subtitle);
    assert.ok(service.summary);
    assert.ok(service.descriptor);
    assert.ok(service.trustTag);
    assert.ok(service.descriptor.length <= 72);
    assert.ok(service.trustTag.length <= 16);
    assert.ok(Array.isArray(service.capabilities));
    assert.ok(service.capabilities.length > 0);
  }
});

test("website services catalog keeps code graph trust-first copy stable", () => {
  const service = getWebsiteServiceBySlug("code-graph");

  assert.ok(service);
  assert.equal(service.descriptor, "Maps repository structure, dependencies, and likely impact");
  assert.equal(service.trustTag, "Core memory");
  assert.match(service.subtitle, /Symbols, dependencies, impact paths/);
});
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
node --test tests/website-services.test.js
```

Expected:

```text
FAIL tests/website-services.test.js
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  assert.ok(service.descriptor)
```

- [ ] **Step 3: Add descriptor and trust-tag metadata to the service catalog**

```js
// apps/website/src/services.js
// Add these lines directly below `subtitle` in each service object.
descriptor: "Maps repository structure, dependencies, and likely impact",
trustTag: "Core memory",

descriptor: "Keeps requirements, ADRs, and design context retrievable",
trustTag: "Citable",

descriptor: "Applies governed boundaries, exclusions, and reuse paths",
trustTag: "Governed",

descriptor: "Delivers local-first memory into agent workflows",
trustTag: "Deterministic",

descriptor: "Separates tenant workspace from internal control plane",
trustTag: "Tenant-safe",

descriptor: "Turns savings and cleanup claims into measurable proof",
trustTag: "Measured",
```

- [ ] **Step 4: Run the contract test to verify it passes**

Run:

```bash
node --test tests/website-services.test.js
```

Expected:

```text
✔ website services catalog exposes trust-first overview metadata
✔ website services catalog keeps code graph trust-first copy stable
ℹ fail 0
```

- [ ] **Step 5: Commit the data contract change**

```bash
git add apps/website/src/services.js tests/website-services.test.js
git commit -m "feat(website): add services trust-map metadata"
```

### Task 2: Refactor `WebsiteServicesVisual` Into A Trust-First Catalog

**Files:**
- Modify: `apps/website/components/WebsiteServicesVisual.jsx`
- Verify with: `tests/website-services.test.js`

- [ ] **Step 1: Record the verification rationale for this task**

Presentation markup in `WebsiteServicesVisual.jsx` is not currently executable through the repo's `node --test` harness because the component is JSX and imports `next/link`. Do not add brittle source-string tests. Use the data contract from Task 1 plus a real Next build to verify integration.

- [ ] **Step 2: Replace the card markup with title, descriptor, trust tag, and supporting meta**

```jsx
// apps/website/components/WebsiteServicesVisual.jsx
import Link from "next/link";
import { listWebsiteServices } from "../src/services.js";

export function WebsiteServicesVisual({
  activeSlug = "",
  title = "Service map",
  description = "Six concrete services turn project memory into a usable AI operating layer.",
}) {
  const services = listWebsiteServices();

  return (
    <div className="website-services-visual">
      <div className="website-services-visual-head">
        <span>Services</span>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <div className="website-services-visual-grid">
        {services.map((service) => {
          const isActive = service.slug === activeSlug;

          return (
            <Link
              key={service.slug}
              href={`/services/${service.slug}`}
              className="website-services-visual-card"
              data-active={isActive}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="website-services-visual-card-top">
                <strong>{service.title}</strong>
                <span className="website-services-visual-tag">
                  {isActive ? "Current service" : service.trustTag}
                </span>
              </div>
              <p className="website-services-visual-descriptor">{service.descriptor}</p>
              <div className="website-services-visual-card-meta">
                <small>{service.category}</small>
                <span className="website-services-visual-card-link">Open service</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="website-services-visual-foot">
        <Link href="/services">Browse all services</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run the contract test and website build to verify the markup integrates cleanly**

Run:

```bash
node --test tests/website-services.test.js
npm run website:build
```

Expected:

```text
✔ website services catalog exposes trust-first overview metadata
✔ website services catalog keeps code graph trust-first copy stable
▲ Next.js 16.2.4
✓ Compiled successfully
```

- [ ] **Step 4: Commit the component refactor**

```bash
git add apps/website/components/WebsiteServicesVisual.jsx
git commit -m "feat(website): refactor services visual hierarchy"
```

### Task 3: Restyle The Overview Cards For Enterprise Trust And Accessibility

**Files:**
- Modify: `apps/website/app/globals.css`
- Verify with: `npm run website:build`

- [ ] **Step 1: Record the verification rationale for CSS**

This task is primarily visual-state and responsive CSS work. Avoid brittle text-matching tests against CSS. Verify with a real website build and a manual smoke pass on `/services` and `/services/code-graph`.

- [ ] **Step 2: Replace the existing visual-card styles with the trust-first catalog styles**

```css
/* apps/website/app/globals.css */
.website-services-visual-card {
  display: grid;
  gap: 12px;
  min-height: 172px;
  padding: 18px 18px 20px;
  text-decoration: none;
  border: 1px solid #dbe2ee;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(247, 250, 255, 0.98));
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

.website-services-visual-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.website-services-visual-card-top strong {
  font-family: "Space Grotesk", "Avenir Next Condensed", sans-serif;
  font-size: 1.18rem;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--website-page-ink);
}

.website-services-visual-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #edf3ff;
  color: #2147aa;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}

.website-services-visual-descriptor {
  margin: 0;
  color: #4d5c75;
  line-height: 1.55;
}

.website-services-visual-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
}

.website-services-visual-card-meta small {
  color: #6a7891;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.website-services-visual-card-link {
  color: #274275;
  font-size: 0.84rem;
  font-weight: 600;
}

.website-services-visual-card:hover,
.website-services-visual-card[data-active="true"] {
  transform: translateY(-2px);
  border-color: rgba(44, 84, 255, 0.28);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
}

.website-services-visual-card:focus-visible {
  outline: 3px solid rgba(44, 84, 255, 0.28);
  outline-offset: 2px;
}

.website-services-visual-card[data-active="true"] .website-services-visual-tag {
  background: #2147aa;
  color: #ffffff;
}

@media (max-width: 720px) {
  .website-services-visual-card-top,
  .website-services-visual-card-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .website-services-visual-tag {
    white-space: normal;
  }
}
```

- [ ] **Step 3: Run the website build after the CSS change**

Run:

```bash
npm run website:build
```

Expected:

```text
▲ Next.js 16.2.4
✓ Compiled successfully
Route (app)
○ /services
```

- [ ] **Step 4: Run the manual smoke pass**

Run:

```bash
npm run website:dev
```

Then verify in the browser:

- `/services` shows six overview cards with clear title, descriptor, and trust tag
- `/services/code-graph` shows the active card with an obvious current-state treatment
- the `Portal + Admin Surfaces` card wraps without looking cramped
- mobile-width inspection keeps the trust tag and descriptor stacked cleanly
- keyboard focus is visible on overview cards

- [ ] **Step 5: Commit the visual polish**

```bash
git add apps/website/app/globals.css
git commit -m "feat(website): polish services trust map states"
```

### Task 4: Final Regression Sweep

**Files:**
- Verify: `tests/website-services.test.js`
- Verify: `apps/website/components/WebsiteServicesVisual.jsx`
- Verify: `apps/website/app/globals.css`
- Verify: `apps/website/src/services.js`

- [ ] **Step 1: Run the focused regression commands**

Run:

```bash
node --test tests/website-services.test.js
npm run website:build
```

Expected:

```text
✔ website services catalog exposes trust-first overview metadata
✔ website services catalog keeps code graph trust-first copy stable
▲ Next.js 16.2.4
✓ Compiled successfully
```

- [ ] **Step 2: Review the final diff for scope discipline**

Run:

```bash
git show --stat --oneline HEAD~3..HEAD
```

Expected:

```text
feat(website): add services trust-map metadata
feat(website): refactor services visual hierarchy
feat(website): polish services trust map states
apps/website/app/globals.css
apps/website/components/WebsiteServicesVisual.jsx
apps/website/src/services.js
 tests/website-services.test.js
```

- [ ] **Step 3: Confirm there are no remaining unstaged trust-map changes**

```bash
git diff -- apps/website/src/services.js apps/website/components/WebsiteServicesVisual.jsx apps/website/app/globals.css tests/website-services.test.js
```

Expected:

```text
No output.
```
