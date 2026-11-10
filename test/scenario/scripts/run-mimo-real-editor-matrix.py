#!/usr/bin/env python3
"""Run the existing real editor scenario serially for the frozen MiMo UI matrix.

This tool never compiles or changes the pinned engine. Every case owns its engine,
JVM home, workspace, and Electron profile. Request observations contain model/path
metadata only; neither credentials nor prompts/responses belong in public reports.
"""

from __future__ import annotations

import argparse
import ctypes
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import signal
import socket
import stat
import subprocess
import sys
import threading
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener
import uuid
import zipfile
import zlib


ROOT = Path(__file__).resolve().parents[3]
MODELS = {name: f"sub2api-mimo/mimo-v2.6-{name}" for name in ("flash", "pro")}
PROTOCOLS = ("anthropic", "openai-chat", "openai-response")
PROVIDER_IDS = {"anthropic": "anthropic", "openai-chat": "openai", "openai-response": "openai-responses"}
CASES = tuple(f"U{number:02}" for number in range(1, 11))
TASK_TIMEOUT_MS = 600_000
PROCESS_STOP_GRACE_SECONDS = 15
PROCESS_KILL_GRACE_SECONDS = 5
RESPONSE_MODEL_ALIASES = {model: (model, f"mimo-v2.6-{alias}") for alias, model in MODELS.items()}
COMMON_ASSERTIONS = ("model-identity", "protocol-identity", "profile-identity", "user-dedup", "dom-visible", "body-order",
                     "live-to-durable", "no-terminal-overlay", "tool-call-correlation", "process-fold-persistence", "event-correlated", "scene-contract")
REQUIRED_ASSERTIONS = {case: COMMON_ASSERTIONS + {
    "U04": ("permission-delivered",), "U05": ("permission-delivered",), "U06": ("cancel-terminal",),
    "U07": ("history-identity", "history-status"), "U08": ("route-owned-terminal",),
    "U09": ("route-owned-terminal",), "U10": ("route-owned-terminal",),
}.get(case, ()) for case in CASES}
HOP_HEADERS = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host"}
PRIVATE_ENV_PREFIXES = ("ANTHROPIC_", "OPENAI_", "OPENROUTER_", "DEEPSEEK_", "MAGPIE_", "SGLANG_", "MIMO_", "UA_PROVIDER_", "UA_REAL_EDITOR_", "VSCODE_", "ELECTRON_", "COPILOT_", "GH_", "GITHUB_")
BUDGET_POLICY_FILE = ROOT / "test/scenario/scenarios/universe-agent-real-editor-budget.json"


def canonical_sha256(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()).hexdigest()


def budget_policy() -> dict:
    policy = json.loads(BUDGET_POLICY_FILE.read_text())
    fixed = {"schemaVersion": 1, "clock": "linux-clock-monotonic-ns", "setupMs": 60000,
             "episodeMs": 600000, "finalizationMs": 60000, "cleanupMs": 60000}
    if any(policy.get(key) != value for key, value in fixed.items()) or set(policy.get("cases", {})) != set(CASES):
        raise ValueError("Unsupported frozen real-editor budget policy")
    for case_id, case in policy["cases"].items():
        count = 7 if case_id == "U07" else 2 if case_id == "U02" else 1
        labels = case.get("episodeLabels")
        history = 120000 if case_id == "U07" else 0
        if not isinstance(labels, list) or len(labels) != count or len(set(labels)) != count or case.get("historyMs") != history:
            raise ValueError("Frozen budget policy changed required episode coverage")
        expected = fixed["setupMs"] + count * fixed["episodeMs"] + history + fixed["finalizationMs"]
        if case.get("caseBudgetMs") != expected or case.get("watchdogMs") != expected + fixed["cleanupMs"]:
            raise ValueError("Frozen case budget does not equal its complete phase allocation")
    return policy


def case_budget(case_id: str) -> dict:
    policy = budget_policy()
    case = policy.pop("cases")[case_id]
    return {**policy, **case, "episodeCount": len(case["episodeLabels"])}


def monotonic_domain() -> str:
    clock = time.get_clock_info("monotonic")
    if sys.platform != "linux" or not clock.monotonic or clock.adjustable or "CLOCK_MONOTONIC" not in clock.implementation:
        raise ValueError("Real-editor budgets require the verified Linux CLOCK_MONOTONIC domain")
    boot_id = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
    if not re.fullmatch(r"[0-9a-f-]{36}", boot_id):
        raise ValueError("Cannot establish the real-editor monotonic boot identity")
    return boot_id


def nanoseconds(value) -> int:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{1,30}", value):
        raise ValueError("Budget timestamps must be decimal monotonic nanosecond strings")
    return int(value)


def validate_budget_stages(budget, clock, stages, now_ns, require_complete=False):
    """Validate the full retained prefix, including phases skipped between parent polls."""
    if not isinstance(stages, list) or not stages:
        raise ValueError("Budget progress omitted its complete phase history")
    expected = [("setup", 0, None, budget["setupMs"])]
    expected += [("episode", index, label, budget["episodeMs"]) for index, label in enumerate(budget["episodeLabels"], 1)]
    if budget["historyMs"]:
        expected.append(("history", 0, None, budget["historyMs"]))
    expected.append(("finalization", 0, None, budget["finalizationMs"]))
    business = [stage for stage in stages if stage.get("phase") != "cleanup"]
    if len(business) > len(expected) or len(stages) - len(business) > 1 or any(stage.get("phase") == "cleanup" for stage in stages[:-1]):
        raise ValueError("Budget progress added or reordered an unregistered phase")
    start = nanoseconds(clock["setupStartedMonoNs"])
    case_deadline = start + budget["caseBudgetMs"] * 1_000_000
    previous_end = start
    for index, stage in enumerate(business):
        phase, episode_index, label, allocation = expected[index]
        if (stage.get("phase"), stage.get("episodeIndex"), stage.get("episodeLabel")) != (phase, episode_index, label):
            raise ValueError("Budget phase history skipped required episode coverage")
        began, deadline = nanoseconds(stage.get("phaseStartedMonoNs")), nanoseconds(stage.get("phaseDeadlineMonoNs"))
        if began != previous_end or began > now_ns or deadline != min(began + allocation * 1_000_000, case_deadline):
            raise ValueError("Budget phase history refreshed a deadline or left unaccounted time")
        status, ended = stage.get("status"), stage.get("endedMonoNs")
        if status == "active":
            if ended is not None or index != len(business) - 1 or stages[-1].get("phase") == "cleanup":
                raise ValueError("Only the final business phase may remain active")
            previous_end = began
        elif status in ("completed", "failed", "timed-out"):
            ended = nanoseconds(ended)
            if ended < began or ended > now_ns or status == "completed" and ended >= deadline:
                raise ValueError("Late budget completion cannot be recorded as a pass")
            if status != "completed" and index != len(business) - 1:
                raise ValueError("Business phases continued after a failed or timed-out phase")
            duration = stage.get("durationMs")
            if not isinstance(duration, (int, float)) or isinstance(duration, bool) or not duration >= 0 or abs(duration - (ended - began) / 1_000_000) > 1:
                raise ValueError("Budget phase duration does not match the monotonic trace")
            previous_end = ended
        else:
            raise ValueError("Unsupported budget history status")
    if require_complete and (len(business) != len(expected) or any(stage["status"] != "completed" for stage in business)):
        raise ValueError("Passed case did not complete every registered budget phase")
    cleanup = stages[-1] if stages[-1].get("phase") == "cleanup" else None
    if cleanup is not None:
        began = nanoseconds(cleanup.get("phaseStartedMonoNs"))
        deadline = nanoseconds(cleanup.get("phaseDeadlineMonoNs"))
        cap = start + budget["watchdogMs"] * 1_000_000
        if cleanup.get("episodeIndex") != 0 or cleanup.get("episodeLabel") is not None or began < start or began > now_ns or deadline != min(began + budget["cleanupMs"] * 1_000_000, cap):
            raise ValueError("Cleanup phase changed its registered identity or allowance")
        # A parent-first cancellation may begin cleanup before a failed CJS
        # phase finally unwinds. Completed business has no such overlap.
        if business and business[-1]["status"] == "completed" and began != nanoseconds(business[-1]["endedMonoNs"]):
            raise ValueError("Completed business left unaccounted time before cleanup")
        status, ended = cleanup.get("status"), cleanup.get("endedMonoNs")
        if status == "active":
            if ended is not None:
                raise ValueError("Active cleanup cannot have an end timestamp")
        elif status in ("completed", "failed", "timed-out"):
            ended = nanoseconds(ended)
            duration = cleanup.get("durationMs")
            if ended < began or ended > now_ns or status == "completed" and ended >= deadline:
                raise ValueError("Late cleanup cannot be recorded as completed")
            if not isinstance(duration, (int, float)) or isinstance(duration, bool) or not duration >= 0 or abs(duration - (ended - began) / 1_000_000) > 1:
                raise ValueError("Cleanup duration does not match the monotonic trace")
        else:
            raise ValueError("Unsupported cleanup phase status")
    if require_complete and (cleanup is None or cleanup.get("status") != "completed"):
        raise ValueError("Passed case did not complete the shared cleanup phase")
    return business


