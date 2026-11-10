#!/usr/bin/env bash
set -euo pipefail

# Opt-in only. The engine binary and model profile are supplied by the caller;
# this wrapper never writes credentials and never reuses the daily user home.
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOME_DIR="${UNIVERSE_AGENT_HOME:?Set UNIVERSE_AGENT_HOME to an owner-only temporary home}"
WORK_DIR="${UA_REAL_EDITOR_WORKDIR:?Set UA_REAL_EDITOR_WORKDIR to an isolated workspace}"
ENGINE="${UA_ENGINE_BIN:?Set UA_ENGINE_BIN to the production HeadlessServer CLI binary}"
PORT="${UA_REAL_EDITOR_PORT:-50161}"
SCENE="${UA_REAL_EDITOR_SCENE:-legacy}"
PROTOCOL="${UA_REAL_EDITOR_PROTOCOL:-openai-chat}"
JVM_HOME="${UA_REAL_EDITOR_JVM_HOME:-}"
SCENARIO_OUT="$ROOT/test/scenario/out/runScenario.js"

case "$SCENE" in legacy|matrix) ;; *) echo "Unsupported real editor scene" >&2; exit 2 ;; esac
case "$PROTOCOL" in
  anthropic) ENGINE_PROVIDER=anthropic ;;
  openai-chat) ENGINE_PROVIDER=openai ;;
  openai-response) ENGINE_PROVIDER=openai-responses ;;
  *) echo "Unsupported real editor protocol" >&2; exit 2 ;;
esac
[[ "$PORT" =~ ^[0-9]+$ && "$PORT" -gt 0 && "$PORT" -lt 65536 ]] || {
  echo "UA_REAL_EDITOR_PORT must be a TCP port" >&2; exit 2;
}
if [[ "$SCENE" == matrix ]]; then
  [[ "$PORT" != 50061 ]] || { echo "Matrix cannot use the shared pinned engine port" >&2; exit 2; }
  : "${UA_REAL_EDITOR_MODEL:?Matrix requires the full requested model id}"
  : "${UA_REAL_EDITOR_MODEL_PROFILE:?Matrix requires a model profile id}"
  : "${UA_REAL_EDITOR_ORACLE_FILE:?Matrix requires an oracle file}"
  : "${UA_REAL_EDITOR_RESULT_FILE:?Matrix requires a result file}"
  : "${JVM_HOME:?Matrix requires a private JVM user.home}"
