#!/usr/bin/env python3
"""Git-hook environment isolation for wiki snapshots containing gitlinks."""

from __future__ import annotations

import os
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "wiki"))
import wiki  # noqa: E402


class WikiGitEnvironmentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory(prefix="wiki-git-environment-")
        self.addCleanup(self.tempdir.cleanup)
        self.root = Path(self.tempdir.name) / "parent"
        self.child = self.root / "dev/loop"
        self.root.mkdir()
        self.child.mkdir(parents=True)
        self.clean_env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        self.git(self.root, "init", "-q")
        self.git(self.child, "init", "-q")
        (self.child / "INDEX.md").write_text("# Recorded child revision\n")
        self.git(self.child, "add", "INDEX.md")
        self.commit(self.child, "Recorded child")
        child_oid = self.git(self.child, "rev-parse", "HEAD").strip()
        (self.root / "README.md").write_text("# Committed parent\n")
        self.git(self.root, "add", "README.md")
        self.git(self.root, "update-index", "--add", "--cacheinfo", f"160000,{child_oid},dev/loop")
        self.commit(self.root, "Parent with gitlink")
        (self.child / "INDEX.md").write_text("# Newer child checkout\n")
        self.git(self.child, "add", "INDEX.md")
        self.commit(self.child, "Child checkout advanced")
        (self.child / "INDEX.md").write_text("# Uncommitted child worktree\n")

        (self.root / "docs").mkdir()
        (self.root / "docs/wiki.json").write_text(json.dumps({
            "version": 1,
            "roots": [{"path": "docs", "role": "knowledge"}],
            "entrypoints": ["README.md"],
        }))
        self.git(self.root, "add", "docs/wiki.json")
        self.commit(self.root, "Wiki configuration")

        self.alternate_index = Path(self.tempdir.name) / "alternate-index"
        shutil.copy2(self.root / ".git/index", self.alternate_index)
        (self.root / "README.md").write_text("# Alternate parent index\n")
        self.git(self.root, "add", "README.md", env={"GIT_INDEX_FILE": str(self.alternate_index)})
        (self.root / "README.md").write_text("# Unstaged parent worktree\n")

    def git(self, root: Path, *args: str, env: dict[str, str] | None = None) -> str:
        return subprocess.check_output(
            ["git", "-C", str(root), *args],
            env={**self.clean_env, **(env or {})}, stderr=subprocess.PIPE, text=True,
        )

    def commit(self, root: Path, title: str) -> None:
        self.git(root, "-c", "user.name=Wiki Test", "-c", "user.email=wiki@example.invalid", "commit", "-qm", title)

    def test_hook_repository_environment_does_not_redirect_gitlink_tree_or_blob_reads(self) -> None:
        with patch.dict(os.environ, {
            "GIT_DIR": str(self.root / ".git"),
            "GIT_WORK_TREE": str(self.root),
            "GIT_COMMON_DIR": str(self.root / ".git"),
            "GIT_INDEX_FILE": str(self.alternate_index),
            "GIT_OBJECT_DIRECTORY": str(self.root / ".git/objects"),
            "GIT_ALTERNATE_OBJECT_DIRECTORIES": str(self.root / ".git/objects"),
        }):
            snapshot = wiki.Snapshot(self.root, staged=True)
            self.assertIn("dev/loop/INDEX.md", snapshot.files())
            self.assertEqual(
                (snapshot.read("README.md"), snapshot.read("dev/loop/INDEX.md"), snapshot.head_read("dev/loop/INDEX.md")),
                (b"# Alternate parent index\n", b"# Recorded child revision\n", b"# Recorded child revision\n"),
            )

    def test_parent_alternate_index_remains_the_snapshot_namespace(self) -> None:
        with patch.dict(os.environ, {"GIT_INDEX_FILE": str(self.alternate_index)}):
            snapshot = wiki.Snapshot(self.root, staged=True)
            self.assertEqual(
                (snapshot.read("README.md"), snapshot.head_read("README.md")),
                (b"# Alternate parent index\n", b"# Committed parent\n"),
            )

    def test_missing_gitlink_object_stays_a_broken_link_without_checkout_fallback(self) -> None:
        missing_child_oid = self.git(self.root, "rev-parse", "HEAD").strip()
        alternate = {"GIT_INDEX_FILE": str(self.alternate_index)}
        self.git(self.root, "update-index", "--cacheinfo", f"160000,{missing_child_oid},dev/loop", env=alternate)
        (self.root / "README.md").write_text("# Parent\n[Loop](dev/loop/INDEX.md)\n")
        self.git(self.root, "add", "README.md", env=alternate)
        with patch.dict(os.environ, {"GIT_DIR": str(self.root / ".git"), **alternate}):
            snapshot = wiki.Snapshot(self.root, staged=True)
            self.assertFalse(snapshot.exists("dev/loop/INDEX.md"))
            findings = wiki.check(wiki.Wiki(snapshot))
            self.assertEqual(
                [(finding.path, finding.key) for finding in findings if finding.rule == "broken-link"],
                [("README.md", "dev/loop/INDEX.md")],
            )

    def test_environment_discovery_failure_is_not_treated_as_a_missing_gitlink(self) -> None:
        snapshot = wiki.Snapshot(self.root, staged=True)
        original_run = subprocess.run

        def fail_environment_query(args: list[str], **kwargs):
            if args == ["git", "rev-parse", "--local-env-vars"]:
                return subprocess.CompletedProcess(args, 1, b"", b"controlled environment query failure")
            return original_run(args, **kwargs)

        with patch.object(wiki.subprocess, "run", side_effect=fail_environment_query):
            with self.assertRaisesRegex(wiki.GitEnvironmentError, "Cannot identify repository-local Git environment variables"):
                wiki.Snapshot(self.root, staged=True)
            for reader in (snapshot.read, snapshot.head_read):
                with self.assertRaisesRegex(wiki.GitEnvironmentError, "Cannot identify repository-local Git environment variables"):
                    reader("dev/loop/INDEX.md")


if __name__ == "__main__":
    unittest.main()