class CaseBudgetControl:
    """Parent-side phase supervisor, including time before the CJS/Electron startup."""

    def __init__(self, case_root: Path, identity: dict, budget: dict, now=time.monotonic_ns):
        self.root, self.identity, self.budget, self.now = case_root, identity, budget, now
        self.budget_sha = canonical_sha256(budget)
        started = now()
        self.clock = {"bootId": monotonic_domain(), "setupStartedMonoNs": str(started),
                      "setupDeadlineMonoNs": str(started + budget["setupMs"] * 1_000_000)}
        self.case_deadline = started + budget["caseBudgetMs"] * 1_000_000
        self.watchdog_deadline = started + budget["watchdogMs"] * 1_000_000
        self.progress_file = case_root / "budget-progress.json"
        self.cleanup_file = case_root / "cleanup-budget.json"
        self.progress = None
        self.cleanup = None
        self.timeout = None
        self.watchdog_expired = False
        self.protocol_error = False

    def envelope(self):
        return {"schemaVersion": 1, **{key: self.identity[key] for key in ("campaignId", "cellId", "caseId", "nonce")},
                "budgetSha256": self.budget_sha, "bootId": self.clock["bootId"]}

    def validate_identity(self, value):
        if not isinstance(value, dict) or any(value.get(key) != expected for key, expected in self.envelope().items()):
            raise ValueError("Case budget progress/cleanup identity does not match the frozen attempt")

    def read_cleanup(self):
        if not self.cleanup_file.exists() and not self.cleanup_file.is_symlink():
            if self.cleanup is not None:
                raise ValueError("An established cleanup budget disappeared; it cannot be restarted")
            return None
        if self.cleanup_file.is_symlink() or not stat.S_ISREG(self.cleanup_file.lstat().st_mode):
            raise ValueError("Cleanup budget must be an owned regular immutable file")
        value = json.loads(self.cleanup_file.read_text())
        self.validate_identity(value)
        started, deadline = nanoseconds(value.get("cleanupStartedMonoNs")), nanoseconds(value.get("cleanupDeadlineMonoNs"))
        if started < nanoseconds(self.clock["setupStartedMonoNs"]) or started > self.now() or deadline != min(started + self.budget["cleanupMs"] * 1_000_000, self.watchdog_deadline):
            raise ValueError("Cleanup deadline changed its one shared allowance")
        if self.cleanup is not None and value != self.cleanup:
            raise ValueError("An immutable cleanup budget was replaced")
        self.cleanup = value
        return value

    def ensure_cleanup(self):
        existing = self.read_cleanup()
        if existing is not None:
            return existing
        started = self.now()
        value = {**self.envelope(), "cleanupStartedMonoNs": str(started),
                 "cleanupDeadlineMonoNs": str(min(started + self.budget["cleanupMs"] * 1_000_000, self.watchdog_deadline))}
        temporary = self.cleanup_file.with_name(self.cleanup_file.name + ".tmp-" + uuid.uuid4().hex)
        try:
            write_private_json(temporary, value)
            try:
                os.link(temporary, self.cleanup_file)  # Complete bytes, publish once, never replace the winner.
            except FileExistsError:
                pass
        finally:
            temporary.unlink(missing_ok=True)
        return self.read_cleanup()

    def cleanup_remaining(self) -> float:
        return max(0, (nanoseconds(self.ensure_cleanup()["cleanupDeadlineMonoNs"]) - self.now()) / 1_000_000_000)

    def cleanup_limit(self) -> int:
        try:
            return nanoseconds(self.ensure_cleanup()["cleanupDeadlineMonoNs"])
        except (OSError, ValueError):
            # A corrupt/foreign record cannot prevent owned cleanup or grant a
            # new allowance. Force immediate kill/verification, then fail closed.
            self.protocol_error = True
            return self.now()

    def read_progress(self):
        if not self.progress_file.exists():
            if self.progress is not None:
                raise ValueError("Previously observed budget progress disappeared")
            return self.progress
        if self.progress_file.is_symlink() or not stat.S_ISREG(self.progress_file.lstat().st_mode):
            raise ValueError("Budget progress must be a private regular file")
        value = json.loads(self.progress_file.read_text())
        self.validate_identity(value)
        count = self.budget["episodeCount"]
        count_keys = ("expectedEpisodeCount", "startedEpisodeCount", "completedEpisodeCount")
        if any(type(value.get(key)) is not int for key in count_keys) or value["expectedEpisodeCount"] != count or type(value.get("seq")) is not int or value["seq"] < 1:
            raise ValueError("Case budget progress has invalid sequence or expected coverage")
        stages = value.get("budgetStages")
        business = validate_budget_stages(self.budget, self.clock, stages, self.now())
        latest = stages[-1]
        phase_keys = ("phase", "episodeIndex", "episodeLabel", "phaseStartedMonoNs", "phaseDeadlineMonoNs", "status")
        if any(value.get(key) != latest.get(key) for key in phase_keys):
            raise ValueError("Current budget progress disagrees with retained history")
        started_count = sum(stage["phase"] == "episode" for stage in business)
        completed_count = sum(stage["phase"] == "episode" and stage["status"] == "completed" for stage in business)
        if value["startedEpisodeCount"] != started_count or value["completedEpisodeCount"] != completed_count:
            raise ValueError("Budget episode counters do not match the retained history")
        if latest["phase"] == "cleanup":
            cleanup = self.read_cleanup()
            if cleanup is None or latest["phaseStartedMonoNs"] != cleanup["cleanupStartedMonoNs"] or latest["phaseDeadlineMonoNs"] != cleanup["cleanupDeadlineMonoNs"]:
                raise ValueError("Mutable progress cannot create or extend the cleanup allowance")
        if self.progress is not None:
            if value["seq"] < self.progress["seq"] or len(stages) < len(self.progress["budgetStages"]):
                raise ValueError("Case budget progress moved backwards")
            if value["seq"] == self.progress["seq"] and value != self.progress:
                raise ValueError("Case budget sequence was reused with different progress")
            for index, prior in enumerate(self.progress["budgetStages"]):
                next_stage = stages[index]
                if prior["status"] != "active" and prior != next_stage:
                    raise ValueError("Completed budget history was modified")
                if any(prior.get(key) != next_stage.get(key) for key in phase_keys[:-1]):
                    raise ValueError("Case budget polling reset a phase deadline")
        self.progress = value
        return value

    def poll(self) -> bool:
        """Return true once a parent-observed business deadline requires termination."""
        cleanup = self.read_cleanup()
        progress = self.read_progress()
        if cleanup is not None:
            return False
        now = self.now()
        phase = progress["phase"] if progress else "setup"
        deadline = nanoseconds(progress["phaseDeadlineMonoNs"]) if progress else nanoseconds(self.clock["setupDeadlineMonoNs"])
        if now >= self.watchdog_deadline or now >= deadline:
            self.watchdog_expired = now >= self.watchdog_deadline
            self.timeout = self.timeout or {"phase": "watchdog" if self.watchdog_expired else phase,
                "episodeIndex": progress.get("episodeIndex", 0) if progress else 0,
                "episodeLabel": progress.get("episodeLabel") if progress else None,
                "operation": "driver-stage-deadline", "atMonoNs": str(now)}
            self.ensure_cleanup()
            return True
        if progress and progress["status"] in ("failed", "timed-out"):
            self.ensure_cleanup()
        return False


class MatrixTermination(BaseException):
    """A signal requests stack unwinding, including all owned-resource finally blocks."""

    def __init__(self, signum: int):
        self.signum = signum
        super().__init__(signal.Signals(signum).name)


