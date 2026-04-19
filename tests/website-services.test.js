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
