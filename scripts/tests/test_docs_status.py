#!/usr/bin/env python3
"""Unit tests for generated documentation status columns."""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

from docs_status import (  # noqa: E402
    PRD_STATUS_VALUES,
    compare_generated_columns,
    parse_prd_statuses,
    apply_generated_status,
)

HEAD_REQUIREMENTS_FIXTURE = """\
### PRD-007 诚实降级

- **状态**：`accepted`
- **用户价值**：能力缺失时用户看到空或省略，而不是假数据。
- **依赖或未决**：无。验收 4–5 见 conversation-stream-timeline。

## 待验证说明

PRD-001 至 PRD-007 的代码已在 M0–M3 合入，但 D4 启动冒烟仍阻塞于 compile。因此这些需求保持 `accepted`，不升 `implemented`。

### PRD-011 Chat 并排比对

- **状态**：`accepted`
- **依赖或未决**：依赖 PRD-008 `accepted` 与 `implemented` 字样不得被抽到本节。
"""


def copy_docs_tree(src_root: Path, dst_root: Path) -> None:
    for rel in (
        "docs/product/requirements.md",
        "docs/product/traceability.md",
        "dev/plans/INDEX.md",
    ):
        source = src_root / rel
        target = dst_root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    plans_src = src_root / "dev/plans"
    plans_dst = dst_root / "dev/plans"
    plans_dst.mkdir(parents=True, exist_ok=True)
    # The fixture carries only plans INDEX links to. A working-tree draft that
    # is not indexed yet is transient local state, not a docs contract; real
    # tree drift stays covered by `generate-docs-status.py --check` in CI.
    index_text = (plans_src / "INDEX.md").read_text(encoding="utf-8")
    indexed_plans = {
        Path(target).name
        for target in re.findall(r"\]\(([^)]+)\)", index_text)
        if target.endswith(".md") and "/" not in target
    }
    for plan in plans_src.glob("*.md"):
        if plan.name == "INDEX.md" or plan.name not in indexed_plans:
            continue
        shutil.copy2(plan, plans_dst / plan.name)


class DocsStatusTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        copy_docs_tree(REPO_ROOT, self.root)

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def test_check_fails_when_generated_column_drifts_from_source(self) -> None:
        trace_path = self.root / "docs/product/traceability.md"
        text = trace_path.read_text(encoding="utf-8")
        text = text.replace("| `accepted` |", "| `implemented` |", 1)
        trace_path.write_text(text, encoding="utf-8")
        findings = compare_generated_columns(self.root)
        self.assertTrue(any("expected '`accepted`'" in f.message for f in findings))

    def test_health_fails_when_generated_col_marker_removed(self) -> None:
        index_path = self.root / "dev/plans/INDEX.md"
        text = index_path.read_text(encoding="utf-8")
        text = text.replace(
            '<!-- generated-col id="plans-index-status" source="plan-frontmatter-status" column="状态" key="first-link" -->\n',
            "",
        )
        index_path.write_text(text, encoding="utf-8")
        findings = compare_generated_columns(self.root)
        self.assertTrue(any("plans-index-status" in f.message for f in findings))

    def test_apply_updates_status_column_and_preserves_other_links(self) -> None:
        plan_path = self.root / "dev/plans/test-baseline-ci.md"
        plan_text = plan_path.read_text(encoding="utf-8")
        plan_path.write_text(plan_text.replace("status: accepted", "status: draft", 1), encoding="utf-8")

        index_before = (self.root / "dev/plans/INDEX.md").read_bytes()
        marker = b"BYTE_STABLE_SUMMARY_UNIQUE_7f3a9c2e"
        index_text = (self.root / "dev/plans/INDEX.md").read_text(encoding="utf-8")
        index_text = index_text.replace(
            "| PRD-008 唯一已定义升档路径",
            f"| PRD-008 唯一已定义升档路径 {marker.decode()}",
            1,
        )
        (self.root / "dev/plans/INDEX.md").write_text(index_text, encoding="utf-8")

        apply_generated_status(self.root)
        findings = compare_generated_columns(self.root)
        self.assertEqual(findings, [])

        updated_index = (self.root / "dev/plans/INDEX.md").read_text(encoding="utf-8")
        self.assertIn(marker.decode(), updated_index)
        self.assertIn("[test-baseline-ci.md](test-baseline-ci.md)", updated_index)
        self.assertIn("| `draft` |", updated_index)

    def test_summary_and_intro_remain_byte_stable_after_write(self) -> None:
        unique_intro = b"BYTE_STABLE_INTRO_UNIQUE_b4e81d0f"
        unique_summary = b"BYTE_STABLE_SUMMARY_UNIQUE_c9a02f11"

        trace_path = self.root / "docs/product/traceability.md"
        trace_text = trace_path.read_text(encoding="utf-8")
        trace_text = trace_text.replace(
            "> 只链接事实来源，不复制",
            f"> {unique_intro.decode()} 只链接事实来源，不复制",
            1,
        )
        trace_path.write_text(trace_text, encoding="utf-8")

        index_path = self.root / "dev/plans/INDEX.md"
        index_text = index_path.read_text(encoding="utf-8")
        # Anchor on the row, not on its status value: the status is generated
        # and legitimately changes as the plan progresses.
        index_text, substitutions = re.subn(
            r"(docs-burden-reduction\.md\) \| `\w+` \| )",
            lambda match: match.group(1) + unique_summary.decode() + " ",
            index_text,
            count=1,
        )
        self.assertEqual(substitutions, 1, "docs-burden-reduction row not found in dev/plans/INDEX.md")
        index_path.write_text(index_text, encoding="utf-8")

        before_trace = trace_path.read_bytes()
        before_index = index_path.read_bytes()

        apply_generated_status(self.root)

        after_trace = trace_path.read_bytes()
        after_index = index_path.read_bytes()

        self.assertIn(unique_intro, after_trace)
        self.assertIn(unique_summary, after_index)
        self.assertEqual(
            before_trace.replace(b"`accepted`", b""),
            after_trace.replace(b"`accepted`", b""),
            "traceability non-status bytes changed unexpectedly",
        )

    def test_health_fails_when_all_markers_removed(self) -> None:
        trace_path = self.root / "docs/product/traceability.md"
        trace_text = trace_path.read_text(encoding="utf-8")
        trace_text = trace_text.replace("<!-- generated-col id=\"traceability-prd-status\"", "<!-- removed ")
        trace_text = trace_text.replace("<!-- generated:start id=\"traceability-prd-buckets\"", "<!-- removed-start ")
        trace_text = trace_text.replace("<!-- generated:end id=\"traceability-prd-buckets\"", "<!-- removed-end ")
        trace_path.write_text(trace_text, encoding="utf-8")

        index_path = self.root / "dev/plans/INDEX.md"
        index_text = index_path.read_text(encoding="utf-8")
        index_text = index_text.replace("<!-- generated-col id=\"plans-index-status\"", "<!-- removed ")
        index_path.write_text(index_text, encoding="utf-8")

        findings = compare_generated_columns(self.root)
        marker_messages = [f.message for f in findings if "marker" in f.message or "expected generated" in f.message]
        self.assertGreaterEqual(len(marker_messages), 3)

    def test_head_requirements_fixture_parses_all_prds(self) -> None:
        requirements_text = (REPO_ROOT / "docs/product/requirements.md").read_text(encoding="utf-8")
        statuses, findings = parse_prd_statuses(requirements_text)
        self.assertEqual(findings, [])

        # Contract against the document tree, not a snapshot of its size: the
        # tool must report exactly the PRD sections requirements.md defines
        # (missing / extra detection), with no duplicate headings, and every
        # status inside the closed set (illegal-status detection). Adding
        # PRD-030 therefore cannot stale this test the way `== 28` did.
        doc_prd_ids = re.findall(r"^### (PRD-\d{3})\b", requirements_text, flags=re.MULTILINE)
        self.assertGreater(len(doc_prd_ids), 0, "requirements.md defines no PRD sections")
        self.assertEqual(
            len(doc_prd_ids),
            len(set(doc_prd_ids)),
            "requirements.md contains duplicate PRD headings",
        )
        self.assertEqual(set(statuses), set(doc_prd_ids))
        for prd_id, status in sorted(statuses.items()):
            self.assertIn(status, PRD_STATUS_VALUES, prd_id)

        section_statuses, section_findings = parse_prd_statuses(HEAD_REQUIREMENTS_FIXTURE)
        self.assertEqual(section_findings, [])
        self.assertEqual(section_statuses["PRD-007"], "accepted")
        self.assertEqual(section_statuses["PRD-011"], "accepted")

        blocked_fixture = HEAD_REQUIREMENTS_FIXTURE.replace(
            "- **状态**：`accepted`",
            "- 状态：`blocked`",
            1,
        )
        blocked_statuses, blocked_findings = parse_prd_statuses(blocked_fixture)
        self.assertEqual(blocked_findings, [])
        self.assertEqual(blocked_statuses["PRD-007"], "blocked")

    def test_generate_cli_check_matches_compare(self) -> None:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "generate-docs-status.py"), "--check", "--repo-root", str(self.root)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)

    def test_check_flags_plan_missing_from_index(self) -> None:
        # Hermetic version of the real-tree contract: a plan on disk that
        # INDEX does not link must be reported, even though such local drafts
        # are filtered out of the fixture above.
        stray = self.root / "dev/plans/unindexed-local-draft.md"
        stray.write_text("---\nstatus: draft\n---\n\n# Unindexed Draft\n", encoding="utf-8")
        findings = compare_generated_columns(self.root)
        self.assertTrue(
            any(
                "unindexed-local-draft.md" in finding.message and "missing from INDEX" in finding.message
                for finding in findings
            ),
            findings,
        )


if __name__ == "__main__":
    unittest.main()
