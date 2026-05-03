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

  assert.equal(services.length, 11);

  for (const service of services) {
    assert.ok(service.slug);
    assert.ok(service.title);
    assert.ok(service.subtitle);
    assert.ok(service.summary);
    assert.ok(service.descriptor);
    assert.ok(service.trustTag);
    assert.ok(service.status);
    assert.ok(service.descriptor.length <= WEBSITE_SERVICE_DESCRIPTOR_MAX_LENGTH);
    assert.ok(service.trustTag.length <= WEBSITE_SERVICE_TRUST_TAG_MAX_LENGTH);
    assert.ok(Array.isArray(service.capabilities));
    assert.ok(service.capabilities.length > 0);
  }
});

test("website services catalog reflects the latest product and enterprise services", () => {
  const services = listWebsiteServices();
  const slugs = services.map((service) => service.slug);

  assert.deepEqual(slugs, [
    "durable-project-memory",
    "cli-ai-agent",
    "coding-workbench",
    "web-portal-chat",
    "mcp-runtime",
    "repo-graph-context-packs",
    "docs-spec-sync",
    "domain-packs",
    "tolling-demo-kit",
    "benchmark-roi",
    "governance-enterprise-readiness",
  ]);

  const allCopy = services
    .flatMap((service) => [
      service.title,
      service.subtitle,
      service.summary,
      service.descriptor,
      ...service.proof.flatMap((item) => [item.label, item.value, item.note]),
      ...service.capabilities.flatMap((capability) => [capability.title, capability.body]),
    ])
    .join(" ");

  assert.match(allCopy, /CLI AI agent/);
  assert.match(allCopy, /CLI IDE/);
  assert.match(allCopy, /Portal chat/);
  assert.match(allCopy, /model selection/);
  assert.match(allCopy, /Tolling Management/);
  assert.match(allCopy, /Tolling Sales MVP Demo Kit/);
  assert.match(allCopy, /payment and billing readiness/);
  assert.doesNotMatch(allCopy, /\b\d+(\.\d+)?k\+?\b|<\s*\d+s|\b\d+%\b/);
});

test("website services catalog keeps code graph trust-first copy stable", () => {
  const service = getWebsiteServiceBySlug("repo-graph-context-packs");

  assert.ok(service);
  // This primary service copy is intentionally snapshot-tested to anchor the approved trust-map narrative.
  assert.equal(service.descriptor, "Builds graph-backed context packs from repo memory");
  assert.equal(service.trustTag, "Core memory");
  assert.match(service.subtitle, /Repo graph, context packs, citations/);
});
