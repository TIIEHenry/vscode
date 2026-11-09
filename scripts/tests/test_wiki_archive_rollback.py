#!/usr/bin/env python3
"""Archive rollback undoes only what one run created or moved, and never replaces another writer's entry."""

from __future__ import annotations

import errno
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "wiki"))
import wiki  # noqa: E402

REAL_MKDIR = os.mkdir
REAL_RENAME = os.rename
REAL_REPLACE = os.replace
REAL_UNLINK = os.unlink
REAL_MOVE = wiki.move_file_without_overwrite

PROJECT = {
    "docs/wiki.json": json.dumps({
        "version": 1,
        "roots": [
            {"path": "docs", "role": "knowledge"},
            {"path": "dev", "role": "process"},
            {"path": "archive", "role": "archive"},
        ],
        "entrypoints": ["README.md"],
    }),
    "README.md": "# Project\n\n[Work](dev/INDEX.md)\n",
    "dev/INDEX.md": "# Work\n\n[Batch](batch/a.md)\n[Single](single.md)\n",
    "dev/batch/a.md": "# Batch A\n\n[Work](../INDEX.md)\n",
    "dev/batch/b.md": "# Batch B\n",
    "dev/batch/notes/c.md": "# Notes\n\n[Batch A](../a.md)\n",
    "dev/single.md": "# Single\n\n[Work](INDEX.md)\n",
}


def same_path(value: object, path: Path) -> bool:
    return isinstance(value, (str, os.PathLike)) and os.fspath(value) == os.fspath(path)


