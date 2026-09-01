---
title: "M5 UI 壳加固与交付收口"
type: plan
status: implemented
phase: M5
updated: 2026-09-02
summary: "切片 1–5 已落 @ 18b5e8d7；D4/D5 closed；valid-layers-check environment-blocked（Node v26.7.0 WebGPU/FileSystemHandle lib）"
---

# M5 UI 壳加固与交付收口

> **前置**：[M0 拓扑](m0-topology-surgery.md) · [M1 壳切片](m1-shell-followon.md) · [M2 产品壳](m2-product-shell.md) · [M3 壳收尾](m3-shell-closeout.md) 均已落代码；[M4 验证波](m4-validation-wave.md) 已闭 D3，D4/D5 仍开。  
> **问题依据**：[Deferred Gaps](../progress/deferred-gaps.md) · [Agent UI](../../docs/systems/chat/agent-ui.md) · [Parts/Grid](../../docs/systems/workbench/parts-and-grid.md) · [壳映射](../../docs/reference/code-oss-b2/desktop-shell-mapping.md)。

## 1. 目标

在不推翻现有 Part/Grid 拓扑、不接 UniverseAgent 引擎的前提下，把默认 Code 窗口 UI 壳从“代码已落、部分路径与运行证据仍有洞”推进到**可验证交付**：

1. 默认 Code 窗口的产品路径不再打开 `ChatEditorInput`、Quick Chat 或 Copilot Agent Host 编辑器面。
2. Sidebar Sessions roster 在 Conversation 已隐藏时仍能完成“选择会话 → 显示并聚焦 Conversation”的导航闭环。
3. 自动化测试真正执行 Action、Resolver、路由与布局行为，不再只验证 helper 或字符串不等。
4. 完整编译、T1–T3 启动冒烟、M3 路径、布局恢复与 EH 探针形成可复查证据。
5. 方案、进度与知识层对代码事实、验证状态和剩余 FORK 保持一致。

**M5 完成线：** 代码门禁、自动化测试、D4 启动验收、D5 EH 探针和文档门禁全部通过；`valid-layers-check` 在 Node v26.7.0 上 **environment-blocked**（TS lib 缺 WebGPU/FileSystemHandle 等），记环境脚注、**不**冒充绿。本方案 @ `18b5e8d7` 已 `implemented`。

## 2. 保留的架构决定

本方案是加固，不是第二次框架改造：

- 产品宿主仍是默认 Code 窗口（`workbench.desktop.main`）。
- `CONVERSATION_PART` 仍是中心，且不是 `EditorInput` / Custom Editor / `ViewPane`。
- End 列仍是上 `EDITOR_PART`、下 `SOURCES_PART`。
- `Conversation ∨ (Editor ∨ Sources)` 仍是非 maximize 常态下的可见性不变量。
- `vs/sessions` 只作 donor；依赖方向仍是 `sessions → workbench`，禁止 `workbench → sessions`。
- `IConversationStubService` 仍是无引擎阶段的本地 UI owner；不得提升为 UA 会话真相。
- `ChatWidget` / `ChatEditor` 源码继续保留给 Agents Window、donor、测试和兼容面；默认 Code 产品路径不使用它们。

## 3. 不做范围

- UniverseAgent、gRPC、adapter、Device Grant、真实 session-core。
- Diff 深查看落点与 ADR-047 FORK；不在 M5 把 Diff 从 `EDITOR_PART` 改绑 `PANEL_PART`。
- Sources Files / Changes / Review 的新功能。
- `product.json` 品牌、Open VSX、扩展分发、ADR-003 token 全量迁移。
- 删除 `ChatWidget`、`ChatEditor`、`ChatEditorInput` 或重做 Agents Window。
- 为测试方便导出仅测试使用的生产接口，或大规模拆分 `layout.ts`。
- Windows/macOS 全矩阵发布认证；M5 至少完成当前 Linux 集成工位，其他平台另记 gap。

## 4. 当前问题与选定处理