fi
if [[ -n "$JVM_HOME" ]]; then
  # Java's environment option parser splits unquoted whitespace. Reject it rather
  # than silently launching against the caller's real home.
  [[ "$JVM_HOME" == /* && ! "$JVM_HOME" =~ [[:space:]] ]] || {
    echo "UA_REAL_EDITOR_JVM_HOME must be an absolute path without whitespace" >&2; exit 2;
  }
  mkdir -p "$JVM_HOME"
  chmod 700 "$JVM_HOME"
fi

[[ -x "$ENGINE" ]] || { echo "Engine binary is not executable: $ENGINE" >&2; exit 2; }
[[ -f "$SCENARIO_OUT" ]] || {
  echo "Scenario runner is not compiled: $SCENARIO_OUT" >&2
  echo "Run the repository's test/scenario compile task first." >&2
  exit 2
}
[[ -d "$WORK_DIR" ]] || { echo "Workspace does not exist: $WORK_DIR" >&2; exit 2; }

# A lock or socket already in this home may belong to a live engine. Do not remove it.
if [[ -e "$HOME_DIR/server.lock" || -e "$HOME_DIR/server.sock" ]]; then
  echo "Refusing to start: $HOME_DIR already has server.lock or server.sock. Leaving it in place; it may belong to a live engine." >&2
  exit 1
fi

mkdir -p "$HOME_DIR"
chmod 700 "$HOME_DIR"
export UNIVERSE_AGENT_HOME="$HOME_DIR"

engine_pid=""
node_pid=""
owned_tmpdir=""

stop_pid() {
  local pid="$1"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill -TERM "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
}

# Foreground node would defer this trap until node exited, so the child would
# never see a signal delivered only to the wrapper. TERM the runner, wait, then
# the engine. Exit status on this path is 128+signal, not the runner's status.
on_signal() {
  local sig="$1"
  stop_pid "$node_pid"
  stop_pid "$engine_pid"
  exit $((128 + sig))
}

cleanup() {
  status=$?
  stop_pid "$engine_pid"
  if [[ -n "$owned_tmpdir" && "$owned_tmpdir" != "/" && "$owned_tmpdir" != "/tmp" ]]; then
    rm -rf "$owned_tmpdir" || true
  fi
  exit "$status"
}

trap 'on_signal 2' INT
trap 'on_signal 15' TERM
trap cleanup EXIT

unset VSCODE_PORTABLE VSCODE_APPDATA

# Caller-provided TMPDIR other than /tmp is left alone, including at cleanup.
need_private_tmpdir=0
tmpdir_value="${TMPDIR:-}"
if [[ -z "$tmpdir_value" ]]; then
  need_private_tmpdir=1
else
  tmpdir_trimmed="${tmpdir_value%/}"
  tmpdir_resolved=""
  if [[ -d "$tmpdir_value" ]]; then
    tmpdir_resolved="$(cd "$tmpdir_value" && pwd -P || true)"
  fi
  if [[ -z "$tmpdir_trimmed" || "$tmpdir_trimmed" == "/tmp" || "$tmpdir_resolved" == "/tmp" ]]; then
    need_private_tmpdir=1
  fi
fi
if [[ "$need_private_tmpdir" -eq 1 ]]; then
  owned_tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/real-editor.XXXXXX")"
  export TMPDIR="$owned_tmpdir"
fi

engine_is_alive() {
  if ! kill -0 "$engine_pid" 2>/dev/null; then
    return 1
  fi
  local proc_stat="" proc_state=""
  { proc_stat=$(<"/proc/$engine_pid/stat"); } 2>/dev/null || true
  if [[ -z "$proc_stat" ]]; then
    return 0
  fi
  proc_state="${proc_stat##*) }"
  proc_state="${proc_state%% *}"
  [[ "$proc_state" != "Z" ]]
}

(
  cd "$WORK_DIR"
  if [[ -n "$JVM_HOME" ]]; then
    export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:+$JAVA_TOOL_OPTIONS }-Duser.home=$JVM_HOME"
  fi
  exec "$ENGINE" \
    --port "$PORT" \
    --bind 127.0.0.1 \
    --no-uds \
    --metrics-port 0 \
    --provider "$ENGINE_PROVIDER"
) >"$HOME_DIR/real-editor-engine.log" 2>&1 &
engine_pid=$!

ready=0
for _ in $(seq 1 60); do
  if ! engine_is_alive; then
    wait "$engine_pid" 2>/dev/null || true
    echo "Production engine exited before listening on 127.0.0.1:$PORT; see $HOME_DIR/real-editor-engine.log" >&2
    exit 1
  fi
  # The editor discovers the engine through server.lock/server.sock, so the
  # port alone is not ready; the port check also rejects a stale lock.
  if [[ -f "$HOME_DIR/server.lock" || -S "$HOME_DIR/server.sock" ]] \
    && (: >/dev/tcp/127.0.0.1/"$PORT") 2>/dev/null; then
    ready=1
    break
  fi
  sleep 0.5
done

if [[ "$ready" -ne 1 ]]; then
  echo "Production engine did not publish server.lock/server.sock and accept TCP on 127.0.0.1:$PORT; see $HOME_DIR/real-editor-engine.log" >&2
  exit 1
fi

export VSCODE_SKIP_PRELAUNCH=1
cd "$ROOT"
node "$SCENARIO_OUT" test/scenario/scenarios/universe-agent-real-editor.cjs --dev &
node_pid=$!
set +e
wait "$node_pid"
node_status=$?
set -e
exit "$node_status"
