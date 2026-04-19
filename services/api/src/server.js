import http from "node:http";
import { Buffer } from "node:buffer";

import { handleServiceHttpRequest, resolveHttpConfig } from "./http.js";

export function startServiceHost(options = {}) {
  const config = resolveHttpConfig(options);
  const port = Number(options.port ?? process.env.PORT ?? process.env.BE_AI_HEART_API_PORT ?? 4010);
  const hostname = options.hostname ?? process.env.BE_AI_HEART_API_HOST ?? "127.0.0.1";

  const server = http.createServer(async (req, res) => {
    try {
      const request = await toWebRequest(req, {
        baseUrl: config.apiBaseUrl,
      });
      const response = await handleServiceHttpRequest(request, config);
      await sendWebResponse(res, response);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          {
            error: error?.message || "Unhandled API host error.",
          },
          null,
          2,
        ),
      );
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, () => {
      const address = server.address();
      const effectivePort = typeof address === "object" && address ? address.port : port;
      config.apiBaseUrl = `http://${hostname}:${effectivePort}`;
      resolve({
        server,
        url: config.apiBaseUrl,
        config,
      });
    });
  });
}

async function toWebRequest(req, { baseUrl } = {}) {
  const url = new URL(req.url ?? "/", baseUrl);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await readIncomingBody(req);

  return new Request(url, {
    method: req.method,
    headers,
    body,
    duplex: body ? "half" : undefined,
  });
}

function readIncomingBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }

      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

async function sendWebResponse(res, response) {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;

  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServiceHost()
    .then(({ url }) => {
      process.stdout.write(`BeHeart API host listening on ${url}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error?.message || "Failed to start API host."}\n`);
      process.exitCode = 1;
    });
}
