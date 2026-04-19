const LINK_TYPES = Object.freeze({
  documentToModule: "DOCUMENT_TO_MODULE",
  decisionToImplementation: "DECISION_TO_IMPLEMENTATION",
  symbolToDomain: "SYMBOL_TO_DOMAIN",
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

export { LINK_TYPES };

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
