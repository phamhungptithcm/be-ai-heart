#!/usr/bin/env python3
"""Search the locally synced awesome-design-md catalog."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    script_dir = Path(__file__).resolve().parent
    default_catalog = (
        script_dir.parent / "references" / "awesome-design-md" / "catalog.json"
    )

    parser = argparse.ArgumentParser(
        description="Search synced awesome-design-md references."
    )
    parser.add_argument("query", nargs="*", help="Free-text search terms.")
    parser.add_argument("--category", help="Filter by category name.")
    parser.add_argument("--owner", help="Filter by owner slug.")
    parser.add_argument("--limit", type=int, default=12, help="Maximum results to print.")
    parser.add_argument("--json", action="store_true", help="Print raw JSON results.")
    parser.add_argument(
        "--catalog",
        type=Path,
        default=default_catalog,
        help="Path to the local catalog.json file.",
    )
    return parser.parse_args()


def load_entries(catalog_path: Path) -> list[dict[str, str]]:
    if not catalog_path.exists():
        raise FileNotFoundError(
            f"Catalog not found at {catalog_path}. Run sync_awesome_design_md.py first."
        )

    payload = json.loads(catalog_path.read_text())
    return payload["entries"]


def score(entry: dict[str, str], terms: list[str]) -> int:
    haystacks = {
        "owner": entry["owner"].lower(),
        "name": entry["name"].lower(),
        "category": entry["category"].lower(),
        "description": entry["description"].lower(),
    }
    total = 0
    for term in terms:
        if term in haystacks["owner"]:
            total += 5
        if term in haystacks["name"]:
            total += 4
        if term in haystacks["category"]:
            total += 3
        if term in haystacks["description"]:
            total += 2
    return total


def filter_entries(
    entries: list[dict[str, str]],
    *,
    query_terms: list[str],
    category: str | None,
    owner: str | None,
    limit: int,
) -> list[dict[str, str]]:
    category_filter = category.lower() if category else None
    owner_filter = owner.lower() if owner else None

    ranked: list[tuple[int, dict[str, str]]] = []
    for entry in entries:
        if category_filter and category_filter not in entry["category"].lower():
            continue
        if owner_filter and owner_filter not in entry["owner"].lower():
            continue

        relevance = score(entry, query_terms) if query_terms else 1
        if query_terms and relevance == 0:
            continue

        ranked.append((relevance, entry))

    ranked.sort(
        key=lambda item: (
            -item[0],
            item[1]["category"].lower(),
            item[1]["name"].lower(),
        )
    )
    return [entry for _, entry in ranked[:limit]]


def main() -> int:
    args = parse_args()

    try:
        entries = load_entries(args.catalog.resolve())
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1

    query_terms = [term.lower() for term in args.query]
    matches = filter_entries(
        entries,
        query_terms=query_terms,
        category=args.category,
        owner=args.owner,
        limit=max(args.limit, 1),
    )

    if args.json:
        print(json.dumps(matches, indent=2, ensure_ascii=True))
        return 0

    if not matches:
        print("No design references matched.")
        return 0

    for index, entry in enumerate(matches, start=1):
        local_path = (
            args.catalog.resolve().parent / f"{entry['owner']}.md"
        )
        print(f"{index}. {entry['name']} ({entry['owner']})")
        print(f"   Category: {entry['category']}")
        print(f"   Description: {entry['description']}")
        print(f"   Local file: {local_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