class TerminationState:
    def __init__(self):
        self.signum: int | None = None
        self.deferred = 0
        self.delivered = False

    def deliver(self):
        if self.signum is not None and not self.deferred and not self.delivered:
            self.delivered = True
            raise MatrixTermination(self.signum)

    def handle(self, signum, _frame):
        if self.signum is None:
            self.signum = signum
            # Another Ctrl-C/TERM must not interrupt owned-process/relay cleanup.
            for item in (signal.SIGTERM, signal.SIGINT):
                signal.signal(item, signal.SIG_IGN)
        self.deliver()


_termination_state: TerminationState | None = None


@contextmanager
def controlled_termination(state: TerminationState):
    global _termination_state
    previous_state = _termination_state
    previous_handlers = {item: signal.getsignal(item) for item in (signal.SIGTERM, signal.SIGINT)}
    _termination_state = state
    try:
        for item in previous_handlers:
            signal.signal(item, state.handle)
        yield
    finally:
        for item, handler in previous_handlers.items():
            signal.signal(item, handler)
        _termination_state = previous_state


@contextmanager
def defer_termination():
    """Acquire a resource and publish its cleanup handle before unwinding."""
    state = _termination_state
    if state is None:
        yield
        return
    state.deferred += 1
    try:
        yield
    finally:
        state.deferred -= 1
        state.deliver()


def write_private_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with path.open("x", encoding="utf-8") as stream:
        os.chmod(path, 0o600)
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def update_private_json(path: Path, value: object) -> None:
    temporary = path.with_name(path.name + ".tmp-" + uuid.uuid4().hex)
    write_private_json(temporary, value)
    os.replace(temporary, path)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def tree_digest(root: Path, *, allow_file_aliases: bool = False) -> dict:
    if not root.is_dir():
        raise ValueError(f"Required compiled/runtime directory is absent: {root}")
    digest = hashlib.sha256()
    count = 0
    aliases = []
    canonical_root = root.resolve(strict=True) if allow_file_aliases else None
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            if not allow_file_aliases:
                raise ValueError(f"Runtime snapshot refuses symlinks: {path}")
            try:
                link = os.readlink(path)
                target = path.resolve(strict=True)
                if not target.is_relative_to(canonical_root) or not stat.S_ISREG(target.stat().st_mode):
                    raise ValueError(f"Runtime file alias must resolve to a regular file inside its package: {path}")
                name = path.relative_to(root).as_posix()
                target_name = target.relative_to(canonical_root).as_posix()
                target_sha = sha256_file(target)
            except (OSError, RuntimeError) as error:
                raise ValueError(f"Runtime file alias is dangling, cyclic or unreadable: {path}") from error
            digest.update(name.encode() + b"\0file-alias\0" + os.fsencode(link) + b"\0" + target_name.encode() + b"\0")
            digest.update(bytes.fromhex(target_sha))
            aliases.append({"path": name, "link": link, "target": target_name, "sha256": target_sha})
            count += 1
            continue
        if path.is_file():
            digest.update(path.relative_to(root).as_posix().encode() + b"\0")
            digest.update(bytes.fromhex(sha256_file(path)))
            count += 1
    if count == 0:
        raise ValueError(f"Required compiled/runtime directory is empty: {root}")
    result = {"sha256": digest.hexdigest(), "files": count}
    if allow_file_aliases:
        result["fileAliases"] = aliases
    return result


def source_identity(repo: Path) -> dict:
    names = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", "src", "test/scenario", "test/automation", "scripts"], cwd=repo).split(b"\0")
    digest = hashlib.sha256()
    for name in sorted(set(names) - {b""}):
        path = repo / os.fsdecode(name)
        # Ignored generated output is covered separately, never inferred from HEAD.
        digest.update(name + b"\0")
        digest.update(bytes.fromhex(sha256_file(path)) if path.is_file() else b"missing")
    return {
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip(),
        "sourceSha256": digest.hexdigest(),
        "clientOutput": tree_digest(repo / "out"),
        "scenarioOutput": tree_digest(repo / "test/scenario/out"),
        "automationOutput": tree_digest(repo / "test/automation/out"),
        "electronRuntime": tree_digest((repo / ".build/electron").resolve(), allow_file_aliases=True),
    }


def runtime_identity(repo: Path, engine_bin: Path, package: Path, engine_sha: str, proto_root: Path) -> dict:
    if not re.fullmatch(r"[0-9a-f]{40}", engine_sha):
        raise ValueError("--engine-sha must identify the actual engine source commit")
    if not engine_bin.is_file() or not os.access(engine_bin, os.X_OK):
        raise ValueError("Production engine launcher is absent or not executable")
    if not engine_bin.is_relative_to(package):
        raise ValueError("Engine launcher must belong to --engine-package")
    provenance = package_provenance(package, engine_sha, proto_root)
    return {"engineSource": provenance["sourceSha"], "packageProvenance": provenance, "launcherSha256": sha256_file(engine_bin),
            "enginePackage": tree_digest(package), "proto": tree_digest(proto_root), "ide": source_identity(repo)}


def package_provenance(package: Path, expected_sha: str, proto_root: Path) -> dict:
    version = {}
    for line in (package / "VERSION").read_text().splitlines():
        if not line.strip():
            continue
        key, separator, value = line.partition("=")
        if not separator or key in version:
            raise ValueError("Malformed or duplicate package VERSION field")
        version[key] = value
    if version.get("source_sha") != expected_sha or version.get("source_dirty") != "false":
        raise ValueError("Package source commit/clean identity does not match the requested candidate")
    if version.get("main_class") != "universe.agentic.grpc.HeadlessServer":
        raise ValueError("Package is not a production HeadlessServer runtime")
    manifest_name = version.get("lib_manifest", "")
    if manifest_name != "lib.SHA256SUMS":
        raise ValueError("Package has no supported library manifest")
    manifest = package / manifest_name
    if sha256_file(manifest) != version.get("lib_manifest_sha256"):
        raise ValueError("Package library manifest does not match VERSION")
    libraries = {}
    for line in manifest.read_text().splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  (lib/[^/]+\.jar)", line)
        if not match or match[2] in libraries:
            raise ValueError("Malformed or duplicate package library manifest entry")
        path = package / match[2]
        if path.is_symlink() or not path.is_file() or sha256_file(path) != match[1]:
            raise ValueError("Package library bytes do not match their digest")
        libraries[match[2]] = match[1]
    actual_jars = {path.relative_to(package).as_posix() for path in (package / "lib").glob("*.jar")}
    if not libraries or actual_jars != set(libraries):
        raise ValueError("Library manifest does not describe the entire loaded jar set")
    record_file = package / "runtime-artifacts.json"
    record = json.loads(record_file.read_text())
    if record.get("source_sha") != expected_sha or record.get("source_dirty") is not False:
        raise ValueError("Runtime component record disagrees with clean package source identity")
    jars = record.get("jars")
    if not isinstance(jars, list) or len(jars) != len(libraries):
        raise ValueError("Runtime component records do not cover the library set")
    ordered = []
    components = set()
    for index, item in enumerate(jars):
        if not isinstance(item, dict) or item.get("classpathIndex") != index:
            raise ValueError("Runtime component classpath order is incomplete")
        name = item.get("filename", "")
        relative = "lib/" + name
        if "/" in name or relative not in libraries or relative in ordered:
            raise ValueError("Runtime component path is not a unique package jar")
        if item.get("sha256") != libraries[relative] or item.get("size") != (package / relative).stat().st_size:
            raise ValueError("Runtime component bytes disagree with the library manifest")
        component = item.get("component")
        if not isinstance(component, str) or not component:
            raise ValueError("Runtime component has no provenance identity")
        components.add(component)
        ordered.append(relative)
    classpath = (package / "classpath.txt").read_text().splitlines()
    if classpath != ordered:
        raise ValueError("Launcher classpath differs from the ordered component records")
    project_paths = record.get("runtime_project_paths")
    if not isinstance(project_paths, list) or not {"project " + path for path in project_paths} <= components:
        raise ValueError("Runtime project components are incomplete")
    if not {"project :grpc-api", "project :grpc-server", "project :core", "project :protocol", "project :tools"} <= components:
        raise ValueError("Required production engine components are absent")
    grpc = [item for item in jars if item["component"] == "project :grpc-api"]
    if len(grpc) != 1:
        raise ValueError("The package must contain one authoritative grpc-api component")
    provided = {path.relative_to(proto_root).as_posix(): path for path in proto_root.rglob("*.proto")}
    with zipfile.ZipFile(package / "lib" / grpc[0]["filename"]) as archive:
        embedded = {name for name in archive.namelist() if name.endswith(".proto")}
        if not embedded or embedded != set(provided):
            raise ValueError("Protocol directory does not match the loaded grpc-api resources")
        for name in embedded:
            if provided[name].is_symlink() or provided[name].read_bytes() != archive.read(name):
                raise ValueError("Protocol bytes differ from the loaded grpc-api jar")
    return {"sourceSha": expected_sha, "sourceDirty": False, "versionSha256": sha256_file(package / "VERSION"),
            "libraryManifestSha256": sha256_file(manifest), "componentRecordSha256": sha256_file(record_file),
            "classpathSha256": sha256_file(package / "classpath.txt"), "grpcApiSha256": grpc[0]["sha256"],
            "embeddedProtoCount": len(embedded)}


