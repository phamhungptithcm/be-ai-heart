export const TEMPLATE_ENGINE_SCHEMA_VERSION = 1;

export function renderTemplate(template, data = {}) {
  return String(template ?? "").replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key) => {
    const value = readPath(data, key);
    return value === undefined || value === null ? "" : String(value);
  });
}

export function renderFileTemplates(templates = [], data = {}) {
  return templates.map((template) => ({
    ...template,
    content: renderTemplate(template.content, data),
  }));
}

function readPath(data, key) {
  return String(key)
    .split(".")
    .reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), data);
}
