#!/usr/bin/env bash
set -euo pipefail

# Opt-in only. The engine binary and model profile are supplied by the caller;
# this wrapper never writes credentials and never reuses the daily user home.
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOME_DIR="${UNIVERSE_AGENT_HOME:?Set UNIVERSE_AGENT_HOME to an owner-only temporary home}"
WORK_DIR="${UA_REAL_EDITOR_WORKDIR:?Set UA_REAL_EDITOR_WORKDIR to an isolated workspace}"
ENGINE="${UA_ENGINE_BIN:?Set UA_ENGINE_BIN to the production HeadlessServer CLI binary}"
PORT="${UA_REAL_EDITOR_PORT:-50161}"
SCENARIO_OUT="$ROOT/test/scenario/out/runScenario.js"

[[ -x "$ENGINE" ]] || { echo "Engine binary is not executable: $ENGINE" >&2; exit 2; }
[[ -f "$SCENARIO_OUT" ]] || {
  echo "Scenario runner is not compiled: $SCENARIO_OUT" >&2
  echo "Run the repository's test/scenario compile task first." >&2
  exit 2
}
[[ -d "$WORK_DIR" ]] || { echo "Workspace does not exist: $WORK_DIR" >&2; exit 2; }

mkdir -p "$HOME_DIR"
chmod 700 "$HOME_DIR"
engine_pid=""
cleanup() {
  status=$?
  if [[ -n "$engine_pid" ]] && kill -0 "$engine_pid" 2>/dev/null; then
    kill -TERM "$engine_pid" 2>/dev/null || true
    wait "$engine_pid" 2>/dev/null || true
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

(
  cd "$WORK_DIR"
  exec "$ENGINE" \
    --port "$PORT" \
    --bind 127.0.0.1 \
    --no-uds \
    --metrics-port 0 \
    --provider openai
) >"$HOME_DIR/real-editor-engine.log" 2>&1 &
engine_pid=$!

for _ in $(seq 1 60); do
  if [[ -f "$HOME_DIR/server.lock" || -S "$HOME_DIR/server.sock" ]]; then
    break
  fi
  sleep 0.5
done

[[ -f "$HOME_DIR/server.lock" || -S "$HOME_DIR/server.sock" ]] || {
  echo "Production engine did not publish server.lock/server.sock; see $HOME_DIR/real-editor-engine.log" >&2
  exit 1
}

export UNIVERSE_AGENT_HOME="$HOME_DIR"
export VSCODE_SKIP_PRELAUNCH=1
cd "$ROOT"
exec node "$SCENARIO_OUT" test/scenario/scenarios/universe-agent-real-editor.cjs --dev
