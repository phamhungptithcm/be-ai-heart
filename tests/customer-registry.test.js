import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ensureCustomer, listCustomers, loadCustomer } from "../services/api/src/customer-registry.js";

test("customer registry preserves the existing customer_id when slug matches", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-customer-registry-"));
  const serviceStorageRoot = path.join(tempRoot, "services", "api", "data");

  const first = await ensureCustomer({
    serviceStorageRoot,
    customerSlug: "customer-alpha",
    displayName: "Customer Alpha",
    customerId: "customer-alpha-id",
  });
  const second = await ensureCustomer({
    serviceStorageRoot,
    customerSlug: "customer-alpha",
    displayName: "Customer Alpha Updated",
    customerId: "customer-alpha-id-new",
    metadata: {
      renewal_state: "active",
    },
  });
  const allCustomers = await listCustomers({
    serviceStorageRoot,
  });

  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  assert.equal(first.customer_id, "customer-alpha-id");
  assert.equal(second.customer_id, "customer-alpha-id");
  assert.equal(second.display_name, "Customer Alpha Updated");
  assert.equal(second.metadata.renewal_state, "active");
  assert.equal(allCustomers.length, 1);
});

test("customer registry can move an existing customer_id to a new slug without duplicate rows", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-customer-registry-"));
  const serviceStorageRoot = path.join(tempRoot, "services", "api", "data");

  const original = await ensureCustomer({
    serviceStorageRoot,
    customerSlug: "customer-alpha",
    displayName: "Customer Alpha",
    customerId: "shared-customer-id",
  });
  const renamed = await ensureCustomer({
    serviceStorageRoot,
    customerSlug: "customer-alpha-renamed",
    displayName: "Customer Alpha Renamed",
    customerId: "shared-customer-id",
  });
  const loadedByLegacySlug = await loadCustomer({
    serviceStorageRoot,
    customerSlug: "customer-alpha",
  });
  const loadedByNewSlug = await loadCustomer({
    serviceStorageRoot,
    customerSlug: "customer-alpha-renamed",
  });
  const allCustomers = await listCustomers({
    serviceStorageRoot,
  });

  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  assert.equal(original.customer_id, "shared-customer-id");
  assert.equal(renamed.customer_id, "shared-customer-id");
  assert.equal(loadedByLegacySlug, null);
  assert.equal(loadedByNewSlug.customer_slug, "customer-alpha-renamed");
  assert.equal(allCustomers.length, 1);
});