class ArchiveRollbackTests(unittest.TestCase):
    def setUp(self) -> None:
        tempdir = tempfile.TemporaryDirectory(prefix="wiki-rollback-test-")
        self.addCleanup(tempdir.cleanup)
        self.base = Path(tempdir.name).resolve()
        clean_env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        clean_env["GIT_CEILING_DIRECTORIES"] = str(self.base)
        environment = mock.patch.dict(os.environ, clean_env, clear=True)
        environment.start()
        self.addCleanup(environment.stop)
        self.projects = 0

    def make_project(self) -> Path:
        self.projects += 1
        root = self.base / f"project-{self.projects}"
        for relative, text in PROJECT.items():
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding="utf-8")
        return root

    def preview(self, root: Path, path: str) -> str:
        result = wiki.archive_report(wiki.Wiki(wiki.Snapshot(root)), path)
        self.assertEqual(result["errors"], 0, result["findings"])
        return result["plan_sha256"]

    def apply(self, root: Path, path: str, plan: str) -> dict:
        return wiki.archive_apply(wiki.Wiki(wiki.Snapshot(root)), path, plan, None)

    def rules(self, result: dict) -> set[str]:
        return {finding["rule"] for finding in result["findings"]}

    def rollback_messages(self, result: dict) -> list[str]:
        return [finding["message"] for finding in result["findings"] if finding["rule"] == "archive-rollback-failed"]

    def test_directory_destination_created_meanwhile_is_left_alone(self) -> None:
        root = self.make_project()
        source, destination = root / "dev/batch", root / "archive/dev/batch"
        plan = self.preview(root, "dev/batch")

        def collision(path, *args, **kwargs):
            if same_path(path, destination):
                REAL_MKDIR(path)
                (destination / "a.md").write_text("# Other writer\n", encoding="utf-8")
            return REAL_MKDIR(path, *args, **kwargs)

        with mock.patch.object(wiki.os, "mkdir", side_effect=collision):
            result = self.apply(root, "dev/batch", plan)
        self.assertIn("archive-apply-failed", self.rules(result))
        self.assertNotIn("archive-rollback-failed", self.rules(result), result["findings"])
        self.assertEqual((source / "a.md").read_text(encoding="utf-8"), PROJECT["dev/batch/a.md"])
        self.assertEqual((source / "b.md").read_text(encoding="utf-8"), PROJECT["dev/batch/b.md"])
        self.assertEqual((destination / "a.md").read_text(encoding="utf-8"), "# Other writer\n")

    def test_directory_taken_by_an_earlier_run_is_not_moved_back(self) -> None:
        root = self.make_project()
        source, destination = root / "dev/batch", root / "archive/dev/batch"
        plan = self.preview(root, "dev/batch")

        def earlier_run(path, *args, **kwargs):
            if same_path(path, destination):
                REAL_MKDIR(path)
                for entry in sorted(os.listdir(source)):
                    REAL_RENAME(source / entry, destination / entry)
                os.rmdir(source)
            return REAL_MKDIR(path, *args, **kwargs)

        with mock.patch.object(wiki.os, "mkdir", side_effect=earlier_run):
            result = self.apply(root, "dev/batch", plan)
        self.assertIn("archive-apply-failed", self.rules(result))
        self.assertNotIn("archive-rollback-failed", self.rules(result), result["findings"])
        self.assertFalse(os.path.lexists(source))
        self.assertEqual((destination / "a.md").read_text(encoding="utf-8"), PROJECT["dev/batch/a.md"])
        self.assertEqual((destination / "b.md").read_text(encoding="utf-8"), PROJECT["dev/batch/b.md"])

    def test_partial_move_rollback_keeps_entries_that_now_exist_at_the_source(self) -> None:
        for planted in ("file", "dangling link"):
            with self.subTest(planted=planted):
                root = self.make_project()
                source, destination = root / "dev/batch", root / "archive/dev/batch"
                plan = self.preview(root, "dev/batch")

                def fail_second(src, dst, *args, **kwargs):
                    if same_path(src, source / "b.md"):
                        if planted == "file":
                            (source / "a.md").write_text("# Other writer\n", encoding="utf-8")
                        else:
                            os.symlink("missing-target", source / "a.md")
                        raise OSError("injected move failure")
                    return REAL_RENAME(src, dst, *args, **kwargs)

                with mock.patch.object(wiki.os, "rename", side_effect=fail_second):
                    result = self.apply(root, "dev/batch", plan)
                self.assertIn("archive-rollback-failed", self.rules(result))
                if planted == "file":
                    self.assertEqual((source / "a.md").read_text(encoding="utf-8"), "# Other writer\n")
                else:
                    self.assertEqual(os.readlink(source / "a.md"), "missing-target")
                self.assertEqual((destination / "a.md").read_text(encoding="utf-8"), PROJECT["dev/batch/a.md"])
                self.assertEqual((source / "b.md").read_text(encoding="utf-8"), PROJECT["dev/batch/b.md"])

    def test_single_file_destination_taken_meanwhile_is_left_alone(self) -> None:
        for taken_by in ("file", "moved source", "dangling link"):
            with self.subTest(taken_by=taken_by):
                root = self.make_project()
                source, destination = root / "dev/single.md", root / "archive/dev/single.md"
                plan = self.preview(root, "dev/single.md")

                def occupy(src, dst):
                    if same_path(src, source):
                        if taken_by == "file":
                            dst.write_text("# Other writer\n", encoding="utf-8")
                        elif taken_by == "moved source":
                            REAL_RENAME(src, dst)
                        else:
                            os.symlink("missing-target", dst)
                    return REAL_MOVE(src, dst)

                with mock.patch.object(wiki, "move_file_without_overwrite", side_effect=occupy):
                    result = self.apply(root, "dev/single.md", plan)
                self.assertIn("archive-apply-failed", self.rules(result))
                self.assertNotIn("archive-rollback-failed", self.rules(result), result["findings"])
                self.assertFalse(source.is_dir())
                if taken_by == "file":
                    self.assertEqual(destination.read_text(encoding="utf-8"), "# Other writer\n")
                    self.assertEqual(source.read_text(encoding="utf-8"), PROJECT["dev/single.md"])
                elif taken_by == "moved source":
                    self.assertFalse(os.path.lexists(source))
                    self.assertEqual(destination.read_text(encoding="utf-8"), PROJECT["dev/single.md"])
                else:
                    self.assertEqual(os.readlink(destination), "missing-target")
                    self.assertEqual(source.read_text(encoding="utf-8"), PROJECT["dev/single.md"])

    def test_move_refuses_a_dangling_link_at_the_destination(self) -> None:
        root = self.make_project()
        source, destination = root / "dev/single.md", root / "dev/taken.md"
        os.symlink("missing-target", destination)
        with self.assertRaises(FileExistsError):
            wiki.move_file_without_overwrite(source, destination)
        self.assertEqual(os.readlink(destination), "missing-target")
        self.assertEqual(source.read_text(encoding="utf-8"), PROJECT["dev/single.md"])

    def test_move_does_not_rename_over_a_link_created_after_the_check(self) -> None:
        for code in (errno.EEXIST, errno.EPERM):
            with self.subTest(code=errno.errorcode[code]):
                root = self.make_project()
                source, destination = root / "dev/single.md", root / "dev/late.md"

                def link_appears(src, dst, *args, **kwargs):
                    os.symlink("missing-target", dst)
                    raise OSError(code, os.strerror(code), os.fspath(dst))

                with mock.patch.object(wiki.os, "link", side_effect=link_appears):
                    with mock.patch.object(wiki.os, "rename") as rename:
                        with self.assertRaises(FileExistsError):
                            wiki.move_file_without_overwrite(source, destination)
                rename.assert_not_called()
                self.assertEqual(os.readlink(destination), "missing-target")
                self.assertEqual(source.read_text(encoding="utf-8"), PROJECT["dev/single.md"])

    def test_move_keeps_a_symlink_source_a_symlink(self) -> None:
        root = self.make_project()
        link, moved, target = root / "dev/link.md", root / "dev/moved.md", root / "dev/single.md"
        os.symlink("single.md", link)
        wiki.move_file_without_overwrite(link, moved)
        self.assertFalse(os.path.lexists(link))
        self.assertTrue(moved.is_symlink())
        self.assertEqual(os.readlink(moved), "single.md")
        self.assertEqual(target.stat().st_nlink, 1)

    def test_move_falls_back_to_rename_without_hard_links(self) -> None:
        root = self.make_project()
        source, destination = root / "dev/single.md", root / "dev/moved.md"
        with mock.patch.object(wiki.os, "link", side_effect=PermissionError(errno.EPERM, "hard links are not allowed")):
            wiki.move_file_without_overwrite(source, destination)
        self.assertFalse(os.path.lexists(source))
        self.assertEqual(destination.read_text(encoding="utf-8"), PROJECT["dev/single.md"])

    def test_source_unlink_failure_takes_back_or_reports_the_hard_link(self) -> None:
        for case in ("taken back", "cleanup fails", "replaced", "source gone"):
            with self.subTest(case=case):
                root = self.make_project()
                source, destination = root / "dev/single.md", root / "archive/dev/single.md"
                plan = self.preview(root, "dev/single.md")

                def unlink(path, *args, **kwargs):
                    if same_path(path, source):
                        if case == "replaced":
                            REAL_UNLINK(destination)
                            destination.write_text("# Other writer\n", encoding="utf-8")
                        if case == "source gone":
                            REAL_UNLINK(source)
                            raise FileNotFoundError(errno.ENOENT, "removed by another writer", os.fspath(path))
                        raise PermissionError(errno.EACCES, "source directory is read-only", os.fspath(path))
                    if case == "cleanup fails" and same_path(path, destination):
                        raise PermissionError(errno.EACCES, "cannot remove the hard link", os.fspath(path))
                    return REAL_UNLINK(path, *args, **kwargs)

                with mock.patch.object(wiki.os, "unlink", side_effect=unlink):
                    result = self.apply(root, "dev/single.md", plan)
                rules = self.rules(result)
                self.assertIn("archive-apply-failed", rules)
                if case == "source gone":
                    self.assertFalse(os.path.lexists(source))
                    self.assertEqual(destination.read_text(encoding="utf-8"), PROJECT["dev/single.md"])
                else:
                    self.assertEqual(source.read_text(encoding="utf-8"), PROJECT["dev/single.md"])
                if case == "taken back":
                    self.assertNotIn("archive-rollback-failed", rules, result["findings"])
                    self.assertFalse(os.path.lexists(destination))
                    continue
                messages = self.rollback_messages(result)
                self.assertTrue(any("archive/dev/single.md" in message for message in messages), messages)
                if case == "cleanup fails":
                    self.assertEqual(source.stat().st_ino, destination.stat().st_ino)
                elif case == "replaced":
                    self.assertEqual(destination.read_text(encoding="utf-8"), "# Other writer\n")

    def test_successful_archive_and_late_failure_rollback(self) -> None:
        for path in ("dev/batch", "dev/single.md"):
            with self.subTest(path=path, outcome="success"):
                root = self.make_project()
                result = self.apply(root, path, self.preview(root, path))
                self.assertIn(result["after_check"], {"passed", "passed_with_warnings"}, result["findings"])
                self.assertIn(f"moved {path} -> archive/{path}", result["writes"])
                self.assertTrue(any(write.startswith("rewrote links in ") for write in result["writes"]), result["writes"])
                self.assertFalse(os.path.lexists(root / path))
                self.assertTrue(os.path.lexists(root / "archive" / path))
            with self.subTest(path=path, outcome="late failure"):
                root = self.make_project()
                before = {relative: (root / relative).read_bytes() for relative in PROJECT}
                plan = self.preview(root, path)
                staged_writes = 0

                def fail_second_write(src, dst, *args, **kwargs):
                    nonlocal staged_writes
                    if ".wiki-archive-" in os.fspath(src):
                        staged_writes += 1
                        if staged_writes == 2:
                            raise OSError("injected late failure")
                    return REAL_REPLACE(src, dst, *args, **kwargs)

                with mock.patch.object(wiki.os, "replace", side_effect=fail_second_write):
                    result = self.apply(root, path, plan)
                self.assertEqual(staged_writes, 2)
                self.assertIn("archive-apply-failed", self.rules(result))
                self.assertNotIn("archive-rollback-failed", self.rules(result), result["findings"])
                self.assertEqual({relative: (root / relative).read_bytes() for relative in PROJECT}, before)
                self.assertFalse(os.path.lexists(root / "archive"))


if __name__ == "__main__":
    unittest.main()
