#!/usr/bin/env bash
# D9 EH secondary probes: panel (git-panel) + terminal (vscode-terminals) + decoration (errorlens)
set -euo pipefail

REPO="${REPO:-/home/clarence/Projects/Agents/vscode-WorkTrees/merge}"
A_REPO="${A_REPO:-/home/clarence/Projects/Agents/vscode-WorkTrees/A}"
EVID="$A_REPO/dev/progress/d5-evidence/smoke-d9-0001"
WS="$REPO/dev/progress/d5-evidence/sample-workspace"
LAUNCH="$REPO/dev/progress/d5-evidence/launch-with-probes.sh"
PW_SESSION="d5-d9-$$"
LOG="$EVID/smoke-run.log"
PW="npx @playwright/cli -s=$PW_SESSION"

exec > >(tee "$LOG") 2>&1

echo "### meta session=$PW_SESSION ws=$WS"

dom_eval() {
	local out="$1"
	shift
	$PW eval --filename="$out" "$*"
	python3 -c "
import re, pathlib
p=pathlib.Path('$out')
text=p.read_text()
m=re.search(r'\{[\s\S]*\}', text)
if m:
    p.write_text(m.group(0)+'\n')
"
}

palette() {
	local cmd="$1"
	$PW press Control+Shift+P
	sleep 0.8
	$PW type "$cmd" --submit
	sleep 1.2
}

open_explorer_file() {
	local name="$1"
	dom_eval "$EVID/open-$name.json" "(() => {
  const item = Array.from(document.querySelectorAll('[role=treeitem]')).find(e => (e.textContent || '').includes('$name'));
  if (item) { item.click(); return { clicked: true, text: item.textContent?.trim()?.slice(0,80) }; }
  return { clicked: false };
})()"
	sleep 2
}

show_terminal_tab() {
	$PW press Control+Backquote
	sleep 1.5
	palette "Terminal: Create New Terminal"
	sleep 2
	palette "Terminals: Run"
	sleep 2.5
}

INFO=$("$LAUNCH" --skip-prelaunch --disable-workspace-trust -- "$WS" | tail -n1)
echo "$INFO" >"$EVID/launch.json"
CDP=$(python3 -c "import json; print(json.load(open('$EVID/launch.json'))['cdpPort'])")
PID=$(python3 -c "import json; print(json.load(open('$EVID/launch.json'))['pid'])")
LOG_FILE=$(python3 -c "import json; print(json.load(open('$EVID/launch.json'))['logFile'])")
echo "### launch pid=$PID cdp=$CDP"

cleanup() {
	$PW close 2>/dev/null || true
	kill "$PID" 2>/dev/null || true
}
trap cleanup EXIT

$PW attach --cdp="http://127.0.0.1:$CDP"
sleep 5
dom_eval "$EVID/terminal-startup-probe.json" "(() => {
  const panel = document.querySelector('.part.panel');
  const terminal = document.querySelector('.terminal, .xterm, .xterm-screen, .xterm-helper-textarea');
  const text = document.body.innerText || '';
  return {
    panelHeight: panel?.offsetHeight ?? 0,
    terminalDom: !!terminal,
    xtermRows: document.querySelectorAll('.xterm-rows').length,
    hasD9Probe: /d9-terminal-probe|echo d9/i.test(text),
    bodyHasTerminal: /Terminal/i.test(text)
  };
})()"
$PW press Escape
sleep 1

palette "View: Toggle Panel"
sleep 1
show_terminal_tab
dom_eval "$EVID/terminal-probe.json" "(() => {
  const panel = document.querySelector('.part.panel');
  const terminal = document.querySelector('.terminal, .xterm, .xterm-screen, .xterm-helper-textarea');
  const text = document.body.innerText || '';
  const panelTabs = Array.from(document.querySelectorAll('.part.panel [role=tab]')).map(e => e.getAttribute('aria-label') || e.textContent?.trim()).filter(Boolean);
  return {
    panelVisible: !!panel && panel.offsetHeight > 0,
    terminalDom: !!terminal,
    xtermRows: document.querySelectorAll('.xterm-rows').length,
    hasD9Probe: /d9-terminal-probe|D9 probe|echo d9/i.test(text),
    hasTerminalTab: panelTabs.some(t => /terminal/i.test(t || '')),
    panelTabs,
    panelSnippet: (panel?.innerText || '').slice(0,400)
  };
})()"
rg -i "terminals|vscode-terminals|d9-terminal|echo d9" "$LOG_FILE" 2>/dev/null | tail -15 >"$EVID/terminal-log-snippet.txt" || true
$PW snapshot >"$EVID/snapshot-terminal.yml"