def expected_cells() -> list[dict]:
    return [{"cellId": f"{alias}:{protocol}", "model": model, "protocol": protocol,
             "modelProfile": f"matrix-{alias}-{protocol}", "requiredCases": list(CASES)}
            for alias, model in MODELS.items() for protocol in PROTOCOLS]


def clean_environment(parent: dict[str, str]) -> dict[str, str]:
    result = {key: value for key, value in parent.items()
              if not key.startswith(PRIVATE_ENV_PREFIXES) and key not in {
                  "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS", "JAVA_OPTS",
                  "UNIVERSE_AGENT_HOME", "UA_ENGINE_BIN", "NODE_OPTIONS", "NODE_PATH"}}
    result["VSCODE_SKIP_PRELAUNCH"] = "1"
    return result


def validate_gateway(base_url: str) -> str:
    parsed = urlsplit(base_url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Gateway must be an HTTP(S) URL without credentials/query/fragment")
    path = parsed.path.rstrip("/")
    if path.endswith("/v1"):
        path = path[:-3]
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def gateway_models(base_url: str, token: str) -> set[str]:
    request = Request(base_url + "/v1/models", headers={"Authorization": f"Bearer {token}"})
    with build_opener(ProxyHandler({}), NoRedirect).open(request, timeout=15) as response:
        value = json.load(response)
    return {item["id"] for item in value.get("data", []) if isinstance(item, dict) and isinstance(item.get("id"), str)}


def request_protocol(path: str) -> str | None:
    return {"/messages": "anthropic", "/chat/completions": "openai-chat", "/responses": "openai-response"}.get(re.sub(r"^/v1", "", urlsplit(path).path.rstrip("/")))


class ResponseModelObserver:
    """Observe public model metadata while forwarding the original bytes unchanged.

    Buffers are bounded and discarded after each SSE event. No message/tool text
    is returned or written to disk; only the exact reported model ids survive.
    """
    LIMIT = 2 * 1024 * 1024

    def __init__(self, model: str, protocol: str, content_type: str, content_encoding=""):
        self.model = model
        self.protocol = protocol
        self.sse = "text/event-stream" in content_type.lower()
        self.buffer = b""
        self.event_data = []
        self.models: list[str] = []
        encoding = content_encoding.strip().lower()
        self.invalid = encoding not in ("", "identity", "gzip", "deflate")
        self.decoder = zlib.decompressobj(16 + zlib.MAX_WBITS if encoding == "gzip" else zlib.MAX_WBITS) if encoding in ("gzip", "deflate") else None

    def consume(self, block: bytes, final=False) -> None:
        if self.decoder is not None:
            try:
                block = self.decoder.decompress(block, self.LIMIT + 1)
                if self.decoder.unconsumed_tail:
                    self.invalid = True
                    return
                if final:
                    block += self.decoder.flush()
            except zlib.error:
                self.invalid = True
                return
        self.buffer += block
        if len(self.buffer) > self.LIMIT:
            self.invalid = True
            self.buffer = b""
            self.event_data = []
            return
        if not self.sse:
            if final and self.buffer:
                self.consume_json(self.buffer)
                self.buffer = b""
            return
        while b"\n" in self.buffer:
            line, self.buffer = self.buffer.split(b"\n", 1)
            line = line.rstrip(b"\r")
            if line.startswith(b"data:"):
                self.event_data.append(line[5:].lstrip(b" "))
                if sum(map(len, self.event_data)) > self.LIMIT:
                    self.invalid = True
                    self.event_data = []
            elif not line and self.event_data:
                self.consume_json(b"\n".join(self.event_data))
                self.event_data = []
        if final:
            if self.buffer.startswith(b"data:"):
                self.event_data.append(self.buffer[5:].strip())
            if self.event_data:
                self.consume_json(b"\n".join(self.event_data))
            self.buffer = b""
            self.event_data = []

    def consume_json(self, data: bytes) -> None:
        if data.strip() == b"[DONE]":
            return
        try:
            value = json.loads(data)
        except (ValueError, UnicodeDecodeError):
            self.invalid = True
            return
        if not isinstance(value, dict):
            self.invalid = True
            return
        reported = value.get("model")
        if self.protocol == "anthropic" and isinstance(value.get("message"), dict):
            reported = value["message"].get("model", reported)
        elif self.protocol == "openai-response" and isinstance(value.get("response"), dict):
            reported = value["response"].get("model", reported)
        if reported is not None:
            if not isinstance(reported, str) or not reported or len(reported) > 200:
                self.invalid = True
                return
            if reported not in self.models:
                self.models.append(reported)

    def metadata(self) -> dict:
        # Exact preregistered aliases only: a pro id can never become flash.
        aliases = RESPONSE_MODEL_ALIASES[self.model]
        status = "unknown" if not self.models else "verified"
        if self.invalid:
            status = "invalid"
        elif any(model not in aliases for model in self.models):
            status = "mismatch"
        return {"responseModels": list(self.models), "responseModelStatus": status}


@contextmanager
def provider_relay(base_url: str, model: str, protocol: str, observations: list[dict], observation_file: Path, budget_control=None):
    """Transparent streaming relay: observe identity, do not retain message bodies."""
    opener = build_opener(ProxyHandler({}), NoRedirect)
    lock = threading.Lock()
    active_sockets: set[socket.socket] = set()
    active_handlers: set[threading.Thread] = set()
    update_private_json(observation_file, [])

    def save():
        update_private_json(observation_file, observations)

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.0"

        def log_message(self, *_args):
            pass  # Default HTTP logging can contain user paths or credentials.

        def do_POST(self):
            current = threading.current_thread()
            with lock:
                active_handlers.add(current)
            try:
                self.forward_request()
            finally:
                with lock:
                    active_handlers.discard(current)

        def forward_request(self):
            length = self.headers.get("Content-Length", "")
            if not length.isdigit() or int(length) > 64 * 1024 * 1024:
                self.send_error(400, "Content length required")
                return
            body = self.rfile.read(int(length))
            try:
                requested = json.loads(body).get("model")
            except (ValueError, AttributeError):
                requested = None
            actual_protocol = request_protocol(self.path)
            with lock:
                row = {"sequence": len(observations) + 1, "model": requested,
                       "protocol": actual_protocol, "path": urlsplit(self.path).path, "status": None,
                       "responseModels": [], "responseModelStatus": "unknown"}
                observations.append(row)
                save()
            if requested != model or actual_protocol != protocol:
                with lock:
                    row["rejected"] = "model-or-protocol-mismatch"
                    save()
                self.send_error(409, "Matrix identity mismatch")
                return
            headers = {key: value for key, value in self.headers.items() if key.lower() not in HOP_HEADERS}
            request = Request(base_url + urlsplit(self.path).path, data=body, headers=headers, method="POST")
            try:
                try:
                    upstream = opener.open(request, timeout=TASK_TIMEOUT_MS / 1000)
                except HTTPError as error:
                    upstream = error
                with upstream:
                    observer = ResponseModelObserver(model, protocol, upstream.headers.get("Content-Type", ""), upstream.headers.get("Content-Encoding", ""))
                    upstream_socket = getattr(getattr(getattr(upstream, "fp", None), "raw", None), "_sock", None)
                    with lock:
                        if upstream_socket is not None:
                            active_sockets.add(upstream_socket)
                        row["status"] = upstream.status
                        save()
                    self.send_response(upstream.status)
                    for key, value in upstream.headers.items():
                        if key.lower() not in HOP_HEADERS:
                            self.send_header(key, value)
                    self.end_headers()
                    while block := upstream.read1(64 * 1024):
                        observer.consume(block)
                        with lock:
                            row.update(observer.metadata())
                            save()
                        self.wfile.write(block)
                        self.wfile.flush()
                    observer.consume(b"", final=True)
                    with lock:
                        row.update(observer.metadata())
                        save()
                        if upstream_socket is not None:
                            active_sockets.discard(upstream_socket)
            except (OSError, TimeoutError):
                with lock:
                    row["transportError"] = True
                    save()
                # No exception/body is logged: either can contain a secret.
                self.close_connection = True

    server = None
    thread = None
    try:
        with defer_termination():
            server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
            server.daemon_threads = True
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        with defer_termination():
            if server is not None:
                deadline = budget_control.cleanup_limit() if budget_control is not None else None
                def remaining(cap=5):
                    return cap if deadline is None else max(0, min(cap, (deadline - time.monotonic_ns()) / 1_000_000_000))
                shutdown = None
                if thread is not None and thread.ident is not None:
                    if deadline is None:
                        server.shutdown()
                    else:
                        shutdown = threading.Thread(target=server.shutdown, daemon=True)
                        shutdown.start()
                # Cancelling U06 must also close its upstream HTTP stream, so the next
                # case never overlaps an orphan relay request from this owned engine.
                with lock:
                    sockets = list(active_sockets)
                for upstream_socket in sockets:
                    try:
                        upstream_socket.shutdown(socket.SHUT_RDWR)
                    except OSError:
                        pass
                    upstream_socket.close()
                server.server_close()
                if shutdown is not None:
                    shutdown.join(timeout=remaining())
                if thread is not None and thread.ident is not None:
                    thread.join(timeout=remaining())
                with lock:
                    handlers = list(active_handlers)
                for handler in handlers:
                    handler.join(timeout=remaining())
                if any(handler.is_alive() for handler in handlers) or shutdown is not None and shutdown.is_alive() or thread is not None and thread.is_alive():
                    raise ValueError("Owned provider relay did not terminate; subsequent cells are stopped")


def seed_profile(case_root: Path, cell: dict, token: str, base_url: str, credentials=None) -> None:
    """ConfigStore provider:state plus catalog and ProviderConfigIo's JVM file."""
    home = case_root / "agent-home"
    jvm = case_root / "jvm-home"
    provider = PROVIDER_IDS[cell["protocol"]]
    endpoint = base_url if provider == "anthropic" else base_url + "/v1"
    state = {"schemaVersion": 1, "providers": [{"id": provider, "name": "MiMo matrix",
              "settingsConfig": {"apiBaseUrl": endpoint, "apiKey": token, "protocol": provider}}],
             "modelProfiles": [{"id": cell["modelProfile"], "name": cell["modelProfile"],
                                "provider": provider, "modelId": cell["model"], "enabled": True}]}
    def write_credentials(path, value):
        if credentials is None:
            write_private_json(path, value)
            return
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with defer_termination():
            with path.open("x", encoding="utf-8") as stream:
                # Register ownership before writing any sensitive bytes. An existing
                # file is never registered or touched by this invocation's cleanup.
                credentials.append({"path": path, "provider": provider,
                                    "parent": path.parent.resolve(strict=True)})
                os.fchmod(stream.fileno(), 0o600)
                json.dump(value, stream, ensure_ascii=False, indent=2)
                stream.write("\n")

    write_credentials(home / "config.json", {"provider:state": json.dumps(state, separators=(",", ":")),
                                           "defaultProvider": provider, "modelId": cell["modelProfile"]})
    write_private_json(home / "models.json", {"models": [{"id": cell["modelProfile"], "type": "coding",
        "enabled": True, "level": 5, "description": "Isolated MiMo matrix", "cost": "medium", "speed": "high",
        "provider": provider, "modelId": cell["model"], "isDefault": True}]})
    # The CLI's startup client does not read ConfigStore's document; pin that
    # fallback too, so it cannot silently select a daily/default provider.
    write_credentials(jvm / ".universe-agent/config.json", {"defaultProvider": provider, "defaultModel": cell["model"],
        "providers": {provider: {"id": provider, "name": "MiMo matrix", "brand": "anthropic" if provider == "anthropic" else "openai",
                                  "apiKey": token, "baseUrl": endpoint, "enabled": True, "protocol": provider}}})


def remove_seeded_credentials(credentials) -> None:
    """Remove only the two runtime config paths exclusively created by this case."""
    for owned in credentials:
        path = owned["path"]
        if not path.exists() and not path.is_symlink():
            continue
        if path.parent.resolve(strict=True) != owned["parent"] or path.is_symlink() or not stat.S_ISREG(path.lstat().st_mode):
            raise ValueError("Owned credential path changed identity; private artifacts must not be shared")
        # The engine may atomically rewrite its config, so ownership follows this
        # exclusively-created path in the same verified private case directory.
        # Never recurse or remove any other runtime/user file.
        path.unlink()


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@contextmanager
def child_subreaper():
    """Adopt only orphaned descendants, allowing owned-group zombies to be reaped."""
    if sys.platform != "linux":
        raise ValueError("Owned descendant verification currently requires Linux /proc")
    libc = ctypes.CDLL(None, use_errno=True)
    previous = ctypes.c_int()
    if libc.prctl(37, ctypes.byref(previous), 0, 0, 0) != 0 or libc.prctl(36, 1, 0, 0, 0) != 0:
        raise ValueError("Cannot establish owned descendant reaping")
    try:
        yield
    finally:
        libc.prctl(36, previous.value, 0, 0, 0)


def process_table() -> dict[int, tuple[str, int, int, str]]:
    table = {}
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            fields = (entry / "stat").read_text().rsplit(") ", 1)[1].split()
            table[int(entry.name)] = (fields[0], int(fields[1]), int(fields[2]), fields[19])
        except (OSError, IndexError, ValueError):
            continue
    return table


def owned_processes(pgid: int, baseline_children=None) -> dict[int, str]:
    table = process_table()
    owned = {pid for pid, (_state, _parent, group, _started) in table.items() if group == pgid}
    if baseline_children is not None:
        # This serial driver launches no other subprocess while a case runs.
        # Subreaper-adopted new children therefore belong to this case even if
        # Electron detached them into another session/group. Existing children
        # retain their baseline identity and are never included.
        owned.update(pid for pid, (_state, parent, _group, started) in table.items()
                     if parent == os.getpid() and baseline_children.get(pid) != started)
    while True:
        children = {pid for pid, (_state, parent, _group, _started) in table.items() if parent in owned}
        if children <= owned:
            break
        owned.update(children)
    return {pid: table[pid][3] for pid in owned}


def process_group_members(pgid: int) -> set[int]:
    return {pid for pid, (_state, _parent, group, _started) in process_table().items() if group == pgid}


def wait_for_owned_group(pgid: int, seconds: float, baseline_children=None, deadline_ns=None) -> bool:
    deadline = time.monotonic() + seconds
    if deadline_ns is not None:
        deadline = min(deadline, deadline_ns / 1_000_000_000)
    while True:
        try:
            while os.waitpid(-pgid, os.WNOHANG)[0]:
                pass
        except ChildProcessError:
            pass
        owned = owned_processes(pgid, baseline_children)
        for pid in owned:
            try:
                os.waitpid(pid, os.WNOHANG)
            except ChildProcessError:
                pass
        if not owned_processes(pgid, baseline_children):
            return True
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.05)


