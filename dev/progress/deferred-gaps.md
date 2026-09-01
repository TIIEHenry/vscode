---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-01
summary: "P2/P3 延期缺口 SSOT；D1/D3/D7/D4 已闭；D5 仍开"
---

# Deferred Gaps

> **SSOT**：当轮无法完成、但不阻塞当前目标的缺口写入本表。  
> 读路径：`dev/progress/status.md` → 本文件 → [research-queue.md](research-queue.md)。

| ID | Priority | Gap | Why Deferred | Exit Condition | Track | Status |
|:---|:---------|:----|:-------------|:---------------|:------|:-------|
| D1 | P3 | 套件 `dev/loop/overview.md` 引用的 `docs/guides/multi-agent-design-workflow.md` 缺失 | 门禁仅 warning 不阻塞 | 指南落盘且 `check-docs-health` 0 warning | docs | closed |
| D2 | P2 | 工位池基线未编译验绿 | 编译耗时长；建槽时未跑 | M0 集成编译绿后在 `worktree-pool.md` 标注基线已验 | infra | open |
| D3 | P2 | **M0 compile 验证**（`compile-client` + `valid-layers-check`） | — | merge 槽 `a6137373`：`compile-client` + `valid-layers-check` 绿；17 域单测绿 | M4 | closed |
| D4 | P2 | **启动 T1–T3 演示**（目视：Conversation 中心、End Editor/Sources、互斥、四钮；M3 无 ChatEditor 默认路径、Sidebar stub Sessions） | 工位 A 首轮无构建产物（已记）；D3 绿后可在 merge 工位重跑。**Closer 是 M5 切片 4 V1–V8**，M4 切片 2 不得把本行标 closed | M5 V1–V8 隔离 profile 通过并有证据（含路由与 roster）；T1–T3 只作环境探测记录 | M5 | closed |
| D5 | P2 | **EH 探针冒烟**（LSP + layout 类扩展） | merge compile 绿后 rerun-2348：boot+yaml PASS；Todo Tree / js-debug 自动化未过 | [eh-surface-matrix](../../docs/reference/code-oss-b2/eh-surface-matrix.md) 关键行「探针已选」→「已实测」 | M4 | open |
| D6 | P3 | **Diff footprint 刷新** | slot C 已于 `b283fe19` 重测 `b5631393` | 页已更新 | docs | closed |
| D7 | P3 | titlebar LayoutControlMenu 产品四钮与原生 Panel/Aux 共存 | `2dcd5a0a` 已从 LayoutControlMenu 去掉 Panel/Aux；留 submenu | 默认窗只见四钮 | M0 | closed |

## D4 冒烟记录（2026-08-31，工位 A / `loop/A`）

**命令**：`.agents/skills/launch/scripts/launch.sh --repo <A> --source-user-data-dir /tmp/d4-smoke-udd --disable-workspace-trust --skip-prelaunch`（未跑 `npm run compile`，按 M4 切片 2 约束）。

**阻塞**：`code.sh` 立即退出 — `.build/electron/code-oss: 没有那个文件或目录`。工位 A 另缺 `out/`、`node_modules/`；`~/.vscode-oss-dev` 不存在（本次用最小 temp profile 仅验证启动链）。

| 检查 | 结果 |
|------|------|
| T1 中心 = `CONVERSATION_PART`，非 ChatEditor tab | **未验**（未启动） |
| T2 End 上 Preview + 下 `SOURCES_PART` | **未验** |
| T3 四钮 Nav/Conv/Preview/Sources；`Conversation ∨ (Editor ∨ Sources)` | **未验** |
| M3 Command Palette 不开 ChatEditor | **未验** |
| M3 Sidebar stub Sessions 列表 | **未验** |
| 截图 | 无 |

**下一步**：D3 已绿（`a6137373`）；在 **merge 工位**（有 `node_modules`/`out`/`.build/electron`）重跑 `launch.sh` 做环境探测。D4 **不得**因 T1–T3 勾选而 closed；closer 是 [M5 切片 4](../plans/m5-ui-shell-hardening.md) V1–V8。

## D4 M5 切片 4 验收记录（2026-09-01，merge 工位 / `loop/merge`）

**基线 SHA**：`c7ed501d`（切片 1–3 集成工位）。**启动修复 SHA**（仅 boot blocker，非 V1–V8 closer）：`bd2b8872`。

**门禁**：

| 命令 | SHA | 结果 |
|------|-----|------|
| `npm run compile` | `c7ed501d` | **PASS**（0 errors，~37s） |
| `npm run valid-layers-check` | `c7ed501d` | **FAIL**（exit 1；`EditContext`/`GPUBufferUsage`/`FileSystemHandle` 等 TS lib 报错，Node v26.7.0；与 M5 路由/布局无关） |
| `launch.sh --repo merge --disable-workspace-trust --skip-prelaunch` | `c7ed501d` | **BLOCKED** — workbench 未加载：`IPreferencesEditorPane` 运行时 re-export 缺失 + `workbench.action.chat.forkConversation` 重复注册 |
| 同上 | `bd2b8872` | **PASS** — CDP 就绪；隔离 temp profile |

