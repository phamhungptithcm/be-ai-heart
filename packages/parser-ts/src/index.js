import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { resolveIgnorePaths } from "../../shared-schema/src/index.js";

const require = createRequire(import.meta.url);

const SUPPORTED_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);
const ROUTE_METHOD_NAMES = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

let cachedTypeScriptModule;
let hasTriedLoadingTypeScript = false;

export async function scanSourceTree(rootDir, options = {}) {
  const ignore = new Set(resolveIgnorePaths(options.ignore ?? []));
  const discoveredFiles = await discoverSourceFiles(rootDir, ignore, rootDir);
  const previousFilesByPath = new Map(
    (options.previousScanResult?.files ?? []).map((file) => [file.relativePath, file]),
  );
  const files = [];
  const warnings = [];
  const typescriptModule = options.typescriptModule ?? loadTypeScriptModule();
  const currentPaths = new Set();
  let reusedFileCount = 0;
  let reparsedFileCount = 0;
  let addedFileCount = 0;
  let changedFileCount = 0;

  for (const fullPath of discoveredFiles) {
    const relativePath = normalizePath(path.relative(rootDir, fullPath));
    const fileStats = await fs.stat(fullPath);
    const statSummary = summarizeStat(fileStats);
    const previousFile = previousFilesByPath.get(relativePath);
    currentPaths.add(relativePath);

    if (canReuseParsedFile(previousFile, statSummary)) {
      files.push({
        ...previousFile,
        path: fullPath,
      });
      warnings.push(...(previousFile.warnings ?? []));
      reusedFileCount += 1;
      continue;
    }

    const content = await fs.readFile(fullPath, "utf8");
    const fileFacts = extractFileFactsFromContent(content, relativePath, typescriptModule);
    const fileRecord = {
      path: fullPath,
      relativePath,
      imports: fileFacts.imports,
      import_details: fileFacts.import_details,
      symbols: fileFacts.symbols,
      calls: fileFacts.calls,
      routes: fileFacts.routes,
      hash: hashContent(content),
      parser: fileFacts.parser,
      warnings: fileFacts.warnings,
      file_stats: statSummary,
    };

    files.push(fileRecord);
    warnings.push(...fileFacts.warnings);
    reparsedFileCount += 1;

    if (!previousFile) {
      addedFileCount += 1;
    } else {
      changedFileCount += 1;
    }
  }

  let removedFileCount = 0;
  for (const relativePath of previousFilesByPath.keys()) {
    if (!currentPaths.has(relativePath)) {
      removedFileCount += 1;
    }
  }

  return {
    rootDir,
    parser_engine: typescriptModule ? "typescript-ast" : "regex-fallback",
    files,
    warnings,
    totals: {
      file_count: files.length,
      symbol_count: files.reduce((count, file) => count + file.symbols.length, 0),
      import_count: files.reduce((count, file) => count + file.imports.length, 0),
      route_count: files.reduce((count, file) => count + (file.routes?.length ?? 0), 0),
      warning_count: warnings.length,
    },
    incremental: {
      reused_file_count: reusedFileCount,
      reparsed_file_count: reparsedFileCount,
      added_file_count: addedFileCount,
      changed_file_count: changedFileCount,
      removed_file_count: removedFileCount,
    },
  };
}

export function extractSymbolsFromContent(content, relativePath, typescriptModule = loadTypeScriptModule()) {
  return extractFileFactsFromContent(content, relativePath, typescriptModule).symbols;
}

export function extractImportsFromContent(content, relativePath = "inline.ts", typescriptModule = loadTypeScriptModule()) {
  return extractFileFactsFromContent(content, relativePath, typescriptModule).imports;
}