def stop_owned_group(pgid: int, baseline_children=None, deadline_ns=None) -> None:
    for sig, grace in ((signal.SIGTERM, PROCESS_STOP_GRACE_SECONDS), (signal.SIGKILL, PROCESS_KILL_GRACE_SECONDS)):
        if deadline_ns is not None:
            remaining = max(0, (deadline_ns - time.monotonic_ns()) / 1_000_000_000)
            if sig == signal.SIGTERM and not remaining:
                continue
            grace = min(grace, remaining)
        try:
            os.killpg(pgid, sig)
        except ProcessLookupError:
            pass
        for pid, started in owned_processes(pgid, baseline_children).items():
            current = process_table().get(pid)
            if current is None or current[3] != started:
                continue
            try:
                os.kill(pid, sig)
            except ProcessLookupError:
                pass
        if wait_for_owned_group(pgid, grace, baseline_children, deadline_ns):
            return
    raise ValueError("Owned case process group survived cleanup; subsequent cases are stopped")


def run_owned(command: list[str], env: dict[str, str], log: Path, timeout: float, cleanup_state=None, budget_control=None) -> tuple[int, bool]:
    with child_subreaper(), log.open("xb") as stream:
        os.chmod(log, 0o600)
        baseline_children = {pid: started for pid, (_state, parent, _group, started) in process_table().items() if parent == os.getpid()}
        process = None
        try:
            with defer_termination():
                if cleanup_state is not None:
                    cleanup_state["stopped"] = False
                process = subprocess.Popen(command, env=env, cwd=ROOT, stdout=stream,
                                           stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True)
            if budget_control is None:
                return process.wait(timeout=timeout), False
            timed_out = False
            while True:
                if budget_control.poll():
                    timed_out = True
                    process.send_signal(signal.SIGTERM)
                cleanup = budget_control.read_cleanup()
                if cleanup is not None and budget_control.cleanup_remaining() <= 0:
                    budget_control.watchdog_expired = time.monotonic_ns() >= budget_control.watchdog_deadline
                    budget_control.timeout = budget_control.timeout or {"phase": "watchdog" if budget_control.watchdog_expired else "cleanup", "episodeIndex": 0,
                        "episodeLabel": None, "operation": "driver-cleanup-deadline", "atMonoNs": str(time.monotonic_ns())}
                    timed_out = True
                    break
                code = process.poll()
                if code is not None:
                    return code, timed_out
                time.sleep(min(0.05, budget_control.cleanup_remaining()) if cleanup is not None else 0.05)
            # The one cleanup allowance is exhausted. No second TERM/wait window.
            return -signal.SIGKILL, timed_out
        except subprocess.TimeoutExpired:
            # Signal the wrapper first: its trap waits for the runner before
            # stopping the owned engine. Never target a shared PID or port.
            process.send_signal(signal.SIGTERM)
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
            return process.returncode, True
        finally:
            # A successful wrapper exit does not imply that Electron descendants
            # have exited. TERM, wait, KILL if needed, reap and verify this group
            # before the next case is allowed to launch.
            with defer_termination():
                deadline = budget_control.cleanup_limit() if budget_control is not None else None
                if process is not None:
                    stop_owned_group(process.pid, baseline_children, deadline)
                    if process.poll() is None:
                        remaining = PROCESS_KILL_GRACE_SECONDS if deadline is None else max(0, (deadline - time.monotonic_ns()) / 1_000_000_000)
                        process.wait(timeout=remaining)
                if cleanup_state is not None:
                    cleanup_state["stopped"] = True
                if budget_control is not None and budget_control.protocol_error:
                    raise ValueError("Invalid cleanup budget; retained artifacts are private and subsequent cases are stopped")


