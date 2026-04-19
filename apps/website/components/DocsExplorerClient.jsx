"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useMemo, useState } from "react";

export function DocsExplorerClient({ documents = [], versions = [], initialVersion = "" }) {
  const [version, setVersion] = useState(initialVersion || versions[0] || "");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredDocuments = useMemo(() => {
    const safeQuery = deferredQuery.trim().toLowerCase();
    const terms = safeQuery ? safeQuery.split(/\s+/).filter(Boolean) : [];

    return documents.filter((entry) => {
      if (version && entry.version !== version) {
        return false;
      }

      if (terms.length === 0) {
        return true;
      }

      const haystack = entry.searchText.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [documents, deferredQuery, version]);

  return (
    <div className="website-docs-surface">
      <div className="website-docs-toolbar">
        <label className="website-docs-search">
          <span>Search docs</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              startTransition(() => {
                setQuery(nextValue);
              });
            }}
            placeholder="Search CLI, benchmark, policy, portal..."
          />
        </label>
        <div className="website-docs-version-tabs" role="tablist" aria-label="Documentation versions">
          {versions.map((entry) => (
            <button
              key={entry}
              type="button"
              data-active={entry === version}
              onClick={() => {
                startTransition(() => {
                  setVersion(entry);
                });
              }}
            >
              {entry.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="website-docs-results">
        {filteredDocuments.length === 0 ? (
          <div className="website-docs-empty">
            <strong>No docs matched this search.</strong>
            <p>Try searching for CLI, benchmark, security, sync, or portal.</p>
          </div>
        ) : (
          filteredDocuments.map((entry) => (
            <Link key={`${entry.version}:${entry.slug}`} href={entry.href} className="website-doc-row">
              <div className="website-doc-row-meta">
                <span>{entry.metadata.category}</span>
                <strong>{entry.metadata.title}</strong>
              </div>
              <p>{entry.metadata.description || entry.excerpt}</p>
              <div className="website-inline-stat">
                <span>{entry.version.toUpperCase()}</span>
                <span>{entry.headings.length} sections</span>
                <span>{entry.slug}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
