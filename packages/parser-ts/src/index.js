import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const SUPPORTED_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);
const DEFAULT_IGNORES = new Set(["node_modules", "dist", "coverage", ".git"]);

let cachedTypeScriptModule;
let hasTriedLoadingTypeScript = false;

export async function scanSourceTree(rootDir, options = {}) {
  const ignore = new Set([...(options.ignore ?? []), ...DEFAULT_IGNORES]);
  const discoveredFiles = await discoverSourceFiles(rootDir, ignore);
  const files = [];
  const warnings = [];
  const typescriptModule = options.typescriptModule ?? loadTypeScriptModule();

  for (const fullPath of discoveredFiles) {
    const relativePath = normalizePath(path.relative(rootDir, fullPath));
    const content = await fs.readFile(fullPath, "utf8");
    const fileFacts = extractFileFactsFromContent(content, relativePath, typescriptModule);

    files.push({
      path: fullPath,
      relativePath,
      imports: fileFacts.imports,
      symbols: fileFacts.symbols,
      hash: hashContent(content),
      parser: fileFacts.parser,
    });
    warnings.push(...fileFacts.warnings);
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
      warning_count: warnings.length,
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
      symbols: extractSymbolsWithRegex(content, relativePath),
      warnings: [],
    };
  }

  const sourceFile = createSourceFile(typescriptModule, content, relativePath);
  const warnings = extractWarningsFromSourceFile(typescriptModule, sourceFile, relativePath);

  return {
    parser: "typescript-ast",
    imports: extractImportsWithTypeScript(typescriptModule, sourceFile),
    symbols: extractSymbolsWithTypeScript(typescriptModule, sourceFile, relativePath),
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

function createSymbolsFromNode(typescriptModule, sourceFile, node, parent, relativePath) {
  if (typescriptModule.isFunctionDeclaration(node) && node.name) {
    return [createSymbolRecord(typescriptModule, sourceFile, node, relativePath, node.name.text, "function")];
  }

  if (typescriptModule.isClassDeclaration(node) && node.name) {
    return [createSymbolRecord(typescriptModule, sourceFile, node, relativePath, node.name.text, "class")];
  }

  if (typescriptModule.isInterfaceDeclaration(node)) {
    return [createSymbolRecord(typescriptModule, sourceFile, node, relativePath, node.name.text, "interface")];
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
) {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return {
    id: `sym:${kind}:${relativePath}:${name}:${line}`,
    kind,
    name,
    exported: isNodeExported(typescriptModule, exportOwner),
    signature: summarizeNodeText(node.getText(sourceFile)),
    line,
    container: readContainerName(typescriptModule, node),
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

async function discoverSourceFiles(rootDir, ignore) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, fullPath));

    if (shouldIgnore(relativePath, ignore)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await discoverSourceFiles(fullPath, ignore)));
      continue;
    }

    if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function shouldIgnore(relativePath, ignore) {
  const segments = relativePath.split("/");
  return segments.some((segment) => ignore.has(segment)) || ignore.has(relativePath);
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