function extractFileFactsFromContent(content, relativePath, typescriptModule) {
  if (!typescriptModule) {
    return {
      parser: "regex-fallback",
      imports: extractImportsWithRegex(content),
      import_details: extractImportDetailsWithRegex(content),
      symbols: extractSymbolsWithRegex(content, relativePath),
      calls: [],
      routes: extractRoutesWithRegex(),
      warnings: [],
    };
  }

  const sourceFile = createSourceFile(typescriptModule, content, relativePath);
  const warnings = extractWarningsFromSourceFile(typescriptModule, sourceFile, relativePath);

  return {
    parser: "typescript-ast",
    imports: extractImportsWithTypeScript(typescriptModule, sourceFile),
    import_details: extractImportDetailsWithTypeScript(typescriptModule, sourceFile),
    symbols: extractSymbolsWithTypeScript(typescriptModule, sourceFile, relativePath),
    calls: extractCallsWithTypeScript(typescriptModule, sourceFile, relativePath),
    routes: extractRoutesWithTypeScript(typescriptModule, sourceFile, relativePath),
    warnings,
  };
}

function loadTypeScriptModule() {
  if (hasTriedLoadingTypeScript) {
    return cachedTypeScriptModule;
  }

  hasTriedLoadingTypeScript = true;

  try {
    cachedTypeScriptModule = require("typescript");
  } catch {
    cachedTypeScriptModule = null;
  }

  return cachedTypeScriptModule;
}

function createSourceFile(typescriptModule, content, relativePath) {
  return typescriptModule.createSourceFile(
    relativePath,
    content,
    typescriptModule.ScriptTarget.Latest,
    true,
    detectScriptKind(typescriptModule, relativePath),
  );
}

function detectScriptKind(typescriptModule, relativePath) {
  const extension = path.extname(relativePath).toLowerCase();

  switch (extension) {
    case ".ts":
      return typescriptModule.ScriptKind.TS;
    case ".tsx":
      return typescriptModule.ScriptKind.TSX;
    case ".jsx":
      return typescriptModule.ScriptKind.JSX;
    case ".js":
    case ".mjs":
    case ".cjs":
    default:
      return typescriptModule.ScriptKind.JS;
  }
}

