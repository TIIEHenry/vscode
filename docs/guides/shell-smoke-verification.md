---
title: "壳冒烟验证指南：隔离 profile 启动 + Playwright over CDP"
type: guide
status: accepted
phase: N/A
updated: 2026-09-02
summary: "把 D4 V1–V8 与 D5 EH 探针的可复用流程提成指南：launch.sh 隔离启动、CDP 端口、Playwright CLI attach、V1–V8 场景清单、探针扩展安装、证据落盘约定；M6 验收直接复用"
---

# 壳冒烟验证指南

> 返回 [指南索引](INDEX.md)。历史记录与首轮失败分析在 [deferred-gaps](../../dev/progress/deferred-gaps.md) D4 / D5 段；本页只写**怎么复现**。证据目录：`dev/progress/d4-evidence/`、`dev/progress/d5-evidence/`。

## 1. 什么时候跑

- 改了 `layout.ts`、四钮、Part 显隐、Chat 路由、Sources tab、Conversation session 窗口 → 跑 V1–V8。
- 改了 Activity / Sidebar 容器、`viewsContainers`、EH 相关注册 → 追加 EH 探针。
- M6 引擎波每个切片的验收按 status.md 要求「D4 式隔离 profile 验收」，即本页流程 + 该切片自己的断言。

## 2. 前置

1. 在**有构建产物**的工位跑（`out/`、`node_modules/`、`.build/electron/`）。历史上 merge 工位 `/home/clarence/Projects/Agents/vscode-WorkTrees/merge` 满足；新工位先 `npm run compile`。
2. Node 版本按 `.nvmrc`（24.18.0）。`valid-layers-check` 在 v26 下环境红（[D8](../../dev/progress/deferred-gaps.md)），与冒烟无关但别混报。
3. `npx @playwright/cli` 可用。

## 3. 启动（隔离 profile）

```bash
REPO=/path/to/vscode-checkout
"$REPO/.agents/skills/launch/scripts/launch.sh" \
  --repo "$REPO" \
  --disable-workspace-trust \
  --skip-prelaunch \
  -- <可选：要打开的文件夹或文件>
```

- 默认从 `~/.vscode-oss-dev`（或 `$CODE_OSS_DEV_AUTHED_USER_DATA_DIR`）做**瘦拷贝**到临时 user-data-dir；**源目录必须存在**，否则脚本 `exit 2`。不想带任何账号态就先 `mkdir` 一个空目录再传 `--source-user-data-dir <该目录>`。
- 默认 extensions 目录为空（最快、无第三方干扰）；要带扩展用 `--clone-extensions`（复制源 `extensions/`）或 `--full`。
- 脚本向 stdout 打印一行 JSON（含 `cdpPort` 及 EH / main 调试端口与路径），日志走 stderr。**记下 `cdpPort`。**
- 每次启动都是独立 `--shared-data-dir`，可与开发中的实例并存。

## 4. 附着与断言

```bash
export CDP=<launch.sh 输出 JSON 的 cdpPort>
export EVIDENCE_DIR=dev/progress/d4-evidence/<sha-or-tag>
mkdir -p "$EVIDENCE_DIR"
bash dev/progress/d4-evidence/c7ed501d/run-v1-v8.sh
```

`run-v1-v8.sh` 用 `npx @playwright/cli --s=<session> attach --cdp=http://127.0.0.1:$CDP`，随后 `pw eval` 读取 DOM：`.part.conversation` / `.part.editor` / `.part.sources` / `.part.panel` / `.part.auxiliarybar` 的可见性、`#workbench.parts.editor` tab 列表、Quick Chat widget 是否存在；四钮通过 titlebar 元素点击；roster 通过 `workbench.view.sessions.focus` 命令 + 行点击。每步落一个 `v<N>*.json`，截图在 `screenshots/`。

手工补验时用同一 `pw eval` 片段（见脚本 `get_layout`），不要靠肉眼判断 Part 显隐。

## 5. V1–V8 场景（PASS 判据）

| ID | 场景 | PASS |
|----|------|------|
| V1 | fresh profile 首屏 | `conversation` + `sources` 可见；`panel` / `aux` 不可见；无 ChatEditor tab |
| V2 | 依次点四钮 | 每钮可达；任何组合下 `conversation ∨ editor ∨ sources` 至少一个 true |
| V3 | 只关 Preview | `editor` false；`conversation` / `sources` 不变；**`panel` 不被强制弹出** |
| V4 | maximize Panel 再恢复 | 恢复后回到合法壳；`panel` false |
| V5 | 隐藏 Conversation → Sessions roster 选会话 | Part 重新可见并聚焦；SessionBar 标题一致 |
| V6 | Open Chat / New Chat Editor / Quick Chat 命令 | 无 ChatEditor tab（`editorTabs` 不含 chat）；`quickChatWidget` false；焦点落 Conversation |
| V7 | Reload | `conversation` / `sources` 显隐恢复；无 ChatEditor 还原；`panel` false |
| V8 | Sources 三 tab | `sourcesTabs` = Files, Changes, Review |

任一 FAIL 直接记入 [deferred-gaps](../../dev/progress/deferred-gaps.md)，附 `v<N>.json` 与截图路径；不得把「代码已落」当 PASS。

## 6. EH 探针（D5 流程）

```bash
# 一次性：装探针 VSIX 到独立目录（勿用 code.sh --install-extension，会起完整 workbench）
export VSCODE_SKIP_PRELAUNCH=1
EXT_DIR=/tmp/d5-probe-ext-vsix
"$REPO/scripts/code-cli.sh" --extensions-dir="$EXT_DIR" --force --install-extension=/tmp/d5-vsix/<id>.vsix

# 启动：把 EXT_DIR 作为 seed profile 的 extensions 注入
REPO=$REPO dev/progress/d5-evidence/launch-with-probes.sh -- dev/progress/d5-evidence/sample-workspace
```

已选探针与判据：`redhat.vscode-yaml`（打开 yaml 见诊断 squiggle）、`gruntfuggly.todo-tree`（Activity **TODOs** 段 → sidebar「TODOs: Tree」；产品预留槽位与扩展共用）、内置 `js-debug`（需要 `sample-workspace/.vscode/launch.json`，F5 后见 debug toolbar）。结果回写 [eh-surface-matrix](../reference/code-oss-b2/eh-surface-matrix.md)「已实测 @date」。panel / terminal / `editor/decoration` 探针尚未选（[D9](../../dev/progress/deferred-gaps.md)）。

## 7. 证据落盘约定

- 目录名 = 被测 SHA 或 `rerun-<HHMM>` / `smoke-<tag>`；含 `README.md`（写 SHA、命令、结果表）或在 deferred-gaps 段落里登记。
- 不留未跟踪目录（D11 教训）：跑完即 `git add` 或删除。
- 状态翻转（open → closed）后按 [DOCUMENTATION.md 规则 3c](../DOCUMENTATION.md) 扫知识层改口。

## 8. 已知坑

- `c7ed501d` 首轮 boot 崩溃（`IPreferencesEditorPane` 运行时 re-export 缺失、`workbench.action.chat.forkConversation` 重复注册）——workbench 起不来时先看 renderer console，不是 layout 问题。
- Command Palette 自动化不可靠；四钮用 titlebar 元素点击或直接执行命令 id。
- INV-052 `beforeHide` 必须在 `setRuntimeValue` 之前采集，否则 V3 会把 Panel 弹出（rerun-2230 修复）。
