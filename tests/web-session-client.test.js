import test from "node:test";
import assert from "node:assert/strict";

import {
  getPortalDefaultSessionToken,
  getPortalSessionState,
} from "../apps/portal/src/api-client.js";
import {
  getAdminDefaultSessionToken,
  getAdminSessionState,
} from "../apps/admin/src/api-client.js";

test("portal and admin clients do not inject demo session fallbacks unless local demo auth is enabled", () => {
  const previousPortalFlag = process.env.NEXT_PUBLIC_BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH;
  const previousPortalSession = process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_PORTAL_SESSION;
  const previousAdminSession = process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION;
  const previousWindow = global.window;

  delete process.env.NEXT_PUBLIC_BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH;
  delete process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_PORTAL_SESSION;
  delete process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION;
  delete global.window;

  try {
    assert.equal(getPortalDefaultSessionToken(), "");
    assert.equal(getPortalSessionState().sessionToken, "");
    assert.equal(getAdminDefaultSessionToken(), "");
    assert.equal(getAdminSessionState().sessionToken, "");

    process.env.NEXT_PUBLIC_BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH = "1";
    process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_PORTAL_SESSION = "portal-demo-session";
    process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION = "admin-owner-session";

    assert.equal(getPortalDefaultSessionToken(), "portal-demo-session");
    assert.equal(getPortalSessionState().sessionToken, "portal-demo-session");
    assert.equal(getAdminDefaultSessionToken(), "admin-owner-session");
    assert.equal(getAdminSessionState().sessionToken, "admin-owner-session");
  } finally {
    if (previousPortalFlag === undefined) {
      delete process.env.NEXT_PUBLIC_BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH;
    } else {
      process.env.NEXT_PUBLIC_BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH = previousPortalFlag;
    }
    if (previousPortalSession === undefined) {
      delete process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_PORTAL_SESSION;
    } else {
      process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_PORTAL_SESSION = previousPortalSession;
    }
    if (previousAdminSession === undefined) {
      delete process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION;
    } else {
      process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION = previousAdminSession;
    }
    if (previousWindow === undefined) {
      delete global.window;
    } else {
      global.window = previousWindow;
    }
  }
});