function extractImportsWithTypeScript(typescriptModule, sourceFile) {
  const imports = new Set();

  visit(sourceFile, (node) => {
    if (
      (typescriptModule.isImportDeclaration(node) || typescriptModule.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      typescriptModule.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.add(node.moduleSpecifier.text);
      return;
    }

    if (
      typescriptModule.isImportEqualsDeclaration(node) &&
      typescriptModule.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      typescriptModule.isStringLiteral(node.moduleReference.expression)
    ) {
      imports.add(node.moduleReference.expression.text);
      return;
    }

    if (
      typescriptModule.isCallExpression(node) &&
      node.arguments.length > 0 &&
      typescriptModule.isStringLiteral(node.arguments[0]) &&
      (isRequireCall(typescriptModule, node) || node.expression.kind === typescriptModule.SyntaxKind.ImportKeyword)
    ) {
      imports.add(node.arguments[0].text);
    }
  });

  return [...imports];
}

function extractImportDetailsWithTypeScript(typescriptModule, sourceFile) {
  const details = [];

  visit(sourceFile, (node) => {
    if (
      typescriptModule.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      typescriptModule.isStringLiteral(node.moduleSpecifier)
    ) {
      const importClause = node.importClause;
      const namedBindings = importClause?.namedBindings;
      const importedNames =
        namedBindings && typescriptModule.isNamedImports(namedBindings)
          ? namedBindings.elements.map((element) => element.name.text)
          : [];

      details.push({
        specifier: node.moduleSpecifier.text,
        imported_names: importedNames,
        default_import: importClause?.name?.text ?? null,
        namespace_import:
          namedBindings && typescriptModule.isNamespaceImport(namedBindings) ? namedBindings.name.text : null,
        source_kind: "import",
      });
      return;
    }

    if (
      typescriptModule.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      typescriptModule.isStringLiteral(node.moduleSpecifier)
    ) {
      details.push({
        specifier: node.moduleSpecifier.text,
        imported_names: [],
        default_import: null,
        namespace_import: null,
        source_kind: "export",
      });
      return;
    }

    if (
      typescriptModule.isImportEqualsDeclaration(node) &&
      typescriptModule.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      typescriptModule.isStringLiteral(node.moduleReference.expression)
    ) {
      details.push({
        specifier: node.moduleReference.expression.text,
        imported_names: [node.name.text],
        default_import: null,
        namespace_import: null,
        source_kind: "import-equals",
      });
      return;
    }

    if (
      typescriptModule.isCallExpression(node) &&
      node.arguments.length > 0 &&
      typescriptModule.isStringLiteral(node.arguments[0]) &&
      (isRequireCall(typescriptModule, node) || node.expression.kind === typescriptModule.SyntaxKind.ImportKeyword)
    ) {
      details.push({
        specifier: node.arguments[0].text,
        imported_names: [],
        default_import: null,
        namespace_import: null,
        source_kind: isRequireCall(typescriptModule, node) ? "require" : "dynamic-import",
      });
    }
  });

  return dedupeImportDetails(details);
}

function extractSymbolsWithTypeScript(typescriptModule, sourceFile, relativePath) {
  const symbols = [];
  const seen = new Set();

  visit(sourceFile, (node, parent) => {
    const candidates = createSymbolsFromNode(typescriptModule, sourceFile, node, parent, relativePath);

    for (const symbol of candidates) {
      const dedupeKey = `${symbol.kind}:${symbol.name}:${symbol.line}`;
      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      symbols.push(symbol);
    }
  });

  return symbols;
}

function extractCallsWithTypeScript(typescriptModule, sourceFile, relativePath) {
  const calls = [];
  const seen = new Set();

  visit(sourceFile, (node) => {
    if (!typescriptModule.isCallExpression(node)) {
      return;
    }

    const sourceSymbol = readEnclosingCallableSymbol(typescriptModule, sourceFile, node, relativePath);
    const target = readCallTarget(typescriptModule, node.expression);

    if (!sourceSymbol || !target) {
      return;
    }

    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const dedupeKey = `${sourceSymbol.id}:${target.name}:${line}`;

    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    calls.push({
      from_symbol_id: sourceSymbol.id,
      from_symbol_name: sourceSymbol.name,
      from_kind: sourceSymbol.kind,
      to_name: target.name,
      target_kind: target.kind,
      expression: target.expression,
      line,
      confidence: target.confidence,
      source: "parser-ts",
      provenance: "EXTRACTED",
    });
  });

  return calls;
}

function extractRoutesWithTypeScript(typescriptModule, sourceFile, relativePath) {
  const routes = [];
  const seen = new Set();
  const nextRoutePath = isNextRouteFile(relativePath) ? deriveNextRoutePath(relativePath) : "";

  visit(sourceFile, (node, parent) => {
    if (
      nextRoutePath &&
      typescriptModule.isFunctionDeclaration(node) &&
      node.name &&
      isRouteMethodName(node.name.text) &&
      isNodeExported(typescriptModule, node)
    ) {
      pushRouteRecord(routes, seen, {
        method: node.name.text.toUpperCase(),
        path: nextRoutePath,
        handler_name: node.name.text,
        handler_expression: node.name.text,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        route_kind: "next-app-router",
        framework: "next-app-router",
      });
      return;
    }

    if (
      nextRoutePath &&
      parent &&
      typescriptModule.isSourceFile(parent) &&
      typescriptModule.isVariableStatement(node) &&
      isNodeExported(typescriptModule, node)
    ) {
      for (const declaration of node.declarationList.declarations) {
        if (!typescriptModule.isIdentifier(declaration.name) || !isRouteMethodName(declaration.name.text)) {
          continue;
        }

        pushRouteRecord(routes, seen, {
          method: declaration.name.text.toUpperCase(),
          path: nextRoutePath,
          handler_name: declaration.name.text,
          handler_expression: declaration.name.text,
          line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart(sourceFile)).line + 1,
          route_kind: "next-app-router",
          framework: "next-app-router",
        });
      }
      return;
    }

    if (!typescriptModule.isCallExpression(node) || !typescriptModule.isPropertyAccessExpression(node.expression)) {
      return;
    }

    const registrar = node.expression.expression.getText(sourceFile);
    const method = node.expression.name.text.toUpperCase();
    if (!isRouteMethodName(method) || !isLikelyRouteRegistrar(registrar)) {
      return;
    }

    const routePath = readRoutePathLiteral(typescriptModule, node.arguments[0]);
    if (!routePath) {
      return;
    }

    const handler = readRouteHandlerTarget(typescriptModule, sourceFile, node.arguments.slice(1));
    pushRouteRecord(routes, seen, {
      method,
      path: routePath,
      handler_name: handler?.name ?? "",
      handler_expression: handler?.expression ?? "",
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      route_kind: "router-call",
      framework: inferRouteFramework(registrar),
      registrar,
    });
  });

  return routes;
}

