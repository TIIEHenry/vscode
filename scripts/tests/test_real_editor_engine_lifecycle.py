#!/usr/bin/env python3
"""Exercise wrapper process ownership with fake engine/runner, not product E2E."""

import ctypes
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
WRAPPER = REPO_ROOT / "test/scenario/scripts/run-universe-agent-real-editor.sh"

LISTENING_ENGINE = '''import json
import os
import signal
import socket
import sys
import time
from pathlib import Path

home = Path(os.environ["UNIVERSE_AGENT_HOME"])

def stop(*_):
    (home / "terminated").touch()
    raise SystemExit(0)

signal.signal(signal.SIGTERM, stop)
(home / "owned.pid").write_text(str(os.getpid()))
(home / "engine-args.json").write_text(json.dumps(sys.argv[1:]))
(home / "engine-jvm-options").write_text(os.environ.get("JAVA_TOOL_OPTIONS", ""))
port = 50161
args = sys.argv[1:]
if "--port" in args:
    port = int(args[args.index("--port") + 1])
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock.bind(("127.0.0.1", port))
sock.listen(1)
(home / "server.lock").write_text("{}")
while True:
    time.sleep(1)
'''

EXITING_ENGINE = '''import os
import sys
from pathlib import Path

home = Path(os.environ["UNIVERSE_AGENT_HOME"])
(home / "owned.pid").write_text(str(os.getpid()))
raise SystemExit(3)
'''

SIGNAL_RUNNER = '''import os
import signal
import time
from pathlib import Path

home = Path(os.environ["UNIVERSE_AGENT_HOME"])

def stop(*_):
    (home / "runner-terminated").touch()
    raise SystemExit(0)

signal.signal(signal.SIGTERM, stop)
(home / "runner.pid").write_text(str(os.getpid()))
while True:
    time.sleep(0.2)
'''

TOUCH_RUNNER = '''#!/bin/sh
touch "$UNIVERSE_AGENT_HOME/runner-started"
printf '%s\\n' "${JAVA_TOOL_OPTIONS-}" > "$UNIVERSE_AGENT_HOME/runner-jvm-options"
exit 0
'''

ENV_RUNNER = '''#!/bin/sh
if [ "${VSCODE_APPDATA+x}" = x ]; then
  printf '%s\\n' "$VSCODE_APPDATA" > "$UNIVERSE_AGENT_HOME/appdata-seen"
fi
printf '%s\\n' "${TMPDIR-}" > "$UNIVERSE_AGENT_HOME/tmpdir-seen"
exit 0
'''


