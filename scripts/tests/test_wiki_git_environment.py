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
        self.original_cwd = Path.cwd()
        os.chdir(self.root)
        # Model the CLI/hook invocation, and leave the temp directory before its
        # cleanup. Snapshot roots below can then genuinely be foreign to cwd.
        self.addCleanup(os.chdir, self.original_cwd)
        self.clean_env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        self.clean_env.update({"GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull,
                               "GIT_CEILING_DIRECTORIES": str(Path(self.tempdir.name).resolve()), "PYTHON": sys.executable})
        self.clean_env.pop("WIKI_ROOT", None)
        clean_process_environment = patch.dict(os.environ, self.clean_env, clear=True)
        clean_process_environment.start()
        self.addCleanup(clean_process_environment.stop)
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
        default_before = (self.root / ".git/index").read_bytes()
        alternate_before = self.alternate_index.read_bytes()
        with patch.dict(os.environ, {"GIT_INDEX_FILE": str(self.alternate_index)}):
            snapshot = wiki.Snapshot(self.root, staged=True)
            self.assertEqual(
                (snapshot.read("README.md"), snapshot.head_read("README.md")),
                (b"# Alternate parent index\n", b"# Committed parent\n"),
            )
            wiki.git_state(self.root, snapshot.git)
        self.assertEqual(((self.root / ".git/index").read_bytes(), self.alternate_index.read_bytes()),
                         (default_before, alternate_before))

    def test_initialized_missing_gitlink_object_reports_incomplete_without_checkout_fallback(self) -> None:
        missing_child_oid = self.git(self.root, "rev-parse", "HEAD").strip()
        alternate = {"GIT_INDEX_FILE": str(self.alternate_index)}
        self.git(self.root, "update-index", "--cacheinfo", f"160000,{missing_child_oid},dev/loop", env=alternate)
        (self.root / "README.md").write_text("# Parent\n[Loop](dev/loop/INDEX.md)\n")
        self.git(self.root, "add", "README.md", env=alternate)
        with patch.dict(os.environ, {"GIT_DIR": str(self.root / ".git"), **alternate}):
            with self.assertRaisesRegex(wiki.WikiError, f"initialized gitlink dev/loop.*{missing_child_oid}"):
                wiki.Snapshot(self.root, staged=True)
        result = self.cli("check", "--staged", "--json", env={"GIT_DIR": str(self.root / ".git"), **alternate})
        report = json.loads(result.stdout)
        self.assertEqual((result.returncode, report["result"], report["findings"][0]["rule"]), (2, "incomplete", "input-unavailable"))

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
            # An already captured context must not rediscover live process env
            # for every blob. A fresh invocation above still fails honestly.
            for reader in (snapshot.read, snapshot.head_read):
                self.assertEqual(reader("dev/loop/INDEX.md"), b"# Recorded child revision\n")

    def cli(self, *args: str, root: Path | None = None, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[bytes]:
        return subprocess.run([sys.executable, str(Path(wiki.__file__).resolve()), *args, "--root", str(root or self.root)],
                              cwd=self.root, env={**self.clean_env, **(env or {})}, capture_output=True, check=False)

    def hook_environment(self) -> dict[str, str]:
        return {"GIT_DIR": str(self.root / ".git"), "GIT_WORK_TREE": str(self.root),
                "GIT_COMMON_DIR": str(self.root / ".git"), "GIT_INDEX_FILE": str(self.alternate_index),
                "GIT_OBJECT_DIRECTORY": str(self.root / ".git/objects")}

    def add_repository(self, path: Path, text: str) -> str:
        path.mkdir(parents=True, exist_ok=True)
        self.git(path, "init", "-q")
        (path / "INDEX.md").write_text(text)
        self.git(path, "add", "INDEX.md")
        self.commit(path, "Recorded nested repository")
        return self.git(path, "rev-parse", "HEAD").strip()

    def test_foreign_root_and_another_worktree_ignore_parent_hook_index(self) -> None:
        linked = Path(self.tempdir.name) / "linked"
        self.git(self.root, "worktree", "add", "-q", "-b", "linked-test", str(linked), "HEAD")
        (linked / "README.md").write_text("# Linked staged\n")
        self.git(linked, "add", "README.md")
        note = self.root / "docs/primary-note.md"
        note.write_text("# Alternate subdirectory blob\n")
        self.git(self.root, "add", "docs/primary-note.md", env={"GIT_INDEX_FILE": str(self.alternate_index)})
        note.write_text("# Dirty subdirectory worktree\n")
        with patch.dict(os.environ, self.hook_environment()):
            child = wiki.Snapshot(self.child, staged=True)
            other = wiki.Snapshot(linked, staged=True)
            parent_subdir = wiki.Snapshot(self.root / "docs", staged=True)
            self.assertEqual((child.read("INDEX.md"), other.read("README.md")),
                             (b"# Newer child checkout\n", b"# Linked staged\n"))
            self.assertEqual(parent_subdir.read("wiki.json"), (self.root / "docs/wiki.json").read_bytes())
            self.assertEqual(parent_subdir.read("primary-note.md"), b"# Alternate subdirectory blob\n")
            self.assertNotEqual(other.git.identity(linked), other.git.primary)

    def test_captured_environment_and_relative_hook_paths_survive_cwd_and_environment_changes(self) -> None:
        relative_index = self.root / "alternate-index"
        shutil.copy2(self.alternate_index, relative_index)
        relative = {"GIT_DIR": ".git", "GIT_WORK_TREE": ".", "GIT_COMMON_DIR": ".git", "GIT_INDEX_FILE": "alternate-index"}
        with patch.dict(os.environ, relative):
            snapshot = wiki.Snapshot(self.root / "docs", staged=True)
            parent = wiki.Snapshot(self.root, staged=True)
        with patch.dict(os.environ, {"GIT_DIR": str(self.child / ".git"), "GIT_INDEX_FILE": "does-not-exist"}):
            os.chdir(self.root / "docs")
            self.assertEqual(parent.read("README.md"), b"# Alternate parent index\n")
            self.assertEqual(snapshot.read("wiki.json"), (self.root / "docs/wiki.json").read_bytes())
            self.assertEqual(parent.head_read("dev/loop/INDEX.md"), b"# Recorded child revision\n")

    def test_nested_and_selected_root_gitlinks_read_only_recorded_commits(self) -> None:
        section = self.root / "docs/section"
        child = section / "module"
        nested = child / "nested"
        child_oid = self.add_repository(child, "# Child pin\n")
        nested_oid = self.add_repository(nested, "# Nested pin\n")
        self.git(child, "update-index", "--add", "--cacheinfo", f"160000,{nested_oid},nested")
        self.commit(child, "Record nested pin")
        child_oid = self.git(child, "rev-parse", "HEAD").strip()
        alternate = {"GIT_INDEX_FILE": str(self.alternate_index)}
        self.git(self.root, "update-index", "--add", "--cacheinfo", f"160000,{child_oid},docs/section/module", env=alternate)
        (nested / "INDEX.md").write_text("# New nested HEAD\n")
        self.git(nested, "add", "INDEX.md")
        self.commit(nested, "Advance nested HEAD")
        (nested / "INDEX.md").write_text("# Dirty nested worktree\n")
        with patch.dict(os.environ, self.hook_environment()):
            snapshot = wiki.Snapshot(section, staged=True)
            self.assertEqual((snapshot.read("module/INDEX.md"), snapshot.read("module/nested/INDEX.md")),
                             (b"# Child pin\n", b"# Nested pin\n"))
            self.assertIn("module/nested/INDEX.md", snapshot.added_files)
        self.assertEqual((nested / "INDEX.md").read_text(), "# Dirty nested worktree\n")

    def test_uninitialized_gitlink_remains_a_record(self) -> None:
        oid = self.git(self.child, "rev-parse", "HEAD").strip()
        self.git(self.root, "update-index", "--add", "--cacheinfo", f"160000,{oid},not-initialized")
        snapshot = wiki.Snapshot(self.root, staged=True)
        self.assertIn("not-initialized", snapshot.files())
        self.assertNotIn("not-initialized/INDEX.md", snapshot.files())

    def test_quoted_relative_object_paths_keep_git_path_list_semantics(self) -> None:
        alternate = self.root / "objects:quoted"
        alternate.mkdir()
        quoted = self.root / 'objects"back\\slash'
        shutil.copytree(self.root / ".git/objects", quoted)
        empty = self.root / "empty-objects"
        empty.mkdir()
        object_paths = json.dumps(alternate.name) + os.pathsep + json.dumps(quoted.name).replace("objects", r"\157bjects", 1)
        with patch.dict(os.environ, {"GIT_OBJECT_DIRECTORY": "empty-objects", "GIT_ALTERNATE_OBJECT_DIRECTORIES": object_paths}):
            context = wiki.GitContext()
            os.chdir(self.root / "docs")
            self.assertEqual(wiki.run_git(self.root, "show", "HEAD:README.md", context=context), b"# Committed parent\n")

    def test_probe_errors_are_not_disguised_as_non_git(self) -> None:
        ordinary = self.root / "docs"
        with patch.dict(os.environ, {"GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": "not-a-config-key", "GIT_CONFIG_VALUE_0": "x"}):
            with self.assertRaises(wiki.GitEnvironmentError):
                wiki.GitContext().command_environment(ordinary, {})

    def test_git_helpers_keep_unborn_trailers_and_captured_head_baseline(self) -> None:
        unborn = Path(self.tempdir.name) / "unborn"
        unborn.mkdir()
        self.git(unborn, "init", "-q")
        self.assertFalse(wiki.has_head(unborn))
        self.assertTrue(wiki.has_head(self.root))
        message = self.root / "message"
        message.write_text("Subject\n\nDocs-Reviewed: demo checked\n")
        with patch.dict(os.environ, self.hook_environment()):
            self.assertEqual(wiki.message_trailers(self.root, str(message)), [" demo checked"])
            self.assertEqual(wiki.git_state(self.root)[0], self.git(self.root, "rev-parse", "--short=12", "HEAD").strip())
            snap = wiki.Snapshot(self.root, staged=True)
            missing = wiki.Wiki(snap)
            missing.baseline_path = "docs/missing-baseline.json"
            self.assertIsNone(wiki.head_baseline(missing))
        baseline = self.root / "docs/baseline.json"
        baseline.write_text(json.dumps({"version": 1, "findings": ["recorded"]}))
        self.git(self.root, "add", "docs/baseline.json")
        self.commit(self.root, "Recorded baseline")
        captured = wiki.Wiki(wiki.Snapshot(self.root, staged=True))
        captured.baseline_path = "docs/baseline.json"
        baseline.write_text(json.dumps({"version": 1, "findings": ["newer"]}))
        self.git(self.root, "add", "docs/baseline.json")
        self.commit(self.root, "Newer baseline")
        self.assertEqual(wiki.head_baseline(captured), {"recorded"})

    def test_effective_hook_paths_follow_worktree_root_not_selected_subdirectory(self) -> None:
        hooks = self.root / "custom-hooks"
        hooks.mkdir()
        for name, marker in wiki.HOOK_MARKERS.items():
            target = hooks / name
            target.write_text(f"#!/bin/sh\n# wiki.py {marker}\n")
            target.chmod(0o755)
        for hooks_path in ("custom-hooks", str(hooks)):
            self.git(self.root, "config", "core.hooksPath", hooks_path)
            with patch.dict(os.environ, self.hook_environment()):
                view = wiki.Wiki(wiki.Snapshot(self.root / "docs"), "wiki.json")
                self.assertEqual(wiki.hook_status(view), {"pre-commit": "installed", "commit-msg": "installed"})
        linked = Path(self.tempdir.name) / "hooks-worktree"
        self.git(self.root, "worktree", "add", "-q", "-b", "hook-location", str(linked), "HEAD")
        self.git(self.root, "config", "core.hooksPath", "custom-hooks")
        shutil.copytree(hooks, linked / "custom-hooks")
        with patch.dict(os.environ, self.hook_environment()):
            view = wiki.Wiki(wiki.Snapshot(linked / "docs"), "wiki.json")
            self.assertEqual(wiki.hook_status(view), {"pre-commit": "installed", "commit-msg": "installed"})

    def test_verify_commands_apply_primary_foreign_and_explicit_environment_contracts(self) -> None:
        linked = self.root / "linked"
        self.git(self.root, "worktree", "add", "-q", "-b", "verify-linked", str(linked), "HEAD")
        non_git = Path(self.tempdir.name) / "ordinary"
        non_git.mkdir()
        # Commands may run scripts which invoke Git, so the boundary is cwd,
        # not an argv[0] == 'git' heuristic.
        script = "import subprocess;print(subprocess.check_output(['git','show',':README.md']).decode().strip())"
        with patch.dict(os.environ, self.hook_environment()):
            context = wiki.GitContext()
            commands = [
                (self.root, {}, "# Alternate parent index"),
                (self.root / "docs", {}, "# Alternate parent index"),
                (linked, {}, "# Committed parent"),
                (self.root, {"GIT_INDEX_FILE": ".git/index"}, "# Committed parent"),
                (self.root, {"GIT_DIR": str(linked / ".git")}, "# Committed parent"),
                (self.root, {"GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": "core.quotePath", "GIT_CONFIG_VALUE_0": "false"}, "# Alternate parent index"),
            ]
            for cwd, explicit, expected in commands:
                with self.subTest(cwd=cwd, explicit=explicit):
                    result = subprocess.run([sys.executable, "-c", script], cwd=cwd,
                                            env=context.command_environment(cwd, explicit), capture_output=True, check=False)
                    self.assertEqual((result.returncode, result.stdout.decode().strip()), (0, expected), result.stderr.decode())
            child_result = subprocess.run(["git", "show", ":INDEX.md"], cwd=self.child,
                                          env=context.command_environment(self.child, {}), capture_output=True, check=False)
            self.assertEqual((child_result.returncode, child_result.stdout), (0, b"# Newer child checkout\n"))
            normal = subprocess.run([sys.executable, "-c", "import os;print(os.environ.get('GIT_INDEX_FILE'));print(os.environ['WIKI_TEST_VALUE'])"],
                                    cwd=non_git, env=context.command_environment(non_git, {"WIKI_TEST_VALUE": "kept"}), capture_output=True, check=False)
            self.assertEqual(normal.stdout, b"None\nkept\n")

    def test_verify_config_selection_replaces_groups_without_mixing_parent_index(self) -> None:
        worktree = self.root / "different-worktree"
        worktree.mkdir()
        (worktree / "README.md").write_text("# Config worktree\n")
        inherited = {**self.hook_environment(), "GIT_CONFIG_COUNT": "2", "GIT_CONFIG_KEY_0": "user.name",
                     "GIT_CONFIG_VALUE_0": "Parent", "GIT_CONFIG_KEY_1": "user.email", "GIT_CONFIG_VALUE_1": "parent@example.invalid"}
        explicit = {"GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": "core.worktree", "GIT_CONFIG_VALUE_0": str(worktree)}
        with patch.dict(os.environ, inherited):
            context = wiki.GitContext()
            env = context.command_environment(self.root, explicit)
            identity_args = ["git", "rev-parse", "--absolute-git-dir", "--show-toplevel"]
            result = subprocess.run(identity_args, cwd=self.root, env=env, capture_output=True, check=False)
            direct = subprocess.run(identity_args, cwd=self.root,
                                    env={**self.clean_env, **explicit}, capture_output=True, check=False)
            selection_names = {"GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_CONFIG_COUNT"}
            diagnostic = {"primary": context.primary,
                          "configured_identity": context._probe(self.root, {**context.foreign_environment(), **explicit}),
                          "direct_git": {"returncode": direct.returncode,
                                         "stdout": direct.stdout.decode("utf-8", "replace"),
                                         "stderr": direct.stderr.decode("utf-8", "replace")},
                          "final": {name: value for name, value in env.items()
                                    if name in selection_names or name.startswith(("GIT_CONFIG_KEY_", "GIT_CONFIG_VALUE_"))},
                          "stderr": result.stderr.decode("utf-8", "replace")}
            self.assertEqual(direct.returncode, 0, diagnostic)
            self.assertEqual((result.returncode, result.stdout), (0, direct.stdout), diagnostic)
            direct_identity = tuple(Path(value).resolve() for value in direct.stdout.decode().splitlines())
            # Git versions decide whether this config participates in early
            # worktree setup. Follow real Git rather than parsing its value.
            if direct_identity == context.primary:
                self.assertEqual(env["GIT_INDEX_FILE"], str(self.alternate_index))
                expected = b"# Alternate parent index\n"
            else:
                for name in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY"):
                    self.assertNotIn(name, env)
                direct_read = subprocess.run(["git", "show", ":README.md"], cwd=self.root,
                                             env={**self.clean_env, **explicit}, capture_output=True, check=False)
                self.assertEqual(direct_read.returncode, 0, direct_read.stderr)
                expected = direct_read.stdout
            read = subprocess.run(["git", "show", ":README.md"], cwd=self.root, env=env, capture_output=True, check=False)
            self.assertEqual((read.returncode, read.stdout), (0, expected), diagnostic)
            self.assertEqual({name: env[name] for name in explicit}, explicit)
            self.assertNotIn("GIT_CONFIG_KEY_1", env)
            self.assertNotIn("GIT_CONFIG_VALUE_1", env)
            foreign = context.command_environment(self.root, {"GIT_DIR": str(self.child / ".git"), "GIT_WORK_TREE": str(self.child)})
            for name in ("GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY"):
                self.assertNotIn(name, foreign)
            foreign_identity = subprocess.run(identity_args, cwd=self.root, env=foreign, capture_output=True, check=False)
            self.assertEqual((foreign_identity.returncode, foreign_identity.stdout.decode().splitlines()),
                             (0, [str(self.child / ".git"), str(self.child)]), foreign_identity.stderr)
            foreign_read = subprocess.run(["git", "show", ":INDEX.md"], cwd=self.root, env=foreign, capture_output=True, check=False)
            self.assertEqual((foreign_read.returncode, foreign_read.stdout), (0, b"# Newer child checkout\n"), foreign_read.stderr)
            with self.assertRaises(wiki.GitEnvironmentError):
                context.command_environment(self.root, {"GIT_CONFIG_COUNT": "2", "GIT_CONFIG_KEY_0": "core.worktree", "GIT_CONFIG_VALUE_0": "."})

    def test_verify_report_runs_the_declared_contexts_and_reports_primary_head_and_index(self) -> None:
        config_path = self.root / "docs/wiki.json"
        config = json.loads(config_path.read_text())
        script = "import subprocess;print(subprocess.check_output(['git','rev-parse','--show-toplevel']).decode().strip())"
        config["verify"] = {"commands": [
            {"name": "primary", "run": [sys.executable, "-c", script], "cwd": "docs"},
            {"name": "foreign", "run": [sys.executable, "-c", script], "cwd": "dev/loop"},
            {"name": "explicit", "run": ["git", "show", ":README.md"], "env": {"GIT_INDEX_FILE": ".git/index"}},
        ]}
        config_path.write_text(json.dumps(config))
        with patch.dict(os.environ, self.hook_environment()):
            snapshot = wiki.Snapshot(self.root)
            actual = wiki.verify_report(wiki.Wiki(snapshot), [])
            expected_state = wiki.git_state(self.root, snapshot.git)
        self.assertEqual([(c["name"], c["exit_code"], c["summary"]) for c in actual["commands"]], [
            ("primary", 0, [str(self.root)]), ("foreign", 0, [str(self.child)]),
            ("explicit", 0, ["# Committed parent"]),
        ])
        self.assertEqual((actual["git_head"], actual["uncommitted_files"]), expected_state)

    def test_verify_report_non_git_root_runs_ordinary_commands_without_parent_selection(self) -> None:
        ordinary = Path(self.tempdir.name) / "non-git-project"
        (ordinary / "docs").mkdir(parents=True)
        (ordinary / "README.md").write_text("# Non Git\n")
        config = {"version": 1, "roots": [{"path": "docs", "role": "knowledge"}], "entrypoints": ["README.md"],
                  "verify": {"commands": [{"name": "ordinary", "run": [sys.executable, "-c", "import os;print(os.environ.get('GIT_DIR'));print(os.environ['EXPLICIT_VALUE'])"],
                                             "env": {"EXPLICIT_VALUE": "preserved"}}]}}
        (ordinary / "docs/wiki.json").write_text(json.dumps(config))
        discovery = subprocess.run(["git", "-C", str(ordinary), "rev-parse", "--show-toplevel"],
                                   env=self.clean_env, capture_output=True, check=False)
        self.assertNotEqual(discovery.returncode, 0, "Non-Git fixture must not discover the runner's repository")
        with patch.dict(os.environ, self.hook_environment()):
            actual = wiki.verify_report(wiki.Wiki(wiki.Snapshot(ordinary)), [])
        self.assertEqual((actual["git_head"], actual["uncommitted_files"], actual["commands"][0]["summary"]),
                         (None, None, ["None", "preserved"]))

    def test_verify_invalid_later_environment_runs_no_commands(self) -> None:
        config_path = self.root / "docs/wiki.json"
        config = json.loads(config_path.read_text())
        sentinel = self.root / "verify-sentinel"
        invalid_groups = [
            {"GIT_CONFIG_COUNT": "1", "GIT_CONFIG_KEY_0": "core.quotePath"},
            {"GIT_CONFIG_COUNT": "2", "GIT_CONFIG_KEY_0": "core.quotePath", "GIT_CONFIG_VALUE_0": "false"},
        ]
        for invalid in invalid_groups:
            with self.subTest(env=invalid):
                config["verify"] = {"commands": [
                    {"name": "sentinel", "run": [sys.executable, "-c", "from pathlib import Path;Path('verify-sentinel').write_text('executed')"]},
                    {"name": "invalid", "run": [sys.executable, "-c", "print('must not run')"], "env": invalid},
                ]}
                config_path.write_text(json.dumps(config))
                self.assertFalse(sentinel.exists())
                result = self.cli("verify", "--json", env=self.hook_environment())
                report = json.loads(result.stdout)
                self.assertEqual((result.returncode, report["result"], report["findings"][0]["rule"]),
                                 (2, "incomplete", "input-unavailable"))
                self.assertFalse(sentinel.exists(), "All environments must be valid before the first command executes")

    def test_original_hooks_commit_real_worktree_and_alternate_index_without_wrapper(self) -> None:
        linked = Path(self.tempdir.name) / "commit-worktree"
        self.git(self.root, "worktree", "add", "-q", "-b", "hook-commit", str(linked), "HEAD")
        self.git(self.root, "clone", "--no-local", str(self.child), str(linked / "dev/loop"))
        tools = linked / "scripts/wiki"
        tools.mkdir(parents=True)
        source = Path(wiki.__file__).resolve().parent
        shutil.copy2(source / "wiki.py", tools / "wiki.py")
        shutil.copytree(source / "hooks", tools / "hooks")
        self.git(linked, "config", "core.hooksPath", str(tools / "hooks"))
        self.git(linked, "add", "scripts")
        self.commit(linked, "Install original wiki hooks")
        child_before = (self.git(self.child, "rev-parse", "HEAD"), (self.child / "INDEX.md").read_bytes())
        linked_child = linked / "dev/loop"
        (linked_child / "INDEX.md").write_text("# Actual hook child dirty worktree\n")
        linked_child_before = (self.git(linked_child, "rev-parse", "HEAD"),
                               self.git(linked_child, "--no-optional-locks", "status", "--porcelain"),
                               (linked_child / ".git/index").read_bytes(), (linked_child / "INDEX.md").read_bytes())
        (linked / "README.md").write_text("# Default staged valid\n")
        self.git(linked, "add", "README.md")
        (linked / "README.md").write_text("# Dirty invalid\n[Missing](absent.md)\n")
        self.commit(linked, "Good staged and bad worktree")
        self.assertEqual(self.git(linked, "show", "HEAD:README.md"), "# Default staged valid\n")
        default_index = Path(self.git(linked, "rev-parse", "--git-path", "index").strip())
        if not default_index.is_absolute():
            default_index = linked / default_index
        alternate = Path(self.tempdir.name) / "real-hook-alternate"
        shutil.copy2(default_index, alternate)
        alternate_env = {"GIT_INDEX_FILE": str(alternate)}
        (linked / "README.md").write_text("# Good alternate\n")
        self.git(linked, "add", "README.md", env=alternate_env)
        (linked / "README.md").write_text("# Dirty invalid\n[Missing](absent.md)\n")
        default_before = default_index.read_bytes()
        self.git(linked, "-c", "user.name=Wiki Test", "-c", "user.email=wiki@example.invalid", "commit", "-qm", "Real alternate commit", env=alternate_env)
        self.assertEqual(self.git(linked, "show", "HEAD:README.md"), "# Good alternate\n")
        self.assertEqual(default_index.read_bytes(), default_before)
        (linked / "README.md").write_text("# Invalid alternate\n[Missing](absent.md)\n")
        self.git(linked, "add", "README.md", env=alternate_env)
        (linked / "README.md").write_text("# Good unstaged\n")
        rejected = subprocess.run(["git", "-C", str(linked), "-c", "user.name=Wiki Test", "-c", "user.email=wiki@example.invalid", "commit", "-qm", "Must reject alternate"],
                                  env={**self.clean_env, **alternate_env}, capture_output=True, check=False)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn(b"broken-link", rejected.stdout + rejected.stderr)
        self.assertEqual(default_index.read_bytes(), default_before)
        self.assertEqual((self.git(self.child, "rev-parse", "HEAD"), (self.child / "INDEX.md").read_bytes()), child_before)
        self.assertEqual((self.git(linked_child, "rev-parse", "HEAD"),
                          self.git(linked_child, "--no-optional-locks", "status", "--porcelain"),
                          (linked_child / ".git/index").read_bytes(), (linked_child / "INDEX.md").read_bytes()), linked_child_before)


if __name__ == "__main__":
    unittest.main()
