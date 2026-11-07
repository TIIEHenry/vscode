#!/usr/bin/env python3
"""Import the formally compiled scenario path resolver in isolated Node processes."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
RESOLVER = REPO_ROOT / "test/scenario/out/artifactPaths.js"


class ScenarioArtifactPathsTest(unittest.TestCase):
    def run_resolver(self, configured_root=None, after_import="", home=None):
        env = dict(os.environ)
        env.pop("VSCODE_SCENARIO_ARTIFACT_ROOT", None)
        if configured_root is not None:
            env["VSCODE_SCENARIO_ARTIFACT_ROOT"] = configured_root
        if home is not None:
            env["HOME"] = home
        code = (f"const paths = require({json.dumps(str(RESOLVER))});"
                f"{after_import}; console.log(JSON.stringify(paths));")
        return subprocess.run(["node", "-e", code], env=env,
                              capture_output=True, text=True, timeout=10)

    def assert_paths(self, configured_root=None):
        result = self.run_resolver(configured_root)
        self.assertEqual(result.returncode, 0, result.stderr)
        root = Path(configured_root) if configured_root else REPO_ROOT / ".build/vscode-playwright-mcp"
        self.assertEqual(json.loads(result.stdout), {
            "artifactRootPath": str(root),
            "logsRootPath": str(root / "logs"),
            "crashesRootPath": str(root / "crashes"),
            "videoRootPath": str(root / "videos"),
            "evidenceRootPath": str(root / "evidence"),
        })

    def test_default(self):
        self.assert_paths()

    def test_absolute_override(self):
        with tempfile.TemporaryDirectory(prefix="scenario-owned-artifacts-") as root:
            self.assert_paths(root)

    def assert_invalid_before_cleanup(self, configured_root, home=None,
                                      message="VSCODE_SCENARIO_ARTIFACT_ROOT must be a non-empty absolute path"):
        with tempfile.TemporaryDirectory(prefix="scenario-artifact-validation-") as root:
            sentinel = Path(root) / "historical-log"
            sentinel.write_text("keep")
            result = self.run_resolver(configured_root,
                                       f"require('node:fs').rmSync({json.dumps(str(sentinel))})",
                                       home=home)
            self.assertEqual(result.returncode, 1)
            self.assertIn(message, result.stderr)
            self.assertEqual(sentinel.read_text(), "keep")

    def test_explicit_empty_rejected_before_cleanup(self):
        self.assert_invalid_before_cleanup("")

    def test_whitespace_rejected_before_cleanup(self):
        self.assert_invalid_before_cleanup("   ")

    def test_relative_rejected_before_cleanup(self):
        self.assert_invalid_before_cleanup("relative/artifacts")

    def test_filesystem_root_rejected_before_cleanup(self):
        with tempfile.TemporaryDirectory(prefix="scenario-artifact-home-") as home:
            self.assert_invalid_before_cleanup(
                "/",
                home=home,
                message="must not resolve to the filesystem root, the home directory, or an ancestor of the home directory",
            )

    def test_home_directory_rejected_before_cleanup(self):
        with tempfile.TemporaryDirectory(prefix="scenario-artifact-home-") as home:
            self.assert_invalid_before_cleanup(
                home,
                home=home,
                message="must not resolve to the filesystem root, the home directory, or an ancestor of the home directory",
            )

    def test_home_ancestor_rejected_before_cleanup(self):
        with tempfile.TemporaryDirectory(prefix="scenario-artifact-home-") as base:
            home = Path(base) / "home"
            home.mkdir()
            self.assert_invalid_before_cleanup(
                base,
                home=str(home),
                message="must not resolve to the filesystem root, the home directory, or an ancestor of the home directory",
            )

    def test_shared_data_argument_preserves_spaces_and_explicit_override_order(self):
        helper = REPO_ROOT / "test/scenario/out/launchArguments.js"
        parser = REPO_ROOT / "out/vs/platform/environment/node/argv.js"
        profile = "/tmp/owned profile with spaces"
        override = "/tmp/explicit shared data"
        code = f"""
const {{ withIsolatedSharedDataDirectory }} = require({json.dumps(str(helper))});
(async () => {{
const {{ parseArgs, OPTIONS }} = await import({json.dumps(parser.as_uri())});
const base = withIsolatedSharedDataDirectory({json.dumps(profile)}, ['--new-window']);
const overridden = withIsolatedSharedDataDirectory({json.dumps(profile)}, [{json.dumps('--shared-data-dir=' + override)}]);
console.log(JSON.stringify({{ base, overridden, parsed: parseArgs(base, OPTIONS)['shared-data-dir'], parsedOverride: parseArgs(overridden, OPTIONS)['shared-data-dir'] }}));
}})();
"""
        result = subprocess.run(["node", "-e", code], capture_output=True,
                                text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {
            "base": [f"--shared-data-dir={profile}/shared-data", "--new-window"],
            "overridden": [f"--shared-data-dir={profile}/shared-data",
                           f"--shared-data-dir={override}"],
            "parsed": f"{profile}/shared-data",
            "parsedOverride": override,
        })


if __name__ == "__main__":
    unittest.main()
