import test from "node:test";
import assert from "node:assert/strict";

import {
  getWebsiteServiceBySlug,
  listWebsiteServices,
  WEBSITE_SERVICE_DESCRIPTOR_MAX_LENGTH,
  WEBSITE_SERVICE_TRUST_TAG_MAX_LENGTH,
} from "../apps/website/src/services.js";

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
    assert.ok(service.descriptor.length <= WEBSITE_SERVICE_DESCRIPTOR_MAX_LENGTH);
    assert.ok(service.trustTag.length <= WEBSITE_SERVICE_TRUST_TAG_MAX_LENGTH);
    assert.ok(Array.isArray(service.capabilities));
    assert.ok(service.capabilities.length > 0);
  }
});

test("website services catalog keeps code graph trust-first copy stable", () => {
  const service = getWebsiteServiceBySlug("code-graph");

  assert.ok(service);
  // This primary service copy is intentionally snapshot-tested to anchor the approved trust-map narrative.
  assert.equal(service.descriptor, "Maps repository structure, dependencies, and likely impact");
  assert.equal(service.trustTag, "Core memory");
  assert.match(service.subtitle, /Symbols, dependencies, impact paths/);
});