def verify_case_result(value: object, oracle: dict, case_root: Path, observations: list[dict]) -> list[str]:
    errors = []
    if not isinstance(value, dict):
        return ["missing-or-invalid-scenario-result"]
    for key in ("schemaVersion", "campaignId", "cellId", "caseId", "nonce"):
        if value.get(key) != oracle[key]:
            errors.append(f"result-identity-{key}")
    try:
        expected_budget = case_budget(oracle["caseId"])
        expected_hash = canonical_sha256(expected_budget)
        if oracle.get("budget") != expected_budget or oracle.get("budgetSha256") != expected_hash:
            raise ValueError("Oracle budget is not the registered policy")
        if value.get("budget") != expected_budget or value.get("budgetSha256") != expected_hash or value.get("clock") != oracle.get("clock"):
            raise ValueError("Result changed the registered budget/clock")
        clock = oracle["clock"]
        began = nanoseconds(clock.get("setupStartedMonoNs"))
        if clock.get("bootId") != monotonic_domain() or began > time.monotonic_ns() or nanoseconds(clock.get("setupDeadlineMonoNs")) != began + expected_budget["setupMs"] * 1_000_000:
            raise ValueError("Result belongs to a different monotonic clock")
        stages = validate_budget_stages(expected_budget, clock, value.get("budgetStages"), time.monotonic_ns(), value.get("status") == "passed")
        started = sum(stage["phase"] == "episode" for stage in stages)
        completed = sum(stage["phase"] == "episode" and stage["status"] == "completed" for stage in stages)
        if any(type(value.get(key)) is not int for key in ("expectedEpisodeCount", "startedEpisodeCount", "completedEpisodeCount")) or value.get("expectedEpisodeCount") != expected_budget["episodeCount"] or value.get("startedEpisodeCount") != started or value.get("completedEpisodeCount") != completed:
            raise ValueError("Result episode accounting does not match full history")
        if value.get("status") == "passed" and (completed != expected_budget["episodeCount"] or value.get("timeout")):
            raise ValueError("A timed-out/incomplete attempt cannot become a late pass")
        cleanup_stages = [stage for stage in value["budgetStages"] if stage.get("phase") == "cleanup"]
        if value.get("status") == "passed" and len(cleanup_stages) != 1:
            raise ValueError("Passed case omitted its shared cleanup phase")
        if cleanup_stages:
            cleanup = json.loads((case_root / "cleanup-budget.json").read_text())
            expected_identity = {"schemaVersion": 1, **{key: oracle[key] for key in ("campaignId", "cellId", "caseId", "nonce")},
                                 "budgetSha256": expected_hash, "bootId": clock["bootId"]}
            began = nanoseconds(cleanup.get("cleanupStartedMonoNs"))
            deadline = nanoseconds(cleanup.get("cleanupDeadlineMonoNs"))
            cap = nanoseconds(clock["setupStartedMonoNs"]) + expected_budget["watchdogMs"] * 1_000_000
            if any(cleanup.get(key) != expected for key, expected in expected_identity.items()) or deadline != min(began + expected_budget["cleanupMs"] * 1_000_000, cap):
                raise ValueError("Cleanup identity or shared allowance changed")
            if cleanup_stages[0].get("phaseStartedMonoNs") != str(began) or cleanup_stages[0].get("phaseDeadlineMonoNs") != str(deadline):
                raise ValueError("Result cleanup phase disagrees with the immutable claim")
    except (KeyError, TypeError, ValueError, OSError):
        errors.append("budget-policy-clock-or-phase-history-invalid")
    for key, expected in (("actualModel", oracle["model"]), ("actualProtocol", oracle["protocol"]), ("modelProfile", oracle["modelProfile"])):
        if value.get(key) != expected:
            errors.append(f"result-identity-{key}")
    if value.get("status") != "passed":
        errors.append("scenario-not-passed")
    assertions = value.get("assertions")
    if not isinstance(assertions, list) or not assertions or any(not isinstance(item, dict) or not item.get("id") or item.get("passed") is not True for item in assertions):
        errors.append("assertions-empty-or-failed")
    else:
        assertion_ids = [item["id"] for item in assertions]
        if len(set(assertion_ids)) != len(assertion_ids) or not set(REQUIRED_ASSERTIONS[oracle["caseId"]]) <= set(assertion_ids):
            errors.append("required-assertions-missing-or-duplicate")
    evidence = value.get("evidence")
    for key in ("domFile", "eventFile", "oracleFile"):
        name = evidence.get(key) if isinstance(evidence, dict) else None
        path = Path(name).resolve() if isinstance(name, str) and name else None
        if path is None or not path.is_relative_to(case_root.resolve()) or not path.is_file() or path.stat().st_size == 0:
            errors.append(f"evidence-missing-{key}")
    if not observations:
        errors.append("no-real-provider-request")
    elif any(row.get("model") != oracle["model"] or row.get("protocol") != oracle["protocol"] or row.get("rejected") for row in observations):
        errors.append("provider-identity-mismatch")
    elif not any(isinstance(row.get("status"), int) and 200 <= row["status"] < 300 for row in observations):
        errors.append("no-successful-provider-response")
    if any(row.get("responseModelStatus") in ("mismatch", "invalid") for row in observations):
        errors.append("actual-response-model-mismatch-or-invalid")
    successful = [row for row in observations if isinstance(row.get("status"), int) and 200 <= row["status"] < 300]
    if successful and any(row.get("responseModelStatus") != "verified" or not row.get("responseModels")
                          or any(name not in RESPONSE_MODEL_ALIASES[oracle["model"]] for name in row["responseModels"]) for row in successful):
        errors.append("actual-response-model-unknown-or-unverified")
    return errors


