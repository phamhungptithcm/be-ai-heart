const LM_STUDIO_BASE_URL = "http://127.0.0.1:1234/v1";

function extractModelNames(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((model) => model?.id)
    .filter((id) => typeof id === "string" && id.length > 0);
}

export async function detectLmStudio({ fetchImpl = globalThis.fetch } = {}) {
  try {
    const response = await fetchImpl(`${LM_STUDIO_BASE_URL}/models`);
    if (!response?.ok) {
      return null;
    }

    const payload = await response.json();
    const models_detected = extractModelNames(payload?.data);

    return {
      id: "lm-studio",
      display_name: "LM Studio",
      transport: "http",
      endpoint: LM_STUDIO_BASE_URL,
      installed: true,
      running: true,
      models_detected,
      auth_required: false,
      discovery_confidence: "high",
      warnings: [],
    };
  } catch {
    return null;
  }
}
