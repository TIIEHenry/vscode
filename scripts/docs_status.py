#!/usr/bin/env python3
"""Parse and compare generated documentation status columns (importable)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

EXPECTED_MARKER_IDS = frozenset(
    {
        "plans-index-status",
        "traceability-prd-status",
        "traceability-prd-buckets",
    }
)

PRD_STATUS_VALUES = frozenset({"proposed", "accepted", "implemented", "blocked"})
PLAN_STATUS_VALUES = frozenset({"draft", "accepted", "implemented"})

GENERATED_COL_RE = re.compile(
    r"<!--\s*generated-col\s+"
    r'id="([^"]+)"\s+'
    r'source="([^"]+)"\s+'
    r'column="([^"]+)"\s+'
    r'key="([^"]+)"\s*-->'
)
GENERATED_START_RE = re.compile(
    r'<!--\s*generated:start\s+id="([^"]+)"\s+source="([^"]+)"\s*-->'
)
GENERATED_END_RE = re.compile(r'<!--\s*generated:end\s+id="([^"]+)"\s*-->')

PRD_HEADING_RE = re.compile(r"^###\s+(PRD-\d{3})\b")
ANY_HEADING_RE = re.compile(r"^#{1,6}\s+")
STATUS_LINE_RE = re.compile(r"^- (\*\*)?状态(\*\*)?[：:]\s*(.+)$")
STATUS_TOKEN_RE = re.compile(r"`(proposed|accepted|implemented|blocked)`")
FIRST_LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
PRD_ID_CELL_RE = re.compile(r"(PRD-\d{3})")
UPDATED_RE = re.compile(r"^updated:\s*.+$", re.MULTILINE)


@dataclass(frozen=True)
class StatusFinding:
    path: str
    message: str


@dataclass(frozen=True)
class GeneratedColMarker:
    marker_id: str
    source: str
    column: str
    key: str
    line_no: int


@dataclass(frozen=True)
class MarkdownTable:
    header: list[str]
    rows: list[list[str]]
    start_line: int
    end_line: int


def repo_path(path: Path, root: Path = REPO_ROOT) -> str:
    return path.relative_to(root).as_posix()


def split_table_cells(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped.startswith("|"):
        return []
    inner = stripped.strip("|")
    return [cell.strip() for cell in inner.split("|")]


def is_separator_row(cells: list[str]) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells if cell)


def parse_markdown_table(lines: list[str], start_idx: int) -> MarkdownTable | None:
    if start_idx >= len(lines) or not lines[start_idx].strip().startswith("|"):
        return None
    header = split_table_cells(lines[start_idx])
    if not header:
        return None
    cursor = start_idx + 1
    if cursor < len(lines) and is_separator_row(split_table_cells(lines[cursor])):
        cursor += 1
    rows: list[list[str]] = []
    while cursor < len(lines):
        line = lines[cursor]
        if not line.strip().startswith("|"):
            break
        cells = split_table_cells(line)
        if not cells:
            break
        rows.append(cells)
        cursor += 1
    return MarkdownTable(header=header, rows=rows, start_line=start_idx, end_line=cursor - 1)


def find_generated_col_markers(text: str) -> list[GeneratedColMarker]:
    markers: list[GeneratedColMarker] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        match = GENERATED_COL_RE.search(line)
        if match:
            markers.append(
                GeneratedColMarker(
                    marker_id=match.group(1),
                    source=match.group(2),
                    column=match.group(3),
                    key=match.group(4),
                    line_no=line_no,
                )
            )
    return markers


def find_bucket_region(text: str) -> tuple[int, int, str] | None:
    lines = text.splitlines()
    start_line = end_line = None
    marker_id = None
    for idx, line in enumerate(lines):
        start_match = GENERATED_START_RE.search(line)
        if start_match:
            marker_id = start_match.group(1)
            start_line = idx
            continue
        if start_line is not None and marker_id is not None:
            end_match = GENERATED_END_RE.search(line)
            if end_match and end_match.group(1) == marker_id:
                end_line = idx
                break
    if start_line is None or end_line is None or end_line <= start_line:
        return None
    return start_line, end_line, marker_id


def parse_frontmatter_block(text: str) -> str | None:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    try:
        closing = lines[1:].index("---") + 1
    except ValueError:
        return None
    return "\n".join(lines[1:closing])


def parse_frontmatter_status(text: str) -> str | None:
    body = parse_frontmatter_block(text)
    if body is None:
        return None
    statuses = re.findall(r"^status:\s*(\S+)\s*$", body, re.MULTILINE)
    if not statuses:
        return None
    return statuses[-1].strip("`")


def parse_prd_statuses(requirements_text: str) -> tuple[dict[str, str], list[StatusFinding]]:
    findings: list[StatusFinding] = []
    statuses: dict[str, str] = {}
    lines = requirements_text.splitlines()
    section_start = None
    section_id = None

    def close_section(end_idx: int) -> None:
        nonlocal section_start, section_id
        if section_start is None or section_id is None:
            return
        status_value, section_findings = extract_prd_status_from_section(
            lines[section_start:end_idx], section_id
        )
        findings.extend(section_findings)
        if status_value is not None:
            if section_id in statuses:
                findings.append(
                    StatusFinding(
                        "docs/product/requirements.md",
                        f"{section_id} appears more than once",
                    )
                )
            statuses[section_id] = status_value
        section_start = None
        section_id = None

    for idx, line in enumerate(lines):
        prd_match = PRD_HEADING_RE.match(line)
        if prd_match:
            close_section(idx)
            section_id = prd_match.group(1)
            section_start = idx
            continue
        if section_start is not None and ANY_HEADING_RE.match(line) and not PRD_HEADING_RE.match(line):
            close_section(idx)
    close_section(len(lines))
    return statuses, findings


def extract_prd_status_from_section(
    section_lines: list[str], prd_id: str
) -> tuple[str | None, list[StatusFinding]]:
    findings: list[StatusFinding] = []
    for line in section_lines[1:]:
        match = STATUS_LINE_RE.match(line)
        if not match:
            continue
        tokens = STATUS_TOKEN_RE.findall(match.group(3))
        unique = []
        for token in tokens:
            if token not in unique:
                unique.append(token)
        if not unique:
            findings.append(
                StatusFinding(
                    "docs/product/requirements.md",
                    f"{prd_id}: status line has no closed-set token",
                )
            )
            return None, findings
        if len(unique) > 1:
            findings.append(
                StatusFinding(
                    "docs/product/requirements.md",
                    f"{prd_id}: status line has multiple different closed-set tokens: {unique}",
                )
            )
            return None, findings
        return unique[0], findings
    findings.append(
        StatusFinding(
            "docs/product/requirements.md",
            f"{prd_id}: missing status line",
        )
    )
    return None, findings


def format_status_cell(status: str) -> str:
    return f"`{status}`"


def column_index(header: list[str], column_name: str) -> int | None:
    try:
        return header.index(column_name)
    except ValueError:
        return None


def first_markdown_link(cell: str) -> str | None:
    match = FIRST_LINK_RE.search(cell)
    if not match:
        return None
    return match.group(2).strip()


def prd_id_from_cell(cell: str) -> str | None:
    match = PRD_ID_CELL_RE.search(cell)
    return match.group(1) if match else None


def load_requirements_prd_statuses(root: Path) -> tuple[dict[str, str], list[StatusFinding]]:
    path = root / "docs/product/requirements.md"
    text = path.read_text(encoding="utf-8")
    return parse_prd_statuses(text)


def load_plan_statuses(root: Path) -> tuple[dict[str, str], list[StatusFinding]]:
    findings: list[StatusFinding] = []
    statuses: dict[str, str] = {}
    plans_dir = root / "dev/plans"
    for plan_path in sorted(plans_dir.glob("*.md")):
        if plan_path.name == "INDEX.md":
            continue
        rel = plan_path.name
        text = plan_path.read_text(encoding="utf-8")
        status = parse_frontmatter_status(text)
        if status is None:
            findings.append(StatusFinding(repo_path(plan_path, root), "missing frontmatter status"))
            continue
        if status not in PLAN_STATUS_VALUES:
            findings.append(
                StatusFinding(
                    repo_path(plan_path, root),
                    f"frontmatter status '{status}' is not in closed set {sorted(PLAN_STATUS_VALUES)}",
                )
            )
            continue
        statuses[rel] = status
    return statuses, findings


def extract_prd_links_from_traceability(text: str) -> dict[str, str]:
    links: dict[str, str] = {}
    table = None
    for marker in find_generated_col_markers(text):
        if marker.marker_id == "traceability-prd-status":
            lines = text.splitlines()
            table = parse_markdown_table(lines, marker.line_no)
            break
    if table is None:
        for idx, line in enumerate(text.splitlines()):
            if line.strip().startswith("| PRD-ID |"):
                table = parse_markdown_table(text.splitlines(), idx)
                break
    if table is None:
        return links
    id_idx = column_index(table.header, "PRD-ID")
    if id_idx is None:
        return links
    for row in table.rows:
        if len(row) <= id_idx:
            continue
        prd_id = prd_id_from_cell(row[id_idx])
        target = first_markdown_link(row[id_idx])
        if prd_id and target:
            links[prd_id] = target
    return links


def render_bucket_lines(prd_statuses: dict[str, str], prd_links: dict[str, str]) -> list[str]:
    bucket_order = ("proposed", "accepted", "implemented", "blocked")
    lines = [
        "| 分桶 | PRD |",
        "|------|-----|",
    ]
    for bucket in bucket_order:
        prd_ids = sorted(prd_id for prd_id, status in prd_statuses.items() if status == bucket)
        if not prd_ids:
            cell = ""
        else:
            parts = []
            for prd_id in prd_ids:
                link_target = prd_links.get(prd_id, f"requirements.md#{prd_id.lower()}")
                parts.append(f"[{prd_id}]({link_target})")
            cell = " · ".join(parts)
        lines.append(f"| `{bucket}` | {cell} |")
    return lines


def expected_bucket_region_lines(prd_statuses: dict[str, str], prd_links: dict[str, str]) -> list[str]:
    return render_bucket_lines(prd_statuses, prd_links)


def rebuild_row(cells: list[str]) -> str:
    return "| " + " | ".join(cell.strip() for cell in cells) + " |"


def apply_status_column(
    table: MarkdownTable,
    column_name: str,
    expected_values: dict[str, str],
    key_fn,
) -> tuple[MarkdownTable, bool]:
    idx = column_index(table.header, column_name)
    if idx is None:
        raise ValueError(f"table missing column '{column_name}'")
    changed = False
    new_rows: list[list[str]] = []
    for row in table.rows:
        if len(row) <= idx:
            new_rows.append(row)
            continue
        key = key_fn(row)
        if key is None:
            new_rows.append(row)
            continue
        if key not in expected_values:
            new_rows.append(row)
            continue
        expected_cell = format_status_cell(expected_values[key])
        cells = list(row)
        if cells[idx].strip() != expected_cell:
            changed = True
        cells[idx] = expected_cell
        new_rows.append(cells)
    return MarkdownTable(
        header=table.header,
        rows=new_rows,
        start_line=table.start_line,
        end_line=table.end_line,
    ), changed


def replace_table_in_lines(lines: list[str], table: MarkdownTable) -> list[str]:
    rendered = [rebuild_row(table.header)]
    if table.rows:
        separator = "| " + " | ".join("---" for _ in table.header) + " |"
        rendered.append(separator)
    rendered.extend(rebuild_row(row) for row in table.rows)
    return lines[: table.start_line] + rendered + lines[table.end_line + 1 :]


def touch_updated_field(text: str, today: str | None = None) -> str:
    if today is None:
        today = date.today().isoformat()
    if UPDATED_RE.search(text):
        return UPDATED_RE.sub(f"updated: {today}", text, count=1)
    return text


def collect_marker_findings(root: Path) -> list[StatusFinding]:
    findings: list[StatusFinding] = []
    seen_ids: set[str] = set()

    plans_index = root / "dev/plans/INDEX.md"
    traceability = root / "docs/product/traceability.md"

    for path in (plans_index, traceability):
        if not path.exists():
            findings.append(StatusFinding(repo_path(path, root), "file missing"))
            continue
        text = path.read_text(encoding="utf-8")
        for marker in find_generated_col_markers(text):
            seen_ids.add(marker.marker_id)

    bucket = find_bucket_region(traceability.read_text(encoding="utf-8")) if traceability.exists() else None
    if bucket is not None:
        seen_ids.add(bucket[2])

    missing = sorted(EXPECTED_MARKER_IDS - seen_ids)
    for marker_id in missing:
        findings.append(
            StatusFinding(
                "scripts/docs_status.py",
                f"expected generated marker id '{marker_id}' is missing",
            )
        )

    extra = sorted(seen_ids - EXPECTED_MARKER_IDS)
    for marker_id in extra:
        findings.append(
            StatusFinding(
                "scripts/docs_status.py",
                f"unexpected generated marker id '{marker_id}'",
            )
        )

    if traceability.exists():
        text = traceability.read_text(encoding="utf-8")
        region = find_bucket_region(text)
        if region is None and "traceability-prd-buckets" not in seen_ids:
            pass
        elif region is None:
            findings.append(
                StatusFinding(
                    repo_path(traceability, root),
                    "traceability-prd-buckets start/end markers are not paired",
                )
            )

    return findings


def compare_generated_columns(root: Path) -> list[StatusFinding]:
    findings: list[StatusFinding] = []
    findings.extend(collect_marker_findings(root))

    prd_statuses, prd_findings = load_requirements_prd_statuses(root)
    findings.extend(prd_findings)

    plan_statuses, plan_findings = load_plan_statuses(root)
    findings.extend(plan_findings)

    plans_index_path = root / "dev/plans/INDEX.md"
    traceability_path = root / "docs/product/traceability.md"

    if plans_index_path.exists():
        text = plans_index_path.read_text(encoding="utf-8")
        markers = [m for m in find_generated_col_markers(text) if m.marker_id == "plans-index-status"]
        if not markers:
            findings.append(
                StatusFinding(
                    repo_path(plans_index_path, root),
                    "missing generated-col marker plans-index-status",
                )
            )
        else:
            lines = text.splitlines()
            table = parse_markdown_table(lines, markers[0].line_no)
            if table is None:
                findings.append(
                    StatusFinding(
                        repo_path(plans_index_path, root),
                        "plans-index-status marker is not followed by a table",
                    )
                )
            else:
                idx = column_index(table.header, "状态")
                if idx is None:
                    findings.append(
                        StatusFinding(
                            repo_path(plans_index_path, root),
                            "plans INDEX table missing 状态 column",
                        )
                    )
                else:
                    indexed_plans: dict[str, int] = {}
                    for row in table.rows:
                        link = first_markdown_link(row[0]) if row else None
                        if not link:
                            findings.append(
                                StatusFinding(
                                    repo_path(plans_index_path, root),
                                    "plans INDEX row missing first-column link",
                                )
                            )
                            continue
                        plan_name = Path(link).name
                        if plan_name == "INDEX.md":
                            continue
                        indexed_plans[plan_name] = indexed_plans.get(plan_name, 0) + 1
                        expected = plan_statuses.get(plan_name)
                        if expected is None:
                            findings.append(
                                StatusFinding(
                                    repo_path(plans_index_path, root),
                                    f"INDEX links to unknown plan '{plan_name}'",
                                )
                            )
                            continue
                        if len(row) <= idx:
                            continue
                        actual = row[idx].strip()
                        expected_cell = format_status_cell(expected)
                        if actual != expected_cell:
                            findings.append(
                                StatusFinding(
                                    repo_path(plans_index_path, root),
                                    f"{plan_name} status cell is '{actual}', expected '{expected_cell}' "
                                    "(run python3 scripts/generate-docs-status.py)",
                                )
                            )
                    for plan_name, count in sorted(indexed_plans.items()):
                        if count != 1:
                            findings.append(
                                StatusFinding(
                                    repo_path(plans_index_path, root),
                                    f"plan '{plan_name}' appears {count} times in INDEX (expected 1)",
                                )
                            )
                    for plan_name in sorted(plan_statuses):
                        if indexed_plans.get(plan_name, 0) == 0:
                            findings.append(
                                StatusFinding(
                                    repo_path(plans_index_path, root),
                                    f"plan '{plan_name}' is missing from INDEX",
                                )
                            )

    if traceability_path.exists():
        text = traceability_path.read_text(encoding="utf-8")
        prd_links = extract_prd_links_from_traceability(text)
        markers = [m for m in find_generated_col_markers(text) if m.marker_id == "traceability-prd-status"]
        if not markers:
            findings.append(
                StatusFinding(
                    repo_path(traceability_path, root),
                    "missing generated-col marker traceability-prd-status",
                )
            )
        else:
            lines = text.splitlines()
            table = parse_markdown_table(lines, markers[0].line_no)
            if table is None:
                findings.append(
                    StatusFinding(
                        repo_path(traceability_path, root),
                        "traceability-prd-status marker is not followed by a table",
                    )
                )
            else:
                idx = column_index(table.header, "产品状态")
                if idx is None:
                    findings.append(
                        StatusFinding(
                            repo_path(traceability_path, root),
                            "traceability table missing 产品状态 column",
                        )
                    )
                else:
                    indexed_prds: dict[str, int] = {}
                    for row in table.rows:
                        prd_id = prd_id_from_cell(row[0]) if row else None
                        if not prd_id:
                            findings.append(
                                StatusFinding(
                                    repo_path(traceability_path, root),
                                    "traceability row missing PRD-ID",
                                )
                            )
                            continue
                        indexed_prds[prd_id] = indexed_prds.get(prd_id, 0) + 1
                        expected = prd_statuses.get(prd_id)
                        if expected is None:
                            findings.append(
                                StatusFinding(
                                    repo_path(traceability_path, root),
                                    f"{prd_id} has no requirements section",
                                )
                            )
                            continue
                        if len(row) <= idx:
                            continue
                        actual = row[idx].strip()
                        expected_cell = format_status_cell(expected)
                        if actual != expected_cell:
                            findings.append(
                                StatusFinding(
                                    repo_path(traceability_path, root),
                                    f"{prd_id} product status cell is '{actual}', expected '{expected_cell}' "
                                    "(run python3 scripts/generate-docs-status.py)",
                                )
                            )
                    for prd_id, count in sorted(indexed_prds.items()):
                        if count != 1:
                            findings.append(
                                StatusFinding(
                                    repo_path(traceability_path, root),
                                    f"{prd_id} appears {count} times in traceability (expected 1)",
                                )
                            )
                    for prd_id in sorted(prd_statuses):
                        if indexed_prds.get(prd_id, 0) == 0:
                            findings.append(
                                StatusFinding(
                                    repo_path(traceability_path, root),
                                    f"{prd_id} is missing from traceability",
                                )
                            )

        region = find_bucket_region(text)
        if region is None:
            if not any(
                f.message.startswith("expected generated marker id 'traceability-prd-buckets'")
                for f in findings
            ):
                findings.append(
                    StatusFinding(
                        repo_path(traceability_path, root),
                        "traceability-prd-buckets region is missing or not paired",
                    )
                )
        else:
            start, end, _ = region
            actual_lines = [line.rstrip() for line in text.splitlines()[start + 1 : end]]
            expected_lines = expected_bucket_region_lines(prd_statuses, prd_links)
            if actual_lines != expected_lines:
                findings.append(
                    StatusFinding(
                        repo_path(traceability_path, root),
                        "traceability-prd-buckets content does not match expected output "
                        "(run python3 scripts/generate-docs-status.py)",
                    )
                )

    return findings


def apply_generated_status(root: Path, dry_run: bool = False) -> list[str]:
    changes: list[str] = []
    prd_statuses, prd_findings = load_requirements_prd_statuses(root)
    if prd_findings:
        raise RuntimeError(
            "cannot generate status while requirements parsing has errors: "
            + "; ".join(f"{f.path}: {f.message}" for f in prd_findings)
        )
    plan_statuses, plan_findings = load_plan_statuses(root)
    if plan_findings:
        raise RuntimeError(
            "cannot generate status while plan parsing has errors: "
            + "; ".join(f"{f.path}: {f.message}" for f in plan_findings)
        )

    plans_index_path = root / "dev/plans/INDEX.md"
    plans_text = plans_index_path.read_text(encoding="utf-8")
    plans_lines = plans_text.splitlines()
    plans_changed = False
    for marker in find_generated_col_markers(plans_text):
        if marker.marker_id != "plans-index-status":
            continue
        table = parse_markdown_table(plans_lines, marker.line_no)
        if table is None:
            raise RuntimeError("plans-index-status is not followed by a table")

        def plan_key(row: list[str]) -> str | None:
            link = first_markdown_link(row[0]) if row else None
            return Path(link).name if link else None

        updated_table, changed = apply_status_column(table, "状态", plan_statuses, plan_key)
        if changed:
            plans_changed = True
            changes.append("dev/plans/INDEX.md: 状态 column updated")
        plans_lines = replace_table_in_lines(plans_lines, updated_table)

    if plans_changed and not dry_run:
        new_text = touch_updated_field("\n".join(plans_lines) + ("\n" if plans_text.endswith("\n") else ""))
        plans_index_path.write_text(new_text, encoding="utf-8")

    traceability_path = root / "docs/product/traceability.md"
    trace_text = traceability_path.read_text(encoding="utf-8")
    trace_lines = trace_text.splitlines()
    prd_links = extract_prd_links_from_traceability(trace_text)
    trace_changed = False

    for marker in find_generated_col_markers(trace_text):
        if marker.marker_id != "traceability-prd-status":
            continue
        table = parse_markdown_table(trace_lines, marker.line_no)
        if table is None:
            raise RuntimeError("traceability-prd-status is not followed by a table")

        def prd_key(row: list[str]) -> str | None:
            return prd_id_from_cell(row[0]) if row else None

        updated_table, changed = apply_status_column(table, "产品状态", prd_statuses, prd_key)
        if changed:
            trace_changed = True
            changes.append("docs/product/traceability.md: 产品状态 column updated")
        trace_lines = replace_table_in_lines(trace_lines, updated_table)

    region = find_bucket_region("\n".join(trace_lines))
    if region is not None:
        start, end, _ = region
        expected_lines = expected_bucket_region_lines(prd_statuses, prd_links)
        actual_lines = [line.rstrip() for line in trace_lines[start + 1 : end]]
        if actual_lines != expected_lines:
            trace_changed = True
            changes.append("docs/product/traceability.md: traceability-prd-buckets region updated")
            trace_lines = trace_lines[: start + 1] + expected_lines + trace_lines[end:]

    if trace_changed and not dry_run:
        new_text = touch_updated_field("\n".join(trace_lines) + ("\n" if trace_text.endswith("\n") else ""))
        traceability_path.write_text(new_text, encoding="utf-8")

    return changes
