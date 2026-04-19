import http from "node:http";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";

export function startMockOidcProvider(options = {}) {
  const hostname = options.hostname ?? process.env.BE_AI_HEART_MOCK_OIDC_HOST ?? "127.0.0.1";
  const requestedPort = Number(options.port ?? process.env.BE_AI_HEART_MOCK_OIDC_PORT ?? 4020);
  const clientId =
    options.clientId ??
    process.env.BE_AI_HEART_AUTH0_CLIENT_ID ??
    process.env.BE_AI_HEART_CLERK_CLIENT_ID ??
    "be-ai-heart-web";
  const clientSecret =
    options.clientSecret ??
    process.env.BE_AI_HEART_AUTH0_CLIENT_SECRET ??
    process.env.BE_AI_HEART_CLERK_CLIENT_SECRET ??
    "local-secret";
  const demoEmail = options.email ?? process.env.BE_AI_HEART_MOCK_OIDC_EMAIL ?? "demo@example.com";
  const demoSubject = options.subject ?? process.env.BE_AI_HEART_MOCK_OIDC_SUBJECT ?? "user_demo";
  const demoActorSlug =
    options.actorSlug ?? process.env.BE_AI_HEART_MOCK_OIDC_ACTOR_SLUG ?? "demo-user";
  const demoCustomerSlug =
    options.customerSlug ?? process.env.BE_AI_HEART_MOCK_OIDC_CUSTOMER_SLUG ?? "demo-customer";
  const demoWorkspaces = normalizeList(
    options.workspaces ?? process.env.BE_AI_HEART_MOCK_OIDC_WORKSPACES ?? demoCustomerSlug,
  );
  const demoRoles = normalizeList(
    options.roles ?? process.env.BE_AI_HEART_MOCK_OIDC_ROLES ?? "customer",
  );
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    use: "sig",
    alg: "RS256",
    kid: "mock-oidc-signing-key",
  };
  const authorizationCodes = new Map();

  const server = http.createServer(async (req, res) => {
    const address = server.address();
    const effectivePort = typeof address === "object" && address ? address.port : requestedPort;
    const issuer = `http://${hostname}:${effectivePort}`;
    const url = new URL(req.url ?? "/", issuer);

    if (url.pathname === "/.well-known/openid-configuration") {
      return respondJson(res, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ["code"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
        scopes_supported: ["openid", "profile", "email"],
      });
    }

    if (url.pathname === "/jwks") {
      return respondJson(res, {
        keys: [jwk],
      });
    }

    if (url.pathname === "/authorize") {
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state");
      if (!redirectUri || !state) {
        return respondJson(res, { error: "redirect_uri and state are required" }, 400);
      }

      if (url.searchParams.get("approve") === "1") {
        const code = randomUUID();
        authorizationCodes.set(code, {
          client_id: url.searchParams.get("client_id") ?? clientId,
          redirect_uri: redirectUri,
        });
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set("code", code);
        callbackUrl.searchParams.set("state", state);
        res.statusCode = 302;
        res.setHeader("Location", callbackUrl.toString());
        res.end();
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Mock Auth Login</title>
            <style>
              body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 40px; background: #f6fbfb; color: #103236; }
              main { max-width: 560px; margin: 0 auto; background: white; border: 1px solid #c8dfdf; border-radius: 18px; padding: 28px; }
              a { display: inline-block; margin-top: 20px; background: #0f766e; color: white; padding: 12px 18px; border-radius: 999px; text-decoration: none; }
              code { background: #ebf6f5; padding: 2px 6px; border-radius: 6px; }
            </style>
          </head>
          <body>
            <main>
              <p>Mock OIDC Provider</p>
              <h1>Approve demo login</h1>
              <p>This simulates an Auth0/Clerk hosted login step for local E2E checks.</p>
              <p>Client: <code>${escapeHtml(url.searchParams.get("client_id") ?? clientId)}</code></p>
              <a href="${escapeAttribute(`${url.toString()}&approve=1`)}">Continue as ${escapeHtml(demoEmail)}</a>
            </main>
          </body>
        </html>
      `);
      return;
    }

    if (url.pathname === "/oauth/token" && req.method === "POST") {
      const body = await readBody(req);
      const payload = new URLSearchParams(body);
      const code = payload.get("code");
      const redirectUri = payload.get("redirect_uri");
      const authCode = authorizationCodes.get(code ?? "");

      if (!authCode || authCode.redirect_uri !== redirectUri) {
        return respondJson(res, { error: "invalid_grant" }, 400);
      }

      const requestClientId = payload.get("client_id") ?? clientId;
      const requestClientSecret = payload.get("client_secret");
      if (requestClientId !== clientId || (requestClientSecret && requestClientSecret !== clientSecret)) {
        return respondJson(res, { error: "invalid_client" }, 401);
      }

      authorizationCodes.delete(code);
      const idToken = createIdToken({
        issuer,
        audience: clientId,
        demoEmail,
        demoSubject,
        demoActorSlug,
        demoCustomerSlug,
        demoWorkspaces,
        demoRoles,
        jwk,
        privateKey,
      });

      return respondJson(res, {
        access_token: "mock-access-token",
        token_type: "Bearer",
        expires_in: 300,
        id_token: idToken,
      });
    }

    return respondJson(res, { error: "Not found" }, 404);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, hostname, () => {
      const address = server.address();
      const effectivePort = typeof address === "object" && address ? address.port : requestedPort;
      const issuer = `http://${hostname}:${effectivePort}`;
      resolve({
        server,
        issuer,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }

              closeResolve();
            });
          }),
      });
    });
  });
}

function createIdToken({
  issuer,
  audience,
  demoEmail,
  demoSubject,
  demoActorSlug,
  demoCustomerSlug,
  demoWorkspaces,
  demoRoles,
  jwk,
  privateKey,
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: jwk.kid,
  };
  const payload = {
    iss: issuer,
    aud: audience,
    sub: demoSubject,
    email: demoEmail,
    preferred_username: demoActorSlug,
    be_ai_heart_customer_slug: demoCustomerSlug,
    be_ai_heart_workspaces: demoWorkspaces,
    roles: demoRoles,
    iat: now,
    nbf: now,
    exp: now + 300,
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8"),
    privateKey,
  );
  return `${encodedHeader}.${encodedPayload}.${toBase64Url(signature)}`;
}

function toBase64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function respondJson(res, payload, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return String(value).replace(/"/g, "&quot;");
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startMockOidcProvider()
    .then(({ issuer }) => {
      process.stdout.write(`Mock OIDC provider listening on ${issuer}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error?.message || "Failed to start mock OIDC provider."}\n`);
      process.exitCode = 1;
    });
}