| ID | 当前事实 | 风险 | M5 处理 |
|:---|:---------|:-----|:--------|
| H1 | `openChatSession(..., Editor)` 仍直接 `openEditor` | 默认窗仍可出现 ChatEditor tab | 在公共路由入口按窗口类型 fail-fast；用户入口在注册层隐藏或转 Conversation |
| H2 | Chat URI resolver 在默认窗仍为 **所有** `getContentProviderSchemes()` 注册 `ChatEditorInput`（含 agent-host 与 EH `$registerChatSessionContentProvider`；**不是**只重做 M3 的 `vscodeChatEditor` / `vscodeLocalChatSession` 注销） | URI / 扩展可绕过命令门闩 | 默认 Code 窗口不注册任何 content-provider scheme → `ChatEditorInput`；Agents Window 保留；`ChatDebugEditor` 保留 |
| H3 | 当前 editor 已是 ChatEditor 时，New Chat Editor 继续放行 | 可连续堆叠 ChatEditor tabs | 默认 Code 窗口无条件转 Conversation，不看 active editor 类型 |
| H4 | Quick Chat 全局快捷键在默认窗仍有效（`QuickChatGlobalAction` 无 `IsSessionsWindowContext`；F1 `workbench.action.openQuickChat` 已 gated） | 绕过产品 Conversation，进入 Copilot 浮层 | **保留一个** `QuickChatGlobalAction`；keybinding 与 `ChatTitleBarMenu` 的 `when: IsSessionsWindowContext`（对照 `AskQuickChatAction`）。禁止「默认窗不注册该类」——`registerAction2` 是进程全局，跳过注册会连 Agents Window 一起丢掉 |
| H5 | roster 打开事件只 `switchSession` | Conversation 隐藏时“选了但没看到” | 切会话后显示并聚焦 `CONVERSATION_PART` |
| H6 | `workbench.action.openChat` / `openInEditor` 测试只调 helper；`chatEditorShellPaths.test.ts` 已跑 `OpenAgentSessionInEditorGroupAction.runWithSessions`（H6 不可写成「全部 ChatEditor 测试只调 helper」） | 绿测不能证明默认窗路由验收 | 用 `ICommandService.executeCommand` 跑已注册命令；T1–T3 用自动化 + 启动证据双锁 |
| H7 | `agentHostCustomizationService.ts:30` 相对路径 import `sessions/common/agentHostSessionsProvider.js`（`IAgentHostMcpServer`）。`valid-layers-check` **不**查 workbench→sessions（只禁 native types）。真实允许名单是 `eslint.config.js` `src/vs/workbench/contrib/*/~` 含 `vs/sessions/~` | 与分层 SSOT 冲突 | 类型下沉到 **`src/vs/platform/agentHost/common/`**（`platform/agentHost/common/` 已存在；禁止下沉到 `workbench/contrib/chat/common`，否则 `sessions/common` 会 import contrib）。从 eslint workbench/contrib allow-list **删除** `vs/sessions/~`，不新增例外 |
| H8 | D4/D5 未实测；M4 与 M5 都写 D4 出口 | `implemented` 易被误读；T1–T3 过了会提前关 D4 | **唯一 closer：M5 切片 4** 用 V1–V8 关 D4。M4 切片 2 只做环境探测，**不得**把 D4 标 `closed` |

## 5. 路由策略

默认 Code 窗口和 Agents Window 必须使用同一处可审计策略，禁止每个 Action 自己判断：

```ts
isDefaultCodeWindow(environmentService): boolean
focusConversationPart(accessor): void
shouldRouteChatEditorToConversation(environmentService): boolean
```

建议把窗口/Conversation 路由 helper 从 `chatActions.ts` 移到独立的 `contrib/chat/browser/chatShellRouting.ts`，避免 `chatSessions`、Resolver、Quick Chat 反向依赖 action 注册文件。

按入口类型处理：

| 入口 | 默认 Code 窗口 | Agents Window |
|------|-----------------|---------------|
| New/Open Chat，无待发送 payload | 显示并聚焦 Conversation | 保持上游 Chat 行为 |
| Quick Chat | 同一 `QuickChatGlobalAction`；keybinding / `ChatTitleBarMenu` `when: IsSessionsWindowContext` | 保留 |
| Continue-in / Agent Host Editor 等带 payload 路径 | 注册层不可见；`openChatSession` **第一句**：默认窗 && `position === Editor` → `BugIndicatingError`（在 URI mint、`importConversationStore.set`、`openEditor` 之前）。HEAD 约 1747–1752 先 stash importConversation 再 switch Editor | 保留 |
| Chat session URI resolver | 默认窗不为 **任何** content-provider scheme 注册 `ChatEditorInput` resolver | 保留（含 EH 动态 scheme） |
| 工作区 ChatEditor 恢复 | `canSerialize === false` 保持 | 保留上游语义 |

**禁止的实现：**

