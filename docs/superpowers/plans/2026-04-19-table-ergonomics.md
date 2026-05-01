# Table Ergonomics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-grade search, quick filters, and explicit sort states to the repository, customer, support, and benchmark tables.

**Architecture:** Keep row derivation and table-state logic in pure helper modules scoped to `apps/portal/src` and `apps/admin/src`, then wire lightweight controls into the existing client components. Avoid a shared package extraction because the portal and admin tables already sit behind separate product and security boundaries.

**Tech Stack:** Next.js App Router, React client components, plain CSS, `node --test`

---

### Task 1: Portal repositories helper and tests

**Files:**
- Create: `apps/portal/src/table-state.js`
- Create: `apps/portal/src/table-state.test.js`
- Modify: `apps/portal/components/PortalProfilesClient.jsx`
- Modify: `apps/portal/app/globals.css`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run `node --test apps/portal/src/table-state.test.js` and verify it fails**
- [ ] **Step 3: Implement minimal portal repository row normalization, filtering, and sorting helpers**
- [ ] **Step 4: Run `node --test apps/portal/src/table-state.test.js` and verify it passes**
- [ ] **Step 5: Wire repository controls into `PortalProfilesClient.jsx`**

### Task 2: Portal benchmark helper and tests

**Files:**
- Modify: `apps/portal/src/table-state.js`
- Modify: `apps/portal/src/table-state.test.js`
- Modify: `apps/portal/components/PortalBenchmarkHistoryClient.jsx`
- Modify: `apps/portal/app/globals.css`

- [ ] **Step 1: Write the failing benchmark-helper test**
- [ ] **Step 2: Run `node --test apps/portal/src/table-state.test.js` and verify it fails**
- [ ] **Step 3: Implement minimal benchmark row filtering and sorting helpers**
- [ ] **Step 4: Run `node --test apps/portal/src/table-state.test.js` and verify it passes**
- [ ] **Step 5: Wire benchmark controls into `PortalBenchmarkHistoryClient.jsx`**

### Task 3: Admin customer/support/benchmark helper and tests

**Files:**
- Create: `apps/admin/src/table-state.js`
- Create: `apps/admin/src/table-state.test.js`
- Modify: `apps/admin/components/AdminCustomerInventoryClient.jsx`
- Modify: `apps/admin/components/AdminSupportOperationsClient.jsx`
- Modify: `apps/admin/components/AdminBenchmarkHistoryClient.jsx`
- Modify: `apps/admin/app/globals.css`

- [ ] **Step 1: Write the failing admin-helper tests**
- [ ] **Step 2: Run `node --test apps/admin/src/table-state.test.js` and verify it fails**
- [ ] **Step 3: Implement minimal admin row filtering and sorting helpers**
- [ ] **Step 4: Run `node --test apps/admin/src/table-state.test.js` and verify it passes**
- [ ] **Step 5: Wire controls into the three admin clients**

### Task 4: Verification

**Files:**
- Verify only

- [ ] **Step 1: Run `node --test apps/portal/src/table-state.test.js apps/admin/src/table-state.test.js`**
- [ ] **Step 2: Run `npm run portal:build`**
- [ ] **Step 3: Run `npm run admin:build`**
- [ ] **Step 4: Note any residual risk if build or full UI verification cannot complete**