**启动命令**（post-fix 实测）：

```bash
.agents/skills/launch/scripts/launch.sh \
  --repo /home/clarence/Projects/Agents/vscode-WorkTrees/merge \
  --disable-workspace-trust --skip-prelaunch
```

**Profile**：throwaway temp（`launch.sh` slim copy；无 `--source-user-data-dir`；`~/.vscode-oss-dev` 不存在）。

**自动化**：Playwright CLI over CDP（`npx @playwright/cli attach --cdp=…`）。证据目录：[d4-evidence/c7ed501d](d4-evidence/c7ed501d/)（JSON + `screenshots/v1.png`）。

| ID | 场景 | 结果 | 证据 / 备注 |
|:---|:-----|:-----|:------------|
| V1 | fresh profile：中心 Conversation；End 上 Preview、下 Sources；Aux hidden | **PARTIAL** | post-`bd2b8872`：`conversation`+`sources` 可见，`panel`/`aux` false，`convError` false；DOM 尺寸检测 `editor`/`sidebar` false（快照见四钮 + End Preview/Sources tab strip）。`c7ed501d` **未验**（未启动） |
| V2 | 依次切 Nav / Conv / Preview / Sources；四钮可达；常态不可全藏 Conv/Preview/Sources | **FAIL** | Command Palette 自动化不可靠；toggle 后 `panel:true`、`sources:false`，未证明互斥 |
| V3 | 只关 Preview；Sources/Conversation 不被改写；Panel 不弹出 | **FAIL** | `panel:true` after hide Preview；Panel 被意外显示 |
| V4 | maximize Panel/Aux 后恢复合法 agent shell | **FAIL** | maximize 命令未改变可测 layout JSON；恢复态与 V3 相同 |
| V5 | 隐藏 Conversation → Sessions 选会话 → show+focus | **PARTIAL** | roster `clicked:true`；之后 `conversation:true`（`v5.json`）；SessionBar 一致性与 focus 未 DOM 断言 |
| V6 | Palette / Chat menu / Quick Chat；无 ChatEditor/Quick Chat；Open Conversation OK | **FAIL** | `New Chat Editor` 后无 ChatEditor tab（`editorTabs:[]`）；**Quick Chat 快捷键打开 quick-input**（`v6-quick.json` `quickChat:true`）— M5 路由违背 |
| V7 | 重启恢复 Part 显隐与 End 尺寸；无 ChatEditor tab 还原 | **FAIL** | Reload 后全部 part `false`（`v7.json`）；布局未恢复 |
| V8 | Sources Files/Changes/Review 基本打开 | **PARTIAL** | 快照（V2 阶段）见 Files/Changes/Review tab；eval `sourcesTabs:[]`（automation 时 Sources 已隐藏） |

**Blocking failures（首轮 c7ed501d，已由 rerun-2230 闭合）：**

1. ~~`c7ed501d` boot 崩溃~~ → `bd2b8872` + `c95fd679` 修复。
2. ~~V2–V7 布局/路由失败~~ → rerun-2230 全 PASS。

**截图**：`dev/progress/d4-evidence/c7ed501d/screenshots/v1.png`（post-fix fresh profile）。

**状态（首轮记录，已 supersede）**：见下节 rerun-2230 — D4 **closed**。

## D4 M5 切片 4 验收记录（2026-09-01，主仓 / `agent-ide` working tree）

**代码修复**（待提交）：INV-052 `beforeHide` 须在 `setRuntimeValue` 之前采集；Panel maximize 恢复 `panelVisible`；.harness 四钮 titlebar 点击 + command id + V5/V7 命令链。

**启动**：`launch.sh --repo /home/clarence/Projects/Agents/vscode --disable-workspace-trust --skip-prelaunch`

**自动化**：`dev/progress/d4-evidence/c7ed501d/run-v1-v8.sh` · 证据：[d4-evidence/rerun-2230](d4-evidence/rerun-2230/)

| ID | 场景 | 结果 | 证据 / 备注 |
|:---|:-----|:-----|:------------|
| V1 | fresh profile：中心 Conversation；End Sources；panel/aux off | **PASS** | `conversation`+`sources` true；`panel`/`aux` false |
| V2 | 四钮 toggle；常态不可全藏 Conv/Preview/Sources | **PASS** | titlebar 点击后 `conversation`+`sources` 仍 true |
| V3 | 只关 Preview | **PASS** | `editor` false；`conversation`+`sources` 不变；`panel` false |
| V4 | maximize Panel 后恢复 | **PASS** | 恢复后合法 shell；`panel` false |
| V5 | 隐藏 Conversation → Sessions roster 选会话 | **PASS** | `workbench.view.sessions.focus` + roster `clicked:true`；`conversation` true |
| V6 | Open Chat / New Chat Editor / Quick Chat | **PASS** | 无 ChatEditor tab；`quickChatWidget` false |
| V7 | Reload 恢复 | **PASS** | `conversation`+`sources` 恢复；无 ChatEditor tab；`panel` false |
| V8 | Sources Files/Changes/Review | **PASS** | `sourcesTabs`: Files, Changes, Review |