function createSymbolsFromNode(typescriptModule, sourceFile, node, parent, relativePath) {
  if (typescriptModule.isFunctionDeclaration(node) && node.name) {
    return [createSymbolRecord(typescriptModule, sourceFile, node, relativePath, node.name.text, "function")];
  }

  if (typescriptModule.isClassDeclaration(node) && node.name) {
    return [
      createSymbolRecord(typescriptModule, sourceFile, node, relativePath, node.name.text, "class", node, {
        relations: readSymbolRelations(typescriptModule, node),
      }),
    ];
  }

  if (typescriptModule.isInterfaceDeclaration(node)) {
    return [
      createSymbolRecord(typescriptModule, sourceFile, node, relativePath, node.name.text, "interface", node, {
        relations: readSymbolRelations(typescriptModule, node),
      }),
    ];
  }

  if (typescriptModule.isTypeAliasDeclaration(node)) {
    return [createSymbolRecord(typescriptModule, sourceFile, node, relativePath, node.name.text, "type")];
  }

  if (typescriptModule.isEnumDeclaration(node)) {
    return [createSymbolRecord(typescriptModule, sourceFile, node, relativePath, node.name.text, "enum")];
  }

  if (typescriptModule.isMethodDeclaration(node)) {
    const methodName = readPropertyName(typescriptModule, node.name);
    if (!methodName) {
      return [];
    }

    return [createSymbolRecord(typescriptModule, sourceFile, node, relativePath, methodName, "method")];
  }

  if (typescriptModule.isVariableStatement(node) && parent && typescriptModule.isSourceFile(parent)) {
    const declarationKind = readVariableDeclarationKind(typescriptModule, node);

    return node.declarationList.declarations
      .map((declaration) => {
        if (!typescriptModule.isIdentifier(declaration.name)) {
          return null;
        }

        return createSymbolRecord(
          typescriptModule,
          sourceFile,
          declaration,
          relativePath,
          declaration.name.text,
          declarationKind,
          node,
        );
      })
      .filter(Boolean);
  }

  if (
    typescriptModule.isFunctionExpression(node) &&
    node.name &&
    !typescriptModule.isVariableDeclaration(parent) &&
    !typescriptModule.isPropertyAssignment(parent)
  ) {
    return [createSymbolRecord(typescriptModule, sourceFile, node, relativePath, node.name.text, "function")];
  }

  return [];
}

function createSymbolRecord(
  typescriptModule,
  sourceFile,
  node,
  relativePath,
  name,
  kind,
  exportOwner = node,
  extra = {},
) {
  const { id, line } = createSymbolIdentity(typescriptModule, sourceFile, node, relativePath, name, kind);
  return {
    id,
    kind,
    name,
    exported: isNodeExported(typescriptModule, exportOwner),
    signature: summarizeNodeText(node.getText(sourceFile)),
    line,
    container: readContainerName(typescriptModule, node),
    ...extra,
  };
}

function createSymbolIdentity(typescriptModule, sourceFile, node, relativePath, name, kind) {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return {
    id: `sym:${kind}:${relativePath}:${name}:${line}`,
    line,
  };
}

