const LINK_TYPES = Object.freeze({
  documentToModule: "DOCUMENT_TO_MODULE",
  decisionToImplementation: "DECISION_TO_IMPLEMENTATION",
  symbolToDomain: "SYMBOL_TO_DOMAIN",
  domainToDomain: "DOMAIN_TO_DOMAIN",
});
const RELATIONSHIP_PROVENANCE = Object.freeze({
  extracted: "EXTRACTED",
  inferred: "INFERRED",
});

const GENERIC_PATH_SEGMENTS = new Set([
  "src",
  "lib",
  "app",
  "apps",
  "packages",
  "services",
  "docs",
  "tests",
  "test",
  "__tests__",
  "components",
  "shared",
  "internal",
]);
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

export { LINK_TYPES, RELATIONSHIP_PROVENANCE };

export function buildHeartModel({
  scanResult = { files: [] },
  documentIndex = { documents: [] },
} = {}) {
  const domainsById = new Map();
  const links = [];
  const filesByPath = new Map(scanResult.files.map((file) => [file.relativePath, file]));

  for (const file of scanResult.files) {
    const domainName = inferDomainFromPath(file.relativePath);
    const domain = ensureDomain(domainsById, domainName);
    domain.file_paths.add(file.relativePath);

    for (const symbol of file.symbols) {
      domain.symbol_ids.add(symbol.id);
      domain.symbol_names.add(symbol.name);
      links.push(
        createLink({
          type: LINK_TYPES.symbolToDomain,
          from: symbol.id,
          to: domain.id,
          score: 1,
          rationale: `${symbol.name} belongs to the ${domain.name} domain based on its file path.`,
          metadata: {
            symbol_name: symbol.name,
            file_path: file.relativePath,
            domain: domain.name,
          },
        }),
      );
    }
  }

  links.push(...buildDomainRelationshipLinks(scanResult, domainsById));

  for (const document of documentIndex.documents ?? []) {
    const documentId = `document:${document.path}`;
    const domainMatches = scoreDomainsForDocument(document, [...domainsById.values()]);

    for (const match of domainMatches) {
      const domain = domainsById.get(match.domain_id);
      domain.document_paths.add(document.path);
      links.push(
        createLink({
          type: LINK_TYPES.documentToModule,
          from: documentId,
          to: match.domain_id,
          score: match.score,
          rationale: match.rationale,
          metadata: {
            document_path: document.path,
            domain: domain.name,
            category: document.category,
          },
        }),
      );
    }

    if (!isDecisionLikeDocument(document)) {
      continue;
    }

    const implementationMatches = scoreImplementationTargets(document, filesByPath);
    for (const match of implementationMatches) {
      const targetDomain = domainsById.get(match.domain_id);
      if (targetDomain) {
        targetDomain.document_paths.add(document.path);
      }

      links.push(
        createLink({
          type: LINK_TYPES.decisionToImplementation,
          from: documentId,
          to: match.target_id,
          score: match.score,
          rationale: match.rationale,
          metadata: {
            document_path: document.path,
            document_category: document.category,
            target_type: match.target_type,
            target_name: match.target_name,
            file_path: match.file_path,
            domain: match.domain,
          },
        }),
      );
    }
  }

  const domains = [...domainsById.values()]
    .map((domain) => ({
      id: domain.id,
      name: domain.name,
      file_paths: [...domain.file_paths].sort(),
      symbol_ids: [...domain.symbol_ids].sort(),
      symbol_names: [...domain.symbol_names].sort(),
      document_paths: [...domain.document_paths].sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const summary = summarizeHeartModel(domains, links);

  return {
    domains,
    links: sortLinks(links),
    summary,
  };
}

export function getLinkedModulesForDocuments(heartModel, documentPaths = []) {
  const selectedDocuments = new Set(documentPaths);
  const domainsById = new Map((heartModel?.domains ?? []).map((domain) => [domain.id, domain]));
  const matches = new Map();

  for (const link of heartModel?.links ?? []) {
    if (link.type !== LINK_TYPES.documentToModule || !selectedDocuments.has(readDocumentPath(link.from))) {
      continue;
    }

    const domain = domainsById.get(link.to);
    if (!domain) {
      continue;
    }

    const existing = matches.get(domain.id) ?? {
      module: domain.name,
      domain_id: domain.id,
      score: 0,
      file_paths: domain.file_paths,
      symbol_names: domain.symbol_names,
      supporting_documents: [],
    };

    existing.score = Math.max(existing.score, link.score);
    existing.supporting_documents = dedupe([...existing.supporting_documents, readDocumentPath(link.from)]);
    matches.set(domain.id, existing);
  }

  return [...matches.values()].sort((left, right) => right.score - left.score || left.module.localeCompare(right.module));
}

export function getModuleRelationshipsForDocuments(heartModel, documentPaths = []) {
  const selectedDocuments = new Set(documentPaths);
  const domainsById = new Map((heartModel?.domains ?? []).map((domain) => [domain.id, domain]));
  const focusedDomainIds = new Set(
    getLinkedModulesForDocuments(heartModel, documentPaths).map((module) => module.domain_id),
  );
  const relationships = [];

  for (const link of heartModel?.links ?? []) {
    if (link.type !== LINK_TYPES.domainToDomain) {
      continue;
    }

    const supportsSelectedDocuments =
      selectedDocuments.size === 0 ||
      (domainsById.get(link.from)?.document_paths ?? []).some((documentPath) => selectedDocuments.has(documentPath)) ||
      (domainsById.get(link.to)?.document_paths ?? []).some((documentPath) => selectedDocuments.has(documentPath));

    if (!supportsSelectedDocuments) {
      continue;
    }

    const outgoingFromFocused = focusedDomainIds.has(link.from);
    const incomingToFocused = focusedDomainIds.has(link.to);

    if (!outgoingFromFocused && !incomingToFocused) {
      continue;
    }

    const orientedFromId = outgoingFromFocused ? link.from : link.to;
    const orientedToId = outgoingFromFocused ? link.to : link.from;
    const fromDomain = domainsById.get(orientedFromId);
    const toDomain = domainsById.get(orientedToId);

    if (!fromDomain || !toDomain) {
      continue;
    }

    relationships.push({
      from_module: fromDomain.name,
      from_domain_id: fromDomain.id,
      to_module: toDomain.name,
      to_domain_id: toDomain.id,
      direction: outgoingFromFocused ? "outgoing" : "incoming",
      score: link.score,
      provenance: link.metadata.provenance ?? RELATIONSHIP_PROVENANCE.inferred,
      relationship_kinds: [...(link.metadata.relationship_kinds ?? [])],
      evidence_count: link.metadata.evidence_count ?? 0,
      supporting_documents: dedupe(
        [...fromDomain.document_paths, ...toDomain.document_paths].filter((documentPath) =>
          selectedDocuments.size === 0 ? true : selectedDocuments.has(documentPath),
        ),
      ),
      target_file_paths: [...toDomain.file_paths],
      target_symbol_ids: [...toDomain.symbol_ids],
      target_symbol_names: [...toDomain.symbol_names],
    });
  }

  return relationships.sort(
    (left, right) =>
      right.score - left.score ||
      right.evidence_count - left.evidence_count ||
      left.from_module.localeCompare(right.from_module) ||
      left.to_module.localeCompare(right.to_module),
  );
}

export function getDecisionImplementationsForDocuments(heartModel, documentPaths = []) {
  const selectedDocuments = new Set(documentPaths);
  const matches = [];

  for (const link of heartModel?.links ?? []) {
    if (
      link.type !== LINK_TYPES.decisionToImplementation ||
      !selectedDocuments.has(readDocumentPath(link.from))
    ) {
      continue;
    }

    matches.push({
      target_id: link.to,
      target_type: link.metadata.target_type,
      target_name: link.metadata.target_name,
      file_path: link.metadata.file_path,
      domain: link.metadata.domain,
      score: link.score,
      supporting_document: readDocumentPath(link.from),
      rationale: link.rationale,
    });
  }

  return matches.sort(
    (left, right) =>
      right.score - left.score ||
      left.target_type.localeCompare(right.target_type) ||
      left.target_name.localeCompare(right.target_name),
  );
}

function ensureDomain(domainsById, domainName) {
  const domainId = `domain:${domainName}`;
  const existing = domainsById.get(domainId);
  if (existing) {
    return existing;
  }

  const domain = {
    id: domainId,
    name: domainName,
    file_paths: new Set(),
    symbol_ids: new Set(),
    symbol_names: new Set(),
    document_paths: new Set(),
  };
  domainsById.set(domainId, domain);
  return domain;
}

function buildDomainRelationshipLinks(scanResult, domainsById) {
  const files = scanResult.files ?? [];
  const fileIndex = new Set(files.map((file) => file.relativePath));
  const symbolTargetsByName = createSymbolTargetsByName(files);
  const relationships = new Map();

  for (const file of files) {
    const fromDomainName = inferDomainFromPath(file.relativePath);
    const fromDomainId = `domain:${fromDomainName}`;
    const importDetails =
      file.import_details?.length > 0
        ? file.import_details
        : (file.imports ?? []).map((specifier) => ({
            specifier,
            imported_names: [],
            default_import: null,
            namespace_import: null,
            source_kind: "legacy-import",
          }));

    for (const detail of importDetails) {
      const resolvedPath = resolveInternalImport(file.relativePath, detail.specifier, fileIndex);
      if (!resolvedPath) {
        continue;
      }

      const toDomainName = inferDomainFromPath(resolvedPath);
      const toDomainId = `domain:${toDomainName}`;
      if (toDomainId === fromDomainId) {
        continue;
      }

      addDomainRelationshipEvidence(relationships, {
        fromDomainId,
        toDomainId,
        relationshipKind: "imports",
        provenance: RELATIONSHIP_PROVENANCE.extracted,
      });
    }

    for (const call of file.calls ?? []) {
      const targetDomains = symbolTargetsByName.get(call.to_name) ?? [];
      if (targetDomains.length !== 1) {
        continue;
      }

      const toDomainId = targetDomains[0];
      if (toDomainId === fromDomainId) {
        continue;
      }

      addDomainRelationshipEvidence(relationships, {
        fromDomainId,
        toDomainId,
        relationshipKind: "calls",
        provenance: RELATIONSHIP_PROVENANCE.inferred,
      });
    }
  }

  return [...relationships.values()]
    .map((relationship) => createDomainRelationshipLink(relationship, domainsById))
    .filter(Boolean)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.from.localeCompare(right.from) ||
        left.to.localeCompare(right.to),
    );
}

function createSymbolTargetsByName(files) {
  const targetsByName = new Map();

  for (const file of files) {
    const domainId = `domain:${inferDomainFromPath(file.relativePath)}`;
    for (const symbol of file.symbols ?? []) {
      const domains = targetsByName.get(symbol.name) ?? new Set();
      domains.add(domainId);
      targetsByName.set(symbol.name, domains);
    }
  }

  return new Map(
    [...targetsByName.entries()].map(([name, domainIds]) => [name, [...domainIds].sort()]),
  );
}

function addDomainRelationshipEvidence(relationships, { fromDomainId, toDomainId, relationshipKind, provenance }) {
  const key = `${fromDomainId}:${toDomainId}`;
  const existing = relationships.get(key) ?? {
    fromDomainId,
    toDomainId,
    relationshipKinds: new Set(),
    importCount: 0,
    callCount: 0,
    evidenceCount: 0,
    hasExtractedEvidence: false,
  };

  existing.relationshipKinds.add(relationshipKind);
  existing.evidenceCount += 1;
  if (relationshipKind === "imports") {
    existing.importCount += 1;
  }
  if (relationshipKind === "calls") {
    existing.callCount += 1;
  }
  if (provenance === RELATIONSHIP_PROVENANCE.extracted) {
    existing.hasExtractedEvidence = true;
  }

  relationships.set(key, existing);
}

function createDomainRelationshipLink(relationship, domainsById) {
  const fromDomain = domainsById.get(relationship.fromDomainId);
  const toDomain = domainsById.get(relationship.toDomainId);

  if (!fromDomain || !toDomain) {
    return null;
  }

  const provenance = relationship.hasExtractedEvidence
    ? RELATIONSHIP_PROVENANCE.extracted
    : RELATIONSHIP_PROVENANCE.inferred;
  const relationshipKinds = [...relationship.relationshipKinds].sort();
  const score = roundScore(Math.min(1, relationship.importCount * 0.35 + relationship.callCount * 0.2));
  const rationaleParts = [];

  if (relationship.importCount > 0) {
    rationaleParts.push(`${relationship.importCount} import path${relationship.importCount === 1 ? "" : "s"}`);
  }
  if (relationship.callCount > 0) {
    rationaleParts.push(`${relationship.callCount} call target${relationship.callCount === 1 ? "" : "s"}`);
  }

  return createLink({
    type: LINK_TYPES.domainToDomain,
    from: relationship.fromDomainId,
    to: relationship.toDomainId,
    score,
    rationale: `${fromDomain.name} connects to ${toDomain.name} through ${rationaleParts.join(" and ")}.`,
    metadata: {
      from_domain: fromDomain.name,
      to_domain: toDomain.name,
      provenance,
      relationship_kinds: relationshipKinds,
      evidence_count: relationship.evidenceCount,
      import_count: relationship.importCount,
      call_count: relationship.callCount,
    },
  });
}

function scoreDomainsForDocument(document, domains) {
  const documentTokens = collectDocumentTokens(document);
  const matches = [];

  for (const domain of domains) {
    const domainTokens = tokenizeValue(
      `${domain.name} ${[...domain.file_paths].join(" ")} ${[...domain.symbol_names].join(" ")}`,
    );
    const overlap = countOverlap(documentTokens, domainTokens);
    const phraseBonus = readPhraseBonus(document, domain.name);
    const score = overlap * 2 + phraseBonus;

    if (score < 2) {
      continue;
    }

    matches.push({
      domain_id: domain.id,
      score: roundScore(score / 10),
      rationale:
        phraseBonus > 0
          ? `${document.path} explicitly points at the ${domain.name} module.`
          : `${document.path} overlaps with the ${domain.name} module vocabulary.`,
    });
  }

  return matches.sort((left, right) => right.score - left.score || left.domain_id.localeCompare(right.domain_id)).slice(0, 3);
}

function scoreImplementationTargets(document, filesByPath) {
  const documentTokens = collectDocumentTokens(document);
  const matches = [];

  for (const file of filesByPath.values()) {
    const domain = inferDomainFromPath(file.relativePath);
    const fileTokens = tokenizeValue(`${file.relativePath} ${file.symbols.map((symbol) => symbol.name).join(" ")}`);
    const fileOverlap = countOverlap(documentTokens, fileTokens);
    const fileBonus = readPhraseBonus(document, baseFileName(file.relativePath)) + readPhraseBonus(document, domain);
    const fileScore = fileOverlap * 2 + fileBonus;

    if (fileScore >= 3) {
      matches.push({
        target_id: `file:${file.relativePath}`,
        target_type: "file",
        target_name: file.relativePath,
        file_path: file.relativePath,
        domain_id: `domain:${domain}`,
        domain,
        score: roundScore(fileScore / 10),
        rationale: `${document.path} points to ${file.relativePath} as the implementation anchor.`,
      });
    }

    for (const symbol of file.symbols) {
      const symbolTokens = tokenizeValue(`${symbol.name} ${symbol.signature ?? ""}`);
      const symbolOverlap = countOverlap(documentTokens, symbolTokens);
      const symbolBonus = readPhraseBonus(document, symbol.name);
      const symbolScore = symbolOverlap * 2 + symbolBonus;

      if (symbolScore < 3) {
        continue;
      }

      matches.push({
        target_id: symbol.id,
        target_type: "symbol",
        target_name: symbol.name,
        file_path: file.relativePath,
        domain_id: `domain:${domain}`,
        domain,
        score: roundScore(symbolScore / 10),
        rationale: `${document.path} names ${symbol.name} as part of the implementation path.`,
      });
    }
  }

  return matches
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.target_type.localeCompare(right.target_type) ||
        left.target_name.localeCompare(right.target_name),
    )
    .slice(0, 5);
}

function summarizeHeartModel(domains, links) {
  const linkTypeCounts = {};
  const linkedDocuments = new Set();
  const linkedTargets = new Set();

  for (const link of links) {
    linkTypeCounts[link.type] = (linkTypeCounts[link.type] ?? 0) + 1;
    if (link.from.startsWith("document:")) {
      linkedDocuments.add(link.from);
    }
    linkedTargets.add(link.to);
  }

  return {
    domain_count: domains.length,
    relationship_count: links.length,
    relationship_type_counts: linkTypeCounts,
    linked_document_count: linkedDocuments.size,
    linked_target_count: linkedTargets.size,
  };
}

function createLink({ type, from, to, score, rationale, metadata = {} }) {
  return {
    id: `${type}:${from}:${to}`,
    type,
    from,
    to,
    score,
    rationale,
    metadata,
  };
}

function sortLinks(links) {
  return [...links].sort(
    (left, right) =>
      left.type.localeCompare(right.type) ||
      left.from.localeCompare(right.from) ||
      left.to.localeCompare(right.to),
  );
}

function inferDomainFromPath(relativePath) {
  const segments = relativePath.split("/").filter(Boolean);
  const directorySegments = segments.slice(0, -1);

  for (const segment of directorySegments) {
    if (!GENERIC_PATH_SEGMENTS.has(segment)) {
      return segment;
    }
  }

  return directorySegments[directorySegments.length - 1] ?? "root";
}

function resolveInternalImport(fromPath, specifier, fileIndex) {
  if (typeof specifier !== "string" || !specifier.startsWith(".")) {
    return null;
  }

  const fromSegments = fromPath.split("/").filter(Boolean);
  fromSegments.pop();
  const candidateSegments = normalizePathSegments([...fromSegments, ...specifier.split("/")]);
  const basePath = candidateSegments.join("/");

  if (fileIndex.has(basePath)) {
    return basePath;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    if (fileIndex.has(`${basePath}${extension}`)) {
      return `${basePath}${extension}`;
    }
  }

  for (const extension of SOURCE_EXTENSIONS) {
    if (fileIndex.has(`${basePath}/index${extension}`)) {
      return `${basePath}/index${extension}`;
    }
  }

  return null;
}

function normalizePathSegments(segments) {
  const normalized = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  return normalized;
}

function isDecisionLikeDocument(document) {
  const haystack = `${document.path} ${document.title} ${document.headings.join(" ")} ${document.summary}`.toLowerCase();
  return (
    document.category === "technical" ||
    haystack.includes("system design") ||
    haystack.includes("architecture") ||
    haystack.includes("adr") ||
    haystack.includes("decision")
  );
}

function collectDocumentTokens(document) {
  return tokenizeValue(
    `${document.path} ${document.title} ${document.category} ${document.headings.join(" ")} ${document.summary}`,
  );
}

function tokenizeValue(value) {
  return [...new Set(splitIntoTerms(value).filter((token) => token.length >= 3))];
}

function splitIntoTerms(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

function countOverlap(leftTokens, rightTokens) {
  const right = new Set(rightTokens);
  return leftTokens.reduce((count, token) => count + (right.has(token) ? 1 : 0), 0);
}

function readPhraseBonus(document, phrase) {
  const normalizedPhrase = splitIntoTerms(phrase).join(" ");
  if (!normalizedPhrase) {
    return 0;
  }

  const haystack = splitIntoTerms(
    `${document.path} ${document.title} ${document.headings.join(" ")} ${document.summary}`,
  ).join(" ");

  if (haystack.includes(`${normalizedPhrase} module`) || haystack.includes(`${normalizedPhrase} path`)) {
    return 4;
  }

  if (haystack.includes(normalizedPhrase)) {
    return 2;
  }

  return 0;
}

function baseFileName(relativePath) {
  return relativePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? relativePath;
}

function readDocumentPath(entityId) {
  return entityId.replace(/^document:/, "");
}

function dedupe(items) {
  return [...new Set(items)].sort();
}

function roundScore(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
