#!/usr/bin/env python3
"""Sources runner routing and five-domain JUnit comparison, without product execution."""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET


REPO_ROOT = Path(__file__).resolve().parents[2]
NODE_FILES = (
    "src/vs/workbench/contrib/sources/test/node/sourcesLeftoverCatchScan.test.ts",
    "src/vs/workbench/contrib/sources/test/node/sourcesWiringScan.test.ts",
)
DOMAINS = ("conversation", "sources", "sourcesNode", "universeAgent", "universeAgentNode")

# Both official entry points are replaced only inside the temporary repository.
# This records the shell's real argv and writes reporter-shaped XML; it does not
# claim to exercise any product test or the official runners themselves.
RUNNER_STUB = r'''#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

args = sys.argv[1:]
domain = args[args.index("--tfs") + 1]
with open(os.environ["STUB_CALLS"], "a", encoding="utf-8") as output:
    output.write(json.dumps({"node": Path(sys.argv[0]).name == "node", "args": args}) + "\n")
config = json.loads(os.environ.get("STUB_CONFIG", "{}")).get(domain, {})
if config.get("require_absent"):
    root = Path(os.environ.get("BUILD_ARTIFACTSTAGINGDIRECTORY") or os.environ["GITHUB_WORKSPACE"])
    expected = [root / "test-results" / f"linux-x64-{name.lower()}-results.xml"
                for name in ("conversation", "sources", "sourcesNode", "universeAgent", "universeAgentNode")]
    if any(path.exists() for path in expected):
        sys.exit(93)
root = Path(os.environ.get("BUILD_ARTIFACTSTAGINGDIRECTORY") or os.environ["GITHUB_WORKSPACE"])
result = root / "test-results" / f"linux-x64-{domain.lower()}-results.xml"
result.parent.mkdir(parents=True, exist_ok=True)
mode = config.get("mode", "xml")
if mode in ("empty", "bad"):
    result.write_text("" if mode == "empty" else "<testsuites>", encoding="utf-8")
elif mode != "missing":
    suite = ET.Element("testsuite")
    if "root_skipped" in config:
        suite.set("skipped", config["root_skipped"])
    case_parent = suite
    if "nested_skipped" in config:
        nested = ET.SubElement(suite, "testsuite", skipped=config["nested_skipped"])
        if config.get("nested_cases"):
            case_parent = nested
    count = config.get("cases", 59 if domain == "sourcesNode" else 89 if domain == "sources" else 1)
    for index in range(count):
        case = ET.SubElement(case_parent, "testcase", classname=domain, name=f"case-{index}")
        if index < config.get("skipped", 0):
            ET.SubElement(case, "skipped")
        if index == 0 and config.get("problem"):
            ET.SubElement(case, config["problem"])
    ET.ElementTree(suite).write(result, encoding="utf-8")
sys.exit(config.get("exit", 0))
'''


class UnitCustomSourcesTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory(prefix="unit-custom-sources-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "repository with spaces"
        self.root.mkdir()
        (self.root / "scripts").mkdir()
        for name in ("run-unit-custom.sh", "check-test-baseline.sh"):
            shutil.copy2(REPO_ROOT / "scripts" / name, self.root / "scripts" / name)
        self.baseline = self.root / "dev/progress/test-baseline-failures.txt"
        self.baseline.parent.mkdir(parents=True)
        # Synthetic Sources 89/0 and SourcesNode 59/0 thresholds exercise the gate;
        # the real header is checked separately. Other domains need only one
        # synthetic case to exercise their original route.
        self.baseline.write_text(
            "# min_cases: conversation=1 sources=89 universeAgent=1 universeAgentNode=1 sourcesNode=59\n"
            "# max_skipped: conversation=1 sources=0 universeAgent=0 universeAgentNode=0 sourcesNode=0\n",
            encoding="utf-8",
        )
        wrapper = (REPO_ROOT / "scripts/run-unit-custom.sh").read_text(encoding="utf-8")
        names = re.search(r"UA_NODE_UNLOADABLE=\((.*?)\n\)", wrapper, re.S)
        self.assertIsNotNone(names)
        self.ua_names = names.group(1).split()
        for name in self.ua_names + ["keptNode"]:
            self.touch(f"src/vs/platform/universeAgent/test/node/{name}.test.ts")
        self.touch("src/vs/platform/universeAgent/test/browser/keptBrowser.test.ts")
        for name in NODE_FILES:
            self.touch(name)
        self.touch("src/vs/workbench/contrib/sources/test/browser/example.test.ts")
        self.calls = self.root / "calls.jsonl"
        self.bin = self.root / "stub-bin"
        self.bin.mkdir()
        self.executable(self.bin / "node", RUNNER_STUB)
        self.executable(self.root / "scripts/test.sh", RUNNER_STUB)
        self.workspace = Path(temporary.name) / "workspace with spaces"
        self.workspace.mkdir()
        self.env = {**os.environ, "PATH": f"{self.bin}{os.pathsep}{os.environ['PATH']}",
                    "GITHUB_WORKSPACE": str(self.workspace), "STUB_CALLS": str(self.calls)}
        self.env.pop("BUILD_ARTIFACTSTAGINGDIRECTORY", None)
        self.env.pop("STUB_CONFIG", None)

    def touch(self, relative: str) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()

    def executable(self, path: Path, source: str) -> None:
        path.write_text(source, encoding="utf-8")
        path.chmod(0o755)

    def result_path(self, root: Path, domain: str) -> Path:
        return root / "test-results" / f"linux-x64-{domain.lower()}-results.xml"

    def old_green_xml(self, domain: str) -> str:
        suite = ET.Element("testsuite", origin="previous-run")
        count = 59 if domain == "sourcesNode" else 89 if domain == "sources" else 1
        for index in range(count):
            ET.SubElement(suite, "testcase", classname=domain, name=f"case-{index}")
        return ET.tostring(suite, encoding="unicode")

    def seed_results(self, root: Path) -> None:
        for domain in DOMAINS:
            path = self.result_path(root, domain)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(self.old_green_xml(domain), encoding="utf-8")

    def run_wrapper(self, config: dict | None = None, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["bash", str(self.root / "scripts/run-unit-custom.sh"), *args],
            cwd=self.root, env={**self.env, "STUB_CONFIG": json.dumps(config or {})},
            capture_output=True, text=True, timeout=20,
        )

    def read_calls(self) -> list[dict]:
        return [json.loads(line) for line in self.calls.read_text(encoding="utf-8").splitlines()]

    def test_routes_sources_separately_and_preserves_other_domain_arguments(self) -> None:
        result = self.run_wrapper()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("baseline check passed", result.stdout)
        calls = self.read_calls()
        self.assertEqual(len(calls), 5)
        self.assertEqual(calls[0], {"node": False, "args": ["--glob", "**/vs/workbench/contrib/conversation/test/**/*.test.js", "--tfs", "conversation"]})
        self.assertEqual(calls[1], {"node": False, "args": ["--glob", "**/vs/workbench/contrib/sources/test/browser/**/*.test.js", "--tfs", "sources"]})
        self.assertEqual(calls[2], {"node": True, "args": ["test/unit/node/index.js", "--tfs", "sourcesNode", "--run", NODE_FILES[0], "--run", NODE_FILES[1]]})
        kept = sorted([f"src/vs/platform/universeAgent/test/{kind}/{name}.test.ts"
                       for kind, name in (("node", "keptNode"), ("browser", "keptBrowser"))])
        self.assertEqual(calls[3], {"node": False, "args": ["--tfs", "universeAgent", *kept]})
        ua_node_args = ["test/unit/node/index.js", "--tfs", "universeAgentNode"]
        for name in sorted(self.ua_names):
            ua_node_args.extend(["--run", f"src/vs/platform/universeAgent/test/node/{name}.test.ts"])
        self.assertEqual(calls[4], {"node": True, "args": ua_node_args})
        for domain in DOMAINS:
            ET.parse(self.result_path(self.workspace, domain))

    def test_real_sources_file_union_and_baseline_thresholds_are_preserved(self) -> None:
        base = REPO_ROOT / "src/vs/workbench/contrib/sources/test"
        all_files = {str(path.relative_to(REPO_ROOT)) for path in base.rglob("*.test.ts")}
        browser = {str(path.relative_to(REPO_ROOT)) for path in (base / "browser").rglob("*.test.ts")}
        self.assertEqual(all_files, browser | set(NODE_FILES))
        self.assertEqual(len(browser), 26)
        text = (REPO_ROOT / "dev/progress/test-baseline-failures.txt").read_text(encoding="utf-8")
        for header, expected in (
            ("min_cases", {"conversation": 799, "sources": 89, "universeAgent": 190, "universeAgentNode": 418, "sourcesNode": 6}),
            ("max_skipped", {"conversation": 1, "sources": 0, "universeAgent": 0, "universeAgentNode": 0, "sourcesNode": 0}),
        ):
            line = next(line for line in text.splitlines() if line.startswith(f"# {header}:"))
            actual = {key: int(value) for key, value in (part.split("=") for part in line.split(":", 1)[1].split())}
            self.assertEqual(actual, expected)
        self.assertFalse([line for line in text.splitlines() if line.strip() and not line.startswith("#")])

    def test_node_failure_and_error_are_compared(self) -> None:
        for problem in ("failure", "error"):
            with self.subTest(problem=problem):
                result = self.run_wrapper({"sourcesNode": {"problem": problem}})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("sourcesNode::case-0", result.stderr)

    def test_node_case_and_skip_thresholds_are_enforced(self) -> None:
        for config, message in (({"cases": 58}, "below min_cases=59"), ({"skipped": 1}, "above max_skipped=0")):
            with self.subTest(config=config):
                result = self.run_wrapper({"sourcesNode": config})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("error: sourcesNode has", result.stderr)
                self.assertIn(message, result.stderr)

    def test_missing_empty_and_bad_node_xml_fail_closed(self) -> None:
        for mode in ("missing", "empty", "bad"):
            with self.subTest(mode=mode):
                result = self.run_wrapper({"sourcesNode": {"mode": mode}})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("missing JUnit" if mode == "missing" else "ParseError", result.stderr)

    def test_nonzero_node_exit_is_preserved_even_with_green_xml(self) -> None:
        result = self.run_wrapper({"sourcesNode": {"exit": 7}})
        self.assertEqual(result.returncode, 7, result.stderr)
        self.assertIn("baseline check passed", result.stdout)
        self.assertIn("Sources Node runner exited 7", result.stderr)

    def test_old_green_node_xml_cannot_mask_a_missing_current_report(self) -> None:
        for exit_code in (0, 8):
            with self.subTest(exit_code=exit_code):
                self.seed_results(self.workspace)
                result = self.run_wrapper({"sourcesNode": {"mode": "missing", "exit": exit_code}})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("linux-x64-sourcesnode-results.xml", result.stderr)
                self.assertFalse(self.result_path(self.workspace, "sourcesNode").exists())

    def test_all_five_reports_are_cleared_without_removing_other_reports(self) -> None:
        self.seed_results(self.workspace)
        unrelated = self.workspace / "test-results/unrelated.xml"
        unrelated.write_text("keep", encoding="utf-8")
        result = self.run_wrapper({"conversation": {"require_absent": True}})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(unrelated.read_text(encoding="utf-8"), "keep")

    def test_cleanup_failure_stops_before_any_runner(self) -> None:
        blocked = self.result_path(self.workspace, "sourcesNode")
        blocked.mkdir(parents=True)
        result = self.run_wrapper()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot remove previous JUnit", result.stderr)
        self.assertFalse(self.calls.exists())

    def test_artifact_root_precedes_workspace_in_cleanup_and_comparison(self) -> None:
        artifacts = self.workspace.parent / "artifacts with spaces"
        self.seed_results(artifacts)
        self.seed_results(self.workspace)
        self.env["BUILD_ARTIFACTSTAGINGDIRECTORY"] = str(artifacts)
        result = self.run_wrapper({"conversation": {"require_absent": True}})
        self.assertEqual(result.returncode, 0, result.stderr)
        for domain in DOMAINS:
            ET.parse(self.result_path(artifacts, domain))
            self.assertEqual(self.result_path(self.workspace, domain).read_text(encoding="utf-8"), self.old_green_xml(domain))
        result = self.run_wrapper({"sourcesNode": {"mode": "missing"}})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(str(artifacts), result.stderr)

    def test_result_root_falls_back_to_repository_without_workspace_variables(self) -> None:
        self.env.pop("GITHUB_WORKSPACE")
        result = self.run_wrapper()
        self.assertEqual(result.returncode, 0, result.stderr)
        for domain in DOMAINS:
            ET.parse(self.result_path(self.root, domain))

    def test_missing_node_source_stops_before_runners_and_cleanup(self) -> None:
        (self.root / NODE_FILES[1]).unlink()
        self.seed_results(self.workspace)
        result = self.run_wrapper()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("listed Sources Node test missing", result.stderr)
        self.assertFalse(self.calls.exists())
        self.assertEqual(self.result_path(self.workspace, "sourcesNode").read_text(encoding="utf-8"), self.old_green_xml("sourcesNode"))

    def test_unrouted_sources_test_fails_instead_of_disappearing(self) -> None:
        self.touch("src/vs/workbench/contrib/sources/test/node/unrouted.test.ts")
        result = self.run_wrapper()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Sources test has no runner route", result.stderr)
        self.assertFalse(self.calls.exists())

    def test_print_interfaces_do_not_start_runners_or_remove_reports(self) -> None:
        self.seed_results(self.workspace)
        for flag in ("--print-universeagent", "--print-universeagent-node"):
            with self.subTest(flag=flag):
                result = self.run_wrapper({}, flag)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("src/vs/platform/universeAgent/test/", result.stdout)
                self.assertFalse(self.calls.exists())
                for domain in DOMAINS:
                    self.assertEqual(self.result_path(self.workspace, domain).read_text(encoding="utf-8"), self.old_green_xml(domain))

    def test_existing_sources_skip_limit_still_rejects_five_pending(self) -> None:
        result = self.run_wrapper({"sources": {"skipped": 5}})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("error: sources has 5 skipped testcase(s), above max_skipped=0", result.stderr)

    def test_other_domain_failures_and_stale_baseline_entries_still_fail(self) -> None:
        result = self.run_wrapper({"conversation": {"problem": "failure"}})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("conversation::case-0", result.stderr)
        with self.baseline.open("a", encoding="utf-8") as output:
            output.write("conversation::case-0\n")
        listed = self.run_wrapper({"conversation": {"problem": "failure", "exit": 1}})
        self.assertEqual(listed.returncode, 0, listed.stderr)
        stale = self.run_wrapper()
        self.assertNotEqual(stale.returncode, 0)
        self.assertIn("remove stale line(s)", stale.stderr)

    def test_all_domains_root_only_skips_follow_existing_limits(self) -> None:
        for domain in DOMAINS:
            maximum = 1 if domain == "conversation" else 0
            for value in dict.fromkeys(("0", str(maximum), str(maximum + 1), "5", "00", "01")):
                with self.subTest(domain=domain, value=value):
                    result = self.run_wrapper({domain: {"root_skipped": value}})
                    if int(value) <= maximum:
                        self.assertEqual(result.returncode, 0, result.stderr)
                        self.assertIn("baseline check passed", result.stdout)
                    else:
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn(
                            f"error: {domain} has {int(value)} skipped testcase(s), above max_skipped={maximum}",
                            result.stderr,
                        )

    def test_all_domains_root_and_child_skips_use_max_without_adding(self) -> None:
        original = self.baseline.read_text(encoding="utf-8")
        maxima = next(line for line in original.splitlines() if line.startswith("# max_skipped:"))
        for domain in DOMAINS:
            count = 59 if domain == "sourcesNode" else 89 if domain == "sources" else 2
            for maximum in (2, 1):
                # Change only this temporary fixture's skip threshold. The real
                # baseline and its independently asserted thresholds stay intact.
                adjusted = re.sub(rf"\b{domain}=[0-9]+\b", f"{domain}={maximum}", maxima)
                self.baseline.write_text(original.replace(maxima, adjusted), encoding="utf-8")
                for root_skipped, child_skipped, effective in ((2, 1, 2), (1, 2, 2), (2, 2, 2), (1, 1, 1)):
                    with self.subTest(domain=domain, maximum=maximum, root=root_skipped, child=child_skipped):
                        result = self.run_wrapper({domain: {
                            "root_skipped": str(root_skipped), "skipped": child_skipped, "cases": count,
                        }})
                        if effective <= maximum:
                            self.assertEqual(result.returncode, 0, result.stderr)
                            self.assertIn("baseline check passed", result.stdout)
                        else:
                            self.assertNotEqual(result.returncode, 0)
                            self.assertIn(f"error: {domain} has {effective} skipped testcase(s), above max_skipped={maximum}", result.stderr)

    def test_all_domains_child_skips_cannot_be_hidden_by_absent_or_zero_root(self) -> None:
        for domain in DOMAINS:
            maximum = 1 if domain == "conversation" else 0
            skipped = maximum + 1
            count = 59 if domain == "sourcesNode" else 89 if domain == "sources" else skipped
            for root in ({}, {"root_skipped": "0"}):
                with self.subTest(domain=domain, root=root):
                    result = self.run_wrapper({domain: {**root, "cases": count, "skipped": skipped}})
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(
                        f"error: {domain} has {skipped} skipped testcase(s), above max_skipped={maximum}",
                        result.stderr,
                    )

    def test_all_domains_invalid_root_skipped_fails_closed(self) -> None:
        for domain in DOMAINS:
            for value in (
                "", "-1", "+1", "1.0", "pending", "not-an-integer", " 1", "1 ",
                "\t1", "1\t", "\n1", "1\n", "1\n0", "١", "１２",
            ):
                with self.subTest(domain=domain, value=value):
                    result = self.run_wrapper({domain: {"root_skipped": value}})
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(f"error: {domain} has invalid root skipped=", result.stderr)

    def test_all_domains_absent_or_zero_root_does_not_sum_nested_suite_skips(self) -> None:
        for domain in DOMAINS:
            for config in ({"nested_skipped": "5"}, {"root_skipped": "0", "nested_skipped": "5"}):
                with self.subTest(domain=domain, config=config):
                    result = self.run_wrapper({domain: config})
                    self.assertEqual(result.returncode, 0, result.stderr)

    def test_all_domains_absent_or_zero_root_skipped_is_zero(self) -> None:
        for domain in DOMAINS:
            for config in ({}, {"root_skipped": "0"}):
                with self.subTest(domain=domain, config=config):
                    result = self.run_wrapper({domain: config})
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn("baseline check passed", result.stdout)

    def test_all_domains_nested_testcase_skips_are_still_counted(self) -> None:
        for domain in DOMAINS:
            maximum = 1 if domain == "conversation" else 0
            skipped = maximum + 1
            count = 59 if domain == "sourcesNode" else 89 if domain == "sources" else skipped
            for root in ({}, {"root_skipped": "0"}):
                with self.subTest(domain=domain, root=root):
                    result = self.run_wrapper({domain: {
                        **root, "nested_skipped": "5", "nested_cases": True, "cases": count, "skipped": skipped,
                    }})
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(
                        f"error: {domain} has {skipped} skipped testcase(s), above max_skipped={maximum}",
                        result.stderr,
                    )


if __name__ == "__main__":
    unittest.main()