def _run_case(args, manifest: dict, cell: dict, case_id: str, token: str, base_url: str, credentials, cleanup_state) -> dict:
    case_root = args.report_root / cell["cellId"].replace(":", "-") / case_id
    case_root.mkdir(parents=True, mode=0o700)
    cleanup_state["caseCreated"] = True
    for name in ("agent-home", "jvm-home", "workspace", "tmp", "artifacts"):
        (case_root / name).mkdir(mode=0o700)
    nonce = uuid.uuid4().hex
    oracle = {"schemaVersion": 1, "campaignId": manifest["campaignId"], "cellId": cell["cellId"],
              "caseId": case_id, "nonce": nonce, "model": cell["model"], "protocol": cell["protocol"],
              "modelProfile": cell["modelProfile"], "requiredAssertions": list(REQUIRED_ASSERTIONS[case_id]),
              "responseModelAliases": list(RESPONSE_MODEL_ALIASES[cell["model"]]),
              "workspaceExpected": {"root": str(case_root / "workspace")}}
    budget = case_budget(case_id)
    if manifest.get("budgetPolicy") != budget_policy() or manifest.get("budgetPolicySha256") != canonical_sha256(budget_policy()):
        raise ValueError("Campaign did not preregister the fixed composite UI budget policy")
    control = CaseBudgetControl(case_root, oracle, budget)
    cleanup_state["budget"] = control
    oracle.update(budget=budget, budgetSha256=control.budget_sha, clock=control.clock)
    oracle_file = case_root / "oracle.json"
    result_file = case_root / "scenario-result.json"
    write_private_json(oracle_file, oracle)
    observations: list[dict] = []
    observation_file = case_root / "provider-requests.json"
    with provider_relay(base_url, cell["model"], cell["protocol"], observations, observation_file, control) as endpoint:
        seed_profile(case_root, cell, token, endpoint, credentials)
        env = clean_environment(dict(os.environ))
        env.update({"UNIVERSE_AGENT_HOME": str(case_root / "agent-home"), "UA_ENGINE_BIN": str(args.engine_bin),
            "UA_REAL_EDITOR_SCENE": "matrix", "UA_REAL_EDITOR_WORKDIR": str(case_root / "workspace"),
            "UA_REAL_EDITOR_JVM_HOME": str(case_root / "jvm-home"), "UA_REAL_EDITOR_PORT": str(free_port()),
            "UA_REAL_EDITOR_MODEL": cell["model"], "UA_REAL_EDITOR_PROTOCOL": cell["protocol"],
            "UA_REAL_EDITOR_MODEL_PROFILE": cell["modelProfile"], "UA_REAL_EDITOR_CASE_ID": case_id,
            "UA_REAL_EDITOR_CAMPAIGN_ID": manifest["campaignId"], "UA_REAL_EDITOR_CELL_ID": cell["cellId"],
            "UA_REAL_EDITOR_NONCE": nonce, "UA_REAL_EDITOR_ORACLE_FILE": str(oracle_file),
            "UA_REAL_EDITOR_RESULT_FILE": str(result_file), "UA_REAL_EDITOR_TIMEOUT_MS": str(TASK_TIMEOUT_MS),
            "UA_REAL_EDITOR_BUDGET_SHA256": control.budget_sha,
            "UA_REAL_EDITOR_SETUP_STARTED_MONO_NS": control.clock["setupStartedMonoNs"],
            "UA_REAL_EDITOR_SETUP_DEADLINE_MONO_NS": control.clock["setupDeadlineMonoNs"],
            "UA_REAL_EDITOR_BOOT_ID": control.clock["bootId"],
            "UA_REAL_EDITOR_BUDGET_PROGRESS_FILE": str(control.progress_file),
            "UA_REAL_EDITOR_CLEANUP_BUDGET_FILE": str(control.cleanup_file),
            "UA_REAL_EDITOR_PROTO_ROOT": str(args.proto_root), "UA_REAL_EDITOR_PROVIDER_REQUESTS_FILE": str(observation_file),
            "VSCODE_SCENARIO_ARTIFACT_ROOT": str(case_root / "artifacts"), "TMPDIR": str(case_root / "tmp")})
        started = time.monotonic()
        code, timed_out = run_owned(["bash", str(ROOT / "test/scenario/scripts/run-universe-agent-real-editor.sh")],
                                   env, case_root / "wrapper.log", budget["watchdogMs"] / 1000, cleanup_state, control)
    try:
        value = json.loads(result_file.read_text())
    except (OSError, ValueError):
        value = None
    errors = verify_case_result(value, oracle, case_root, observations)
    progress = control.read_progress()
    if progress is None:
        errors.append("budget-progress-missing")
    elif isinstance(value, dict) and value.get("status") == "passed" and value.get("budgetStages") != progress.get("budgetStages"):
        errors.append("budget-result-does-not-match-observed-progress")
    if code != 0:
        errors.append("runner-exit-nonzero")
    if timed_out:
        errors.append("timeout")
    if control.cleanup_remaining() <= 0:
        errors.append("cleanup-deadline-exceeded")
    update_private_json(observation_file, observations)
    row = {"campaignId": manifest["campaignId"], "cellId": cell["cellId"], "caseId": case_id, "attempt": 1,
           "status": "passed" if not errors else "failed", "errors": errors, "runnerExitCode": code,
           "durationSeconds": round(time.monotonic() - started, 3), "providerRequestCount": len(observations),
           "scenarioStatus": value.get("status") if isinstance(value, dict) else "missing",
           "failureCategory": value.get("failureCategory") if isinstance(value, dict) else "scenario-result-missing",
           "budget": budget, "budgetSha256": control.budget_sha, "clock": control.clock,
           "expectedEpisodeCount": budget["episodeCount"],
           "startedEpisodeCount": value.get("startedEpisodeCount", 0) if isinstance(value, dict) else 0,
           "completedEpisodeCount": value.get("completedEpisodeCount", 0) if isinstance(value, dict) else 0,
           "budgetStages": value.get("budgetStages", []) if isinstance(value, dict) else (control.progress or {}).get("budgetStages", []),
           "timeout": control.timeout or (value.get("timeout") if isinstance(value, dict) else None),
           "watchdogExpired": control.watchdog_expired,
           "infrastructureFailureCategory": "budget-stage-timeout" if control.timeout else None,
           "responseModels": sorted({name for request in observations for name in request.get("responseModels", [])}),
           "actualModelVerification": "verified" if observations and all(request.get("responseModelStatus") == "verified" for request in observations)
           else "unknown" if not any(request.get("responseModels") for request in observations) else "unverified"}
    write_private_json(case_root / "result.json", row)
    return row


