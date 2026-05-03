#!/usr/bin/env node
const surfaces = [
  { name: "website", url: process.env.BE_AI_HEART_WEBSITE_SMOKE_URL ?? "http://127.0.0.1:3000" },
  { name: "portal", url: process.env.BE_AI_HEART_PORTAL_SMOKE_URL ?? "http://127.0.0.1:3001" },
  { name: "admin", url: process.env.BE_AI_HEART_ADMIN_SMOKE_URL ?? "http://127.0.0.1:3002" },
];

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is required for web smoke. Run: npm install --no-save playwright@1.51.1");
  process.exit(1);
}

const browser = await chromium.launch();
const failures = [];
try {
  for (const surface of surfaces) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    const response = await page.goto(surface.url, { waitUntil: "networkidle", timeout: 30_000 });
    if (!response || response.status() >= 400) {
      failures.push(`${surface.name}: root returned ${response?.status() ?? "no response"}`);
    }
    const links = await page.$$eval("a[href]", (anchors) =>
      [...new Set(anchors.map((anchor) => anchor.href).filter((href) => {
        const url = new URL(href);
        return url.origin === window.location.origin;
      }))].slice(0, 24),
    );
    for (const href of links) {
      const nav = await page.goto(href, { waitUntil: "networkidle", timeout: 30_000 });
      if (!nav || nav.status() >= 400) {
        failures.push(`${surface.name}: ${href} returned ${nav?.status() ?? "no response"}`);
      }
    }
    if (consoleErrors.length > 0) {
      failures.push(`${surface.name}: console errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error("Web surface smoke failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Web surface smoke passed for ${surfaces.length} surface(s).`);
