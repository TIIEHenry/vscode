#!/usr/bin/env bash
# M5 D4 V1-V8 automation harness (Playwright CLI over CDP)
set -euo pipefail

CDP="${CDP:?CDP port required}"
PW_SESSION="${PW_SESSION:-d4-v1v8-$$}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$(dirname "$0")}"

pw() { npx @playwright/cli --s="$PW_SESSION" "$@"; }

# Attach to running Code OSS via CDP
pw attach --cdp="http://127.0.0.1:$CDP" >/dev/null
sleep 5

# Dismiss welcome / trust if present
pw press Escape 2>/dev/null || true
sleep 1

get_layout() {
  pw eval '
(() => {
  const partVisible = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const editorTabs = [...document.querySelectorAll("#workbench\\.parts\\.editor .tabs-container .tab")].map(t => t.getAttribute("aria-label") || t.textContent?.trim()).filter(Boolean);
  const quickChatWidget = !!document.querySelector(".quick-input-widget .interactive-session");
  return {
    sidebar: partVisible(".part.sidebar"),
    conversation: partVisible(".part.conversation"),
    editor: partVisible(".part.editor"),
    sources: partVisible(".part.sources"),
    panel: partVisible(".part.panel"),
    aux: partVisible(".part.auxiliarybar"),
    editorTabs: editorTabs.slice(0, 8),
    quickChatWidget,
    hasWorkbench: !!document.querySelector(".monaco-workbench"),
    title: document.title
  };
})()' --raw 2>/dev/null
}

run_cmd_id() {
  local cmd_id="$1"
  pw press Control+Shift+P
  sleep 0.4
  pw press Control+a
  pw type "$cmd_id"
  sleep 0.4
  pw press Enter
  sleep 1
}

run_palette() {
  local label="$1"
  pw press Control+Shift+P
  sleep 0.4
  pw press Control+a
  pw type ">${label}"
  sleep 0.4
  pw press Enter
  sleep 1
}

mkdir -p "$EVIDENCE_DIR/screenshots"

echo "=== V1 fresh profile layout ==="
V1=$(get_layout)
echo "$V1" | tee "$EVIDENCE_DIR/v1-layout.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v1-fresh.png" 2>/dev/null || true

echo "=== V2 toggle Nav / Conversation / Preview / Sources ==="
for label in \
  "View: Toggle Primary Side Bar Visibility" \
  "View: Toggle Conversation Visibility" \
  "View: Toggle Editor Area Visibility" \
  "View: Toggle Sources Visibility"; do
  run_palette "$label"
  sleep 0.5
done
V2=$(get_layout)
echo "$V2" | tee "$EVIDENCE_DIR/v2-after-toggles.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v2-toggles.png" 2>/dev/null || true

echo "=== V3 hide Preview only ==="
run_palette "View: Toggle Editor Area Visibility"
sleep 1
V3=$(get_layout)
echo "$V3" | tee "$EVIDENCE_DIR/v3-hide-preview.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v3-hide-preview.png" 2>/dev/null || true

echo "=== V4 maximize panel then restore ==="
run_palette "View: Toggle Maximized Panel"
sleep 1
V4max=$(get_layout)
echo "$V4max" | tee "$EVIDENCE_DIR/v4-maximized.json"
run_palette "View: Toggle Maximized Panel"
sleep 1
V4=$(get_layout)
echo "$V4" | tee "$EVIDENCE_DIR/v4-restored.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v4-restored.png" 2>/dev/null || true

echo "=== V5 hide Conversation, open Sessions roster ==="
run_palette "View: Toggle Conversation Visibility"
sleep 1
run_palette "View: Show Sessions"
sleep 1
pw eval '
(() => {
  const row = document.querySelector(".sessions-list-row, .monaco-list-row");
  if (row) { row.click(); return { clicked: true }; }
  return { clicked: false };
})()' --raw 2>/dev/null | tee "$EVIDENCE_DIR/v5-roster-click.json"
sleep 1
V5=$(get_layout)
echo "$V5" | tee "$EVIDENCE_DIR/v5-after-roster.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v5-roster.png" 2>/dev/null || true

echo "=== V6 command routing ==="
run_cmd_id workbench.action.openChat
sleep 1
V6open=$(get_layout)
run_cmd_id workbench.action.chat.openInEditor
sleep 1
V6editor=$(get_layout)
# Quick Chat chord: Ctrl+Shift+Alt+L (Linux); service no-ops in default window
pw press Control+Shift+Alt+L
sleep 1
V6quick=$(get_layout)
echo "{\"openConversation\":$V6open,\"newChatEditor\":$V6editor,\"quickChat\":$V6quick}" | tee "$EVIDENCE_DIR/v6-routing.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v6-routing.png" 2>/dev/null || true

echo "=== V7 reload window ==="
run_palette "Developer: Reload Window"
sleep 10
pw attach --cdp="http://127.0.0.1:$CDP" >/dev/null 2>&1 || true
sleep 5
V7=$(get_layout)
echo "$V7" | tee "$EVIDENCE_DIR/v7-after-reload.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v7-reload.png" 2>/dev/null || true

echo "=== V8 Sources tabs ==="
run_palette "View: Toggle Sources Visibility"
sleep 1
pw eval '
(() => {
  const tabs = [...document.querySelectorAll(".part.sources .tabs-container .tab")].map(t => t.textContent?.trim());
  return { sourcesTabs: tabs };
})()' --raw 2>/dev/null | tee "$EVIDENCE_DIR/v8-sources-tabs.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v8-sources.png" 2>/dev/null || true

echo DONE