def run_case(args, manifest: dict, cell: dict, case_id: str, token: str, base_url: str) -> dict:
    credentials = []
    cleanup_state = {"stopped": True, "caseCreated": False}
    case_root = args.report_root / cell["cellId"].replace(":", "-") / case_id
    try:
        try:
            return _run_case(args, manifest, cell, case_id, token, base_url, credentials, cleanup_state)
        finally:
            with defer_termination():
                if cleanup_state["caseCreated"]:
                    status = {"ownedProcessesStopped": cleanup_state["stopped"], "knownRuntimeCredentialsRemoved": False,
                              "safeToShare": False, "status": "private-isolation-required"}
                    try:
                        control = cleanup_state.get("budget")
                        if not cleanup_state["stopped"]:
                            raise ValueError("Owned processes were not confirmed stopped; credential-bearing artifacts remain private")
                        remove_seeded_credentials(credentials)
                        status.update(knownRuntimeCredentialsRemoved=True, status="known-runtime-credentials-removed")
                        if control is not None:
                            control.ensure_cleanup()
                            status["cleanupBudget"] = control.cleanup
                            if control.cleanup_remaining() <= 0:
                                status["status"] = "cleanup-deadline-exceeded"
                                raise ValueError("Shared cleanup budget expired; subsequent cases are stopped")
                    finally:
                        update_private_json(case_root / "credential-status.json", status)
                        if status["knownRuntimeCredentialsRemoved"] and control is not None and control.cleanup_remaining() <= 0:
                            raise ValueError("Shared cleanup deadline expired while finalizing private evidence")
    except BaseException as error:
        if cleanup_state["caseCreated"]:
            try:
                raw = json.loads((case_root / "scenario-result.json").read_text())
            except (OSError, ValueError):
                raw = {}
            if not isinstance(raw, dict):
                raw = {}
            control = cleanup_state.get("budget")
            # Persist classification even when cleanup aborts the enclosing case;
            # never serialize exception messages, config values or credentials.
            signum = _termination_state.signum if _termination_state is not None else None
            update_private_json(case_root / "result.json", {
                "campaignId": manifest["campaignId"], "cellId": cell["cellId"], "caseId": case_id, "attempt": 1,
                "status": "interrupted" if isinstance(error, MatrixTermination) or signum is not None else "failed",
                "signal": signum,
                "scenarioStatus": raw.get("status", "missing"), "failureCategory": raw.get("failureCategory"),
                "infrastructureFailureCategory": "signal" if isinstance(error, MatrixTermination) or signum is not None else
                    "budget-stage-timeout" if control is not None and control.timeout else "owned-cleanup-or-budget-protocol-error",
                "errors": ["owned-case-unwind"], "ownedProcessesStopped": cleanup_state["stopped"], "safeToShare": False,
                "budget": control.budget if control is not None else None,
                "budgetSha256": control.budget_sha if control is not None else None,
                "clock": control.clock if control is not None else None,
                "expectedEpisodeCount": control.budget["episodeCount"] if control is not None else None,
                "startedEpisodeCount": raw.get("startedEpisodeCount", 0), "completedEpisodeCount": raw.get("completedEpisodeCount", 0),
                "budgetStages": raw.get("budgetStages", (control.progress or {}).get("budgetStages", []) if control is not None else []),
                "timeout": control.timeout if control is not None and control.timeout else raw.get("timeout"),
            })
        raise


def _run_matrix(argv, termination: TerminationState) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine-bin", type=Path, required=True)
    parser.add_argument("--engine-package", type=Path, required=True)
    parser.add_argument("--engine-sha", required=True)
    parser.add_argument("--proto-root", type=Path, required=True, help="Frozen official grpc-api/src/main/proto directory")
    parser.add_argument("--report-root", type=Path, required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:3425")
    parser.add_argument("--api-key-env", default="MAGPIE_API_KEY")
    args = parser.parse_args(argv)
    report_owned = False
    manifest = None
    rows = []
    active_case = None
    cleanup_failed = False
    try:
        args.engine_bin = args.engine_bin.resolve(strict=True)
        args.engine_package = args.engine_package.resolve(strict=True)
        args.proto_root = args.proto_root.resolve(strict=True)
        if not args.report_root.is_absolute() or re.search(r"\s", str(args.report_root)):
            raise ValueError("Report root must be an absolute path without whitespace")
        args.report_root = args.report_root.resolve()
        if args.report_root.is_relative_to(ROOT) or args.report_root.is_relative_to(args.engine_package) or args.report_root.is_relative_to(args.proto_root):
            raise ValueError("Report root must be outside source and frozen runtime directories")
        if args.report_root.exists():
            raise ValueError("Use a fresh report root; previous attempts are never overwritten")
        token = os.environ.get(args.api_key_env, "")
        if not token:
            raise ValueError("The requested API key environment variable is empty")
        base_url = validate_gateway(args.base_url)
        identity = runtime_identity(ROOT, args.engine_bin, args.engine_package, args.engine_sha, args.proto_root)
        available = gateway_models(base_url, token)
        if not set(MODELS.values()) <= available:
            raise ValueError("Gateway does not advertise both required MiMo model ids")
        args.report_root.mkdir(parents=True, mode=0o700)
        report_owned = True
        os.chmod(args.report_root, 0o700)
        manifest = {"schemaVersion": 1, "campaignId": uuid.uuid4().hex,
                    "createdAt": datetime.now(timezone.utc).isoformat(), "identity": identity,
                    "responseModelAliases": RESPONSE_MODEL_ALIASES,
                    "taskTimeoutMs": TASK_TIMEOUT_MS, "attemptsPerCase": 1, "cells": expected_cells(),
                    "budgetPolicy": budget_policy(), "budgetPolicySha256": canonical_sha256(budget_policy())}
        write_private_json(args.report_root / "manifest.json", manifest)
        for cell in manifest["cells"]:
            for case_id in CASES:
                if runtime_identity(ROOT, args.engine_bin, args.engine_package, args.engine_sha, args.proto_root) != identity:
                    raise ValueError("Source/runtime identity drifted; start a new campaign")
                active_case = {"cellId": cell["cellId"], "caseId": case_id}
                row = run_case(args, manifest, cell, case_id, token, base_url)
                rows.append(row)
                active_case = None
                print(f"{cell['cellId']} {case_id}: {row['status']}", flush=True)
                if runtime_identity(ROOT, args.engine_bin, args.engine_package, args.engine_sha, args.proto_root) != identity:
                    raise ValueError("Source/runtime identity drifted; retained attempt is not final evidence")
        expected = {(cell["cellId"], case) for cell in manifest["cells"] for case in CASES}
        present = {(row["cellId"], row["caseId"]) for row in rows}
        passed = present == expected and len(rows) == len(expected) and all(row["status"] == "passed" for row in rows)
        write_private_json(args.report_root / "summary.json", {"schemaVersion": 1, "campaignId": manifest["campaignId"],
            "expectedCases": len(expected), "executedCases": len(rows), "status": "passed" if passed else "failed", "results": rows})
        return 0 if passed else 1
    except (OSError, ValueError, zipfile.BadZipFile, subprocess.SubprocessError):
        cleanup_failed = termination.signum is not None
        # urllib/launcher errors may carry credentials; report the category only.
        print("MiMo real editor matrix stopped; inspect private campaign artifacts and configuration.", file=sys.stderr)
        if report_owned and manifest is not None and termination.signum is None:
            retained = list(rows)
            if active_case is not None:
                path = args.report_root / active_case["cellId"].replace(":", "-") / active_case["caseId"] / "result.json"
                try:
                    failed = json.loads(path.read_text())
                    if isinstance(failed, dict) and failed.get("status") != "passed":
                        retained.append(failed)
                except (OSError, ValueError):
                    pass
            update_private_json(args.report_root / "summary.json", {"schemaVersion": 1, "campaignId": manifest["campaignId"],
                "expectedCases": len(manifest["cells"]) * len(CASES), "executedCases": len(retained),
                "status": "failed", "stoppedEarly": True, "results": retained, "activeCase": active_case})
        return 2
    finally:
        if termination.signum is not None and report_owned:
            interrupted = {"schemaVersion": 1, "campaignId": manifest["campaignId"] if manifest else None,
                "expectedCases": len(manifest["cells"]) * len(CASES) if manifest else 60,
                "executedCases": len(rows), "status": "interrupted", "signal": termination.signum,
                "exitCode": 128 + termination.signum, "results": rows, "interruptedCase": active_case,
                "cleanupFailed": cleanup_failed}
            if active_case is not None:
                case_root = args.report_root / active_case["cellId"].replace(":", "-") / active_case["caseId"]
                if case_root.is_dir():
                    update_private_json(case_root / "interruption.json", {**active_case, "status": "interrupted",
                        "signal": termination.signum, "exitCode": 128 + termination.signum})
                    try:
                        interrupted["activeCaseResult"] = json.loads((case_root / "result.json").read_text())
                    except (OSError, ValueError):
                        pass
            update_private_json(args.report_root / "summary.json", interrupted)


def main(argv=None) -> int:
    termination = TerminationState()
    try:
        with controlled_termination(termination):
            code = _run_matrix(argv, termination)
    except MatrixTermination:
        code = 128 + termination.signum
    except Exception:
        if termination.signum is None:
            raise
        # Cleanup/reporting failure must retain the requested signal exit code;
        # its existing artifacts remain partial and can never become a pass.
        print("Interrupted matrix cleanup or partial-report persistence failed; inspect private artifacts.", file=sys.stderr)
        code = 128 + termination.signum
    if termination.signum is not None:
        print(f"MiMo real editor matrix interrupted by {signal.Signals(termination.signum).name}; private evidence retained.", file=sys.stderr)
        return 128 + termination.signum
    return code


if __name__ == "__main__":
    raise SystemExit(main())