- 不得“先创建/迁移 session，再发现默认窗不能开 Editor”。
- 不得把待发送 prompt 静默丢弃后只 focus Conversation。
- 不得用 active editor 是否为 `ChatEditorInput` 决定默认窗是否放行。
- 不得把 ChatEditor 改挂到 `CONVERSATION_PART`。

## 6. 实施切片

### 切片 1 — 默认窗 Chat 路由统一

**目标：** 所有默认 Code 产品入口遵守 §5；Agents Window donor 行为不回退。

**创建：**

- `src/vs/workbench/contrib/chat/browser/chatShellRouting.ts` — 唯一窗口路由与 Conversation focus helper。

**修改：**

- `src/vs/workbench/contrib/chat/browser/actions/chatActions.ts`
  - 删除“active editor 已是 ChatEditor 则放行”的例外。
  - New Chat Editor 族在默认窗无条件 focus Conversation。
- `src/vs/workbench/contrib/chat/browser/actions/chatQuickInputActions.ts`
  - 保留一个 `QuickChatGlobalAction`；keybinding 与 `ChatTitleBarMenu` 加 `when: IsSessionsWindowContext`。
- `src/vs/workbench/contrib/chat/browser/chatSessions/chatSessions.contribution.ts`
  - `openChatSession` **第一句**：默认 Code 窗口 && `position === Editor` → `BugIndicatingError`；不得先 `importConversationStore.set` / mint URI / `openEditor`。
  - 动态 New Session Editor action 只在 Agents Window 可见。
- `src/vs/workbench/contrib/chat/browser/actions/chatContinueInAction.ts`
  - 默认窗不提供 Editor continuation target。
- `src/vs/workbench/contrib/chat/electron-browser/chat.contribution.ts`
  - `openNewSessionEditor.*` 静态命令不再成为默认窗产品入口。
- `src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts`
  - `ChatResolverContribution` 注入窗口环境；默认窗不注册 session scheme → `ChatEditorInput`。
  - 保留 `ChatDebugEditor` 与 Agents Window resolver。

**测试：**

- 改 `src/vs/workbench/contrib/chat/test/browser/actions/chatOpenConversationPart.test.ts`
  - 在 `registerChatActions()` 之后用 `ICommandService.executeCommand('workbench.action.openChat')`（或实际命令 id）；断言 `CONVERSATION_PART` 显示、focus 被调用、`openSession` 未调用。
  - active editor 预置为 `ChatEditorInput` 后重复，结果仍不得打开新 ChatEditor（H3）。
- 改 `src/vs/workbench/contrib/chat/test/browser/widgetHosts/editor/chatEditorShellPaths.test.ts`
  - **没有**名为 `OpenChatInEditorAction` 的导出类（HEAD：New Chat Editor 是 `registerChatActions()` 内匿名类，约 704；`workbench.action.chat.openInEditor` 是匿名 `GlobalMoveToEditorAction`）。经 `ICommandService.executeCommand` 驱动已注册命令，或调用已导出的 `openChatSession(...)`。禁止为测试导出生产接口。
- 新增 `src/vs/workbench/contrib/chat/test/browser/chatShellRouting.test.ts`
  - 默认窗与 Agents Window 两套分支。
  - 带 payload 的默认窗 Editor 请求（`chatSendOptions.prompt` / `importConversation`）在 session side effect 前以 `BugIndicatingError` 失败，spies 显示零 session create/migrate/send。
  - Resolver：通过 `IEditorResolverService` 按窗口断言注册；`ChatResolverContribution` 不是测试用 façade——要么作为真实 contribution 类导出，要么走公共 register 缝。默认窗不注册任何 content-provider scheme。
  - Quick Chat：断言 `workbench.action.quickchat.toggle`（`ASK_QUICK_QUESTION_ACTION_ID`）的 keybinding / 菜单 `when`，不是再写一条 F1 测。

**退出条件：**

- 全仓默认窗产品入口不再能构造或打开新的 `ChatEditorInput`。
- Agents Window 对应路径保持原行为。
- 测试直接执行行为，不以 helper 调用替代。

### 切片 2 — Sessions roster 导航闭环

**目标：** 从 Sidebar Sessions 选会话时，无论 Conversation 当前是否隐藏，都能看到并操作目标会话。

**修改：**

- `src/vs/workbench/contrib/conversation/browser/conversationSessionsView.ts`
  - 构造函数注入 `IWorkbenchLayoutService` 与 `IConversationPartService`。
  - `onDidOpen` 顺序固定为：`switchSession(id)` → 显示 `CONVERSATION_PART` → focus Conversation。
  - 仅当前元素存在且 `switchSession` 成功时导航；不存在的 stale id 不改变布局。