function extractWarningsFromSourceFile(typescriptModule, sourceFile, relativePath) {
  return sourceFile.parseDiagnostics.map((diagnostic) => {
    const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0);

    return {
      file: relativePath,
      line: position.line + 1,
      column: position.character + 1,
      message: typescriptModule.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    };
  });
}

function isRequireCall(typescriptModule, node) {
  return typescriptModule.isIdentifier(node.expression) && node.expression.text === "require";
}

function readPropertyName(typescriptModule, nameNode) {
  if (!nameNode) {
    return null;
  }

  if (typescriptModule.isIdentifier(nameNode) || typescriptModule.isStringLiteral(nameNode)) {
    return nameNode.text;
  }

  return null;
}

function readVariableDeclarationKind(typescriptModule, statement) {
  const flags = statement.declarationList.flags;

  if (flags & typescriptModule.NodeFlags.Const) {
    return "const";
  }

  if (flags & typescriptModule.NodeFlags.Let) {
    return "let";
  }

  return "var";
}

function isNodeExported(typescriptModule, node) {
  const modifiers = typescriptModule.canHaveModifiers(node) ? typescriptModule.getModifiers(node) ?? [] : [];
  return modifiers.some(
    (modifier) =>
      modifier.kind === typescriptModule.SyntaxKind.ExportKeyword ||
      modifier.kind === typescriptModule.SyntaxKind.DefaultKeyword,
  );
}

function readContainerName(typescriptModule, node) {
  let current = node.parent;

  while (current) {
    if ((typescriptModule.isClassDeclaration(current) || typescriptModule.isInterfaceDeclaration(current)) && current.name) {
      return current.name.text;
    }

    if (typescriptModule.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }

    current = current.parent;
  }

  return null;
}

function readEnclosingCallableSymbol(typescriptModule, sourceFile, node, relativePath) {
  let current = node.parent;

  while (current) {
    if (typescriptModule.isMethodDeclaration(current)) {
      const methodName = readPropertyName(typescriptModule, current.name);
      if (methodName) {
        return {
          ...createSymbolIdentity(typescriptModule, sourceFile, current, relativePath, methodName, "method"),
          kind: "method",
          name: methodName,
        };
      }
    }

    if (typescriptModule.isFunctionDeclaration(current) && current.name) {
      return {
        ...createSymbolIdentity(typescriptModule, sourceFile, current, relativePath, current.name.text, "function"),
        kind: "function",
        name: current.name.text,
      };
    }

    if (
      (typescriptModule.isFunctionExpression(current) || typescriptModule.isArrowFunction(current)) &&
      current.parent &&
      typescriptModule.isVariableDeclaration(current.parent) &&
      typescriptModule.isIdentifier(current.parent.name)
    ) {
      const variableStatement = findAncestorVariableStatement(typescriptModule, current.parent);
      const declarationKind = variableStatement ? readVariableDeclarationKind(typescriptModule, variableStatement) : "const";
      return {
        ...createSymbolIdentity(
          typescriptModule,
          sourceFile,
          current.parent,
          relativePath,
          current.parent.name.text,
          declarationKind,
        ),
        kind: declarationKind,
        name: current.parent.name.text,
      };
    }

    current = current.parent;
  }

  return null;
}

