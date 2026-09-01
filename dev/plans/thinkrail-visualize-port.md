---
title: "Conversation visualize 卡：ThinkRail 图示工具移植"
type: plan
status: implemented
phase: N/A
updated: 2026-09-01
summary: "ThinkRail visualize 图示卡；diagram mermaid webview + comparison 网格；overlay 全屏 pan/zoom；T1–T3 已合入 `5cad7c3b`–`0eb470f2`；T4 blocked PRD-008"
origin: multi-party-design-review
mpdr:
  skill: multi-party-design-review
  synthesized_by: "Cursor / Grok (synthesizer session)"
  draft_sources:
    - platform: Cursor
      model: cursor-grok-4.6-high-fast
      file: draft-cursor-grok-a.md
    - platform: Cursor
      model: cursor-grok-4.6-high-fast
      file: draft-cursor-grok-b.md
  perspective_reviewers:
    - dimension: Architecture
      platform: Cursor
      model: cursor-grok-4.6-high-fast
    - dimension: Product / Interaction
      platform: Cursor
      model: cursor-grok-4.6-high-fast
    - dimension: Testing / Verification
      platform: Cursor
      model: cursor-grok-4.6-high-fast
  architecture_reviewed_by: "Cursor / Grok (synthesizer — post-perspective refine)"
  architecture_review_verdict: "Approve with changes"
  refined_by: "Cursor / Grok (synthesizer)"
  implementer_ask_rounds: 1
---

# Conversation visualize 卡