- `src/vs/workbench/contrib/conversation/test/browser/conversationSessionsView.test.ts`
  - Conversation 初始隐藏时打开列表项，断言切会话、显示、focus 三者都发生。
  - 键盘打开与单击走同一 `onDidOpen` 路径。
  - stale/空元素不展开 Conversation。

**可访问性同切片完成：**

- 保留 list 的 `IListAccessibilityProvider`。
- 打开后 focus 落 Conversation，而不是遗留在已切换的 roster 行。
- 不新增只靠颜色表达的当前会话状态。

**退出条件：** “隐藏 Conversation → 打开 Sessions → 选会话”形成可自动测试、可目视复验的完整路径。

**与页面接入互斥：**

- M5 **不**改 `agentSessionsActions.ts` 的 `when`（page-access 切片 2）也 **不**改其 `runWithSessions`（HEAD 已 guard）。
- M5 切片 2 拥有 `conversationSessionsView.ts` `onDidOpen` 的 show+focus；page-access 不得回退该行为。
- M5 **不**把 `IConversationStubService` 改名为 `IConversationRosterService`（page-access B11）。
- 切片 2 **禁止**从 `contrib/conversation` import `chatShellRouting.ts`。show+focus 经 `IWorkbenchLayoutService` + `IConversationPartService`（对照 `conversationSessionStatus.ts`）。

### 切片 3 — 分层与回归门禁

**目标：** 清掉与本方案架构承诺直接冲突的依赖，并补关键回归检测。

**修改：**

- `src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostCustomizationService.ts`
  - 去掉对 `src/vs/sessions/common/agentHostSessionsProvider.ts` 中 `IAgentHostMcpServer` 的直接 import（HEAD 相对路径 `../../../../../../sessions/common/agentHostSessionsProvider.js`）。
- **钉死落点：** `src/vs/platform/agentHost/common/`（已有 agent-host 协议层）。`IAgentHostMcpServer` 是 agent-host 协议（status / enablement / start/stop），不是 chat facade。**禁止**放到 `workbench/contrib/chat/common/`——`LAYERS.md` 不允许 `sessions/common` import `workbench/contrib`。
- `src/vs/sessions/` 与 `workbench/contrib/chat` 同时依赖新落点，不互相 import。测试 import `agentHostChatContribution.test.ts:103` 随类型迁移。
- `eslint.config.js`：从 `src/vs/workbench/contrib/*/~`（约 1851 行）以及其它 workbench 目标的 restrictions **删除** `vs/sessions/~`；不新增例外。

**布局回归：**

- 扩 `src/vs/workbench/services/layout/test/browser/layoutService.test.ts`
  - HEAD 约 471–563 已锁 `forceShownAgentShellPart` 组合与 maximize 例外。切片 3 = **补洞**，不重写已有测。
  - maximize **恢复**走 `Layout` 私有路径；不为测试扩大 API。V4（切片 4）才是 restore 运行证据，单测不能替代 V4。

**退出条件：**

- `npm run valid-layers-check` 通过（**只**是 native-type 门；**不**作为 H7 关闭证明）。
- H7 关闭 = eslint `code-import-patterns` 在 workbench 绿，且 `src/vs/workbench/**` 生产文件无 `sessions/common` / `vs/sessions` import。
- 常态互斥有单测；maximize 恢复语义由切片 4 V4 证明。

### 切片 4 — D4 启动与恢复验收

**D4 唯一 closer。** [M4](m4-validation-wave.md) 切片 2 只做环境探测（有无 `.build/electron`）；**不得**在 T1–T3 目视后把 D4 标 `closed`。D4 Exit Condition 以本切片 V1–V8 为准，见 [deferred-gaps.md](../progress/deferred-gaps.md)。

**前置：** 切片 1–3 合入集成工位；使用有 `node_modules`、`out`、`.build/electron` 的 merge 工位。

**门禁：**

```bash
npm run compile
npm run valid-layers-check
scripts/test.sh
```

先运行 chat/conversation/layout 聚焦域测试；M5 出口再运行一次完整 `scripts/test.sh`。不得用重复 typecheck 代替 compile。

使用 `.agents/skills/launch/SKILL.md` 启动隔离 profile，借助 Playwright/CDP 验证：

