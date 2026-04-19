#!/usr/bin/env python3
"""Sync local DESIGN.md references from VoltAgent/awesome-design-md."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


REPO_README_URL = "https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/README.md"
DESIGN_DOC_URL = "https://getdesign.md/design-md/{owner}/DESIGN.md"
USER_AGENT = "Codex UI UX Skill Sync/1.0"

ITEM_PATTERN = re.compile(
    r"^- \[\*\*(?P<name>.+?)\*\*\]\((?P<url>https://getdesign\.md/(?P<owner>[^/]+)/design-md)\) - (?P<description>.+)$"
)


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request) as response:
        return response.read().decode("utf-8")


def parse_catalog(readme_text: str) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    category = ""

    for raw_line in readme_text.splitlines():
        line = raw_line.strip()
        if line.startswith("### "):
            category = line.removeprefix("### ").strip()
            continue

        match = ITEM_PATTERN.match(line)
        if not match or not category:
            continue

        entries.append(
            {
                "category": category,
                "name": match.group("name").strip(),
                "owner": match.group("owner").strip(),
                "description": match.group("description").strip(),
                "source_url": match.group("url").strip(),
            }
        )

    if not entries:
        raise RuntimeError("Could not parse any design entries from upstream README.")

    return entries


def build_catalog_markdown(entries: list[dict[str, str]]) -> str:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for entry in entries:
        grouped[entry["category"]].append(entry)

    lines = [
        "# Awesome Design MD Catalog",
        "",
        "Local index generated from `VoltAgent/awesome-design-md`.",
        "",
        "Use `python3 skills/ui-ux/scripts/search_awesome_design_md.py <query>` to shortlist references,",
        "then open only the matching local `DESIGN.md` files under this folder.",
        "",
        f"Total references: {len(entries)}",
        "",
    ]

    for category in sorted(grouped):
        lines.append(f"## {category}")
        lines.append("")
        for entry in sorted(grouped[category], key=lambda item: item["name"].lower()):
            lines.append(
                f"- `{entry['owner']}` | **{entry['name']}** | {entry['description']}"
            )
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def write_catalog_json(entries: list[dict[str, str]], output_path: Path) -> None:
    payload: dict[str, Any] = {
        "source_repo": "VoltAgent/awesome-design-md",
        "entry_count": len(entries),
        "entries": entries,
    }
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n")


def sync_design_docs(
    entries: list[dict[str, str]],
    references_dir: Path,
    *,
    refresh: bool,
) -> tuple[int, int]:
    written = 0
    skipped = 0

    for entry in entries:
        destination = references_dir / f"{entry['owner']}.md"
        if destination.exists() and not refresh:
            skipped += 1
            continue

        document = fetch_text(DESIGN_DOC_URL.format(owner=entry["owner"]))
        destination.write_text(document)
        written += 1

    return written, skipped


def parse_args() -> argparse.Namespace:
    script_dir = Path(__file__).resolve().parent
    default_output = script_dir.parent / "references" / "awesome-design-md"

    parser = argparse.ArgumentParser(
        description="Sync local DESIGN.md references from awesome-design-md."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output,
        help="Destination folder for synced references.",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Re-download files even if they already exist locally.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_dir = args.output.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        readme_text = fetch_text(REPO_README_URL)
        entries = parse_catalog(readme_text)
        written, skipped = sync_design_docs(entries, output_dir, refresh=args.refresh)
    except (HTTPError, URLError) as error:
        print(f"Sync failed while fetching upstream content: {error}", file=sys.stderr)
        return 1
    except Exception as error:  # pragma: no cover - thin CLI wrapper
        print(f"Sync failed: {error}", file=sys.stderr)
        return 1

    catalog_path = output_dir / "catalog.md"
    catalog_json_path = output_dir / "catalog.json"
    catalog_path.write_text(build_catalog_markdown(entries))
    write_catalog_json(entries, catalog_json_path)

    print(
        f"Synced {written} DESIGN.md files, skipped {skipped} existing files. "
        f"Catalog written to {catalog_path}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
