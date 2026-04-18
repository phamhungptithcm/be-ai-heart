const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

function extractModelNames(models) {
  if (!Array.isArray(models)) {
    return [];
  }

  return models
    .map((model) => model?.name || model?.model)
    .filter((name) => typeof name === "string" && name.length > 0);
}

function responseIndicatesRunning(payload, modelNames) {
  const runningModels = extractModelNames(payload?.models);
  if (runningModels.length === 0) {
    return false;
  }

  if (modelNames.length === 0) {
    return true;
  }

  const runningSet = new Set(runningModels);
  return modelNames.some((name) => runningSet.has(name));
}

export async function detectOllama({ fetchImpl = globalThis.fetch } = {}) {
  try {
    const tagsResponse = await fetchImpl(`${OLLAMA_BASE_URL}/api/tags`);
    if (!tagsResponse?.ok) {
      return null;
    }

    const tagsPayload = await tagsResponse.json();
    const models_detected = extractModelNames(tagsPayload?.models);

    let running = false;
    try {
      const psResponse = await fetchImpl(`${OLLAMA_BASE_URL}/api/ps`);
      if (psResponse?.ok) {
        const psPayload = await psResponse.json();
        running = responseIndicatesRunning(psPayload, models_detected);
      }
    } catch {
      running = false;
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