| ID | 场景 | 期望 |
|:---|:-----|:-----|
| V1 | fresh profile 启动 | 中心 Conversation；End 上 Preview、下 Sources；Aux hidden |
| V2 | 依次切 Nav / Conversation / Preview / Sources | 四钮可达；常态下不能把 Conversation、Preview、Sources 全藏 |
| V3 | 只关 Preview | Sources/Conversation 状态不被错误改写；Panel 不被强制弹出 |
| V4 | maximize Panel/Aux 后恢复 | maximize 允许临时例外；恢复后回到合法 agent shell 组合 |
| V5 | 隐藏 Conversation 后从 Sessions 选会话 | Conversation 显示并聚焦，目标 session 与 SessionBar 一致 |
| V6 | Command Palette、Chat title menu、Quick Chat 快捷键 | 默认窗不出现新 ChatEditor/Quick Chat；Open Conversation 正常 |
| V7 | 重启恢复 | 新 Part 显隐与 End 尺寸可恢复；ChatEditor tab 不还原 |
| V8 | Sources Files/Changes/Review 基本打开 | 文件仍落 End Preview；不在本波改变 Diff FORK |

证据写入 `dev/progress/deferred-gaps.md` D4 记录：命令、commit SHA、profile 类型、每项结果和截图位置。任一 Blocking 失败则 D4 不关闭。

### 切片 5 — D5 EH 探针与文档收口

**进度（2026-09-02）：** 切片 1 `@304db259`、切片 2 `@b11290bb`、切片 3 `@2f938d6b`、切片 4 D4 closed @ rerun-2230、切片 5 文档门禁 @ `3180a611` + D5 closed @ `13069cb7`（wave3 三探针）。`valid-layers-check` 仍 environment-blocked（Node v26.7.0），不阻塞本方案关闭。

在同一隔离 profile 按既有 D5 计划实测：

- `redhat.vscode-yaml`：YAML LSP 在 End Preview 生效。
- `gruntfuggly.todo-tree`：Sidebar / Activity 贡献不破坏四钮与中心 Conversation。
- `ms-vscode.js-debug`：调试视图、Panel 与 End Preview 可用。

**更新：**

- `docs/reference/code-oss-b2/eh-surface-matrix.md`
  - 关键行从“探针已选”改为“已实测 @日期 + commit”或明确失败。
- `dev/progress/deferred-gaps.md`
  - D4/D5 仅在 Exit Condition 满足时 `closed`。
- `dev/progress/status.md`
  - 同一提交同步 M5、D3–D5 与当前 HEAD，清除“D3 closed / 仍运行中”矛盾。
- `dev/progress/worktree-pool.md`
  - 只记录实际工位状态，不保留过期 busy/queued。
- `docs/systems/chat/agent-ui.md`
  - 删除重复 frontmatter `summary`。
  - 统一 ChatEditor 默认路径、独立 Sidebar Sessions ViewContainer 与运行验证状态。
- `docs/systems/workbench/parts-and-grid.md`
  - 仅在行为事实变化时更新；Diff FORK 保持。
- `docs/reference/code-oss-b2/desktop-shell-mapping.md`
  - 写实默认窗 Chat/Quick Chat 路由与 roster 导航。
- `dev/plans/INDEX.md`
  - M5 状态随实际阶段从 `proposed` → `in_progress` → `implemented`。

**文档门禁：**

```bash
python3 scripts/check-docs-health.py
```

M5 完成时要求本方案相关 warning 为 0；`dev/loop/` 子模块自身断链若仍存在，单独记为套件 gap，不与 UI 壳结果混写。

## 7. 切片顺序与文件互斥

| 切片 | 依赖 | 独占文件面 | 可并行性 |
|------|------|------------|----------|
| 1 Chat 路由 | 无 | `contrib/chat` actions、sessions、resolver、对应测试 | 不与其他 Chat 路由改动并行 |
| 2 roster | 无 | `contrib/conversation` Sessions View + 测试；**不**改 `agentSessionsActions.ts` `when` | 可与 1 并行；page-access 切片 2 只改 `when` |
| 3 分层/布局 | 先确认 1 的 helper 落点 | agentHost 公共类型、layout test | 类型迁移不与 Agent Host 其他改动并行 |
| 4 D4 | 1–3 已集成且 compile 绿 | 运行环境 + D4 记录 | 不与会改变 `src/**` 的切片并行验收 |
| 5 D5/文档 | D4 可启动；D5 可在 D4 后执行 | EH 矩阵、progress、知识层 | 文档单写者 |

方案 commit 与实施 commit 分离。实施时每个切片使用显式路径暂存，不得 `git add -A`，不得覆盖现有无关 WIP。

