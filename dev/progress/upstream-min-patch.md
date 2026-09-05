---
title: "上游最小 patch 清单"
type: progress
status: accepted
phase: N/A
created: 2026-09-05
updated: 2026-09-05
summary: "ADR-007 侵入面 A/B 清单；基线 004a1fbb；U1 祖先可用，候选 tag 1.136.0"
---

# 上游最小 patch 清单

> **上游快照：004a1fbb（非 tag）**  
> **产品分支**：`agent-ide` @ `e9e40a8d`（2026-09-05 核对）  
> **权威 ADR**：[ADR-007 上游同步策略](../decisions/007-upstream-sync.md)  
> **U1 只读准备（2026-09-05）**：`complete`  
> **祖先判断**：可用 — `git cat-file -e 004a1fbb^{commit}` 通过；`git rev-list --parents -1 004a1fbb` → parent `3aa54039a0bec1bd4f9b428cdb202b4271bf22ef`（`git fetch microsoft --tags` + `git fetch --unshallow microsoft` 后）  
> **候选 tag**：`1.136.0` @ `520fb30b2d3d324b4cb2342f6e88e2cd93751de1` — 满足 `git merge-base --is-ancestor 004a1fbb 1.136.0` 的最旧 `1.N.0`（`1.135.0` 不满足；共 136 枚 `1.N.0` tag 中仅此一枚）

相对基线 `004a1fbb`，排除自定义树（`platform/universeAgent`、`contrib/conversation|navigator|sources`、`dev/`、`docs/`）后共 **371 文件**。本清单按 Decision 2 分 **A 表**（hook，须留上游文件）与 **B 表**（待迁回产品功能面）。

## 完备性闸门

合入上游 tag 前必须跑；`comm` 输出**必须为空**：

```bash
git diff --name-only 004a1fbb agent-ide -- . \
  ':!src/vs/platform/universeAgent' ':!src/vs/workbench/contrib/conversation' \
  ':!src/vs/workbench/contrib/navigator' ':!src/vs/workbench/contrib/sources' ':!dev' ':!docs' \
  | sort > /tmp/intrusion.txt
# 清单 A/B 表里的路径（目录行按前缀展开）→ /tmp/listed.txt
comm -23 /tmp/intrusion.txt /tmp/listed.txt   # 必须为空
```

**2026-09-05 U0 核对**：`comm -23` 输出为空（371 / 371 已入账）。月度同步后重跑；新出现的上游改动必须归 A 或列入 B。

## A 表：必须留在上游文件的 hook

### 默认窗拓扑（1 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | INV-TOPO / INV-052；中心叶与 `Conversation ∨ (Editor ∨ Sources)` 只能改 Layout |
| ADR / 方案 | ADR-006 |
| 收缩条件 | 拓扑不变量稳定后仅保留注册行，逻辑迁 contrib |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- `src/vs/workbench/browser/layout.ts`

### Part 注册与工厂（13 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | Conversation / Sources 进 `Parts` 枚举、`createPart`、第四类 `IEditorPart` |
| ADR / 方案 | ADR-002, ADR-006 |
| 收缩条件 | 注册行稳定后不再增；功能实现不得继续摊在此面 |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- `src/vs/workbench/browser/parts/editor/conversationEditorPart.ts`
- `src/vs/workbench/browser/parts/editor/editorPart.ts`
- `src/vs/workbench/browser/parts/editor/editorParts.ts`
- `src/vs/workbench/browser/workbench.contribution.ts`
- `src/vs/workbench/browser/workbench.ts`
- `src/vs/workbench/common/activityViewletEnablement.ts`
- `src/vs/workbench/common/configuration.ts`
- `src/vs/workbench/common/contextkeys.ts`
- `src/vs/workbench/services/editor/common/editorGroupFinder.ts`
- `src/vs/workbench/services/editor/common/editorGroupsService.ts`
- `src/vs/workbench/services/editor/common/editorService.ts`
- `src/vs/workbench/services/layout/browser/layoutService.ts`
- `src/vs/workbench/services/layout/test/browser/layoutService.test.ts`

### 新增 Part 挂点与瘦 chrome（7 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | Layout 拥有 Part；目录不能整包搬到 contrib，只留挂点与瘦 chrome |
| ADR / 方案 | ADR-002, ADR-006 |
| 收缩条件 | 功能实现迁 contrib 后此处只留 DOM 挂点与样式骨架 |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- `src/vs/workbench/browser/parts/conversation/conversationPart.ts`
- `src/vs/workbench/browser/parts/conversation/media/conversationPart.css`
- `src/vs/workbench/browser/parts/conversation/media/ua-common.css`
- `src/vs/workbench/browser/parts/conversation/partRegionHideControl.ts`
- `src/vs/workbench/browser/parts/sources/media/sourcesPart.css`
- `src/vs/workbench/browser/parts/sources/sourcesPart.ts`
- `src/vs/workbench/test/browser/parts/conversation/conversationPart.test.ts`

