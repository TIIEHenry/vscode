#!/usr/bin/env bash
# M5 D4 V1-V8 automation harness (Playwright CLI over CDP)
set -euo pipefail

CDP="${CDP:?CDP port required}"
PW_SESSION="${PW_SESSION:-d4-v1v8-$$}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$(dirname "$0")}"
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

pw() { npx @playwright/cli -s="$PW_SESSION" "$@"; }

# Attach and select workbench tab
pw attach --cdp="http://127.0.0.1:$CDP" >/dev/null
pw tab-select 1 >/dev/null
sleep 5

# Dismiss welcome / trust if present
pw press Escape 2>/dev/null || true
sleep 1

get_layout() {
  pw eval '
(() => {
  const body = document.body;
  const partVisible = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const bodyClasses = body.className.split(/\s+/).filter(c => c.startsWith("no") || c.includes("maximized"));
  const editorTabs = [...document.querySelectorAll("#workbench\\.parts\\.editor .tabs-container .tab")].map(t => t.getAttribute("aria-label") || t.textContent?.trim()).filter(Boolean);
  const chatEditorTabs = editorTabs.filter(t => /chat|conversation/i.test(t));
  return {
    bodyClasses,
    sidebar: partVisible(".part.sidebar"),
    conversation: partVisible(".part.conversation"),
    editor: partVisible(".part.editor"),
    sources: partVisible(".part.sources"),
    panel: partVisible(".part.panel"),
    aux: partVisible(".part.auxiliarybar"),
    editorTabs: editorTabs.slice(0, 8),
    chatEditorTabs,
    hasWorkbench: !!document.querySelector(".monaco-workbench"),
    title: document.title
  };
})()' 2>/dev/null | sed -n '/^### Result$/,/^### Ran/p' | grep -v '^###' | head -1
}

run_cmd() {
  local cmd="$1"
  pw press Control+Shift+P
  sleep 0.5
  pw press Control+a
  pw type_text "$cmd"
  sleep 0.5
  pw press Enter
  sleep 1.5
}

mkdir -p "$EVIDENCE_DIR/screenshots"

echo "=== V1 fresh profile layout ==="
V1=$(get_layout)
echo "$V1" | tee "$EVIDENCE_DIR/v1-layout.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v1-fresh.png" 2>/dev/null || true

echo "=== V2 toggle Nav / Conversation / Preview / Sources ==="
for label in Navigator Conversation Preview Sources; do
  run_cmd ">View: Toggle $label Visibility" || run_cmd ">Toggle $label"
  sleep 0.8
done
V2=$(get_layout)
echo "$V2" | tee "$EVIDENCE_DIR/v2-after-toggles.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v2-toggles.png" 2>/dev/null || true

echo "=== V3 hide Preview only ==="
run_cmd ">View: Toggle Preview Visibility"
sleep 1
V3=$(get_layout)
echo "$V3" | tee "$EVIDENCE_DIR/v3-hide-preview.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v3-hide-preview.png" 2>/dev/null || true

echo "=== V4 maximize panel then restore ==="
run_cmd ">View: Toggle Maximized Panel"
sleep 1
V4max=$(get_layout)
echo "$V4max" | tee "$EVIDENCE_DIR/v4-maximized.json"
run_cmd ">View: Toggle Maximized Panel"
sleep 1
V4=$(get_layout)
echo "$V4" | tee "$EVIDENCE_DIR/v4-restored.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v4-restored.png" 2>/dev/null || true

echo "=== V5 hide Conversation, open Sessions roster ==="
run_cmd ">View: Toggle Conversation Visibility"
sleep 1
run_cmd ">View: Show Sessions"
sleep 1
# Click first session row if any
pw eval '
(() => {
  const row = document.querySelector(".sessions-list-row, .monaco-list-row");
  if (row) { row.click(); return { clicked: true }; }
  return { clicked: false };
})()' 2>/dev/null | sed -n '/^### Result$/,/^### Ran/p' | grep -v '^###' | head -1 | tee "$EVIDENCE_DIR/v5-roster-click.json"
sleep 1
V5=$(get_layout)
echo "$V5" | tee "$EVIDENCE_DIR/v5-after-roster.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v5-roster.png" 2>/dev/null || true

echo "=== V6 command palette routing ==="
run_cmd ">Open Conversation"
sleep 1
V6open=$(get_layout)
run_cmd ">New Chat Editor"
sleep 1
V6editor=$(get_layout)
pw press Control+Shift+P
sleep 0.3
pw press Escape
sleep 0.3
# Quick chat chord Ctrl+Alt+I on Linux
pw press Control+Alt+I
sleep 1
V6quick=$(get_layout)
echo "{\"openConversation\":$V6open,\"newChatEditor\":$V6editor,\"quickChat\":$V6quick}" | tee "$EVIDENCE_DIR/v6-routing.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v6-routing.png" 2>/dev/null || true

echo "=== V7 reload window ==="
USER_DATA_DIR="${USER_DATA_DIR:-}"
if [[ -n "$USER_DATA_DIR" ]]; then
  run_cmd ">Developer: Reload Window"
  sleep 8
  pw tab-select 1 >/dev/null 2>&1 || pw attach --cdp="http://127.0.0.1:$CDP" >/dev/null
  sleep 3
  V7=$(get_layout)
  echo "$V7" | tee "$EVIDENCE_DIR/v7-after-reload.json"
  pw screenshot --filename="$EVIDENCE_DIR/screenshots/v7-reload.png" 2>/dev/null || true
else
  echo '{"skipped":"no USER_DATA_DIR"}' | tee "$EVIDENCE_DIR/v7-after-reload.json"
fi

echo "=== V8 Sources tabs ==="
run_cmd ">View: Show Sources"
sleep 1
pw eval '
(() => {
  const tabs = [...document.querySelectorAll(".part.sources .tabs-container .tab")].map(t => t.textContent?.trim());
  return { sourcesTabs: tabs };
})()' 2>/dev/null | sed -n '/^### Result$/,/^### Ran/p' | grep -v '^###' | head -1 | tee "$EVIDENCE_DIR/v8-sources-tabs.json"
pw screenshot --filename="$EVIDENCE_DIR/screenshots/v8-sources.png" 2>/dev/null || true

echo DONE