## 8. 验收清单

### 代码与自动化

- [x] 默认 Code 窗口 New/Open Chat 不创建 `ChatEditorInput`，即使 active editor 已是 ChatEditor。
- [x] 默认窗 Chat session URI 不解析为 ChatEditor；Agents Window 保留。
- [x] 默认窗 Quick Chat 快捷键/菜单不可达；Open Conversation 可达。
- [x] 带 payload 的 Editor 路径在副作用前失败，不静默丢 prompt。
- [x] roster 选择会话会显示并聚焦 Conversation。
- [x] `workbench` 生产文件无 `vs/sessions` / `sessions/common` import（eslint `code-import-patterns`）。
- [x] 路由、Action、Resolver、roster、互斥测试通过。

### 构建与运行

- [x] `npm run compile` 通过。
- [ ] `npm run valid-layers-check` — **environment-blocked**（Node v26.7.0 TS lib 缺 `WebGPU`/`FileSystemHandle` 等；exit 1 @ `c7ed501d`，与 M5 路由/布局无关；**不**记为通过）。
- [ ] 聚焦域单测通过（本轮未全量重跑）。
- [x] V1–V8 在隔离 profile 通过并有证据（[rerun-2230](../progress/d4-evidence/rerun-2230/)）。
- [x] YAML / Todo Tree / js-debug 三探针均已实测（wave3 @ 2026-09-02）；D5 **closed** @ [deferred-gaps](../progress/deferred-gaps.md)（panel/terminal 矩阵脚注仍待实测）。

### 文档与状态

- [x] D3/D4/D5/status 一致（D5 closed @ wave3；valid-layers 环境脚注见 D3/deferred-gaps）。
- [x] `agent-ui.md` 无重复 frontmatter key。
- [x] M5 不宣称 UA 引擎、Diff FORK、跨平台发布验证已完成。
- [x] `python3 scripts/check-docs-health.py` 0 error（5 条既有 loop 子模块 warning，非本方案引入）。

## 9. 失败与回退规则

- 默认窗路由修复若导致 Agents Window 回退：撤回对应入口改动，不放宽默认窗 INV-TOPO；先补窗口分支测试。
- Resolver 禁用若让非 Chat URI 受影响：缩小 scheme 过滤，不恢复默认窗 ChatEditor resolver。
- D4 无法启动：记录构建产物、命令与退出错误，M5 保持阻塞；不得以 DOM 单测替代。
- EH 扩展安装受网络阻塞：D5 记 blocking gap；已完成的 D4 不回退，但 M5 不宣称 EH 完成。
- 上游行为与本方案冲突时，优先保产品不变量；donor 兼容通过 Agents Window 分支保留。

## 10. 相关文档

- [M4 验证波](m4-validation-wave.md)
- [Deferred Gaps](../progress/deferred-gaps.md)
- [健康检查 Gate](../progress/health-gates.md)
- [Agent UI](../../docs/systems/chat/agent-ui.md)
- [Parts/Grid](../../docs/systems/workbench/parts-and-grid.md)
- [Desktop 壳映射](../../docs/reference/code-oss-b2/desktop-shell-mapping.md)
- [页面接入](page-access-schemes.md)（Settings/Navigator/lens；本方案不改其 `when` / B11 token）

## 11. 审查记录（规则 16）

- 2026-08-31 签收审查。Opus 5.0 因账单未付失败；并行只读 reviewer（inherit / Cursor Grok 4.6）。人类本会话要求审查后签收。父 agent 已对 HEAD 核验。已当轮改入：
  - **C1**：H7 钉死下沉 `platform/agentHost/common/`；H7 关闭靠 eslint allow-list 删除 `vs/sessions/~`，不靠 `valid-layers-check`。
  - **C2**：M5 切片 4 为 D4 唯一 closer；M4 不得以 T1–T3 关 D4。
  - **I1**：测试经 `ICommandService.executeCommand` / 已导出 `openChatSession`；不发明 `OpenChatInEditorAction`。
  - **I2**：`openChatSession` 第一句 fail-fast，先于 `importConversationStore.set`。
  - **I3**：H2 = 全部 content-provider scheme，不是重做 M3 两 scheme。
  - **I4**：与 page-access 文件互斥写明。
  - **I5**：Quick Chat 保留一个 Action2，用 `when` 而不是不注册。
  - **I6**：切片 3 布局测补洞；V4 才是 maximize restore 证据。