### 入口装配（4 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | contrib 须被入口引用才进产物；UA 宿主 = electron-main |
| ADR / 方案 | ADR-003 |
| 收缩条件 | 仅保留 import / 注册行；业务逻辑不得新增 |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- `src/vs/code/electron-main/app.ts`
- `src/vs/workbench/workbench.common.main.ts`
- `src/vs/workbench/workbench.desktop.main.ts`
- `src/vs/workbench/workbench.web.main.ts`

### 产品标识（2 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | 发行身份，不是功能 contrib |
| ADR / 方案 | ADR-007 |
| 收缩条件 | 随品牌合同维护；不迁走 |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- `product.json`
- `src/vs/platform/product/common/product.ts`

### 壳按钮 / 显隐（7 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | 四钮与 Panel/Aux 相对 Conversation 的显隐，与 Layout 合同绑死 |
| ADR / 方案 | ADR-006 |
| 收缩条件 | 显隐逻辑稳定后不再增行 |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- `src/vs/workbench/browser/actions/layoutActions.ts`
- `src/vs/workbench/browser/actions/navigationActions.ts`
- `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts`
- `src/vs/workbench/browser/parts/globalCompositeBar.ts`
- `src/vs/workbench/browser/parts/panel/panelActions.ts`
- `src/vs/workbench/browser/parts/titlebar/menubar.contribution.ts`
- `src/vs/workbench/test/browser/layoutControlMenu.test.ts`

### 构建装配（3 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | 发行包须带 `@grpc/grpc-js` 与品牌图标；gulp 管线无贡献点可挂 |
| ADR / 方案 | packaging-and-release |
| 收缩条件 | packaging 方案落地后 `.moduleignore*` 一并记账；无据不增 |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- `build/filters.ts`
- `build/gulpfile.vscode.linux.ts`
- `build/lib/electron.ts`

### 依赖与产品声明（2 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | 依赖声明只能在根 `package.json` |
| ADR / 方案 | ADR-007, packaging-and-release |
| 收缩条件 | 仅保留发行必需依赖 |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- `package-lock.json`
- `package.json`

### 品牌资源（47 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | 随产品身份维护；合并时会碰到 |
| ADR / 方案 | ADR-007 |
| 收缩条件 | 不迁走；整目录记账 |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- `build/brand/generate-icons.mjs`
- `build/brand/package-lock.json`
- `build/brand/package.json`
- `resources/README.md`
- `resources/brand/universe-agent-studio-bold.svg`
- `resources/brand/universe-agent-studio-light.svg`
- `resources/brand/universe-agent-studio.svg`
- `resources/darwin/code.icns`
- `resources/linux/code-url-handler.desktop`
- `resources/linux/code.appdata.xml`
- `resources/linux/code.desktop`
- `resources/linux/code.png`
- `resources/linux/debian/control.template`
- `resources/linux/debian/templates.template`
- `resources/linux/icons/hicolor/128x128/apps/universe-agent-studio.png`
- `resources/linux/icons/hicolor/16x16/apps/universe-agent-studio.png`
- `resources/linux/icons/hicolor/24x24/apps/universe-agent-studio.png`
- `resources/linux/icons/hicolor/256x256/apps/universe-agent-studio.png`
- `resources/linux/icons/hicolor/32x32/apps/universe-agent-studio.png`
- `resources/linux/icons/hicolor/48x48/apps/universe-agent-studio.png`
- `resources/linux/icons/hicolor/512x512/apps/universe-agent-studio.png`
- `resources/linux/icons/hicolor/64x64/apps/universe-agent-studio.png`
- `resources/linux/rpm/code.spec.template`
- `resources/linux/rpm/code.xpm`
- `resources/linux/snap/snapcraft.yaml`
- `resources/server/code-192.png`
- `resources/server/code-512.png`
- `resources/server/favicon.ico`
- `resources/server/manifest.json`
- `resources/win32/VisualElementsManifest.xml`
- `resources/win32/code.ico`
- `resources/win32/code_150x150.png`
- `resources/win32/code_70x70.png`
- `resources/win32/inno-big-100.bmp`
- `resources/win32/inno-big-125.bmp`
- `resources/win32/inno-big-150.bmp`
- `resources/win32/inno-big-175.bmp`
- `resources/win32/inno-big-200.bmp`
- `resources/win32/inno-big-225.bmp`
- `resources/win32/inno-big-250.bmp`
- `resources/win32/inno-small-100.bmp`
- `resources/win32/inno-small-125.bmp`
- `resources/win32/inno-small-150.bmp`
- `resources/win32/inno-small-175.bmp`
- `resources/win32/inno-small-200.bmp`
- `resources/win32/inno-small-225.bmp`
- `resources/win32/inno-small-250.bmp`

