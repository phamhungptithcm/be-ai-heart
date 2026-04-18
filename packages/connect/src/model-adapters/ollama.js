const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

function extractModelNames(models) {
  if (!Array.isArray(models)) {
    return [];
  }

  return models
    .map((model) => model?.name || model?.model)
    .filter((name) => typeof name === "string" && name.length > 0);
}

export async function detectOllama({ fetchImpl = globalThis.fetch } = {}) {
  try {
    const tagsResponse = await fetchImpl(`${OLLAMA_BASE_URL}/api/tags`);
    if (!tagsResponse?.ok) {
      return null;
    }

    const tagsPayload = await tagsResponse.json();
    const models_detected = extractModelNames(tagsPayload?.models);
    let running = true;
    try {
      await fetchImpl(`${OLLAMA_BASE_URL}/api/ps`);
    } catch {
      // Best-effort enrichment only. Tags success already proves liveness.
    }

    return {
      id: "ollama",
      display_name: "Ollama",
      transport: "http",
      endpoint: `${OLLAMA_BASE_URL}/api`,
      installed: true,
      running,
      models_detected,
      auth_required: false,
      discovery_confidence: "high",
      warnings: [],
    };
  } catch {
    return null;
  }
}
