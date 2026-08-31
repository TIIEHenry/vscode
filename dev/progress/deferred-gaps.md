---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-08-31
summary: "P2/P3 延期缺口 SSOT；D1/D3/D7 已闭；D4/D5 仍开；D4 closer 为 M5 切片 4 V1–V8"
---

# Deferred Gaps

> **SSOT**：当轮无法完成、但不阻塞当前目标的缺口写入本表。  
> 读路径：`dev/progress/status.md` → 本文件 → [research-queue.md](research-queue.md)。

| ID | Priority | Gap | Why Deferred | Exit Condition | Track | Status |
|:---|:---------|:----|:-------------|:---------------|:------|:-------|
| D1 | P3 | 套件 `dev/loop/overview.md` 引用的 `docs/guides/multi-agent-design-workflow.md` 缺失 | 门禁仅 warning 不阻塞 | 指南落盘且 `check-docs-health` 0 warning | docs | closed |
| D2 | P2 | 工位池基线未编译验绿 | 编译耗时长；建槽时未跑 | M0 集成编译绿后在 `worktree-pool.md` 标注基线已验 | infra | open |
| D3 | P2 | **M0 compile 验证**（`compile-client` + `valid-layers-check`） | — | merge 槽 `a6137373`：`compile-client` + `valid-layers-check` 绿；17 域单测绿 | M4 | closed |
| D4 | P2 | **启动 T1–T3 演示**（目视：Conversation 中心、End Editor/Sources、互斥、四钮；M3 无 ChatEditor 默认路径、Sidebar stub Sessions） | 工位 A 首轮无构建产物（已记）；D3 绿后可在 merge 工位重跑。**Closer 是 M5 切片 4 V1–V8**，M4 切片 2 不得把本行标 closed | M5 V1–V8 隔离 profile 通过并有证据（含路由与 roster）；T1–T3 只作环境探测记录 | M5 | open |
| D5 | P2 | **EH 探针冒烟**（LSP + layout 类扩展） | 探针已选（2026-08-31）；未安装/未跑；依赖 D4 启动 | [eh-surface-matrix](../../docs/reference/code-oss-b2/eh-surface-matrix.md) 关键行「探针已选」→「已实测」 | M4 | open |
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

## D5 探针计划（2026-08-31，工位 B / `loop/B`）

**文档**：[eh-surface-matrix §Probe plan](../../docs/reference/code-oss-b2/eh-surface-matrix.md#probe-plan)。

**已选扩展**（尚未安装）：

| 扩展 | ID | 覆盖 |
|------|-----|------|
| YAML | `redhat.vscode-yaml` | LSP / 语言层（End 列 editor） |
| Todo Tree | `gruntfuggly.todo-tree` | Sidebar `views` + Activity 布局挤占 |
| JavaScript Debugger | `ms-vscode.js-debug` | 调试视图（Sidebar/Panel） |

**矩阵**：3 行 + 2 探针对照行已标 **探针已选 @2026-08-31**；panel / terminal / `editor/decoration` 仍为 **待实测**。

**下一步**：

1. D3 compile 绿 + D4 隔离 profile 启动（同 `launch.sh` 工位）。
2. 在 temp profile 安装上表三扩展（`code --install-extension <id>` 或 Extensions 视图）。
3. 打开含 `.yaml` 与 `// TODO` 注释的样例仓；YAML 文件在 End Preview 验 LSP；Todo Tree 验 Sidebar/Activity；对样例 `.js` F5 验调试视图。
4. 截图 + 把覆盖行证据改为 **已实测 @\<date\>**，未覆盖 gap 记入本表或矩阵脚注。

## 维护规则

1. **新增**：分配下一 `D<n>` ID；须有可验证 Exit Condition。
2. **闭合**：`Status` → `closed`；并在 `status.md` 记摘要。
3. **与 Research Queue 分工**：本表 = 已知怎么做但优先级/环境不够；Research Queue = 先搞清再干。