### CI 装配（0 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | 新文件用 `agent-ide` 前缀避免与上游同名 |
| ADR / 方案 | test-baseline-ci |
| 收缩条件 | workflow 绿后不再改上游 `pr.yml` |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- *（当前无 diff；计划项 `.github/workflows/agent-ide.yml`，见 [test-baseline-ci](../plans/test-baseline-ci.md)）*

### 仓根配置（18 文件）

| 字段 | 值 |
|:-----|:---|
| 为何留 hook | 开发工具面；上游不会新增同名文件 |
| ADR / 方案 | ADR-007 |
| 收缩条件 | 上游不碰则保持 |

路径（`git diff --name-only 004a1fbb agent-ide`）：

- `.cursor/rules/scheme-review.mdc`
- `.eslint-ignore`
- `.gitmodules`
- `.idea/.gitignore`
- `AGENTS.md`
- `eslint.config.js`
- `extensions/copilot/package-lock.json`
- `extensions/copilot/package.json`
- `extensions/copilot/src/extension/completions/vscode-node/completionsCoreContribution.ts`
- `extensions/copilot/src/extension/inlineEdits/vscode-node/inlineEditProviderFeature.ts`
- `extensions/copilot/src/extension/inlineEdits/vscode-node/jointInlineCompletionProvider.ts`
- `extensions/terminal-suggest/src/completions/code.ts`
- `scripts/SYNC-session-core.md`
- `scripts/check-docs-health.py`
- `scripts/code.sh`
- `scripts/sync-session-core.sh`
- `scripts/sync-universe-agent-device-grant-hub.ts`
- `scripts/sync-universe-agent-session-core.ts`

**A 表合计**：104 文件（含计划项 CI 0）。

## B 表：待迁回产品功能面