> 需求：[PRD-014](../../docs/product/requirements.md#prd-014-conversation-图示卡visualize)（`accepted`）。  
> 对话列表合同：[PRD-003](../../docs/product/requirements.md#prd-003-时间线与输入) / [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级) 不变。  
> 能力对照（只读，不 import）：ThinkRail `packages/pi-visualize/`（工具名 `visualize`，schema `diagram|comparison`）。  
> 呈现对照（只取卡形态，不搬 React）：`thinkrail/apps/web/src/chat/tools/visualize/`。  
> 过程折：[conversation-process-fold.md](conversation-process-fold.md)（`accepted`，PRD-013）— 本卡折**外**；`visualization` 与 `reasoning`/`tool` span **互斥**。  
> 轨迹页：[conversation-trajectory-lens.md](conversation-trajectory-lens.md)（`accepted`，PRD-012）— `projectTurnsToTrajectory` **skip** `visualization`。  
> 透镜组装：[page-access-schemes.md](page-access-schemes.md) §4 三槽冻结。  
> 本稿 `implemented`（2026-09-01 签收；T1–T3 已合入 `5cad7c3b`–`0eb470f2`）。规则 16 Grok xhigh 审查（Opus 5.0 不可用）Approve with changes 已改入。T4 blocked PRD-008。

**Goal：** 把 ThinkRail 聊天里 agent 调用 `visualize` 后出现的图示卡搬进 Agent IDE 默认窗 Conversation 时间线：`type=diagram` 用主题感知的 mermaid SVG（标题 + 全屏 overlay pan/zoom）；`type=comparison` 用并排方案卡（pros / cons / Recommended）。截图里的「实现路线状态」（冻结 / 进行中 / 未立项 + 箭头）是 **mermaid flowchart 内容**，不是第三种 widget。无引擎用 Stub fixture 证明卡形态，不冒充已接引擎。

---

## 1. VS Code 有没有？（inventory）

**短答：** VS Code **有 mermaid 基础设施**，Copilot Chat 里能画；Agent IDE **Conversation 时间线今天没有** visualize / 图示卡 / 全屏 modal。

| 能力 | ThinkRail | VS Code Chat | Agent IDE 今天 |
|------|-----------|--------------|----------------|
| 产品宿主 | Web chat 主卡 | `ChatWidget` + EH | `ConversationLens` stub DOM |
| 工具名 / schema | `visualize`：`type` + `mermaid` / `options` | `renderMermaidDiagram`：`markup` + `title?` | 无 |
| Inline SVG | `MermaidView` lazy mermaid | webview `text/vnd.mermaid` | 无；```mermaid``` 当代码块 |
| 全屏 | `Dialog` + `PanZoomView`（0.25–5×，Ctrl/Meta+滚轮） | **Open in Editor** preview tab | 无 |
| comparison 卡 | `type=comparison` 网格 + Recommended | 无 | 无 |
| 主题 | CSS var → mermaid `themeVariables` | 扩展 `vsCodeTheme.ts` | 无 |
| 降级 | fence markdown | 工具结果 + fence | 助手 markdown 普通 fence |

**可复用 donor（本波 **零改** 扩展源码）：**

| 资产 | 位置 | 用法 |
|------|------|------|
| mermaid 11 + CSP + 主题脚本 | 扩展 `chat-webview-out/index.js` | `IExtensionService.getExtension('vscode.mermaid-markdown-features')` → `asWebviewUri`；**自写 HTML 壳**（**不含** Open-in-Editor 按钮） |
| 主题映射参考 | `preview-src/shared/vsCodeTheme.ts` | 宿主 postMessage / 配置 span 对齐 |
| Pan/zoom 行为参考 | `preview-src/chat/mermaidWebview.ts` `PanZoomHandler` | **overlay 内**由 donor 脚本提供 pan/zoom（Alt+滚轮 / pinch）；外层 chrome **仅** Close + Reset（`postMessage resetPanZoom`），**不**再叠第二套 0.25–5× 缩放 |
| ChatOutputRenderer | `chatOutputRenderer.ts` | **不用** — donor HTML 内置 Open-in-Editor → editor tab，与产品壳冲突 |

**HEAD 锚点：**

| 事实 | 位置 |
|------|------|
| 时间线仅 `user` / `assistant` / `confirmation` | `conversationStubModel.ts` · `conversationLens.ts` `createTurnElement` |
| 非 user 且未分支 → 标 `"Agent"` | `conversationLens.ts:502-504` |
| 助手 Markdown，无 mermaid 特化 | `IMarkdownRendererService` |
| page-access 禁 `contrib/chat/**`（除 `chatContentParts/**`） | [page-access-schemes.md](page-access-schemes.md) §4.3 |
| `IChatOutputRendererService` 单测未 stub | `conversationLens.test.ts` `mountLens()` |

**禁止误判：** 不要把 Copilot Chat 已有 mermaid 写成「产品 Conversation 已有图示」。不要把 `renderMermaidDiagram` 改名冒充 `visualize`。

---

## 2. 方案选项与选定

| | 做法 | 结论 |
|--|------|------|
| **A. 只 Markdown 降级** | 时间线继续 fence | **拒绝** |
| **B. 借 ChatOutputRenderer** | `IChatOutputRendererService.renderOutputPart` | **拒绝** — donor webview **必带** Open-in-Editor → preview editor tab；Conversation 无法从外部去掉该按钮且本波零改扩展 |
| **C. workbench 自绘 mermaid** | `import('mermaid')` 进核心 | **拒绝** |
| **D. 混合（选定）** | 自研 `IWebviewService` 宿主读扩展 `chat-webview-out`；comparison = 自研 DOM；全屏 = overlay + 第二 webview | **选定** |

**选定 D 的理由：** 借 mermaid 资产不借 Chat 管道；overlay 对齐 ThinkRail modal；不触发 `_mermaid-markdown.openInEditor`；page-access **无需**开 `chatOutputItemRenderer` 例外。合同在 `contrib/conversation/common`。

**禁止 import：** `IChatOutputRendererService`、`IChatWidgetService`、`IChatService`、`chatListWidget`、`chatWidget`、`thinkrail/**`、`vs/sessions/**`（from conversation）。

---

## 3. 设计

### 3.1 数据模型

```ts
type ConversationVisualizeType = 'diagram' | 'comparison';

interface ConversationVisualizeOption {
	readonly name: string;
	readonly description?: string;
	readonly pros: readonly string[];
	readonly cons: readonly string[];
	readonly recommended: boolean;
	readonly mermaid?: string;
}

type ConversationVisualizeArgs =
	| { readonly type: 'diagram'; readonly title?: string; readonly mermaid: string }
	| { readonly type: 'comparison'; readonly title?: string; readonly options: readonly ConversationVisualizeOption[] };
```

- 校验对齐 ThinkRail `pi-visualize/src/validate.ts`（自写，不 import 包）。
- `StubTurnKind` 增 **`visualization`**。
- `ConversationStubTurn` 增 `visualize?: ConversationVisualizeArgs`；**`text`** 对 visualization 固定为 **`''`**（必填字段占位；UI 不读 `text`）。
- `shouldRenderTurnAsMarkdown` **仍只** `assistant`。
- `createTurnElement`：`visualization` **最先**分支；元素 **无** `.conversation-lens-turn-header` 的 You/Agent 行；用卡 header「Visualize · Stub: …」代替。
- `parseVisualizeArgs` 失败 → 卡内 error + fence，**不 throw** 出 `createTurnElement`（PRD-007）。`validateVisualizeArgs` 供单测 throw；parse 供 UI 降级。
- **引擎映射（T4）：** UA admitted 工具名 `visualize` **只**投影为 `kind: 'visualization'`；**禁止**同时进 `tool`/`reasoning` span（否则会被 PRD-013 过程折收起）。

**与 `renderMermaidDiagram` 关系：** 并列工具。提供适配器 `visualizeArgsFromMermaidTool({ markup, title })` 仅供将来引擎映射，**不**合并工具名。

### 3.2 渲染架构

```text
createTurnElement(visualization)
  └── conversationVisualizeCard.ts
        ├── header（可折叠，默认展开；文案含 Stub）
        ├── title
        ├── type=diagram → conversationMermaidHost (inline webview)
        │       └── 全屏按钮 → conversationVisualizeOverlay.ts
        └── type=comparison → CSS grid 方案卡
              └── 每卡可选嵌 inline mermaid host
```

- **comparison chrome：** workbench DOM + `conversationVisualize.css`；Recommended badge；`Codicon.check` / `Codicon.error`。
- **inline mermaid：** `ConversationMermaidHost.mountInline(parent, source, title)` — `IWebviewService.createWebviewElement`；扩展 URI 经 **`await IExtensionService.getExtension('vscode.mermaid-markdown-features')`**（宿主在 lens 构造时预解析 Promise，同步 `createTurnElement` 只读缓存）。`contentOptions.allowScripts: true` + `localResourceRoots` + `extension`；`providedViewType` **不得**用 `vscode.mermaid-markdown-features.chatOutputItem`（避免 donor Open-in-Editor context menu）。HTML **无** Open-in-Editor 按钮；加载 `chat-webview-out/index.js`。高度听 `webview.intrinsicContentSize`（非 Chat 包装的 `onDidChangeHeight`）。扩展缺失 / 无 `chat-webview-out` 产物 → `<pre data-mermaid-source>` + Stub。
- **全屏 overlay：** `ConversationVisualizeOverlay` 挂 `ILayoutService.getContainer(targetWindow)`；独立 `DisposableStore`（**不进** `turnBodyDisposables`）。`role="dialog"` `aria-modal` `aria-labelledby`；Escape 监听 **layout container / targetWindow**（焦点在 webview 内也能关）；切会话 force-close。~90vh × 95vw。内层 webview 用同一 donor 脚本 + **内建** `PanZoomHandler`；外层 chrome **Close + Reset only**。**禁止** `_mermaid-markdown.openInEditor`。
- **时间线滚轮：** inline webview 须 `webview.onDidWheel` 委托给 `.conversation-lens-timeline-scroll`（Conversation 无 Chat 列表 delegate）。
- **失败：** 扩展未激活 / render throw → 错误 + fence。
- **禁止：** workbench `import('mermaid')`；SVG 进主 DOM。

### 3.3 Stub 种子

新会话 **`visualize`**，SessionBar 标题 **`Visualize (Stub)`**（`localize`）：

1. user：`Show the implementation roadmap.`
2. visualization diagram：`title: 'Stub: 实现路线状态'`；mermaid `flowchart TD` 三框 **冻结 → 进行中 → 未立项**。
3. visualization comparison：两卡（如 DOM card vs webview host），一卡 `recommended: true`，名称含 Stub。
4. assistant stubEcho：`Stub echo — visualize cards above are fixtures, no engine.`

### 3.4 Stub vs 引擎

| | Stub（T1–T3） | 引擎（T4，blocked PRD-008） |
|--|---------------|----------------------------|
| 数据 | 种子 `visualize` turns | UA admitted `visualize` tool → 同一 `ConversationVisualizeArgs` |
| LM 工具 | **不**注册 | 引擎侧 `visualize`，不改 mermaid 扩展 |
| 诚实 | 标题 / 选项含 **Stub** | 去 Stub 前缀 |

### 3.5 与 PRD-013 / PRD-012

| | 过程折 PRD-013 | 轨迹 PRD-012 | **本方案 PRD-014** |
|--|----------------|--------------|-------------------|
| 价值 | 收起连续思考/工具 | 检查注入 / chip / 工具树 | 阅读图示与方案对比 |
| 宿主 | 对话 overlay | SessionBar 切页 | 对话折**外**卡 |
| kind | `reasoning` / `tool` span | 轨迹 `tool` / `subtool` | **`visualization`** |

**非目标：** Activity / Thinking 缩进；轨迹检查表；把图示折进过程区；`groupIdentity`；Copilot thinking；Chat 并排（PRD-011）。

过程折切段：`visualization` 与 `user` / `assistant` / `confirmation` 同级切开。轨迹投影 **skip** `visualization`。

**文件串行：** 与过程折 P2、轨迹 T1/T2 都可能改 `conversationLens.ts` / `conversationStubModel.ts` — **同一 PR 禁止并行改**。

---

## 4. 文件清单

路径默认 `src/vs/workbench/contrib/conversation/`。

| 文件 | 职责 |
|------|------|
| **Create** `common/conversationVisualize.ts` | DTO、`parseVisualizeArgs`、`validateVisualizeArgs`、`mermaidFence` / `comparisonMarkdown` |
| **Create** `browser/conversationVisualizeCard.ts` | diagram / comparison DOM；折叠 header |
| **Create** `browser/conversationMermaidHost.ts` | `IWebviewService` + 扩展 URI；inline/overlay mount |
| **Create** `browser/conversationVisualizeOverlay.ts` | 全屏 overlay + zoom chrome |
| **Create** `browser/media/conversationVisualize.css` | 卡 / grid / overlay |
| **Modify** `browser/conversation.contribution.ts` | import css |
| **Modify** `browser/conversationStubModel.ts` | kind + 字段 + 种子 |
| **Modify** `browser/conversationLens.ts` | 分支 + dispose |
| **Modify** `browser/conversationTurnMarkdown.ts` | `visualization` 非 markdown |
| **Test** `test/browser/conversationVisualize.test.ts` | 纯函数 |
| **Test** `test/browser/conversationVisualizeCard.test.ts` | 卡 fixture |
| **Test** `test/browser/conversationVisualizeOverlay.test.ts` | overlay zoom / Escape |
| **Test** `test/browser/conversationVisualizeImportBoundaries.test.ts` | 禁 thinkrail / chatListWidget / sessions |
| **Test** 扩 `conversationLens.test.ts` · `conversationTurnMarkdown.test.ts` | 回归 |

**禁止改：** `extensions/mermaid-markdown-features/**`（本波零改）、`contrib/chat/**`、`vs/sessions/**`。

---

## 5. 测试

### 5.1 单元

- diagram 缺/空 `mermaid` → throw。
- comparison 缺 `options` / 空 `name` → throw。
- `mermaidFence` / `comparisonMarkdown` 含 fence 与 Recommended。
- `shouldRenderTurnAsMarkdown('visualization') === false`。

### 5.2 组件 fixture

**`mountLens()` 必须 stub `IWebviewService` / `IExtensionService`**（T2 起；T3 接真 host 逻辑）。`conversationLens.test.ts` 共享 helper 一并更新。

T2 断言（`<pre data-mermaid-source>` 可见「冻结 / 进行中 / 未立项」）。

T3 断言：

- `[data-kind="visualization"]`；**无** header 文案 `"Agent"`。
- `[data-visualize-type]`；标题含 Stub。
- `data-mermaid-host` 或 `data-mermaid-source`（宿主 stub 时）。
- 全屏 → `role="dialog"`；Escape / 切会话关闭；**不**调用 `_mermaid-markdown.openInEditor`（stub `ICommandService`）。
- `untitled` / `tour` / `blank` 回归；种子数 +1。

`conversationVisualizeImportBoundaries.test.ts` 对齐 page-access §10 扫描规则（禁 `contrib/chat/**`、`thinkrail`、`sessions/`）。

---

## 6. 切片

**Implemented：** T1–T3（`5cad7c3b`–`0eb470f2`）。T4 blocked PRD-008。

### T1 — 合同与降级

Create `common/conversationVisualize.ts` + `conversationVisualize.test.ts`。

- [ ] 纯函数单测绿；零 DOM、零 chat import。

### T2 — Stub 卡 chrome（假 mermaid host）

Create card + css；改 stub model / lens；comparison 网格；diagram 用 `<pre>` 占位。

- [ ] 种子 `visualize` 可见两卡；折叠 header 工作。

### T3 — webview host + overlay

Create `conversationMermaidHost.ts` + overlay + import boundary test。

- [ ] 扩展缺失 → fence；overlay 会话切换 dispose。
- [ ] `scripts/test.sh --grep 'ConversationLens|ConversationVisualize'` 绿。

### T4 — 引擎（blocked）

admitted `visualize` → 同一 parse；去 Stub。不改 mermaid 扩展。

---

## 7. 风险与 Deferred

| 风险 | 缓解 |
|------|------|
| 与过程折抢 stub 文件 | 独立种子 `visualize`；PR 串行 |
| 扩展被禁用 | fence + Stub 文案 |
| webview 撑高时间线 | `onDidChangeHeight` + max-height 内滚 |
| 误用 ChatOutputRenderer | 方案已拒绝 B；import lint 禁 `chatOutputItemRenderer` |
| Open-in-Editor 泄漏 | 自研 HTML 壳，不用 donor renderer |
| overlay 随 renderTimeline 泄漏 | overlay 独立 DisposableStore；切会话 force-close |

**Deferred：** TimelineTree 虚拟化 webview 回收；助手正文 ```mermaid``` 升级；轨迹 visualize payload 检查器；TUI tier-2；扩展 bundle 被裁掉时的 vendor 决策（HUMAN）。

---

## 8. PRD-014

见 [requirements.md](../../docs/product/requirements.md#prd-014-conversation-图示卡visualize)。

---

## 9. 开放问题

| ID | 问题 | 决议 |
|----|------|------|
| H1 | PRD-014 独立编号？ | **已关** — 独立 PRD-014 `accepted` |
| H2 | 与过程折谁先改 lens/model？ | **串行**；visualize 折外 |
| H3 | Agent IDE 发行是否 bundled mermaid 扩展？ | 假设有；缺失诚实降级 |

---

## 相关文档

- [PRD-003](../../docs/product/requirements.md#prd-003-时间线与输入) · [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级)
- [conversation-process-fold.md](conversation-process-fold.md) · [conversation-trajectory-lens.md](conversation-trajectory-lens.md)
- ThinkRail（只读）：`../thinkrail/packages/pi-visualize/SPEC.md` · `../thinkrail/apps/web/src/chat/tools/visualize/*`
- VS Code mermaid：`extensions/mermaid-markdown-features/src/chatOutputRenderer.ts`

## 审查记录

- 2026-08-31：Grok×2 并行草案 → 综合稿；Grok 多视角 refine（拒 ChatOutputRenderer）。
- 2026-09-01：规则 16 **Grok xhigh** 审查（Opus 5.0 子 agent 不可用）— **Approve with changes**。已改入：donor PanZoomHandler + chrome Close/Reset；webview API/async 扩展解析；`visualization`↔`tool` 互斥；滚轮/Escape 委托；PRD-014 落盘。
- 2026-09-01：签收 `accepted`；T1–T3 ReadyToImplement。
- 2026-09-01：T1–T3 已合入（`5cad7c3b`–`0eb470f2`）；`status: implemented`。
