export function isLocalDemoAuthEnabled(options = {}) {
  if (typeof options.localDemoAuth === "boolean") {
    return options.localDemoAuth;
  }

  return ["1", "true", "yes", "on", "enabled"].includes(
    String(process.env.BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH ?? "")
      .trim()
      .toLowerCase(),
  );
}