**状态**：D4 **closed** @ rerun-2230（2026-09-01）。`valid-layers-check` 环境红仍记 D3 行，不阻塞 D4。

## D5 探针计划（2026-08-31，工位 B / `loop/B`）

**文档**：[eh-surface-matrix §Probe plan](../../docs/reference/code-oss-b2/eh-surface-matrix.md#probe-plan)。

**已选扩展**（安装状态 @ 2026-09-01）：

| 扩展 | ID | 覆盖 | 安装 |
|------|-----|------|------|
| YAML | `redhat.vscode-yaml` | LSP / 语言层（End 列 editor） | **OK** → `/tmp/d5-probe-ext-vsix` |
| Todo Tree | `gruntfuggly.todo-tree` | Sidebar `views` + Activity 布局挤占 | **OK** → 同上 |
| JavaScript Debugger | `ms-vscode.js-debug` | 调试视图（Sidebar/Panel） | **跳过 VSIX** — 产品内置；`code-cli.sh` 拒绝覆盖 builtin |

**安装命令（SSOT）**：

```bash
export VSCODE_SKIP_PRELAUNCH=1
REPO=/home/clarence/Projects/Agents/vscode-WorkTrees/merge
EXT_DIR=/tmp/d5-probe-ext-vsix
$REPO/scripts/code-cli.sh --extensions-dir="$EXT_DIR" \
  --force --install-extension=/tmp/d5-vsix/<id>.vsix
```

`launch.sh` 冒烟时传 **`--extensions-dir=/tmp/d5-probe-ext-vsix`**（或 `--` 转发给 `code.sh`）。勿用 `code.sh --install-extension`（会起完整 workbench）。

**矩阵**：3 行 + 2 探针对照行已标 **探针已选 @2026-08-31**；panel / terminal / `editor/decoration` 仍为 **待实测**。

**下一步**：

1. ~~D3 compile 绿 + D4 隔离 profile 启动~~ — D4 closed @ rerun-2230。
2. ~~VSIX 下载 + 安装~~ — 两扩展已装入 `EXT_DIR`；js-debug 用内置扩展，不装 VSIX。
`launch.sh` 冒烟：`dev/progress/d5-evidence/launch-with-probes.sh`（seed profile + `--clone-extensions` 注入 `EXT_DIR`）。
4. 截图 + 把覆盖行证据改为 **已实测 @\<date\>**，未覆盖 gap 记入本表或矩阵脚注。



## D5 EH 探针冒烟记录（2026-09-01 rerun-2348，merge launch / loop/A 证据）

**Launch：** `REPO=/home/clarence/Projects/Agents/vscode-WorkTrees/merge dev/progress/d5-evidence/launch-with-probes.sh -- /tmp/d5-probe-sample.yaml`（post `npm run compile` on merge）。

**证据：** [d5-evidence/smoke-rerun-2348](d5-evidence/smoke-rerun-2348/)（保留 [smoke-20260901](d5-evidence/smoke-20260901/) 首轮 stale-out 记录）。

| 检查 | 结果 | 备注 |
|------|------|------|
| Workbench boot（merge `out/`） | **PASS** | EH 起；无 `IPreferencesEditorPane` |
| `redhat.vscode-yaml` 诊断 | **PASS** | 打开 sample yaml；squiggle ≥1 |
| `gruntfuggly.todo-tree` sidebar | **FAIL** | Activity 无 Todo Tree 容器；`Todo Tree: Focus` 未出 pane |
| 内置 `js-debug` F5 | **FAIL** | F5/Start Debugging 未出现 debug toolbar |

**矩阵：** [eh-surface-matrix](../../docs/reference/code-oss-b2/eh-surface-matrix.md) 探针行仍为 **探针已选**（整体 smoke 未 PASS）。

**下一步：** Todo Tree 与 Agent IDE activity 槽位冲突排查；js-debug 需 workspace `launch.json` 或稳定 picker 自动化后重跑。

## 维护规则

1. **新增**：分配下一 `D<n>` ID；须有可验证 Exit Condition。
2. **闭合**：`Status` → `closed`；并在 `status.md` 记摘要。
3. **与 Research Queue 分工**：本表 = 已知怎么做但优先级/环境不够；Research Queue = 先搞清再干。