@unittest.skipUnless(sys.platform == "linux", "Linux subreaper isolates the historical orphan")
class RealEditorEngineLifecycleTest(unittest.TestCase):
    def setUp(self):
        # Reap the intentionally leaked historical engine ourselves, never via PID 1.
        self.libc = ctypes.CDLL(None, use_errno=True)
        previous = ctypes.c_int()
        self.assertEqual(self.libc.prctl(37, ctypes.byref(previous), 0, 0, 0), 0)
        self.previous_subreaper = previous.value
        self.assertEqual(self.libc.prctl(36, 1, 0, 0, 0), 0)
        self.temp = tempfile.TemporaryDirectory(prefix="real-editor-lifecycle-")
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.libc.prctl, 36, self.previous_subreaper, 0, 0, 0)

    def reserve_port(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            return sock.getsockname()[1]

    def write_program(self, path, text, kind):
        if kind == "python":
            path.write_text(f"#!{sys.executable}\n{text}")
        else:
            path.write_text(text)
        path.chmod(0o700)

    def prepare(self, engine_body, node_text, *, historical=False, shell_node=False, tmpdir="caller"):
        root = Path(self.temp.name)
        script = root / "test/scenario/scripts/run-universe-agent-real-editor.sh"
        script.parent.mkdir(parents=True)
        source = WRAPPER.read_text()
        if historical:
            needle = 'node "$SCENARIO_OUT" test/scenario/scenarios/universe-agent-real-editor.cjs --dev &'
            replacement = 'exec node "$SCENARIO_OUT" test/scenario/scenarios/universe-agent-real-editor.cjs --dev'
            self.assertEqual(source.count(needle), 1)
            source = source.replace(needle, replacement, 1)
        script.write_text(source)
        (root / "test/scenario/out").mkdir()
        (root / "test/scenario/out/runScenario.js").touch()
        (root / "workspace").mkdir()
        (root / "caller-tmp").mkdir()
        binaries = root / "bin"
        binaries.mkdir()
        engine = binaries / "engine"
        self.write_program(engine, engine_body, "python")
        node = binaries / "node"
        self.write_program(node, node_text, "shell" if shell_node else "python")
        home = root / "home"
        port = self.reserve_port()
        env = {key: value for key, value in os.environ.items() if not key.startswith("UA_REAL_EDITOR_")}
        env.update(UNIVERSE_AGENT_HOME=str(home),
                   UA_REAL_EDITOR_WORKDIR=str(root / "workspace"),
                   UA_ENGINE_BIN=str(engine),
                   UA_REAL_EDITOR_PORT=str(port),
                   PATH=f"{binaries}:{os.environ['PATH']}")
        if tmpdir == "caller":
            env["TMPDIR"] = str(root / "caller-tmp")
        elif tmpdir is None:
            env.pop("TMPDIR", None)
        else:
            env["TMPDIR"] = tmpdir
        return script, home, env, root

    def reap_file(self, pid_path):
        if not pid_path.exists():
            return
        text = pid_path.read_text().strip()
        if not text:
            return
        pid = int(text)
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            os.waitpid(pid, 0)
        except ChildProcessError:
            pass

    def run_wrapper(self, runner_exit, historical=False):
        node = f"#!/bin/sh\nexit {int(runner_exit)}\n"
        script, home, env, root = self.prepare(
            LISTENING_ENGINE, node, historical=historical, shell_node=True)
        try:
            result = subprocess.run(
                ["bash", str(script)], env=env, capture_output=True, text=True,
                timeout=10, stdin=subprocess.DEVNULL)
            self.assertEqual(result.returncode, runner_exit, result.stderr)
            self.assertTrue((root / "caller-tmp").is_dir())
            engine_pid = int((home / "owned.pid").read_text())
            if historical:
                os.kill(engine_pid, 0)
                self.assertFalse((home / "terminated").exists())
            else:
                self.assertTrue((home / "terminated").exists())
                with self.assertRaises(ProcessLookupError):
                    os.kill(engine_pid, 0)
        finally:
            self.reap_file(home / "owned.pid")

    def test_historical_exec_leaves_owned_engine_running(self):
        self.run_wrapper(0, historical=True)

    def test_success_cleans_owned_engine(self):
        self.run_wrapper(0)

    def test_runner_failure_cleans_owned_engine_and_preserves_exit(self):
        self.run_wrapper(23)

    def test_sigterm_to_wrapper_stops_runner_and_engine(self):
        script, home, env, _root = self.prepare(LISTENING_ENGINE, SIGNAL_RUNNER)
        proc = None
        try:
            proc = subprocess.Popen(
                ["bash", str(script)], env=env, stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, text=True, stdin=subprocess.DEVNULL)
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                if (home / "owned.pid").exists() and (home / "runner.pid").exists():
                    break
                if proc.poll() is not None:
                    _out, err = proc.communicate()
                    self.fail(f"wrapper exited {proc.returncode} before the runner started: {err}")
                time.sleep(0.05)
            else:
                if proc.poll() is None:
                    proc.kill()
                _out, err = proc.communicate()
                self.fail(f"runner did not start: {err}")
            runner_pid = int((home / "runner.pid").read_text())
            engine_pid = int((home / "owned.pid").read_text())
            os.kill(proc.pid, signal.SIGTERM)
            try:
                _out, err = proc.communicate(timeout=8)
            except subprocess.TimeoutExpired:
                proc.kill()
                _out, err = proc.communicate()
                self.fail(f"wrapper still running after SIGTERM to its pid: {err}")
            self.assertEqual(proc.returncode, 128 + signal.SIGTERM, err)
            self.assertTrue((home / "runner-terminated").exists())
            self.assertTrue((home / "terminated").exists())
            for pid in (runner_pid, engine_pid):
                with self.assertRaises(ProcessLookupError):
                    os.kill(pid, 0)
        finally:
            if proc is not None and proc.poll() is None:
                proc.send_signal(signal.SIGTERM)
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=5)
            self.reap_file(home / "runner.pid")
            self.reap_file(home / "owned.pid")

    def test_existing_server_lock_fails_without_runner(self):
        script, home, env, _root = self.prepare(
            LISTENING_ENGINE, TOUCH_RUNNER, shell_node=True)
        home.mkdir()
        token = "live-engine-do-not-delete\n"
        (home / "server.lock").write_text(token)
        try:
            result = subprocess.run(
                ["bash", str(script)], env=env, capture_output=True, text=True,
                timeout=8, stdin=subprocess.DEVNULL)
        except subprocess.TimeoutExpired as exc:
            self.fail(f"wrapper hung on a pre-existing server.lock: {exc}")
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("Refusing to start", result.stderr)
        self.assertIn(str(home), result.stderr)
        self.assertEqual((home / "server.lock").read_text(), token)
        self.assertFalse((home / "owned.pid").exists())
        self.assertFalse((home / "runner-started").exists())
        self.assertFalse((home / "real-editor-engine.log").exists())

    def test_engine_exit_before_listen_fails_fast(self):
        script, home, env, _root = self.prepare(
            EXITING_ENGINE, TOUCH_RUNNER, shell_node=True)
        started = time.monotonic()
        try:
            result = subprocess.run(
                ["bash", str(script)], env=env, capture_output=True, text=True,
                timeout=8, stdin=subprocess.DEVNULL)
        except subprocess.TimeoutExpired as exc:
            self.fail(f"wrapper did not fail fast: {exc}")
        finally:
            self.reap_file(home / "owned.pid")
        elapsed = time.monotonic() - started
        self.assertLess(elapsed, 5, result.stderr)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn(str(home / "real-editor-engine.log"), result.stderr)
        self.assertIn("exited before listening", result.stderr)
        self.assertFalse((home / "runner-started").exists())

    def test_explicit_protocol_is_passed_to_owned_engine_without_changing_legacy_default(self):
        import json
        for protocol, expected in ((None, "openai"), ("anthropic", "anthropic"),
                                   ("openai-response", "openai-responses")):
            with self.subTest(protocol=protocol):
                # Every invocation owns a fresh fixture directory.
                with tempfile.TemporaryDirectory(prefix="real-editor-protocol-") as directory:
                    original_temp = self.temp
                    self.temp = type("Fixture", (), {"name": directory})()
                    try:
                        script, home, env, _root = self.prepare(LISTENING_ENGINE, TOUCH_RUNNER, shell_node=True)
                    finally:
                        self.temp = original_temp
                    if protocol:
                        env["UA_REAL_EDITOR_PROTOCOL"] = protocol
                    try:
                        result = subprocess.run(["bash", str(script)], env=env, capture_output=True,
                                                text=True, timeout=10, stdin=subprocess.DEVNULL)
                        self.assertEqual(result.returncode, 0, result.stderr)
                        args = json.loads((home / "engine-args.json").read_text())
                        self.assertEqual(args[args.index("--provider") + 1], expected)
                        self.assertTrue((home / "terminated").exists())
                    finally:
                        self.reap_file(home / "owned.pid")

    def test_private_jvm_home_is_only_applied_to_owned_engine(self):
        script, home, env, root = self.prepare(LISTENING_ENGINE, TOUCH_RUNNER, shell_node=True)
        jvm_home = root / "private-jvm"
        env["UA_REAL_EDITOR_JVM_HOME"] = str(jvm_home)
        env["JAVA_TOOL_OPTIONS"] = "-Xmx64m"
        try:
            result = subprocess.run(["bash", str(script)], env=env, capture_output=True,
                                    text=True, timeout=10, stdin=subprocess.DEVNULL)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("-Duser.home=" + str(jvm_home), (home / "engine-jvm-options").read_text())
            self.assertEqual((home / "runner-jvm-options").read_text().strip(), "-Xmx64m")
            self.assertEqual(jvm_home.stat().st_mode & 0o777, 0o700)
            self.assertTrue((home / "terminated").exists())
        finally:
            self.reap_file(home / "owned.pid")

    def test_matrix_rejects_shared_pinned_port_before_starting_engine(self):
        script, home, env, _root = self.prepare(LISTENING_ENGINE, TOUCH_RUNNER, shell_node=True)
        env.update(UA_REAL_EDITOR_SCENE="matrix", UA_REAL_EDITOR_PORT="50061")
        result = subprocess.run(["bash", str(script)], env=env, capture_output=True,
                                text=True, timeout=5, stdin=subprocess.DEVNULL)
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("shared pinned engine port", result.stderr)
        self.assertFalse((home / "owned.pid").exists())

    def test_unknown_protocol_fails_without_starting_engine(self):
        script, home, env, _root = self.prepare(LISTENING_ENGINE, TOUCH_RUNNER, shell_node=True)
        env["UA_REAL_EDITOR_PROTOCOL"] = "fallback-please"
        result = subprocess.run(["bash", str(script)], env=env, capture_output=True,
                                text=True, timeout=5, stdin=subprocess.DEVNULL)
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertFalse((home / "owned.pid").exists())

    def test_private_tmpdir_removed_and_appdata_hidden(self):
        script, home, env, _root = self.prepare(
            LISTENING_ENGINE, ENV_RUNNER, shell_node=True, tmpdir="/tmp")
        env["VSCODE_APPDATA"] = "/caller/should-not-leak"
        env["VSCODE_PORTABLE"] = "/caller/portable-should-not-leak"
        try:
            result = subprocess.run(
                ["bash", str(script)], env=env, capture_output=True, text=True,
                timeout=10, stdin=subprocess.DEVNULL)
            self.assertEqual(result.returncode, 0, result.stderr)
            seen = (home / "tmpdir-seen").read_text().strip()
            self.assertTrue(seen.startswith("/tmp/real-editor."), seen)
            self.assertNotEqual(os.path.realpath(seen), "/tmp")
            self.assertFalse(Path(seen).exists(), seen)
            self.assertTrue(Path("/tmp").is_dir())
            self.assertFalse((home / "appdata-seen").exists())
        finally:
            self.reap_file(home / "owned.pid")


if __name__ == "__main__":
    unittest.main()
