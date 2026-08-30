#!/usr/bin/env python3
"""Read-only documentation health checks for this VS Code repo's docs/ + dev/ tree."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote

REPO_ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FRONTMATTER_FIELDS = ("title", "type", "status", "phase", "updated", "summary")
REQUIRED_DOC_ENTRIES = (
    "docs/README.md",
    "docs/INDEX.md",
    "docs/DOCUMENTATION.md",
    "docs/DOCS-SPEC.md",
    "dev/README.md",
    "dev/progress/status.md",
)
ACTIVE_MODULES = (
    "base",
    "platform",
    "editor",
    "workbench",
    "sessions",
    "code",
    "server",
    "chat",
    "workbench-api",
)
ACTIVE_SYSTEMS = (
    "editor",
    "workbench",
    "sessions",
    "chat",
    "extension-api",
    "processes",
    "agent-host",
)
STATUS_MD_PATH = "dev/progress/status.md"
STATUS_MD_MAX_LINES = 200
FRONTMATTER_EXEMPT_FILES = {
    "AGENTS.md",
    "README.md",
}
FRONTMATTER_EXEMPT_BASENAMES = {
    "SKILL.md",
}
HISTORICAL_DIR_PARTS = {
    "archive",
    "iterations",
    "tmp",
    ".git",
    "node_modules",
    "out",
}
LINK_SKIP_PREFIXES = (
    "http://",
    "https://",
    "mailto:",
    "tel:",
    "file:",
    "data:",
)
ROOT_RELATIVE_LINK_PREFIXES = (
    "AGENTS.md",
    "README.md",
    "docs/",
    "dev/",
    ".github/",
    "src/",
    "scripts/",
    "test/",
    "extensions/",
)
DOC_LINK_SUFFIXES = {".md", ".markdown", ".html", ".htm"}


@dataclass(frozen=True)
class Finding:
    path: str
    message: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run read-only docs health checks.")
    parser.add_argument("--strict-frontmatter", action="store_true")
    parser.add_argument("--strict-links", action="store_true")
    parser.add_argument("--max-details", type=int, default=30)
    parser.add_argument("--format", choices=("text", "json"), default="text")
    return parser.parse_args()


def repo_path(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def iter_markdown_files() -> list[Path]:
    files: list[Path] = []
    for prefix in ("docs", "dev"):
        root = REPO_ROOT / prefix
        if not root.exists():
            continue
        for path in root.rglob("*.md"):
            relative_parts = path.relative_to(REPO_ROOT).parts
            if any(part in HISTORICAL_DIR_PARTS for part in relative_parts):
                continue
            if path.is_file():
                files.append(path)
    for name in ("AGENTS.md",):
        candidate = REPO_ROOT / name
        if candidate.is_file():
            files.append(candidate)
    return sorted(files)


def check_required_entries() -> list[Finding]:
    findings: list[Finding] = []
    for entry in REQUIRED_DOC_ENTRIES:
        if not (REPO_ROOT / entry).exists():
            findings.append(Finding(entry, "required documentation entry is missing"))
    return findings


def check_status_md_line_limit() -> list[Finding]:
    path = REPO_ROOT / STATUS_MD_PATH
    if not path.exists():
        return []
    line_count = len(path.read_text(encoding="utf-8").splitlines())
    if line_count > STATUS_MD_MAX_LINES:
        return [
            Finding(
                STATUS_MD_PATH,
                f"exceeds {STATUS_MD_MAX_LINES} lines ({line_count}); archive historical notes",
            )
        ]
    return []


def check_module_indexes() -> list[Finding]:
    findings: list[Finding] = []
    for module in ACTIVE_MODULES:
        index = REPO_ROOT / "docs" / "modules" / module / "INDEX.md"
        if not index.exists():
            findings.append(Finding(repo_path(index), "declared module has no INDEX.md"))
    return findings


def check_system_indexes() -> list[Finding]:
    findings: list[Finding] = []
    for system in ACTIVE_SYSTEMS:
        index = REPO_ROOT / "docs" / "systems" / system / "INDEX.md"
        if not index.exists():
            findings.append(Finding(repo_path(index), "declared system has no INDEX.md"))
    return findings


def frontmatter_findings(markdown_files: list[Path]) -> list[Finding]:
    findings: list[Finding] = []
    for path in markdown_files:
        if repo_path(path) in FRONTMATTER_EXEMPT_FILES:
            continue
        if path.name in FRONTMATTER_EXEMPT_BASENAMES:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        lines = text.splitlines()
        if not lines or lines[0].strip() != "---":
            findings.append(Finding(repo_path(path), "missing YAML frontmatter"))
            continue
        try:
            closing = lines[1:].index("---") + 1
        except ValueError:
            findings.append(Finding(repo_path(path), "frontmatter is not closed"))
            continue
        body = "\n".join(lines[1:closing])
        missing = [field for field in REQUIRED_FRONTMATTER_FIELDS if not re.search(rf"^{field}\s*:", body, re.MULTILINE)]
        if missing:
            findings.append(Finding(repo_path(path), "frontmatter missing fields: " + ", ".join(missing)))
        for fm_no, fm_line in enumerate(lines[1:closing], start=2):
            if fm_line[:1] in (">", "|"):
                findings.append(Finding(repo_path(path), f"frontmatter contains body content at line {fm_no}"))
                break
        dup_keys = sorted(k for k, c in Counter(re.findall(r"^([\w.-]+)\s*:", body, re.MULTILINE)).items() if c > 1)
        if dup_keys:
            findings.append(Finding(repo_path(path), "frontmatter duplicate keys: " + ", ".join(dup_keys)))
    return findings


def strip_fenced_code(text: str) -> str:
    return re.sub(r"```.*?```", "", text, flags=re.DOTALL)


def strip_inline_code(text: str) -> str:
    return re.sub(r"`[^`\n]*`", "", text)


def normalize_link_target(raw_target: str) -> str:
    target = raw_target.strip()
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1].strip()
    if " " in target and not target.startswith("../") and not target.startswith("./"):
        target = target.split(" ", 1)[0]
    return unquote(target)


def markdown_link_targets(text: str) -> list[str]:
    targets: list[str] = []
    index = 0
    while index < len(text):
        open_bracket = text.find("[", index)
        if open_bracket == -1:
            break
        close_bracket = text.find("]", open_bracket + 1)
        if close_bracket == -1:
            break
        open_paren = close_bracket + 1
        if open_paren >= len(text) or text[open_paren] != "(":
            index = close_bracket + 1
            continue
        cursor = open_paren + 1
        depth = 1
        while cursor < len(text):
            char = text[cursor]
            if char == "\\":
                cursor += 2
                continue
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    targets.append(text[open_paren + 1 : cursor])
                    break
            cursor += 1
        index = cursor + 1
    return targets


def is_local_link(target: str) -> bool:
    lowered = target.lower()
    return bool(target) and not target.startswith("#") and not lowered.startswith(LINK_SKIP_PREFIXES)


def strip_line_suffix(target: str) -> str:
    return re.sub(r":\d+(?::\d+)?$", "", target)


def resolve_link(source: Path, raw_target: str) -> Path | None:
    target = normalize_link_target(raw_target)
    if not is_local_link(target):
        return None
    target_without_anchor = strip_line_suffix(target.split("#", 1)[0])
    if not target_without_anchor:
        return None
    if target_without_anchor.startswith("/"):
        return (REPO_ROOT / target_without_anchor.lstrip("/")).resolve()
    if target_without_anchor.startswith(ROOT_RELATIVE_LINK_PREFIXES):
        repo_target = (REPO_ROOT / target_without_anchor).resolve()
        if repo_target.exists():
            return repo_target
    return (source.parent / target_without_anchor).resolve()


def is_documentation_link_target(raw_target: str) -> bool:
    target = normalize_link_target(raw_target)
    path_part = strip_line_suffix(target.split("#", 1)[0]).rstrip("/")
    if not path_part:
        return False
    name = Path(path_part).name
    if "." not in name:
        return True
    return Path(name).suffix.lower() in DOC_LINK_SUFFIXES


def link_findings(markdown_files: list[Path]) -> list[Finding]:
    findings: list[Finding] = []
    for path in markdown_files:
        text = strip_inline_code(strip_fenced_code(path.read_text(encoding="utf-8", errors="replace")))
        for raw_target in markdown_link_targets(text):
            if not is_documentation_link_target(raw_target):
                continue
            target_path = resolve_link(path, raw_target)
            if target_path is None or target_path.exists():
                continue
            findings.append(Finding(repo_path(path), f"broken local link: {raw_target}"))
    return findings


def flatten_groups(groups: dict[str, list[Finding]]) -> list[Finding]:
    findings: list[Finding] = []
    for group_findings in groups.values():
        findings.extend(group_findings)
    return findings


def finding_to_dict(finding: Finding) -> dict[str, str]:
    return {"path": finding.path, "message": finding.message}


def print_grouped_section(title: str, groups: dict[str, list[Finding]], max_details: int) -> None:
    total = len(flatten_groups(groups))
    print(f"{title}: {total}")
    for group_name, findings in groups.items():
        print(f"  {group_name}: {len(findings)}")
        for finding in findings[:max_details]:
            print(f"    - {finding.path}: {finding.message}")
        remaining = len(findings) - max_details
        if remaining > 0:
            print(f"    ... {remaining} more")


def main() -> int:
    args = parse_args()
    markdown_files = iter_markdown_files()
    error_groups: dict[str, list[Finding]] = {
        "required_entries": check_required_entries() + check_status_md_line_limit(),
        "module_indexes": check_module_indexes(),
        "system_indexes": check_system_indexes(),
    }
    warning_groups: dict[str, list[Finding]] = {}
    frontmatter = frontmatter_findings(markdown_files)
    links = link_findings(markdown_files)
    if args.strict_frontmatter:
        error_groups["frontmatter"] = frontmatter
    else:
        warning_groups["frontmatter"] = frontmatter
    if args.strict_links:
        error_groups["links"] = links
    else:
        warning_groups["links"] = links

    errors = flatten_groups(error_groups)
    warnings = flatten_groups(warning_groups)
    result = "failed" if errors else ("passed_with_warnings" if warnings else "passed")

    if args.format == "json":
        print(
            json.dumps(
                {
                    "result": result,
                    "markdown_files_checked": len(markdown_files),
                    "counts": {"errors": len(errors), "warnings": len(warnings)},
                    "errors": {k: [finding_to_dict(f) for f in v] for k, v in error_groups.items()},
                    "warnings": {k: [finding_to_dict(f) for f in v] for k, v in warning_groups.items()},
                },
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print("Docs health check")
        print(f"- markdown files checked: {len(markdown_files)}")
        print()
        print_grouped_section("Errors", error_groups, args.max_details)
        print_grouped_section("Warnings", warning_groups, args.max_details)
        print()
        print(f"Result: {result.replace('_', ' ')}")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
