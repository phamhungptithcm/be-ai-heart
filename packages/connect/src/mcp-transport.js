export function normalizeMcpRemoteUrl(value) {
  if (!value) {
    return null;
  }

  const url = new URL(String(value));
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

export function resolveConnectRemoteUrl(value, surface = "portal") {
  if (!value) {
    return null;
  }

  const url = new URL(String(value));
  const normalizedPath = url.pathname.endsWith("/") && url.pathname.length > 1
    ? url.pathname.slice(0, -1)
    : url.pathname;

  if (normalizedPath === "/" || normalizedPath === "") {
    url.pathname = surface === "admin" ? "/api/admin/mcp" : "/api/mcp";
  } else {
    url.pathname = normalizedPath;
  }

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

export function extractMcpRemoteUrl(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const directUrl = entry.serverUrl ?? entry.url ?? entry.transport?.url ?? null;
  return normalizeMcpRemoteUrl(directUrl);
}

export function isRemoteMcpEntry(entry) {
  return extractMcpRemoteUrl(entry) !== null;
}

export function matchesMcpRemoteUrl(entry, remoteUrl) {
  const expectedUrl = normalizeMcpRemoteUrl(remoteUrl);
  const actualUrl = extractMcpRemoteUrl(entry);

  if (!expectedUrl) {
    return actualUrl !== null;
  }

  return actualUrl === expectedUrl;
}