| 路径（粗记） | 文件数 | 迁到哪 | 说明 |
|:-------------|-------:|:-------|:-----|
| `src/vs/workbench/contrib/chat/**` | 114 | contrib/conversation + platform/universeAgent | INV-NO-COPILOT 薄门闩 |
| `src/vs/workbench/contrib/agentsVoice/**` | 8 | contrib/conversation | Voice 入口与文案 |
| `src/vs/workbench/contrib/welcomeAgentSessions/**` | 3 | contrib/conversation / 产品配置 | Agent Sessions Welcome |
| `src/vs/workbench/contrib/welcomeGettingStarted/**` | 9 | 产品配置 / contrib | Getting Started / Copilot walkthrough |
| `src/vs/workbench/contrib/welcomeOnboarding/**` | 3 | 产品配置 | Onboarding 变体 A |
| `src/vs/workbench/contrib/welcomeWalkthrough/**` | 3 | 产品配置 | Editor walkthrough 正文 |
| `src/vs/workbench/contrib/files/**` | 15 | contrib/sources / 设置 | Explorer 内联过滤与面包屑 |
| `src/vs/workbench/contrib/scm/**` | 5 | contrib/conversation | SCM history chat 上下文 |
| `src/vs/workbench/contrib/notebook/**` | 5 | 设置 | Notebook cell chat |
| `src/vs/workbench/contrib/mcp/**` | 5 | platform/universeAgent | MCP 命令与 Servers 视图 |
| `src/vs/workbench/contrib/terminal/**` | 6 | 设置 | 终端动作与菜单 |
| `src/vs/workbench/contrib/terminalContrib/chat/**` | 2 | contrib/conversation | 终端 chat 动作 |
| `src/vs/workbench/contrib/search/**` | 4 | contrib/sources | 搜索顶栏与视图 |
| `src/vs/workbench/contrib/remote/**` | 4 | 设置 | 远程指示器 |
| `src/vs/workbench/contrib/preferences/**` | 11 | contrib/conversation + platform/universeAgent | UA 设置 TOC / 深链 |
| `src/vs/workbench/contrib/universeAgentMigration/**` | 2 | platform/universeAgent | Code-OSS 迁移 |
| `src/vs/workbench/contrib/authentication/**` | 2 | platform/universeAgent | Manage accounts / MCP trust |
| `src/vs/workbench/contrib/accessibility/**` | 1 | 设置 | 无障碍配置项 |
| `src/vs/workbench/contrib/debug/**` | 2 | 设置 | 调试贡献注册 |
| `src/vs/workbench/contrib/extensions/**` | 3 | 设置 | 扩展视图文案 |
| `src/vs/workbench/contrib/editTelemetry/**` | 1 | 删除或设置关闭 | 编辑遥测贡献 |
| `src/vs/workbench/contrib/codeEditor/**` | 1 | contrib/conversation | 空编辑器 hint |
| `src/vs/workbench/contrib/inlineChat/**` | 2 | contrib/conversation | 内联 chat 动作 |
| `src/vs/workbench/contrib/inlineCompletions/**` | 2 | 设置 | 内联补全状态栏 |
| `src/vs/workbench/contrib/issue/**` | 1 | contrib/conversation | Issue reporter overlay |
| `src/vs/workbench/contrib/markers/**` | 2 | 设置 | Markers 贡献 |
| `src/vs/workbench/contrib/output/**` | 2 | 设置 | Output 贡献 |
| `src/vs/workbench/contrib/quickaccess/**` | 2 | contrib/conversation | 命令面板 UA 过滤 |
| `src/vs/workbench/contrib/tasks/**` | 1 | 设置 | Tasks 贡献 |
| `src/vs/workbench/contrib/testing/**` | 2 | 设置 | Testing 贡献 |
| `src/vs/workbench/contrib/timeline/**` | 1 | 设置 | Timeline 贡献 |
| `src/vs/workbench/contrib/update/**` | 1 | 设置 | Update 检查文案 |
| `src/vs/workbench/services/agentHost/**` | 2 | platform/universeAgent | Agent SDK setup service |
| `src/vs/workbench/services/preferences/**` | 4 | contrib/conversation | Preferences 编辑器 pane 注册 |
| `src/vs/workbench/services/themes/**` | 2 | 设置 | Workbench 主题配置 |
| `src/vs/workbench/services/history/**` | 1 | contrib/conversation | History service |
| `src/vs/workbench/services/extensions/**` | 1 | platform/universeAgent | Native extension service |
| `src/vs/workbench/services/userDataProfile/**` | 1 | 设置 | Profile 管理 |
| `src/vs/workbench/api/**` | 3 | contrib/conversation / navigator | viewsExtensionPoint / mainThreadComments |
| `src/vs/workbench/browser/actions/helpActions.ts` | 1 | contrib/conversation | Help 菜单 |
| `src/vs/workbench/browser/contextkeys.ts` | 1 | （browser 层补丁，随 Part 注册收缩） | browser context key 补丁 |
| `src/vs/workbench/browser/style.ts` | 1 | contrib/conversation | 全局 workbench 样式 |
| `src/vs/workbench/browser/media/**` | 2 | resources/ / contrib | code-icon / productAccessibility CSS |
| `src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts` | 1 | contrib/conversation | 编辑器组水印 |
| `src/vs/workbench/browser/parts/editor/media/conversationEditorPart.css` | 1 | contrib/conversation | 随 conversationEditorPart 迁 |
| `src/vs/workbench/test/browser/helpActions.test.ts` | 1 | 随 helpActions | 测试随迁 |
| `src/vs/workbench/test/browser/parts/editor/editorGroupWatermark.test.ts` | 1 | 随 watermark | 测试随迁 |
| `src/vs/workbench/test/browser/workbenchTestServices.ts` | 1 | 测试基础设施 | 随相关测试迁 |
| `src/vs/sessions/**` | 12 | sessions/contrib/providers | ADR-001 比对；grid 级 hook 除外 |
| `src/vs/editor/common/config/editorOptions.ts` | 1 | sessions/contrib/providers | inline suggest 默认值 |
| `src/vs/editor/test/common/config/editorInlineSuggestDefaults.test.ts` | 1 | 随 editorOptions | 测试随迁 |
| `src/vs/platform/accessibility/browser/accessibleView.ts` | 1 | 设置 | accessibleView |
| `src/vs/platform/agentHost/common/agentHostMcpServer.ts` | 1 | platform/universeAgent | MCP server 类型 |
| `src/vs/platform/dialogs/electron-browser/dialog.ts` | 1 | contrib/conversation | 对话框 overlay |
| `src/vs/platform/environment/node/argv.ts` | 1 | 设置 | CLI argv |
| `src/vs/platform/environment/node/userDataPath.ts` | 1 | 设置 | userData 路径 |
| `src/vs/platform/theme/electron-main/themeMainServiceImpl.ts` | 1 | 设置 | 主题主进程 |

**B 表合计**：267 文件。

## 相关

- [ADR-007](../decisions/007-upstream-sync.md) — 节奏、分类、操作规范
- [worktree-pool.md](worktree-pool.md) — 工位池；集成分支 `agent-ide`
- [worktrees.md](../loop/worktrees.md) — 通用 Loop 规则 + 本仓基线特例