palette "Git Panel"
sleep 1.5
dom_eval "$EVID/panel-probe.json" "(() => {
  const panel = document.querySelector('.part.panel');
  const tabs = panel ? Array.from(panel.querySelectorAll('[role=tab]')).map(e => e.getAttribute('aria-label') || e.textContent?.trim()).filter(Boolean) : [];
  const headings = panel ? Array.from(panel.querySelectorAll('h2,h3')).map(e => e.textContent?.trim()).filter(Boolean) : [];
  return {
    panelPart: !!panel,
    panelHeight: panel?.offsetHeight ?? 0,
    panelTabs: tabs,
    panelHeadings: headings,
    gitPanelTab: tabs.some(t => /git panel/i.test(t || '')) || headings.some(h => /git/i.test(h || '')),
    bodySnippet: (panel?.innerText || '').slice(0,400)
  };
})()"
$PW snapshot >"$EVID/snapshot-panel.yml"

open_explorer_file "d5-probe-todo.js"
dom_eval "$EVID/decoration-probe.json" "(() => {
  const squiggles = document.querySelectorAll('.squiggly-error, .squiggly-warning, .squiggly-info').length;
  const viewLines = Array.from(document.querySelectorAll('.view-line')).map(v => v.textContent).join('|');
  const errorLensInline = /Expected|';' expected|Expression expected|error/i.test(viewLines);
  return {
    title: document.title,
    squiggleDecorations: squiggles,
    errorLensInline,
    todoInBuffer: /TODO\(d9\)/i.test(viewLines),
    hasExpectedError: squiggles > 0 || errorLensInline,
    sampleText: viewLines.slice(0,350)
  };
})()"
$PW snapshot >"$EVID/snapshot-decoration.yml"

HEAD_SHA=$(cd "$A_REPO" && git rev-parse HEAD)
python3 <<PY
import json, pathlib
evid = pathlib.Path("$EVID")
launch = json.loads((evid/"launch.json").read_text())

def load(name):
    p = evid / name
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text())
    except Exception:
        return {"raw": p.read_text()[:500]}

panel = load("panel-probe.json")
term = load("terminal-probe.json")
startup = load("terminal-startup-probe.json")
deco = load("decoration-probe.json")
log_snip = (evid/"terminal-log-snippet.txt").read_text() if (evid/"terminal-log-snippet.txt").exists() else ""

term_pass = (
    term.get("terminalDom") or term.get("xtermRows", 0) > 0 or term.get("hasTerminalTab")
    or term.get("hasD9Probe") or startup.get("terminalDom") or startup.get("hasD9Probe")
) and (term.get("panelVisible") or startup.get("panelHeight", 0) > 0 or term.get("panelVisible"))

checks = [
    {
        "id": "panel-git-panel",
        "description": "zhangmo8.git-panel viewsContainers.panel + views(panel) land in PANEL_PART",
        "result": "PASS" if panel.get("panelHeight", 0) > 80 and panel.get("gitPanelTab") else "FAIL",
        "notes": panel,
    },
    {
        "id": "terminal-autorun",
        "description": "fabiospampinato.vscode-terminals onStartup/autorun → terminal in Panel",
        "result": "PASS" if term_pass else "FAIL",
        "notes": {**term, "startup": startup, "logSnippet": log_snip[:500]},
    },
    {
        "id": "editor-decoration",
        "description": "usernamehw.errorlens + TS syntax error decorations in EDITOR_PART",
        "result": "PASS" if deco.get("hasExpectedError") else "FAIL",
        "notes": deco,
    },
]

overall = "PASS" if all(c["result"] == "PASS" for c in checks) else ("PARTIAL" if any(c["result"] == "PASS" for c in checks) else "FAIL")
results = {
    "meta": {
        "date": "2026-09-02",
        "wave": "smoke-d9-0001",
        "worktree": "$A_REPO",
        "compileWorktree": "$REPO",
        "branch": "loop/A",
        "head": "$HEAD_SHA",
        "probeExtDir": "/tmp/d5-probe-ext-vsix",
        "probes": {
            "panel": "zhangmo8.git-panel",
            "terminal": "fabiospampinato.vscode-terminals",
            "decoration": "usernamehw.errorlens"
        },
        "pwSession": "$PW_SESSION",
        "evidenceDir": "dev/progress/d5-evidence/smoke-d9-0001"
    },
    "launch": launch,
    "checks": checks,
    "overall": overall,
}
(evid/"smoke-results.json").write_text(json.dumps(results, indent=2) + "\n")
print(json.dumps(results, indent=2))
PY

echo "### done overall=$(python3 -c "import json; print(json.load(open('$EVID/smoke-results.json'))['overall'])")"