function findAncestorVariableStatement(typescriptModule, node) {
  let current = node.parent;

  while (current) {
    if (typescriptModule.isVariableStatement(current)) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function readCallTarget(typescriptModule, expression) {
  if (typescriptModule.isIdentifier(expression)) {
    return {
      name: expression.text,
      expression: expression.text,
      kind: "identifier",
      confidence: 0.95,
    };
  }

  if (typescriptModule.isPropertyAccessExpression(expression)) {
    return {
      name: expression.name.text,
      expression: expression.getText(),
      kind: "property-access",
      confidence: 0.82,
    };
  }

  if (
    typescriptModule.isElementAccessExpression(expression) &&
    expression.argumentExpression &&
    typescriptModule.isStringLiteral(expression.argumentExpression)
  ) {
    return {
      name: expression.argumentExpression.text,
      expression: expression.getText(),
      kind: "element-access",
      confidence: 0.72,
    };
  }

  return null;
}

function readRoutePathLiteral(typescriptModule, node) {
  if (!node) {
    return "";
  }

  if (typescriptModule.isStringLiteral(node) || typescriptModule.isNoSubstitutionTemplateLiteral(node)) {
    return normalizeRoutePath(node.text);
  }

  if (typescriptModule.isTemplateExpression(node)) {
    const staticParts = [node.head.text, ...node.templateSpans.map((span) => `{${span.expression.getText()}}${span.literal.text}`)];
    return normalizeRoutePath(staticParts.join(""));
  }

  return "";
}

function readRouteHandlerTarget(typescriptModule, sourceFile, argumentsList) {
  for (const candidate of argumentsList) {
    const target = readCallTarget(typescriptModule, candidate);
    if (target) {
      return target;
    }

    if (
      (typescriptModule.isArrowFunction(candidate) || typescriptModule.isFunctionExpression(candidate)) &&
      candidate.parent &&
      typescriptModule.isCallExpression(candidate.parent)
    ) {
      const enclosing = readEnclosingCallableSymbol(typescriptModule, sourceFile, candidate, sourceFile.fileName);
      if (enclosing) {
        return {
          name: enclosing.name,
          expression: enclosing.name,
        };
      }
    }
  }

  return null;
}

function readSymbolRelations(typescriptModule, node) {
  const relations = {
    extends: [],
    implements: [],
  };

  if (!node.heritageClauses?.length) {
    return relations;
  }

  for (const heritageClause of node.heritageClauses) {
    const relationName =
      heritageClause.token === typescriptModule.SyntaxKind.ExtendsKeyword ? "extends" : "implements";

    for (const typeNode of heritageClause.types) {
      const typeName = typeNode.expression?.getText?.() ?? null;
      if (!typeName) {
        continue;
      }

      relations[relationName].push(typeName);
    }
  }

  return relations;
}

function pushRouteRecord(routes, seen, record) {
  const normalized = {
    method: String(record.method ?? "").toUpperCase(),
    path: normalizeRoutePath(record.path),
    handler_name: String(record.handler_name ?? "").trim(),
    handler_expression: String(record.handler_expression ?? "").trim(),
    line: Number(record.line ?? 0),
    route_kind: String(record.route_kind ?? "route"),
    framework: String(record.framework ?? "generic"),
    registrar: String(record.registrar ?? "").trim(),
    confidence: normalizeConfidence(record.confidence ?? inferRouteConfidence(record)),
    source: "parser-ts",
    provenance: "EXTRACTED",
  };

  if (!normalized.method || !normalized.path) {
    return;
  }

  const dedupeKey = [
    normalized.method,
    normalized.path,
    normalized.handler_name,
    normalized.handler_expression,
    normalized.line,
  ].join(":");

  if (seen.has(dedupeKey)) {
    return;
  }

  seen.add(dedupeKey);
  routes.push(normalized);
}

function inferRouteConfidence(record) {
  if (record.route_kind === "next-app-router" && record.handler_name) {
    return 0.95;
  }

  if (record.handler_name || record.handler_expression) {
    return 0.86;
  }

  return 0.7;
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(0, Math.min(1, numeric));
}

function isRouteMethodName(value) {
  return ROUTE_METHOD_NAMES.has(String(value ?? "").toUpperCase());
}

function isLikelyRouteRegistrar(value) {
  return /(^|\.)(router|app|server|fastify|api)$/i.test(String(value ?? "").trim());
}

function inferRouteFramework(registrar) {
  const normalized = String(registrar ?? "").toLowerCase();
  if (normalized.includes("fastify")) {
    return "fastify";
  }
  if (normalized.includes("router")) {
    return "express-router";
  }
  if (normalized.includes("app")) {
    return "express-app";
  }
  return "http-router";
}

function normalizeRoutePath(value) {
  const normalized = String(value ?? "").trim().replace(/\/+/g, "/");
  if (!normalized) {
    return "";
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function isNextRouteFile(relativePath) {
  return /(^|\/)app\/.+\/route\.(?:[cm]?[jt]sx?)$/i.test(String(relativePath ?? ""));
}

function deriveNextRoutePath(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  const segments = normalizedPath.split("/");
  const appIndex = segments.indexOf("app");
  if (appIndex === -1) {
    return "";
  }

  const routeSegments = segments
    .slice(appIndex + 1, -1)
    .filter((segment) => segment && !/^\(.*\)$/.test(segment))
    .map((segment) => segment === "index" ? "" : segment);
  const routePath = routeSegments.filter(Boolean).join("/");
  return normalizeRoutePath(routePath || "/");
}

function summarizeNodeText(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

function visit(node, handler, parent = null) {
  handler(node, parent);
  node.forEachChild((child) => visit(child, handler, node));
}

function extractSymbolsWithRegex(content, relativePath) {
  const patterns = [
    { kind: "function", exported: true, regex: /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g },
    { kind: "class", exported: true, regex: /export\s+class\s+([A-Za-z_$][\w$]*)/g },
    { kind: "const", exported: true, regex: /export\s+const\s+([A-Za-z_$][\w$]*)/g },
    { kind: "function", exported: false, regex: /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g },
  ];

  const symbols = [];
  const seen = new Set();

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern.regex)) {
      const name = match[1];
      const line = countLines(content, match.index ?? 0);
      const key = `${pattern.kind}:${name}:${line}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      symbols.push({
        id: `sym:${pattern.kind}:${relativePath}:${name}:${line}`,
        kind: pattern.kind,
        name,
        exported: pattern.exported,
        signature: readLineAt(content, match.index ?? 0),
        line,
        container: null,
        relations: {
          extends: [],
          implements: [],
        },
      });
    }
  }

  return symbols;
}

function extractImportsWithRegex(content) {
  const imports = [];
  const patterns = [
    /import\s+[^'"]*['"]([^'"]+)['"]/g,
    /export\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
    /require\(['"]([^'"]+)['"]\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      imports.push(match[1]);
    }
  }

  return [...new Set(imports)];
}

function extractImportDetailsWithRegex(content) {
  return extractImportsWithRegex(content).map((specifier) => ({
    specifier,
    imported_names: [],
    default_import: null,
    namespace_import: null,
    source_kind: "regex",
  }));
}

function extractRoutesWithRegex() {
  return [];
}

function dedupeImportDetails(details) {
  const seen = new Set();

  return details.filter((detail) => {
    const key = [
      detail.specifier,
      detail.source_kind,
      detail.default_import ?? "",
      detail.namespace_import ?? "",
      ...(detail.imported_names ?? []),
    ].join(":");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function discoverSourceFiles(rootDir, ignore, currentDir = rootDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, fullPath));

    if (shouldIgnore(relativePath, ignore)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await discoverSourceFiles(rootDir, ignore, fullPath)));
      continue;
    }

    if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function shouldIgnore(relativePath, ignore) {
  const normalizedPath = normalizePath(relativePath);
  const segments = normalizedPath.split("/");

  for (const ignoredPath of ignore) {
    if (ignoredPath.includes("/") && (normalizedPath === ignoredPath || normalizedPath.startsWith(`${ignoredPath}/`))) {
      return true;
    }
  }

  return segments.some((segment) => ignore.has(segment)) || ignore.has(normalizedPath);
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function readLineAt(content, index) {
  const start = content.lastIndexOf("\n", index) + 1;
  const end = content.indexOf("\n", index);
  return content.slice(start, end === -1 ? content.length : end).trim();
}

function countLines(content, index) {
  return content.slice(0, index).split("\n").length;
}

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}

function summarizeStat(fileStats) {
  return {
    size: fileStats.size,
    mtime_ms: fileStats.mtimeMs,
  };
}

function canReuseParsedFile(previousFile, statSummary) {
  if (!previousFile?.file_stats) {
    return false;
  }

  return (
    previousFile.file_stats.size === statSummary.size &&
    previousFile.file_stats.mtime_ms === statSummary.mtime_ms
  );
}
