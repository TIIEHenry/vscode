---
title: "Conversation 时间线正文：会话与子代理 pill"
type: plan
status: accepted
phase: N/A
updated: 2026-09-16
summary: "助手 markdown 里的内部会话/子代理链接升级为行内 pill + 轻量 hover + 点击按 PRD-016 路由；跨会话 reveal 目标自己的叶；S3w 钉死叶级 SessionBar（方案 C，每扇一份，用户 2026-09-14 拍板）+ 隐藏叶 restore 仍单叶 + 隐藏叶释放 lease；规则 16 第五轮（fable 5.1）已审改稿，2026-09-14 用户签收"
---

# Conversation 时间线正文：会话与子代理 pill

> 需求：[PRD-003](../../docs/product/requirements.md#prd-003-时间线与输入)（`accepted`；本稿 S0 增补一条可观察陈述与一条验收）。
> 打开形态沿用 [PRD-016](../../docs/product/requirements.md#prd-016-conversation-session-窗口与-chat-tab) 与 [ADR-002](../decisions/002-conversation-session-windows.md)，本稿 **不改** 其正文：子代理仍是叶内居中**子代理对话框**，「打开为 tab」才升 tab。
> 时间线正文渲染边界见 [lens-and-trajectory](../../docs/systems/conversation/lens-and-trajectory.md)；session 窗口与 chat tab 见 [session-windows](../../docs/systems/conversation/session-windows.md)；已签收方案见 [conversation-session-windows](conversation-session-windows.md)。
> 不变量：INV-NO-COPILOT / INV-TOPO（[ADR-006](../decisions/006-shell-invariants.md)）。诚实降级见 [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级)。
> 活数据权威仍是 [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威)（`blocked`）。本稿 **不**升 PRD-008，**不**新增任何引擎 RPC。

**Goal：** 让时间线正文里指向本仓某个会话或某个子代理对话的链接，从今天「渲染阶段被清洗掉、或点一次被当成外链打开两遍」变成一枚可辨认的行内 **会话 pill**（时间线正文里可点的会话/子代理行内标签）：悬停给出会话标题、工作区目录与当前 agent/模型三类事实中**能拿到的那几行**，点击按 PRD-016 已拍板的形态打开——同会话的工具子代理进叶内居中**子代理对话框**，另一个会话先 **reveal 该 session 自己的叶**（已有则聚焦/恢复；无叶则建叶并成为唯一可见窗，旧叶只藏、**不**改 `part.sessionKey`），认不出的目标诚实地不画 pill、不跳转。

## 1. 选定与拒绝

| 议题 | 选定 | 拒绝 |
|------|------|------|
| 宿主 | 只在 `ConversationTurnContentAdapter.renderTurnBody` 内升级助手 markdown 渲染出的 `<a>`；识别、装饰、hover、点击路由四件事都收在这一个 adapter 实现里 | 新建 `ChatListRenderer` 或第二条时间线正文渲染路径；在 `conversationTimelineRenderer.ts` 各行模板里另挂链接监听；把正文渲染搬进 `contrib/chat` |
| 链接放行 | 在 `render` 的 `sanitizerConfig.allowedLinkSchemes.augment` 里放行 **且仅放行** `conversation-chat`；其余 scheme 保持 HEAD 白名单 | 放行 `agent-host-session`、`command`、通配 `'*'`；靠 `isTrusted: true` 把 `command:` 一起放进来 |
| 点击宿主 | 给 `render` 传**显式** `actionHandler`，由它单点分流；同批**删掉** adapter 今天挂在同一 container 上的第二个 `click` 监听 | 保留两条监听「互相兜底」；改读 `anchor.href` 却不管 `href` 已被渲染器清空；在 `activateLink` 之外再包一层 `stopImmediatePropagation` 打补丁 |
| 链接来源合同 | 正文里的 `conversation-chat:` 链接只有两个**显式**来源：(a) stub 帧源种子会话与单测 fixture 直接写（S4，本期唯一实际来源，文案带 `Stub`）；(b) 引擎接通后由帧源侧适配器在投影 `ConversationStubTurn.text` 时，**仅**改写引擎字面给出的会话链接 | 假设 UA 正文里已经有 `agent-host-session://`（本仓无此合同）；在自由文本里按 agent 名或会话标题猜引用；为拿到链接向引擎提新 RPC 或把本稿升 PRD-008 |
| 打开路由 | 同会话 `originKind === 'tool'` → `openSubAgent`；同会话 `chatId === 'default'` → 聚焦根 tab + 关对话框（**不**走会关 tool tab 的 breadcrumb）；同会话 `originKind === 'fork'` → 延伸 tab；另一会话 → 先 `revealSessionWindow` 再按同会话表。装饰与点击同一条 resolve。S3w 钉死叶级 SessionBar（方案 C，§3.4） | 只调 `switchSession`；就地改 `part.sessionKey`；只 `restoreSessionWindow` 当单叶切回已藏会话；SessionBar 方案 B（透镜拥有 bar）；每个新叶再 `mountSessionBar`；把未命中交给 `openSubAgent` |
| SessionBar 所有权 | **方案 C：叶级 bar，每扇 session 窗一份**（用户 2026-09-14 拍板）。与已签收 [conversation-session-windows](conversation-session-windows.md) L73「窗口 chrome……**每扇 session 窗一份**」/ L358「SelectBox 只切**当前叶**」及 PRD-016「**每扇窗口**有一键关闭……按钮」一致，主语是该叶 `sessionKey`（构造期常量），不需要焦点派生状态；两叶时用户用哪一叶的 SelectBox 就替换哪一叶。前提：bar 脱离透镜、「对话\|轨迹」迁页 chrome、隐藏叶透镜不得 `reset` 共享节点、overlay 改传 `lensTablist` 且可见形态不变 | **方案 A（Part 级唯一条，主语 = 焦点叶）**：与 L73 / PRD-016「每扇」措辞相悖，须改 PRD-016 依赖段并 supersede 签收方案；两叶时用户不能选替换哪叶；需要 `promoteLeaf` / `demoteLeaf` 拆装 secondary chrome。**方案 B（透镜拥有 bar）**：构造期挂载 / `void openEditor` / `reset` 清 window-nav，不可落 |
| adapter 依赖 | adapter 新增注入 `IHoverService` 与 catalog 读面；`IConversationSessionChatService` 的装饰器与接口先挪到 `common/conversationSessionChat.ts` 再注入（§3.2） | adapter 直接 import `./conversationSessionChatService.js`（经 overlay → lens → timelineTree 成环，§2） |
| 装饰时机 | 渲染时 resolve 一次 + 订阅 `onDidChangeCatalog(sessionKey)` / roster `onDidChangeSession` 补画（§3.2） | 只渲染时装饰一次，引擎 catalog / roster 晚到就静默缺 pill |
| 隐藏叶资源 | 叶被藏后其透镜释放 `sessionViewLease`，恢复可见时重取；tab / 导航栈 / 草稿保留（§3.4） | 隐藏叶常驻 lease（用户切过的每个会话都常驻订阅）；设隐藏叶上限 + LRU dispose（丢 tab，违 PRD-016 验收 2） |
| 并排打开 | **修饰键 / 右键「打开到旁边」不在本期。** 两叶已可见且目标无叶时，`revealSessionWindow` 走 HEAD 已有的 `openSessionBeside`（驱逐当前 secondary）——这是 PRD-016 验收 7 的既有并列，不是新手势 | 在 S3 为 pill 另写一份 beside；把「当前可见叶就地换成另一 session」当成并列的替代品 |
| SideChat / 非根 user | 本期 **不画 pill、点击无动作**。协议 `sideChat` 与 [conversation-session-windows](conversation-session-windows.md) §3.3b「与工具子代理同款对话框」仍有效，但不在本稿切片落地 | 命中 catalog 就装饰；实施时猜「与 tool 同款」或「与 fork 同款」 |
| pill 视觉 | Conversation 自绘轻量 pill（新 `conversationSessionPill.ts` + 自有 CSS），**视觉参考** ChatRichLink 的「图标 + 标题 + detail」行结构 | `import` `chatRichLink.ts`（该模块顶层就 import `agentSessions/sessionSummaryHoverService.js`，见 §2；进口门禁只扫直接 import，过得了门禁却把 `agentSessions/` 拖进默认窗）；把 `ChatRichLink` 拆到更低层以便复用（为几行 CSS 动 donor 共享文件）；复用类名 `.chat-rich-link*` |
| pill 数据源 | Conversation 自己的 roster + session chat catalog + live agent tree | 挂 Agent Host 的 `ILinkPresentationService` provider / watcher（那些规则由扩展与 Agents 窗注册，默认窗一条都没有）；在默认窗注册 `agent-host-session://` opener 与 Agents 窗抢 |
| hover | Conversation 自研轻量摘要：一行「会话标题 · 目标名」+ 工作区行 + 模型行，缺数据**整行省略**；经 `IHoverService.setupManagedHover` | `import` `agentSessions/sessionSummaryHoverService.ts`（进口门禁明禁）；把 `SessionSummaryHoverWidget` 迁到 `chatContentParts/` 或更低层再经 adapter 用；像素复制 Cursor 三行；无数据时回填 IDE 自己的工作区路径冒充会话工作目录 |
| 用户消息行 | 第一期只做助手行。`shouldRenderTurnAsMarkdown` 保持 `kind === 'assistant'` | 为了让用户气泡也出 pill 而改 `shouldRenderTurnAsMarkdown`；给用户气泡单独接一套 markdown 渲染 |
| Composer @ 补全 | **产品方向选定，不在 S1–S4。** 输入区（`compose` / `turnEdit` / `queueEdit` 同一张 Composer）`@` 会话或子代理，展示必须复用本稿的 `conversationSessionPill` + §3.2 resolve + §3.4 打开路由，禁止另画一套 chip。宿主与发送合同另开切片（§7），先落地时间线助手正文 | 把 `@` 补全 / 换 textarea / 改用户卡塞进 S1–S4；import `chat/browser/widget/input/` 或 `agentHostInputCompletions`（C12 明禁）；在 textarea 里假装能画行内 pill |
| 需求顺序 | S0 先给 PRD-003 增补可观察陈述与验收，再动代码（规则 10a） | 先写 CSS / 先改 adapter，事后补需求 |

## 2. HEAD 事实锚点（2026-09-13 已核对；实施前再核对一次）

| 事实 | 位置 |
|------|------|
| 时间线正文唯一适配器：助手行走 `markdownRendererService.render(new MarkdownString(turn.text), undefined, container)`，随后在 **同一个 container** 上挂 `click` 监听，命中 `<a>` 就一律 `openUaClientExternalLink` | `src/vs/workbench/contrib/conversation/browser/conversationTurnContentAdapter.ts` `ConversationTurnContentAdapter.renderTurnBody` |
| 外链出口：确认后 `openerService.open(uri, { allowCommands: false, openExternal: true })` | `src/vs/workbench/contrib/conversation/browser/uaClientExternalLink.ts` `openUaClientExternalLink` |
| **`conversation-chat:` 链接今天连锚点都不存在**：清洗白名单只有 http / https / mailto / file / vscode-file-resource / vscode-remote(-resource) / vscode-notebook-cell / internal（`isTrusted` 才加 `command`）；dompurify 钩子对不合法 `href` **删属性**，随后 `rewriteRenderedLinks` 见 `href === null` 就 `el.replaceWith(...el.childNodes)`，整个 `<a>` 消失，只剩 label 文字 | `src/vs/base/browser/markdownRenderer.ts` `getDomSanitizerConfig` / `rewriteRenderedLinks`；`src/vs/base/browser/domSanitize.ts` `hookDomPurifyHrefAndSrcSanitizer` |
| 唯一放行入口是 `MarkdownRenderOptions.sanitizerConfig.allowedLinkSchemes.augment` | 同上 `MarkdownSanitizerConfig` |
| 渲染器把原始 `href` 挪进 `data-href`，`href` 先清空，**只有** `isPortableLinkTarget`（http / https / mailto 且非 `_…_` 占位 authority）才写回。故 adapter 读 `anchor.href` 对非 http 目标读到的是**工作台文档 URL**，不是链接目标 | `src/vs/base/browser/markdownRenderer.ts` `rewriteRenderedLinks`；`src/vs/base/common/htmlContent.ts` `isPortableLinkTarget` |
| **`actionHandler` 拿到的是 `data-href` 字符串**（`activateLink` → `target.dataset.href`），不是解析过的 `URI`；无 `markdown.uris` 时 `massageHref` 原样返回 | `src/vs/base/browser/markdownRenderer.ts` `activateLink` / `massageHref` |
| **今天 http 链接点一次会走两条路**：`MarkdownRendererService.render` 在 `options.actionHandler` 缺省时自己装一个（`openLinkFromMarkdown` → opener），`renderMarkdown` 又在 `outElement` 上挂 `click` / `auxclick` → `activateLink` → `preventDefault` + `stopPropagation` + actionHandler；adapter 的监听挂在**同一节点**，`stopPropagation` 挡不住同节点监听 | `src/vs/platform/markdown/browser/markdownRenderer.ts` `MarkdownRendererService.render`；`src/vs/base/browser/markdownRenderer.ts` `renderMarkdown` / `activateLink` |
| 进口门禁：**允许** `vs/workbench/contrib/chat/browser/widget/chatContentParts/`；**禁止** `contrib/chat/` 其它路径、`chat/widget/chatListWidget`、`chatWidget`、`chat/browser/widget/input/`、`agentSessions/`。失败条件是生产文件的**直接** `from '…'` import，不查 transitive、不扫 `import()`。**今天不禁 `vs/sessions`**（那条在 `conversationVisualizeImportBoundaries.test.ts`），测试 9 要真加 | `src/vs/workbench/contrib/conversation/test/node/conversationImportBoundaries.test.ts` / `conversationImportBoundaryScan.ts`；条款出处 [page-access-schemes](page-access-schemes.md) C12 |
| **透镜链今天不 import `conversationSessionChatService.js`。** 值 import 链：`conversationSessionChatService.ts` → `conversationSubAgentOverlay.ts` → `conversationLens.ts` → `conversationTimelineTree.ts` → `conversationTurnContentAdapter.ts`。adapter 若直接 import `IConversationSessionChatService` 即成 ESM 环，`createDecorator` 的 `const` 在 TDZ，类装饰器求值 ReferenceError（只在特定入口顺序 / 打包后暴露）。`IConversationRosterService` 安全是因为 `conversationStubService.ts` 不回 import 透镜链；`conversationSessionWindowService.ts` 只 import `conversationStubService` / `conversationPart`，也安全 | 各文件顶部 import |
| `chatRichLink.ts` 虽在被允许的 `chatContentParts/` 下，但**模块顶层**就 `import { ISessionSummaryHoverService } from '../../agentSessions/sessionSummaryHoverService.js'`；`ChatRichLinkDecorator` 构造要 `ILinkPresentationService` + `IHoverService` + `ISessionSummaryHoverService` | `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatRichLink.ts` |
| 子代理打开：`findOpenTabForChat` 命中先聚焦已有延伸 tab，否则 `ConversationSubAgentOverlay.open`；catalog `originKind: 'tool'` | `src/vs/workbench/contrib/conversation/browser/conversationSessionChatService.ts` `openSubAgent` |
| `chatId ≡ agent_id`，引擎根 agent 映射成 `default`，根不登记 catalog（GC-4 liveAgentTree） | `src/vs/workbench/contrib/conversation/common/conversationLiveAgentCatalog.ts` `collectLiveAgentTreeCatalogEntries` / `catalogChatIdFromAgentId` |
| 资源：`conversation-chat:/session/<sessionKey>/chat/<chatId>`（`URI.from({ scheme, path })`，authority 为空串，序列化单斜杠），根 `chatId === 'default'`；解析器现成。`parseConversationChatResource` **只看** `scheme + path`（正则 `[^/]+` 禁多段，两段各 `decodeURIComponent`），不拒绝非空 `authority` / `query` / `fragment`。`URI.parse` 已先 decode path，故 key 含 `/` 的**链接**形态会被正则拒（`URI.from` 形态保留 `%2F` 不受影响）。`findOpenTabForChat` / `openExtensionTab` 比的是 `resource.toString()` | `src/vs/workbench/contrib/conversation/common/conversationChatInput.ts` `ConversationChatInputScheme` / `getConversationChatResource` / `parseConversationChatResource`；`conversationSessionChatService.ts` `findOpenTabForChat` |
| 切当前会话在 roster 上；**并排**不在 roster 上，而在 session 窗口服务上 | `conversationStubService.ts` `IConversationRosterService.switchSession`；`conversationSessionWindowService.ts` `IConversationSessionWindowService.openSessionBeside` |
| **跨会话今天没有「可见叶跟着 roster 走」的 API**：`ensurePrimaryWindow` 在已有 `primarySessionKey` 时直接 return；透镜在 `boundSessionId !== undefined && sessionId !== boundSessionId` 时忽略 `onDidChangeActiveSession`（未绑透镜才跟随）；SessionBar SelectBox 的 `switchToSession` 今天是「关 visualize / history / snapshots、写 composer 草稿、`switchSession`，然后**同步**调 `showConversationPart`」，不 `setBoundSessionId`。[session-windows.md](../../docs/systems/conversation/session-windows.md) 写 `ensurePrimaryWindow`「跟随」active session，**HEAD 代码并不跟随**——本稿按代码取值，S3 改口该句 | `conversationSessionWindowService.ts` `ensurePrimaryWindow`；`conversationLens.ts` `onDidChangeActiveSession`；`conversationLensSessionBar.ts` `switchToSession` |
| **叶身份是构造期只读的 `sessionKey`**：`ConversationEditorPartImpl.sessionKey` 构造写入；`EditorParts.conversationEditorParts`（Map，按传入 key）、窗口服务 `leaves`、`subAgentOverlays`（Map，按传入 key）各自以 sessionKey 为键；`ConversationSessionChatService.getConversationPart` / `findOpenTabForChat` / `openExtensionTab` 按 **part.sessionKey** `find`。`createConversationEditorPart` 会 `void openEditor` 打开该 session 的根 `ConversationChatInput`。`hideSessionWindow` 对 `primarySessionKey` 直接 return（主叶不能藏） | `conversationEditorPart.ts`；`editorParts.ts` `createConversationEditorPart`；`conversationSessionChatService.ts`；`conversationSessionWindowService.ts` `hideSessionWindow` |
| **`createConversationEditorPart` 对已存在 key 直接返回旧 part**，不重新 `create` 到新宿主；`rollbackHalfAppliedLeaf` 只删 `leaves` / `leafOrder` / 容器，**不** dispose part，Map 的 `delete` 挂在 `EditorParts` 自己的 store 上。故「建叶失败 → 回滚 → 同 key 再建」会拿到挂在已 remove DOM 上的旧 part | `editorParts.ts` L212–216 / L248–249；`conversationSessionWindowService.ts` `rollbackHalfAppliedLeaf` |
| **每个透镜都持一条 lease**：`bindSessionView` → `acquireSessionView(sessionId)`；隐藏叶的透镜不释放。fork 延伸 tab 的透镜同样各持一条 | `conversationLensSessionBinding.ts` `bindSessionView` |
| **HEAD 无真实 `ConversationEditorPane` 夹具**：`conversationSessionWindowSideBySide.test.ts` 主路径用真 `EditorParts` + `ConversationPart`，但未注册 pane（`openEditor` 后无 `activeEditorPane`）；rollback 路径 stub `createConversationEditorPart` 造 `{ sessionKey, whenReady }` 假 part。`conversationLens.test.ts` 的 `mountLens()` 直接 `new ConversationLens`，不经 pane | 该测试 `createHarness` / `createPrimaryBootstrapHarness`；`conversationLens.test.ts` `mountLens` |
| **「对话\|轨迹」tablist 今天在 `mountSessionBar` 内**（bar 的 leading 区），overlay 里也可见。透镜已接受 `slots.lensTablist`，但只在**没有** `slots.sessionBar` 时才走该分支，生产代码无人传它（仅 `conversationLens.test.ts` `tablistOnly`）；`ConversationEditorPane.pageChrome` 只挂面包屑——HEAD 偏离 PRD-016 验收 9 / ADR-002「页 chrome」 | `conversationLensSessionBar.ts` L81 / L172；`conversationLens.ts` L265–270；`conversationEditorPane.ts` `createEditor` |
| 透镜重绑入口**已经存在**：`ConversationLens.setBoundSessionId`；`ConversationEditorPane.setInput` 已在 `parseConversationChatResource` 后调用它。缺的是 **为目标 session 准备它自己的 part/leaf/overlay**，不是透镜 API | `conversationLens.ts`；`conversationEditorPane.ts` |
| overlay 只由 `conversationSessionChat.contribution.ts` 的 `mountAll` 挂载（构造时 `getSlots()` 已有则立刻挂，之后 `onDidCreateSlots` / `onDidChangeVisibleWindows`），按 `getAllLeafSessionKeys` + `getLeafSlots(sessionKey).sessionWindow` 为宿主。`ensureLeaf` **本身不** `fireVisibleWindowsChange`；会开火的是 `tryBootstrapPrimaryWindow`、`openSessionBeside`、`hideSessionWindow`、`restoreSessionWindow`。reveal 若只 `ensureLeaf` 不开火，`openSubAgent` 会因 overlay 未挂 **throw**（throw 前若已走 `registerSubAgentChat`，catalog 会被污染） | `conversationSessionChat.contribution.ts`；`conversationSessionWindowService.ts` `ensureLeaf` / `fireVisibleWindowsChange`；`conversationSessionChatService.ts` `openSubAgent` |
| **SessionBar 是 Part 级单槽，却被每个叶的透镜再挂一遍。** [session-windows.md](../../docs/systems/conversation/session-windows.md) §1 写 `sessionBar` 是 Part 级窗口 chrome。`ConversationPart` 只有一个 `sessionBar` 节点；`conversationNavigation.contribution.ts` 已在其上挂 `.conversation-window-nav`。`ConversationEditorPane.createEditor` **总是**把同一节点交给透镜；`mountSessionBar` **append**；透镜 dispose 对同一节点 `reset()`，会把 window-nav 与别的叶的条一并清掉。`createConversationEditorPart` 立刻 `void openEditor` 根 input，每 `ensureLeaf` 一次就多一根条 | `conversationPart.ts`；`conversationEditorPane.ts`；`conversationLens.ts`；`conversationLensSessionBar.ts`；`editorParts.ts`；`conversationNavigation.contribution.ts` |
| **子代理 overlay 不是「无 bar」。** overlay 给透镜传的是它自己的 `sessionBarHost`（完整 SelectBox / New / Delete / 标题），CSS 把 icon、sync badge、title-wrap、controls `display:none`，露出 lens tablist。真正省略 `sessionBar`、只传 `lensTablist` 的路径**仅测试在用**。`IConversationLensSlots` 注释「Omitted in the sub-agent overlay」与 HEAD 不符 | `conversationSubAgentOverlay.ts`；`media/conversationSubAgentOverlay.css` |
| SessionBar **标题 / rename** 跟 `getBoundSessionId()`，**SelectBox 选中项 / Delete** 跟 `getActiveSessionId()`。生产透镜总是绑 `sessionKey`，故 `onDidChangeActiveSession` 在 `sessionId !== boundSessionId` 时直接 return | `conversationLensSessionBar.ts`；`conversationLens.ts` |
| `IConversationEditorPart` **没有** `focus()`；`EditorPart` / `Part` 也没有。组级 API 是 `IEditorGroup.focus()` → `ConversationEditorPane.focus()` → 仅当 `ua.client.chatInput.autoFocus !== false` 才 `lens.focusDockInput()`。`showConversationPart` → `ConversationPart.focus()` → `querySelector('textarea.conversation-lens-dock-input')` 取 DOM **第一个**（隐藏叶若仍在 DOM 且排在前面会被命中；两叶可见时永远是 DOM 靠前的叶，通常 primary），`autoFocus === false` 不聚焦，无 textarea 时聚焦 Part 容器。`getActiveConversationEditorPart()` 看 `activeElement` 祖先，否则 `conversationParts.at(0)`（Map 插入序 = 往往是旧 primary） | `editorGroupsService.ts` `IConversationEditorPart` / `IEditorGroup.focus`；`conversationEditorPane.ts` `focus`；`conversationSessionStatus.ts` `showConversationPart`；`conversationPart.ts` `focus`；`editorParts.ts` `getActiveConversationEditorPart` |
| `restoreSessionWindow` 只在 `visibleOthers.length >= MAX`（2）时才藏一个 secondary。单叶时 restore 隐藏叶 → **可见变成 2**，被恢复叶仍带着创建/demote 时的 secondary chrome | `conversationSessionWindowService.ts` `restoreSessionWindow` |
| `ConversationEngineRosterService.getSessions()` 四分支：已连接且 `!listCompleted` → 有 leftover 才返回 `engineSessions`，否则 `[]`；已连接且 bind-fail → **只**返回 `ENGINE_BIND_FAILED_SESSION_ID` 哨兵一行（`engineSessions` 已清空）；断连且 `wasEverConnected` → 原样 `engineSessions`（含 `source: 'engine-cache'`，无哨兵）；从未连接 → `super.getSessions()`（滤 `engine-cache`）。`isEngineRosterPlaceholderSessionId` 覆盖哨兵与 stub seed（`untitled` / `visualize`）。`markEngineSessionBindFailed` / `activateEngineSession` 在 active 真变时 fire `onDidChangeActiveSession`；已连接或 `wasEverConnected` 时 `createSession` 返回 `''` 不走 stub 路径 | `conversationEngineRosterService.ts` `getSessions` / `markEngineSessionBindFailed` / `activateEngineSession` / `createSession` |
| 叶 chrome 只在 `ensureLeaf` **创建时**按 `{ primary }` 挂：primary 加 `conversation-session-leaf-primary`、无藏钮；secondary 加 `conversation-session-leaf-secondary` 并 `mountSecondaryChrome`。之后 **没有** promote/demote API，也不能把已有叶的 chrome 拆掉再挂 | `conversationSessionWindowService.ts` `ensureLeaf` / `mountSecondaryChrome` |
| live tree / catalog 只绑 `getActiveSessionId()`（`bindLiveTreeLease` / `bindLiveTreeObservationLease`）；目标 session 从未当过活动会话时，其 tool catalog 通常为空（只增不减） | `conversationSessionChatService.ts`；`conversationEngineRosterService.ts` |
| catalog 同步手写字段：`collectLiveAgentTreeCatalogEntries` 只推 `chatId/title/parentChatId`；`syncSubAgentsFromLiveTree` 已有条目只比 `title`，新建条目手写 `sessionKey/chatId/title/originKind/parentChatId`，**不会** spread 新字段 | `conversationLiveAgentCatalog.ts`；`conversationSessionChatService.ts` `syncSubAgentsFromLiveTree` |
| `openSubAgent` 在 catalog 未命中时会 `registerSubAgentChat` 造一条 `originKind:'tool'` 条目 | `conversationSessionChatService.ts` `openSubAgent` |
| hover 可用数据：`ConversationStubSession` = `{ id, title, turns, source?, workDir? }`，hover 只用 `title` / `workDir`；`workDir` 由引擎 roster 从 `SessionSummary.work_dir` 填，引擎留空就没有 | `conversationStubModel.ts` `ConversationStubSession`；`conversationEngineRosterService.ts` |
| agent 名 / 类型 / 模型在活动树节点上（`agentId` / `name` / `type` / `status` / `model` / `turnCount` / `createdAt` / `children`）；`model` 是**必填** `string`（可为空串），`type` 是 `string`（`AGENT_TYPE_ROOT \| SUB \| MEMBER \| ADVISE` 只在 wire 层）。本仓 catalog 目前只留 `title` 与 `parentChatId`；`originKind:'tool'` 是 `syncSubAgentsFromLiveTree` 写的，不在 `collectLiveAgentTreeCatalogEntries` | `src/vs/platform/universeAgent/common/sessionView/types.ts` `LiveAgentTreeNodeView`；`common/conversationSessionChat.ts` `IConversationSessionChatEntry`；`conversationSessionChatService.ts` `syncSubAgentsFromLiveTree` |
| 用户行不是 markdown：`shouldRenderTurnAsMarkdown(kind) => kind === 'assistant'`，单测锁 `rendered-markdown` 只出现在助手行 | `conversationTurnMarkdown.ts`；`test/browser/conversationLens.test.ts` |
| 生产透镜经 `ConversationEditorPane` **总是** `setBoundSessionId(parsed.sessionKey)`。`conversationLens.test.ts`「session switcher changes visible title and timeline turns」用的是**未绑** `sessionKey` 的 `mountLens()`，不能代表生产 | `conversationEditorPane.ts`；`conversationLens.test.ts` |
| `createSession()` 会改 active 并 fire `onDidChangeActiveSession`；`createNewSession` 只调 `createSession()`，不建叶 | `conversationStubService.ts`；`conversationLensSessionBar.ts` `createNewSession` |
| Donor 对照（**不是**产品宿主）：装饰经 `walkTreeAndAnnotateReferenceLinks` → `ChatRichLinkDecorator`；pill 文案靠**扩展注册**的 presentation 规则（`uriPattern: /^agent-host-session:/i`）；Agents 窗在 `sessions` 层注册 opener + 两个 presentation provider + hover provider。默认窗一条都没注册 | `chatMarkdownDecorationsRenderer.ts`；`src/vs/platform/dataChannel/common/dataChannel.ts` `ILinkPresentationService`；`src/vs/sessions/contrib/chat/browser/openSessionLinkOpener.contribution.ts` |
| Donor hover 行结构：标题行「title · providerLabel」，位置块 Workspace / Worktree / Branch / changes，再 createdBy / externalSession | `src/vs/workbench/contrib/chat/browser/agentSessions/sessionSummaryHover.ts` `SessionSummaryHoverWidget` |
| Navigator「Reveal in Conversation」已经打开 PRD-016 overlay（PRD-022 验收 3）。本稿是时间线**正文内**的同目的出口，不是 Navigator。Reveal **只**用 `getActiveSessionId()`，不处理跨会话 | `src/vs/workbench/contrib/navigator/browser/navigatorReveal.ts` |
| `workbench` 不得依赖 `sessions`（ESLint `code-import-patterns`；`valid-layers-check` 不查这条） | [layers.md](../../docs/architecture/cross-cutting/layers.md) |

**与上一轮口头描述的两处出入，本稿按 HEAD 取值：**

1. 「会话/子代理链接今天会被当成外链」**只对 http/https 成立**。`conversation-chat:` 与 `agent-host-session://` 在清洗阶段就被删掉 `href`、锚点整个消失。所以 S1 的第一件事不是「拦截外链」，而是**先让锚点活下来**（放行 scheme）。
2. 「点击一律 `openUaClientExternalLink`」漏了 `MarkdownRendererService` 自带的默认 `actionHandler`。http 链接今天是 **双开**（opener 内部打开 + 外链确认弹窗 + `openExternal`）。S1 必须一并收口，否则 pill 会在新路由之外再被 opener 打开一次。

## 3. 设计

### 3.1 链接合同：谁写 `conversation-chat:` 链接

正文是 UA 帧源投影出来的 markdown 文本，本仓**不拥有**它的措辞。因此链接来源必须显式、可判定，且在引擎缺席时诚实为空：

| 来源 | 合同 | 本期 |
|------|------|------|
| stub 帧源种子会话 / 单测 fixture | 助手正文可直接写 `[标签](conversation-chat:/session/<sessionKey>/chat/<chatId>)`（S4，文案带 `Stub`）；亦可写字面 `/session/<sessionKey>/chat/<chatId>`，投影 `ConversationStubTurn.text` 时 **仅** catalog 命中 tool/fork 才改写成 `conversation-chat:`，未命中或已是该 scheme 则原样 | S4 直写已落；字面路径改写 D472 |
| 引擎帧源适配器 | 引擎正文里**字面**给出会话链接时，在投影成 `ConversationStubTurn.text` 的同一步改写成 `conversation-chat:`；改写前必须能解析出 `chatId` 并在该 session catalog 命中，命中不了**原样保留**（不造内部链接） | 不在本期切片；live-engine scheme/path 属 [R9](../progress/research-queue.md)，不猜、不发明 RPC |
| 自由文本推断 | **禁止**。不按 agent 名、会话标题或「看起来像会话」的字样猜引用 | — |

与 [glossary](../../docs/glossary.md) 的 attribution sidecar 同一条原则：**禁止按 title 猜测**（那条禁的是猜测身份，不是禁展示 catalog 已登记的 `title`）。

`sessionKey` 在链接里是必填段，因为 pill 要区分「同会话的子代理」与「另一个会话」，而这两条走完全不同的路由（§3.4）。省略 `sessionKey` 的短链不在合同里，解析失败即不画 pill。

### 3.2 渲染与点击宿主

`renderTurnBody` 的助手分支改成三步，全部留在 adapter 内：

1. **放行并渲染。** 给 `render` 传 `sanitizerConfig: { allowedLinkSchemes: { augment: [ConversationChatInputScheme] } }`。放行面**只有** `conversation-chat`；不放行 `agent-host-session`（默认窗不认它），不放行 `command`，不用通配。渲染后内部链接才会以 `<a data-href="conversation-chat:/…">` 存活（`href` 属性仍为空——它不是 portable target，这是上游有意为之，见 §2）。`new MarkdownString(turn.text)` 保持默认 `isTrusted === false`。
2. **单点路由。** 同一次 `render` 传**显式** `actionHandler`。它收到的是 **`data-href` 字符串**（见 §2），必须 `URI.parse` 后再走 `resolveConversationTimelineLink`：
   - scheme 是 `conversation-chat` → **永不** `openerService.open` / `openUaClientExternalLink`；未命中零动作。
   - scheme ∈ { http, https, mailto }（**按 scheme 分支**，不用 `isPortableLinkTarget` 当判据——它对 `_…_` 占位 authority 返回 false，会让 `https://_host_/…` 落不进任何分支）→ `openUaClientExternalLink`（与 adapter 今天的产品路径一致，收成一次）。
   - 其余已在清洗白名单内的 scheme（`file` / `vscode-file-resource` / `vscode-remote(-resource)` / `vscode-notebook-cell` / `internal`）→ 走 `openLinkFromMarkdown`（工作台内打开）。**禁止**把它们一律 `openExternal`。
   同批**删掉** container 级的第二个 `click` 监听。解析函数落在 `conversationTurnContentAdapter.ts` 旁的 `resolveConversationTimelineLink`（同目录新文件或同文件私有函数，实施选定一处即可）。
3. **装饰。** 渲染完扫 `a[data-href]`，**仅当 resolve 与点击走同一条命中规则**（§3.4）时升级为 pill。resolve 未命中 → **什么都不做**（label 保持普通文字，不画 pill、不装 hover、点击无动作）。S1 在 S2 之前就会放出可点锚点，因此 S1 的点击规则必须已经是「未命中零动作」，不能等 S2 才收。
   **装饰不是一次性的。** 引擎路径下 `getSessions()` 在 `listCompleted` 前可能为 `[]`、catalog 由 live tree 异步到达（§2），正文往往先于二者渲染。adapter 在 `renderTurnBody` 返回的 store 里订阅 `IConversationSessionChatService.onDidChangeCatalog(sessionKey)` 与 roster `onDidChangeSession`，事件到达时对本 container 内 `a[data-href^="conversation-chat:"]` **重跑同一条 resolve**：新命中的装饰、已装饰的不重复、仍未命中的不动。点击路由本来就是点击时 resolve，天然吃到晚到数据。不接受「晚到不补画」（PRD-007 只允许诚实省略，不允许该画却漏画）。

`resolveConversationTimelineLink` 合同：

- `URI.parse` 失败 → 未命中。
- `scheme !== conversation-chat` → 外链（交回 `openUaClientExternalLink`）。
- `scheme === conversation-chat` 但 `authority` / `query` / `fragment` 非空 → **未命中**（挡住 `conversation-chat://evil/…`、`conversation-chat:command:…`）。**不要**用 `uri.toString(true)` 与 `getConversationChatResource(...).toString(true)` 往返相等当门禁：`URI.parse` 会 decode path，`getConversationChatResource` 存的是 `encodeURIComponent` 后的 path，含 `:` / 空格 / `%` 的 sessionKey 会误杀合法链接。`parseConversationChatResource` 成功即可（正则已禁多段）。
- `parseConversationChatResource` 失败 → 未命中。
- `sessionKey` 不在 **注入的** `IConversationRosterService.getSessions()` → 未命中。禁止再套一层 `source !== 'engine-cache'`（见 §3.4）。
- `chatId === 'default'` → 命中，kind = 根会话。
- `chatId !== 'default'`：目标 session catalog 命中且 `originKind ∈ { tool, fork }` → 命中；`sideChat` / 非 default `user` / 查无此行 → **未命中**（不画、不跳，也不「停在根」）。
- 命中后，路由与 tab 比对**一律**用 `getConversationChatResource(parsed.sessionKey, parsed.chatId)` 重建规范资源（`findOpenTabForChat` 比的是 `resource.toString()`，§2），不拿链接 URI 直接比。
- key 字符集：`URI.parse` 先 decode path，sessionKey / chatId 含 `/` 的链接会被 `parseConversationChatResource` 的 `[^/]+` 拒掉，按合同**不画**；本仓 sessionKey（引擎 session id / stub id）与 chatId（`agent_id`）今天都不含 `/`，不为此另写解析器。

`IConversationTurnContentAdapter` 的对外形状（`renderTurnBody(turn, container): IDisposable`）**不变**，因此 `conversationTimelineRenderer.ts` / `conversationTimelineTypes.ts` 与既有测试替身不必改。adapter 新增注入 `IHoverService` 与 session chat catalog 读面；roster 已经可经 `IConversationRosterService` 注入。**禁止** adapter 直接 import `./conversationSessionChatService.js`——会经 overlay → lens → timelineTree 成 ESM 环（§2）。S2 断环，三选一、实施定一处写进 commit：(a) 把 `IConversationSessionChatService` 的 `createDecorator` 与 **DOM-free** 部分接口挪到 `common/conversationSessionChat.ts`（entry 类型已在那；`IConversationEditorPart` / `ConversationChatInput` / `URI` 在 `common` 可达），`mountSubAgentOverlay(sessionKey, host: HTMLElement)` 因含 DOM 类型留在 browser 侧扩展接口供 contribution 用（`common` 不得引用 DOM 类型，`valid-layers-check` 会拦）；(b) 在另一侧断环——`conversationSessionChat.contribution.ts` 自己 `createInstance(ConversationSubAgentOverlay)` 并经 `registerSubAgentOverlay(sessionKey, overlay)` 交给服务，`conversationSessionChatService.ts` 不再值 import overlay；(c) contribution 注册窄接口 `IConversationTimelineLinkResolver`（resolve + 路由）供 adapter 注入，服务接口不动。S3 再注入 `IConversationSessionWindowService`（`conversationSessionWindowService.ts` 只 import `conversationStubService` / `conversationPart`，无环）。

**分层与门禁：** pill / resolve 新代码在 `workbench/contrib/conversation/browser/`。S3w 允许动 `ConversationPart.focus()`、`EditorParts.getActiveConversationEditorPart` 与新增 `EditorParts.disposeConversationEditorPart`（`workbench/browser`），因为叶聚焦回退、跳过 hidden textarea 与 part 释放不在 contrib 里；`workbench/browser` **不得** import contrib 常量，`conversation-session-leaf-hidden` 等叶类名常量上移到 `workbench/browser/parts/conversation/conversationPart.ts` 导出，`contrib/conversation/common/conversationSessionWindow.ts` 改为 re-export。零 `vs/sessions` import；零 `agentSessions/` import；零 `chatRichLink` import；任何进入 adapter 的新 import 先查是否被透镜链反向依赖；`chatContentParts/**` 的既有用法仍只经本 adapter。

### 3.3 pill 视觉与数据

新 `conversationSessionPill.ts` + `media/conversationSessionPill.css`，自绘：

| 项 | 合同 |
|----|------|
| DOM | 原地改造渲染出的 `<a>`：加类 `conversation-session-pill`、`data-conversation-pill-kind="session" \| "subagent"`，内部插图标 span + label span（label 沿用作者写的文字，不被 presentation 覆盖） |
| 种类 / 图标 | **跟打开目标，不跟「是不是另一个 session」。** `chatId === 'default'` 或 `originKind === 'fork'` → `session` + `Codicon.agent`；`originKind === 'tool'`（含跨会话的 tool）→ `subagent` + `Codicon.commentDiscussion`（与子代理对话框标题同款）。禁止「跨会话 tool 画成 session pill、点下去却弹出子代理对话框」 |
| 类名 | **不得**出现 `.chat-rich-link*`；CSS 用 `--vscode-*` 令牌，不硬编码颜色 |
| 状态 | 第一期**没有** loading / 进度 / 变更计数 —— 那些在 donor 里靠扩展注册的 presentation watcher 供数，默认窗没有数据源，画了就是假数据（PRD-007） |
| 可访问性 | `<a>` 保留；`aria-label` 给出「会话标题 · 目标名」的文本形式（根无第二段）；键盘激活与点击同路由（`activateLink` 已含 `keydown`） |

### 3.4 hover、reveal 与打开路由

**hover 三行，缺数据整行省略：**

| 行 | 数据 | 缺失时 |
|----|------|--------|
| 标题行 | `<会话标题> · <目标名>`。会话标题取 roster 该 session 的 `title`；目标名取 catalog 该 `chatId` 的 `title`（tool = agent 名，fork = fork 名，不是一律叫 agent 名） | 会话标题缺 → 用 `sessionKey`（与子代理对话框现有兜底一致）；目标是根 tab → 只画会话标题，无第二段 |
| 工作区行 | roster 该 session 的 `workDir` | 整行省略。**禁止**回填 IDE 自己的工作区路径 |
| 模型行 | 活动树节点的 `model` | 整行省略。stub 期与断连期一律省略 |

模型与 agent 类型今天没有进本仓 catalog。S2 把 `ILiveAgentCatalogEntry` / `IConversationSessionChatEntry` 各加可选 `model?`（hover 模型行只用这一个；`agentType` **不加**，避免超陈述）。必须同时改三处，缺一则模型行永远空：`collectLiveAgentTreeCatalogEntries` 从 `LiveAgentTreeNodeView.model` 填；`syncSubAgentsFromLiveTree` 新建条目带上该字段、已有条目 `title` **或** `model` 变化都就地更新。空串与 `undefined` 同样省略模型行。**这不是新引擎合同**：`model` 在 `sessionView/types.ts` 里已经存在。无 live tree（stub / 断连）时为 `undefined`。catalog 是内存 `Map`，editor serializer 只存 `ConversationChatInput` 的 resource，加 `model?` 没有持久化丢字段路径。

**roster 命中口径（钉死）：** 只用注入的 `IConversationRosterService.getSessions()`。生产实现是 `ConversationEngineRosterService`：`wasEverConnected` 时**原样返回** `engineSessions`（含 `source === 'engine-cache'`）；SessionBar 与 Navigator 吃的就是这份。禁止再套 `ConversationStubService.getSessions()` 的 `engine-cache` 过滤，也禁止自己写 `source !== 'engine-cache'`。断连后 SessionBar 仍列得出的会话，pill 也必须能画、能跳。

**跨会话：`revealSessionWindow(sessionKey, options?: { replace?: string }): Promise<void>`（S3 新增，SelectBox / pill / `createSession` 触发的 active 变更共用）。**

主语是 **该 session 自己的叶**，不是「把当前 part 改成另一个 session」。`setBoundSessionId` / `setInput` 只是透镜钩子，**不是**窗口入口。`replace` 只在两叶可见时有意义：指定要让位的叶（SelectBox 传所在叶）；pill / listener 不传，按下表默认（驱逐当前 secondary）。若 `replace` 指向 primary，先 `promoteLeaf(目标)` 再藏它。

| 目标叶状态 | 动作 | 可见叶数 / part 数 |
|------------|------|-------------------|
| 已有可见叶 | 聚焦该叶（§3.4「聚焦」）；可另调 `showConversationPart` 保证 Part 可见 | 可见数不变 |
| 已有隐藏叶，当前仅 1 个可见叶 | `restoreSessionWindow` **不够**（HEAD 会变成 2 叶）。必须：restore → **`promoteLeaf(目标)`**（拆 secondary chrome）→ 目标写成 `primarySessionKey` → **`demoteLeaf(旧 primary)`** → `hideSessionWindow(旧)` → 聚焦目标 | 可见 1 |
| 已有隐藏叶，当前已 2 个可见叶 | 按 HEAD `restoreSessionWindow`（满员时藏一个 secondary）+ 聚焦目标 | 可见 2 |
| 无叶，当前仅 1 个可见叶 | `ensureLeaf(target, { primary: true })` → 目标写成 `primarySessionKey` → `demoteLeaf(旧 primary)` → `hideSessionWindow(旧)` → 聚焦目标。旧叶的 fork tab / overlay / 导航栈随隐藏叶保留（PRD-016 验收 2）。**禁止** `ensureLeaf(target)` 不传 `{ primary }` | 可见 1；`conversationParts.length` **可以 +1** |
| 无叶，当前已 2 个可见叶 | 走 HEAD `openSessionBeside`（驱逐当前 secondary）+ 聚焦目标 | 可见 2 |

**叶 chrome：** HEAD **没有** promote/demote。S3w **必须新增** `promoteLeaf` / `demoteLeaf`：不变量是「唯一可见叶无藏钮；非 primary 的可见叶有藏钮」。每叶 chrome 同款（叶级 bar 内含藏钮，HEAD 的 `mountSecondaryChrome` 标题 + 藏钮并入它），promote/demote 只切 `-primary` / `-secondary` 类名与藏钮显隐，不拆装节点。监听与 ActionBar 放 **per-leaf DisposableStore**，随叶 dispose，禁止挂在窗口服务生命周期上累积（HEAD `mountSecondaryChrome` 挂在 `this._register`）。`gridHost` 未挂时 reveal 与 `ensurePrimaryWindow` 一样 no-op / 排队。

**失败回滚：** HEAD `rollbackHalfAppliedLeaf` 只删 `leaves` / `leafOrder` / 容器，**不** dispose `ConversationEditorPart`，而 `createConversationEditorPart` 对已存在 key 直接返回旧 part（§2）——同 key 再建叶会拿到挂在已 remove DOM 上的旧 part。S3w 补：`EditorParts` 新增 `disposeConversationEditorPart(sessionKey)`（`workbench/browser`，§3.2 允许清单）并在 rollback 时调用。「不留半个叶」= `leaves`、`leafOrder`、`conversationParts` **三处**都不含该 key。失败时 **不**改 `primarySessionKey`、**不**藏旧叶，通知用户。

**隐藏叶释放 lease：** 每个透镜持一条 `acquireSessionView` lease（§2）。reveal 把每次 active 变更都变成建叶，用户切过的每个会话都会常驻订阅——与 HEAD 只有显式 `openSessionBeside` 才堆 hidden 叶不是一个量级。S3w 规定：叶被 `hideSessionWindow` 后，其 pane 内所有透镜（根 tab、fork 延伸 tab）释放 `sessionViewLease`（`sessionViewLifetime.clear()`），tab / 导航栈 / composer 草稿 / overlay 状态保留（PRD-016 验收 2 只要求 tab 还在）；`restoreSessionWindow` / reveal 使其可见时 `bindSessionView` 重取并吃 baseline。触发源：透镜订阅 `onDidChangeVisibleWindows`，按 `isSessionWindowHidden(boundSessionId)` 判定。隐藏叶不是「断开」，不得画 PRD-007 验收 5 的「断开前快照」条。拒绝「隐藏叶上限 + LRU dispose」（丢 tab，违 PRD-016 验收 2）。

**SessionBar 所有权：钉死方案 C（叶级 bar，每扇一份；用户 2026-09-14 拍板），拒绝 A / B。** overlay 不是「无 bar」模板（见 §2）。B（透镜拥有 bar、只让 primary 叶挂）不可落：透镜只在构造时 `mountSessionBar`；`ensureLens` 只建一次；pane 在 `ensureLeaf` 期间构造、此时 `primarySessionKey` 还没换成目标；`createConversationEditorPart` 是 `void openEditor`，reveal resolve 时目标透镜可能尚不存在；透镜 `reset(sessionBar)` 会清掉 `.conversation-window-nav`。A（Part 级唯一条、主语 = 焦点叶）被拒的理由见 §1 拒绝列；下表右列保留 A 的对照只为说明代价，不是候选。

前提：bar **脱离透镜**——`ConversationEditorPane` 不再把任何 `sessionBar` 传给透镜；`IConversationLensSessionBarHost` 里依赖透镜状态的部分（`switchToSession` 写 composer 草稿、关 visualize / history / snapshots）改为经该叶 pane 的访问器；「对话\|轨迹」迁到页 chrome（pane 不再传 `slots.sessionBar`，透镜自然走已有的 `slots.lensTablist` 分支；`ConversationEditorPane.pageChrome` 今天只有面包屑，须新增 `lensTablist` 宿主并传入）；隐藏叶透镜 dispose 不得 `reset` 任何共享节点；子代理 overlay 的透镜同样不再拿 `slots.sessionBar`，改传 `lensTablist`（其 `sessionBarHost` 只剩 tablist，`conversationSubAgentOverlay.css` 藏 icon / badge / title-wrap / controls 的规则随之删掉），用户可见形态不变。

| | **C：叶级 bar（每扇一份）— 钉死** | A：Part 级唯一条（已拒绝，仅对照） |
|---|---|---|
| 宿主 | `IConversationSessionLeafSlots` 增 `sessionBar` 槽，窗口服务 `ensureLeaf` 时挂在叶容器顶（与 HEAD `mountSecondaryChrome` 同模式，二者合并为一份叶 chrome）；Part 级 `.conversation-session-bar` 槽退役或只留空 | Part 级 `.conversation-session-bar` 由一个 Part 级 contribution 填充唯一 `.conversation-lens-session-bar` |
| 主语 | 该叶 `sessionKey`（构造期常量，无派生状态） | `focusedLeafSessionKey`（见「焦点叶」） |
| SelectBox 切 X | = 「让**这一叶的位置**换成 X 的叶」：单叶 → reveal 状态表；两叶 → 先 `revealSessionWindow(X, { replace: 本叶 })` 再 `switchSession(X)`（listener 对同 key 并入同一条 in-flight，`replace` 不丢；本叶是 primary 时先 promote X）。用户决定替换哪一叶 | 单叶 → reveal 状态表；两叶 → `openSessionBeside` 驱逐当前 secondary，用户不能选替换哪叶 |
| 标题 / rename / Delete / New 草稿 / sync badge / History / Snapshots 入口 | 读该叶 `sessionKey`；`getSessionSync(该叶)`（PRD-007 验收 4）；列表渲染进该叶 reading column | 全读 `focusedLeafSessionKey`；列表渲染进焦点叶 reading column |
| ←→ / 关非根 | 每叶一份：`conversationNavigation.contribution.ts` 改为 per-leaf 挂，直接传 `sessionKey`（`closeNonRootTabs(sessionKey)` / `canCloseNonRoot(sessionKey)` 已接受参数），对应 per-part 导航栈 | 仍 Part 级一份，打 `focusedLeafSessionKey`，禁止打 `conversationParts.at(0)` |
| 唯一可见叶 | 藏钮隐藏，其余 chrome 同款 | 需 `promoteLeaf` / `demoteLeaf` 拆装 secondary chrome |
| 与已拍板合同 | 满足签收方案 L73「每扇 session 窗一份」、L358「SelectBox 只切当前叶」与 PRD-016「每扇窗口有……按钮」；只需 supersede「`ensurePrimaryWindow` 跟随」 | 与 L73 / PRD-016「每扇」措辞相悖；S0 须改 PRD-016 依赖段（「窗口 chrome 为 Part 级、作用于聚焦窗口」）并在签收方案加 supersede |
| 可见布局变化 | bar 从 Part 顶落到每叶顶；两叶并列出现两条 | 无 |
| 计数不变量 | 每个**可见**叶恰 1 条 `.conversation-lens-session-bar`、Part 槽下 0 条 | Part 槽下恰 1 条（两叶并列仍 1） |

实施合同以 C 列为准；A 列不得被实施引用。

**焦点叶：** 窗口服务维护 sticky `focusedLeafSessionKey`（叶容器 `focusin` 捕获 + reveal 成功时显式写入；焦点离开 Part **不清空**）并 fire `onDidChangeFocusedLeaf`。HEAD 没有这类事件（`IConversationSessionWindowService` 无 focus 事件，`EditorParts` 对 conversation parts 无 active-part 事件），只靠对 `getActiveElement()` 的即时查询画不了持久 bar。叶获焦时 `switchSession(leaf.sessionKey)`（reveal 对已可见叶只聚焦、不建叶、不改可见集，故无回环），保证 Navigator / Sessions 列表 / SessionBar 的「当前会话」是同一份（PRD-022 验收 2）。叶级 bar 不读它（bar 主语是自己的叶）；它只用于对齐 roster active、`ConversationPart.focus()` / `getActiveConversationEditorPart()` 的回退，以及 window-nav 之外需要「当前叶」的调用方。已签收「SelectBox 只切当前叶」据此落地：SelectBox 所在叶即当前叶。

**聚焦：** 调 `part.activeGroup.focus()`，**不是** `IConversationEditorPart.focus()`（HEAD 无此方法）。`IEditorGroup.focus()` 只转给 `activeEditorPane.focus()`，而 `ConversationEditorPane.focus()` 在 `autoFocus === false` 时是空操作——必须改成把焦点落到该叶 container / group element，使 `getActiveConversationEditorPart()` 能解析到目标。同步改三处（允许动 `workbench/browser`）：

- `ConversationPart.focus()`：优先聚焦 `focusedLeafSessionKey` 所在叶容器内的 textarea（`IConversationPartService` 增 `setFocusedLeafContainer(el | undefined)`，由窗口服务在焦点叶变化时写入），无焦点叶时取**第一个可见叶**；HEAD 的「DOM 第一个 textarea」在两叶可见时会把焦点拉回 primary、覆盖 reveal 的聚焦。叶类名常量按 §3.2 上移。
- `getActiveConversationEditorPart()` 无 DOM 命中时回退 `focusedLeafSessionKey` 对应 part，再回退可见 primary，不是 `conversationParts.at(0)`。
- `switchToSession`：`showConversationPart` 只做 Part 显隐（或改在 await reveal 之后调用）；聚焦由 reveal 末尾 `part.activeGroup.focus()` 负责。HEAD 在 `switchSession` **之后**同步调 `showConversationPart`（§2），不改顺序则「两叶并列，选已可见的另一叶」永远聚焦回 primary。

测试在 `ua.client.chatInput.autoFocus=false` 下锁解析结果。

**in-flight 与串行：** 同 `sessionKey` 共用一条 Promise。不同 key **不得交错** hide/promote：钉死 **latest-wins**——后到的 key 取消尚未开始 DOM 变更的前一条，已进入 hide / promote 原子段的跑完再切；拒绝队列（会出现「roster active = B、可见叶 = A」窗口期，与 SelectBox 显示冲突）。`onDidChangeActiveSession` 把今天的 `ensurePrimaryWindow` 换成 `void revealSessionWindow`，但对 `ENGINE_BIND_FAILED_SESSION_ID` 与 `getSessions()` 没有的 id **零动作、不建叶**。生产 listener **不得**调用 `isEngineRosterPlaceholderSessionId`：该谓词还包含 stub 种子 `untitled` / `visualize`，原样挡会让种子会话永远不 reveal。接通时 `activateEngineSession` 把 active 从 stub id 换成引擎 id：reveal 目标是引擎 id；若 primary 叶仍键在 stub id 上，按「无叶」路径为引擎 id 建叶并藏 stub 叶（不要假设透镜 `onDidChangeConnection` 能冒充换叶）。

**Promise 收口：** resolve 之前必须已经 `fireVisibleWindowsChange`，且目标 overlay 已 mount。测试 14 的夹具必须 **构造 `ConversationSessionChatContribution`**（或 reveal 末尾直接调同一挂载钩子，实施选定一种写进测试），禁止只测窗口服务假 part。`void openEditor` 是异步的：await reveal 之后还要等到目标 `activeEditorPane instanceof ConversationEditorPane` 再数 SessionBar / 调 `openSubAgent`。

`revealSessionWindow` **不**调用 `switchSession`。SelectBox、`createNewSession`、Navigator 点会话行、通知点会话，仍各自 `switchSession`，由 listener 建/聚焦叶。pill：目标不是当前 active 时先 `switchSession`，再 **await** 同一条 in-flight。引擎接通下 `createSession` 要等 `activateEngineSession` 才 fire；`wasEverConnected` 断连时 `createSession` 可能不 fire——New Session 回归只锁 stub 未接通路径（`createNewSession` 已有断连守卫）。

**禁止：**

- 就地改 `ConversationEditorPartImpl.sessionKey` 或 `conversationEditorParts` 的 key。
- 只对旧叶 `setInput(目标根 ConversationChatInput)` / `setBoundSessionId(目标)`（透镜换了，`openSubAgent(目标)` 会找不到 part 并 throw）。
- 只调 `switchSession`。
- 用 `editorGroupsService.conversationParts.length` 不变当成功。
- 把未命中交给 `openSubAgent`。

SelectBox 回归面（S3 必写测试，夹具必须带 `sessionKey` 的 editor-pane **且走真实 `ConversationEditorPane.createEditor`**，不能只复用未绑 `mountLens()`，也不能只测窗口服务假 part）：

| 场景 | 用户看见 |
|------|----------|
| 单叶，选另一会话（无叶或已藏） | 时间线与标题换成目标（PRD-002 验收 1）；可见仍一叶；唯一可见叶**无藏钮**（叶级 bar 内藏钮隐藏）。**A→B→A** 后可见叶恰 1、`getPrimarySessionKey()===A`；A 叶透镜 lease 在藏时释放、回来后重取 |
| 两叶并列，选已可见的另一叶 | 聚焦该叶，不拆并列；`focusedLeafSessionKey` 与 roster active 都变成该叶；两叶各自 bar 不变。焦点不得被 `showConversationPart` 拉回 primary |
| 两叶并列，选尚无叶的第三会话 | 藏**操作所在叶**（`revealSessionWindow(X, { replace: 本叶 })`；若本叶是 primary 先 promote 第三会话叶），第三会话补位，另一叶不动、其 bar 与时间线不变。禁止只断言「某个 textarea 附近的时间线变了」却看错叶 |
| New Session | stub 未接通：新 session 成为唯一可见叶。引擎接通路径不在本回归表（`activateEngineSession` 异步 fire） |
| 删除当前可见会话 | 本期不重写 delete；若 delete 后 active 变了且 id 不是 `ENGINE_BIND_FAILED_SESSION_ID`、且仍在 `getSessions()` 里，同一 listener 会 reveal（stub 种子 `untitled` / `visualize` 也要 reveal）。若现有 delete 测试因此红，修测试或补 reveal，不把 delete 改成另一套切叶 |

**打开路由（先 `resolve`，未命中立刻 return；禁止把未命中交给 `openSubAgent`）：**

| 解析结果 | 动作 |
|----------|------|
| 同会话，`originKind === 'tool'` | `openSubAgent(sessionKey, chatId)`。已有延伸 tab 则聚焦（HEAD），否则子代理对话框 |
| 同会话，`chatId === 'default'` | `part.activeGroup.openEditor(根 input)` + 若子代理对话框开着则 `closeSubAgentDialog`。**不要**走 `navigateAgentBreadcrumb(…, 'default')`：那条在当前是 tool 延伸 tab 时会 **关掉** 该 tab，与测试「tab 数不变」冲突 |
| 同会话，`originKind === 'fork'` | 聚焦已有 fork 延伸 tab，未开则 `openExtensionTab`。**不**走子代理对话框 |
| 同会话，`sideChat` 或非 default 的 `user` | 不画、不跳（§1） |
| 另一会话且 resolve 命中 | **await** `revealSessionWindow(targetSessionKey)`，再按上面同会话表继续。目标 catalog 在 reveal 前未命中的非 `default` 链接在 resolve 阶段已被判未命中，**不会**走到「先切过去再停在根」 |
| 在子代理对话框内点 pill | 同会话 tool → `openSubAgent`，复用已开对话框替换预览（HEAD `overlay.open(state)` 语义，与面包屑同款，PRD-016 验收 5）；同会话根 / fork → 先 `closeSubAgentDialog` 再按上表；跨会话 → 关本叶对话框后 reveal。对话框内时间线走同一个 adapter，不另起一套 |
| 不在 roster / catalog 未命中 / 解析失败 | **不画 pill、点击无动作。** 不弹通知、不打开外链、不猜最近会话、不调用 `openSubAgent`、不打开目标根 tab（PRD-007） |

**诚实降级：** 断连（`isEngineConnected() === false`）时 pill 仍可画——它指向的是本窗口自己的 chat 目标，不是「已连接」声明；但 hover 的模型行省略，且不得出现任何同步 / 已连接措辞。

hover 用 `IHoverService.setupManagedHover(getDefaultHoverDelegate('element'), anchor, …)`（与 donor 同一 delegate 工厂）。

### 3.5 明确不在本稿

Composer `@` 的**宿主与发送合同**（产品方向见 §1 / §7，不在 S1–S4 落地）；在默认窗注册 `agent-host-session://` opener 或 presentation provider；Agents 窗任何改动；新 gRPC / 新引擎字段；`ChatEditorInput` / ChatEditor；修饰键 / 右键「打开到旁边」；pill 上的 loading / 变更计数 / 状态徽标；用户气泡 markdown 化（跟 Composer `@` 同一后续，不提前改 `shouldRenderTurnAsMarkdown`）；`sideChat` 对话框形态（留给 PRD-016 既有合同，不在 pill 切片展开）；就地改 `part.sessionKey` 的「主叶换身份」大改（若产品以后要这条，须另开 session-windows 修订并改 PRD-016 / ADR-002，不能藏在 pill 方案里）。S3w 对窗口跟随的改动**写在本稿**，但必须在已签收的 [conversation-session-windows](conversation-session-windows.md) 文首加 supersede 注记（`ensurePrimaryWindow` 跟随改口），**不**改 PRD-016 / ADR-002 正文（方案 C 与二者措辞一致）。隐藏叶上限 / LRU 回收（拒绝，见 §3.4 lease）。

## 4. 实施切片

每条独立验收。S0 无代码；S1 之后每个实施 commit 满足 [DOCUMENTATION 规则 3a/3b](../../docs/DOCUMENTATION.md)。

| # | 切片 | 内容 | DoD | 停止条件 |
|---|------|------|-----|----------|
| S0 | 需求与导航 | SessionBar 所有权已拍板 C（2026-09-14，随签收落稿；PRD-016 不动）。PRD-003 按 §6 贴文增补一条可观察陈述 + 一条验收（打开形态只引用 PRD-016 / PRD-002，不复述）；glossary 加「会话 pill」；traceability PRD-003 实施方案列加本稿。系统 INDEX 与 plans INDEX 已链本稿，不要再写成从零新增 | `check-docs-health.py` PASS；`generate-docs-status.py --check` PASS；PRD-003 仍 `accepted` | 增补若开始复述对话框 / tab / 并列，改成引用 |
| S1 | adapter 收口 | `allowedLinkSchemes.augment: ['conversation-chat']` + 显式 `actionHandler`（收 `data-href` 字符串 → `URI.parse` + §3.2 resolve）；删第二监听。内部资源未命中零动作；http/https/mailto 走 `openUaClientExternalLink`；白名单内其它 scheme 走 `openLinkFromMarkdown` | `conversation-chat:` 渲染后仍是 `<a data-href>`；http 点一次只开一次；file: 不走 `openExternal`；未知 / 畸形内部目标不走 opener、不切会话 | 外链确认测试若红则修测试，不改 `openExternal` 对 http 的语义 |
| S2 | pill 与 hover | 先按 §3.2 断环（三选一写进 commit）；`conversationSessionPill.ts` + CSS；只升级 resolve 命中的 tool/fork/default；渲染时装饰 + 订阅 `onDidChangeCatalog(sessionKey)` / roster `onDidChangeSession` 补画；hover 用 `getDefaultHoverDelegate('element')`；catalog 只加 `model?`，并改 `collectLiveAgentTreeCatalogEntries` 与 `syncSubAgentsFromLiveTree` | 命中有 pill；sideChat/未知/畸形无 pill；晚到 catalog / roster 后补画且不重复（测试 16）；断连无模型行；adapter 零直接 import `conversationSessionChatService.js`（门禁子串新增，测试 9）；门禁零 `chatRichLink` / `agentSessions/`；`valid-layers-check` 绿（`common` 不含 DOM 类型） | `LiveAgentTreeNodeView.model` 若不存在则停，不发明字段；断环若要改 overlay 挂载，只改挂载所在文件，不重排 overlay 行为 |
| S3 | 点击路由 + `revealSessionWindow` | **S3p 同会话三条（tool / default / fork）不依赖 S3w，可与 S2 同批落地；S3p 跨会话一条等 S3w。** S3w 按序：① 夹具先行——注册真实 `ConversationEditorPane` 的窗口夹具（HEAD 没有，§2），测试 8 / 10 / 12–17 共用；② `promoteLeaf` / `demoteLeaf` + 隐藏叶 restore 仍单叶；③ 叶级 SessionBar（C）：bar 脱离透镜、`IConversationSessionLeafSlots.sessionBar`、per-leaf window-nav、overlay 改传 `lensTablist`、「对话\|轨迹」迁 `pageChrome.lensTablist`；④ `focusedLeafSessionKey` + `onDidChangeFocusedLeaf` + 叶获焦 `switchSession`；⑤ `part.activeGroup.focus()` + `ConversationPart.focus` / `getActiveConversationEditorPart` 回退 + `switchToSession` 顺序；⑥ `revealSessionWindow` 状态机（latest-wins）+ listener 只挡 `ENGINE_BIND_FAILED_SESSION_ID` 与 `getSessions()` miss（不调用 `isEngineRosterPlaceholderSessionId`）；⑦ 失败回滚含 `disposeConversationEditorPart`；⑧ 隐藏叶释放 lease；⑨ [session-windows.md](../../docs/systems/conversation/session-windows.md) 改口 + [conversation-session-windows](conversation-session-windows.md) supersede 注记。S3p：pill 接同一入口；SelectBox 仍 `switchSession`（两叶时带 `replace`）。先 resolve，未命中禁止 `openSubAgent` | S3w：每个可见叶恰 1 条 `.conversation-lens-session-bar`、Part 槽下 0 条，连续单叶 reveal ≥3 与两叶并列都成立；A→B→A 可见恰 1 且无藏钮；每个可见叶恰 1 个 `.conversation-window-nav`；目标 overlay 已 mount；`autoFocus=false` 时 `getActiveConversationEditorPart` 是目标；两叶可见点已可见叶后焦点在该叶；rollback 后 `leaves` / `leafOrder` / `conversationParts` 均不含该 key；隐藏叶透镜 `sessionViewLease === undefined`、恢复后重取。S3p：同会话 tool 对话框且 `group.count === 1`；已有 tab 则聚焦；fork 可加延伸 tab；根 pill 关对话框且 **不关** 已有 tool 延伸 tab。跨会话：目标 `part.sessionKey === 目标`、该叶可见并被 `getActiveConversationEditorPart` 解析到、该叶自己的 bar 主语是目标、旧叶若曾存在则仍按其原 `sessionKey` 可查（只是 hidden）。单叶切到无叶或已藏会话后可见叶数仍为 1 | 禁止只断言 `getActiveSessionId()`；禁止就地改 `part.sessionKey`；禁止 `parts.length` 不变当成功；禁止 catalog 未命中却打开根 tab；禁止 S3p 跨会话在 SessionBar 仍会叠条时标完成；禁止 listener 为 `ENGINE_BIND_FAILED_SESSION_ID` 建叶；禁止用假 part 夹具替代 ① |
| S4 | fixture 与门禁 | stub/fixture 助手正文含 `conversation-chat:`（带 `Stub`）；知识层改口已落 | fixture 里 pill 可点；用户行仍纯文本；lens 既有断言绿 | 禁止 fixture 写引擎风格链接冒充引擎已给 |

S1–S4 全部可在**无引擎**下落地：链接目标是本窗口自己的 chat 资源，catalog 在 stub 期也有（fork / 手动登记），live tree 缺席只表现为 hover 少一行。跨会话非 `default` 的 fixture 必须**同时**在目标 session catalog 里登记对应 tool/fork 条目，否则按合同不画。

## 5. 测试计划

1. **放行：** 助手正文 `[a](conversation-chat:/session/s1/chat/c1)` 渲染后存在 `a[data-href="conversation-chat:/session/s1/chat/c1"]`；未放行的 `agent-host-session://…` 仍被清洗成纯文字（锚点不存在）。`command:` 仍无锚点（`isTrusted === false`）。
2. **不再双开：** http 链接点一次，opener 恰被调用一次且 `openExternal` 恰一次；`conversation-chat:` 链接点一次，`openExternal` **零**次、`openerService.open` **零**次。`file:` / `vscode-remote:` 点一次走工作台内打开，`openExternal` 零次。
3. **未命中诚实：** `conversation-chat:/session/unknown/chat/x`、格式非法、`conversation-chat://evil/session/s1/chat/default`、`conversation-chat:command:…`、以及 roster 有但 catalog 无的非 `default` → 无 `.conversation-session-pill`、无 hover、点击后 roster 当前会话与各 part 的 `sessionKey` / tab 数均不变。**禁止**出现「锚点可点却打开目标根」。
4. **pill 装饰：** `originKind === 'tool'`（含跨会话）→ `data-conversation-pill-kind="subagent"` + `codicon-comment-discussion`；`chatId === 'default'` 或 `originKind === 'fork'`（含跨会话）→ `"session"` + `codicon-agent`；label 文字仍是作者写的那串；DOM 上无 `.chat-rich-link*` 类名。禁止跨会话 tool 画成 `session`。
5. **hover 三行：** 三类数据齐 → 三行；`workDir` 为空 → 无工作区行；无 live tree → 无模型行；会话标题缺 → 显示 `sessionKey`；hover 文本不含「已连接 / 已同步」。
6. **路由 · 子代理：** 点击后子代理对话框打开、该组 `group.count === 1`、index-0 仍是根 input；已有延伸 tab 时再点 → 聚焦该 tab 且对话框未开。
7. **路由 · 根与 fork：** `chatId === 'default'` → 聚焦根 tab、**已有 tool 延伸 tab 仍在**（不走 `navigateAgentBreadcrumb`）、对话框未开（已开则关）；`originKind === 'fork'` → 延伸 tab（已开则聚焦），对话框未开。
8. **路由 · 跨会话：** 单叶时点另一会话（无叶或已藏）→ 目标 `part.sessionKey` 等于目标、该叶可见且聚焦、`getActiveConversationEditorPart()` 为该 part（含 `autoFocus=false`）、时间线与标题换成目标、旧叶 hidden 且 `sessionKey` 仍是旧值、可见叶数 1。**A→B→A** 后可见恰 1、`getPrimarySessionKey()===A`、唯一可见叶无藏钮。两叶并列时点已可见的另一叶 → 聚焦该叶（`document.activeElement` 在该叶容器内，不被拉回 primary），可见数仍 2，`focusedLeafSessionKey` 与 `getActiveSessionId()` 都是该叶；两叶各自 bar 的标题不变。只变 `getActiveSessionId()` / 只变 `boundSessionId` 而 `part.sessionKey` 仍是旧值视为失败。
9. **门禁与分层：** `conversationImportBoundaries.test.ts` 绿；断言 `contrib/conversation` 生产文件不含 `chatRichLink` / `agentSessions/` / `vs/sessions` import（`vs/sessions` 子串 HEAD 未禁，S1 加）；新增子串禁 `conversationTurnContentAdapter.ts` 直接 import `conversationSessionChatService`（或单测断言其 import 列表），锁住 §2 的环。
10. **不回归：** `conversationLens.test.ts` 的「助手 markdown / 用户纯文本」与 `rendered-markdown` 断言不变；`shouldRenderTurnAsMarkdown('user') === false`。SelectBox / New Session 用**带 `sessionKey` 且走真实 `ConversationEditorPane.createEditor` 的夹具**锁 PRD-002 验收 1（单叶切会话后标题与时间线跟着走）。
11. **SideChat：** catalog 里有 `sideChat` 条目时对应链接仍无 `.conversation-session-pill`、点击零动作。
12. **engine-cache 口径：** `wasEverConnected` 断连后，`IConversationRosterService.getSessions()` 仍列出的会话，对应根 pill 可画、点击会 reveal；不得因 `source === 'engine-cache'` 被滤掉。
13. **SessionBar 计数：** 夹具注册真实 `ConversationEditorPane`（S3w ①），等到 `activeEditorPane instanceof ConversationEditorPane` 后：连续单叶 reveal 三个不同会话，以及两叶并列——每个可见叶子树里 `.conversation-lens-session-bar` 恰 1、`.conversation-window-nav` 恰 1，Part 槽下 0。隐藏叶的透镜被拆掉后计数不变，可见叶的 bar 主语仍是各自的叶。禁止直接 `part.dispose()` 冒充「dispose 隐藏叶」（`conversationEditorParts.delete` 不挂在 part 上）。
14. **overlay 已挂：** 夹具构造 `ConversationSessionChatContribution`（或 reveal 调用同一挂载钩子）。`revealSessionWindow` await 且 pane 就绪后，目标 `openSubAgent` **不 throw**。
15. **reveal 串行与失败：** 连点跨会话 pill A 再 B，结束后可见叶是 B，且 A 的未开始段被取消（latest-wins，不出现 A 短暂可见再被藏）。建叶抛错时 primary 不翻、旧叶不藏、`leaves` / `leafOrder` / `conversationParts` 都不含该 key；同 key 再建成功且 part 挂在新容器上。`onDidChangeActiveSession(ENGINE_BIND_FAILED_SESSION_ID)` 不建叶。`onDidChangeActiveSession('untitled')`（stub 种子，`isEngineRosterPlaceholderSessionId` 为真但在 `getSessions()` 内）**会** reveal。
16. **晚到补画：** 先渲染含跨会话 tool 链接与根链接的正文，此时 catalog 无该条 / roster 尚无该会话 → 无 pill；随后 `registerSubAgentChat` / `syncSubAgentsFromLiveTree`（fire `onDidChangeCatalog`）与 roster `onDidChangeSession` → pill 出现；再 fire 一次不重复装饰、不叠 hover。adapter store dispose 后事件不再触发。
17. **隐藏叶 lease：** A→B 后 A 叶所有透镜（根 + fork 延伸 tab）`sessionViewLease === undefined`、tab 数不变、导航栈不变；B→A 后重取 lease 且吃到 baseline；不出现「断开前快照」条。

## 6. 知识层更新清单

| 文件 | 改什么 | 何时 |
|------|--------|------|
| `docs/product/requirements.md` PRD-003 | 在现有可观察陈述后增补一句：「助手正文里指向本窗口某个会话或某个子代理对话的链接，以行内会话 pill 出现；点按后的打开形态见 [PRD-016](#prd-016-conversation-session-窗口与-chat-tab)，切到另一会话时时间线更换见 [PRD-002](#prd-002-会话上下文) 验收 1。」在现有验收后增补第 6 条：「助手正文中可识别的会话/子代理链接渲染为行内 pill；点击后的打开形态遵循 PRD-016，本条不复述对话框、tab 或并列规则。无法识别的目标保持普通文字，点击不改变当前会话窗口与 tab。」**禁止**在 PRD-003 里再写一遍子代理对话框 / fork tab / 并列。 | S0 |
| `docs/glossary.md` | 新增「会话 pill」一条，S4 前标明待落地 | S0 写入，S4 改口 |
| `docs/systems/conversation/INDEX.md` | 「相关文档」**已链本稿**（2026-09-13）；S0 不重复新增 | 已做 |
| `docs/systems/conversation/lens-and-trajectory.md` | §内容渲染补 adapter 放行 / 单点 actionHandler / pill 与 hover / 晚到补画；明确无状态徽标；「对话\|轨迹」tablist 位置改为页 chrome `lensTablist` 槽（不再在 SessionBar 内） | S2 / S3w / S4 |
| `docs/systems/conversation/session-windows.md` | 删掉「`ensurePrimaryWindow` 跟随 active session」；改为 `revealSessionWindow` 状态机（§3.4，含隐藏叶 restore 仍单叶、latest-wins）+ 叶级 SessionBar（C）+ `focusedLeafSessionKey` / `onDidChangeFocusedLeaf` + 隐藏叶释放 lease + 失败回滚含 part + §1「sessionBar 是 Part 级窗口 chrome」改为「每扇 session 窗一份叶级 bar；Part 槽退役」 | S3w |
| [conversation-session-windows.md](conversation-session-windows.md) | 文首加 supersede：`ensurePrimaryWindow` 跟随改由本稿 S3w 落地；第 259/358 行「切当前窗/当前叶」指向所在叶 + reveal（L73「每扇一份」仍成立）。**不**改 PRD-016 / ADR-002 正文 | S3w |
| `docs/product/traceability.md` | PRD-003「实施方案」手写列加本稿；产品状态列由脚本生成 | S0 |
| `dev/plans/INDEX.md` | **已有**生成行；S0 只在改 frontmatter.status 后跑脚本 | 已做 |

`dev/progress/status.md` 在 S1 起每个实施 commit 前更新；本轮（方案未实施）**不**动它。

## 7. 风险与开放点

| 风险 | 缓解 |
|------|------|
| 放行 `conversation-chat` 会不会放宽正文的清洗面 | 放行面只有这一个 scheme，且 resolve 只认 authority / query / fragment 为空 + `parseConversationChatResource` 成功（§3.2，**不是** `toString` 往返）；`command:` 仍靠 `isTrusted: false` 挡住；测试 1 / 3 锁住 `agent-host-session://` 仍被清洗、畸形 `conversation-chat` 零 opener |
| adapter 注入 session chat 服务成 ESM 环（TDZ ReferenceError 只在特定入口顺序暴露） | §2 写明链路；§3.2 三选一断环；测试 9 子串门禁机械挡住 |
| 引擎 catalog / roster 晚于正文到达，pill 静默缺画 | §3.2 订阅 `onDidChangeCatalog` / `onDidChangeSession` 补画；测试 16 |
| 实施顺手回到 Part 级唯一 bar（A）或透镜自挂 bar（B），与签收合同双真相 | §1 拒绝列写明 A / B 代价；测试 13 锁「每可见叶恰 1、Part 槽 0」机械挡住 |
| `ConversationPart.focus()` 两叶可见时拉回 primary，覆盖 reveal 聚焦 | §3.4 聚焦三处改动（焦点叶容器 / 回退 / `switchToSession` 顺序）；测试 8 断言 `activeElement` 所在叶 |
| HEAD 无真实 pane 夹具，S3w 验收退化成假 part | S3w ① 夹具先行；停止条件禁止假 part 替代 |
| 建叶失败回滚留旧 part，同 key 再建拿到脱离 DOM 的 part | §3.4 失败回滚含 `disposeConversationEditorPart`；测试 15 |
| reveal-on-every-switch 让隐藏叶常驻 lease，订阅数随访问会话数线性涨 | §3.4 隐藏叶释放 lease、恢复重取；测试 17；与 [session-subscription-lifecycle](session-subscription-lifecycle.md) 的 lease 归属不冲突（那稿管重连，本稿管可见性） |
| 删掉 container 级监听后漏掉某条既有点击路径（非 `<a>` 的可点元素） | S1 先跑 `conversationLens` 全套；`actionHandler` 只接管 `a[data-href]`，与今天 `closest('a')` 的判定面一致 |
| 反悔复用 `chatRichLink.ts` 省事 | §1 已拒绝并给出理由（模块顶层 transitive 拖进 `agentSessions/`，门禁只扫直接 import）；测试 9 把 `chatRichLink` 写进禁止清单，机械挡住 |
| 引擎正文到底给不给会话链接（上游缺口） | §3.1 把 live-engine 来源排除在本期切片外。stub/fixture 字面 `/session/…/chat/…` 改写已由 D472 落地（catalog 命中才改）。live-engine scheme 仍记 [R9](../progress/research-queue.md)，按 [cross-repo-protocol](cross-repo-protocol.md) 登记，不发明 RPC |
| `LiveAgentTreeNodeView.model` 在真引擎下可能为空串 | 空串与 `undefined` 同样省略模型行；测试 5 覆盖 |
| 跨会话只调 `switchSession`、或只改透镜、或就地改 `sessionKey` 会假绿 / throw | §2 / §3.4 / S3 / 测试 8 锁目标 `part.sessionKey` 与旧叶身份 |
| catalog 未就绪却打开根 tab 变成半成品页 | 装饰与点击同一条 resolve；非 `default` catalog 未命中 = 不画不跳；测试 3 锁死 |
| pill 与 Navigator Reveal 两处出口行为漂移 | 已命中的 tool 都收敛到 `openSubAgent`；未命中禁止调用它。Navigator 仍只处理当前活动会话，本稿不改它 |
| 用户以为 pill 会显示运行状态 | §3.3 第一期无状态徽标 |
| SelectBox 与 pill 两套切会话 | S3 强制共用 `revealSessionWindow`；测试 10 / 12 用生产绑定夹具 |
| 每访问一个新 session 就多一个 hidden EditorPart | DOM / part / tab 保留（PRD-016 验收 2），但 lease 释放（§3.4）；不设隐藏叶上限（会丢 tab） |
| 唯一可见叶仍挂 secondary 藏钮 | §3.4 强制新增 `promoteLeaf` / `demoteLeaf`；S3w 测「单叶无藏钮」 |
| 每 `ensureLeaf` 叠一根 SessionBar；dispose `reset` 清掉 window-nav | §3.4 bar 脱离透镜 + 叶级 bar 随叶 dispose + 测试 13；S3w 未绿不得开 S3p 跨会话一条 |
| 「对话\|轨迹」仍在 bar 里，HEAD 已偏离 PRD-016 验收 9 / ADR-002 | 独立于 pill，但 bar 脱离透镜时顺手迁 `pageChrome.lensTablist`（§3.4 前提）；overlay 改传 `lensTablist`，可见形态不变 |
| 只 `ensureLeaf` 不开火导致 `openSubAgent` throw | §3.4 Promise 收口 + 测试 14 |
| 连点两枚跨会话 pill 交错 hide/promote | §3.4 串行 + 测试 15 |
| 跨会话 tool 画成 session pill | §3.3 / 测试 4 跟打开目标 |
| 单叶 restore 隐藏叶变成并列 | §3.4 拆行 + 测试 8 A→B→A |
| listener 为 bind-failed 哨兵建叶 | 只挡 `ENGINE_BIND_FAILED_SESSION_ID` + `getSessions()` miss（不调用 `isEngineRosterPlaceholderSessionId`）+ 测试 15（untitled 仍 reveal） |
| 根 pill 关掉已有 tool tab | 不走 `navigateAgentBreadcrumb`；测试 7 |
| `toString` 往返误杀合法 key | §3.2 改 parse + authority/query/fragment |

**仍开放（不阻塞正文）：** 修饰键 / 右键「打开到旁边」与 Navigator 入口如何统一；live-engine 正文链接格式（R9）确定后，帧源侧改写规则写在哪个方案（stub/fixture 路径改写已落，不闭合 R9）；`sideChat` 何时按 [conversation-session-windows](conversation-session-windows.md) §3.3b 画 pill 并走子代理对话框。已删除会话的隐藏叶 DOM / part 永不回收（lease 已释放），不在本期设上限。

**群聊 / DeepThink / Team member / Advise（引擎已有，本仓 Conversation 未分面；外仓细节待核，不当事合同）：** wire 层 `AGENT_TYPE_ROOT | SUB | MEMBER | ADVISE`，`LiveAgentTreeNodeView.type` 只是 `string`。HEAD `collectLiveAgentTreeCatalogEntries` **不看 type**，`syncSubAgentsFromLiveTree` 把非根一律写成 catalog `originKind:'tool'`。DeepThink / Circle 群聊的引擎形态不在本仓 docs 落锚，本稿 **不**按 type 分 pill、**不**加 `agentType`。若这类节点已经在 catalog 里且链接命中，点击会走今天的 `openSubAgent` 对话框——可能是错面。后续要分面时另开方案，先改 PRD。

**Composer `@`（产品已选定「同一套 pill」，阻塞的是宿主不是方向）：** HEAD Composer 是自研 `<textarea>`（[composer-and-inbox](../../docs/systems/conversation/composer-and-inbox.md) §8 / PRD-015 验收 8），画不出行内 `<a class="conversation-session-pill">`。Agents 窗那套 `@` 走 Monaco + `agentHostInputCompletions` + `ChatDynamicVariableModel`，默认窗进口门禁禁止。后续方案须先拍两件事，再动 PRD-015（规则 10a），不在本稿发明发送 RPC：

1. **输入宿主：** (A) 保持 textarea，`@` 弹出候选，选中后在输入区上方用同一 `conversationSessionPill` 做 chip，正文里只留稳定 token / `conversation-chat:` 字面；(B) 换 contenteditable / 自研编辑器，行内插同一 pill。选 (B) 等于重开 Composer 宿主，不能藏在时间线切片里。
2. **发出去之后：** PRD-015 写「用户回合展示为纯文本卡片」。要在已发送用户卡上也「一样展示」，必须改这条，并决定 `submitInput.text` 是带 `conversation-chat:` 的 markdown，还是 pill 只是 UI、载荷另附结构化 mention。引擎是否认 mention 属上游缺口，按 [cross-repo-protocol](cross-repo-protocol.md) 登记，不发明 RPC。候选名单与 pill 命中同一份：`IConversationRosterService.getSessions()` + 当前 session catalog 的 tool/fork/根。

## 8. 审查记录（规则 16）

2026-09-13：首轮 `draft`。规则 16 只读审查 **Approve with changes**。当轮已改入：跨会话不得只调 `switchSession`；`sideChat` / 非根 `user` 本期不画；fork 延伸 tab 不是「拒绝新开 tab」的偷换；未命中禁止 `openSubAgent`。

2026-09-13：第二轮独立审查 **Request changes**（[审查](ca38f5b8-c713-49a4-8dbf-dfe9728dec22)）。核验后当轮已改入：

- **Critical：** 跨会话改为 `revealSessionWindow` 状态机——为目标 session 准备**它自己的**叶（聚焦 / 恢复 / 建叶并藏旧 primary），禁止就地改 `part.sessionKey`、禁止只 `setBoundSessionId`/`setInput`。S3 / 测试 8 锁目标 `part.sessionKey` 与旧叶身份，删除「`parts.length` 不变」。
- **Critical：** 装饰与点击同一条 resolve；「catalog 未就绪停在根」删除。非 `default` catalog 未命中 = 不画不跳。
- **Important：** roster 命中只认注入的 `IConversationRosterService.getSessions()`；SelectBox / New Session 回归面写清并用绑定夹具；S0 贴出将写入 PRD-003 的原文；`actionHandler` 收字符串 + 畸形 `conversation-chat` 零 opener。
- **未采纳：** 无。Minor（hover 第二段对 fork 叫目标名不叫 agent 名；`model?` 无持久化路径）已写入 §3.4。

2026-09-13：用户提出 Composer / 编辑区 `@` 会话或子代理应同一套展示。**采纳为产品方向**，不纳入 S1–S4；§1 / §3.5 / §7 已写明须另开切片（textarea 画不出行内 pill；用户卡纯文本是 PRD-015）。

2026-09-13：第三轮独立审查 **Request changes**（fable 5.1 额度耗尽，本会话对照 HEAD 核验）。当轮已改入：

- **Critical：** `ConversationPart` 只有一个 `sessionBar`，每个叶的 `ConversationEditorPane` / `ConversationLens` 都会 `mountSessionBar` append；reveal 每建一叶就多一根 SelectBox，隐藏叶 dispose 还会 `reset` 共享 host。S3 **强制先 S3w** 收口所有权（A 或 B），测试 13 锁「恰好 1 根」。
- **Important：** HEAD 无 promote/demote，`ensureLeaf` 必须显式 `{ primary: true }`；`ensureLeaf` 本身不 fire visible，reveal resolve 前必须已挂 overlay（测试 14）；不同 key 的 reveal 不得交错（测试 15）；聚焦是叶 `EditorPart.focus()`，不是只 `showConversationPart`；pill kind 跟打开目标，跨会话 tool 不得画成 `session`；两叶选第三会话时 primary 时间线仍是原 primary。
- **未采纳：** 无。Composer `@` / 群聊 DeepThink 仍作开放点，不进 S1–S4。S0 PRD-003 贴文只引用 PRD-016 / PRD-002，无双真相。

2026-09-13：第四轮独立审查 **Request changes**（[fable 5.1](f52a7649-f824-4d57-9601-dc745d71870c)）。对照 HEAD 核验后当轮已改入：

- **Critical：** 「已有隐藏叶」只 `restore` 会在单叶路径变成并列；拆成 1 可见 / 2 可见两行，强制 `promoteLeaf(目标)` 再藏旧 primary；测试锁 A→B→A。
- **Critical：** SessionBar 钉死方案 A 并写迁移表；overlay 不是无 bar 路径；拒绝 B（构造期挂载 / `void openEditor` / `reset` 清 window-nav）。`displayedSessionKey` 统一标题、SelectBox、Delete。
- **Critical：** 聚焦改为 `part.activeGroup.focus()`；`ConversationPart.focus` 跳过 hidden 叶；`getActiveConversationEditorPart` 回退可见 primary；`autoFocus=false` 下锁解析。
- **Important：** listener 只挡 bind-failed / `getSessions()` miss（D469：不得调用 `isEngineRosterPlaceholderSessionId`，stub 种子 untitled 仍 reveal）；reveal 失败回滚；测试 13 等 pane 且锁两叶仍 1 条；resolve 不用 `toString` 往返；非 http 白名单走 `openLinkFromMarkdown`；根 pill 不走会关 tab 的 breadcrumb；session-windows 已签收方案加 supersede；测试 14 构造 contribution。
- **未采纳：** 无。Composer `@` / 群聊仍开放点。S0–S2 本身可做，S3w 未绿整稿不标 `accepted`。

2026-09-14：第五轮独立审查 **Request changes（S3w）；S0–S2 改两处文本后可先签收**（[fable 5.1](77c10215-cd67-4db7-b240-cd9f7e6fcfe4)；S1 渲染链路 / 窗口服务 / EditorParts 亲自对照 HEAD，叶与 catalog 事实由两个只读子代理各核 16 / 15 条，文档交叉引用自核）。当轮已改入：

- **Critical：** SessionBar「钉死方案 A」与已签收 [conversation-session-windows](conversation-session-windows.md) L73「每扇 session 窗一份」、PRD-016「每扇窗口有……按钮」相悖，且候选没列全——改为 **S0 由用户在 A / C 之间拍板**，§3.4 给对照表（宿主 / 主语 / 两叶语义 / 与合同关系 / 计数不变量），本稿推荐 C；拍板前 S3w 不开工，S1 / S2 / S3p 同会话三条不受阻。
- **Critical：** `displayedSessionKey` 无变更源（HEAD 无 focus 事件、无 active-part 事件）且与 roster active 分叉——改为窗口服务持有 sticky `focusedLeafSessionKey` + `onDidChangeFocusedLeaf`，叶获焦 `switchSession`，两案共用，PRD-022 验收 2 落地。
- **Important：** adapter 直接注入 `IConversationSessionChatService` 会经 overlay → lens → timelineTree 成 ESM 环（§2 链路），S2 三选一断环 + 门禁子串（测试 9）；resolve 只在渲染时跑一次会漏引擎晚到的 catalog / roster，改为订阅补画（测试 16）；`ConversationPart.focus()` 两叶可见时拉回 primary、`switchToSession` 在 `switchSession` 后同步 `showConversationPart`，聚焦改三处（测试 8）；HEAD 无真实 `ConversationEditorPane` 夹具，S3w ① 夹具先行；`rollbackHalfAppliedLeaf` 不 dispose part 而 `createConversationEditorPart` 复用旧 part，「不留半个叶」补 `disposeConversationEditorPart`（测试 15）；隐藏叶常驻 lease 与 reveal-on-every-switch 叠加成线性增长，改为隐藏释放 / 恢复重取（测试 17）；「对话\|轨迹」迁页 chrome 独立于 pill，作为 bar 脱离透镜的共同前提。
- **Minor：** §7 首行「`toString` 往返相等」与 §3.2 矛盾已改；`isPortableLinkTarget` 改为按 scheme 分支；规范资源用 `getConversationChatResource` 重建后再比 tab；key 含 `/` 的链接按合同不画；串行钉死 latest-wins；对话框内点 pill 的三条路由补进 §3.4；§2 事实修正（`ConversationStubSession` 形状、`originKind:'tool'` 写在 `syncSubAgentsFromLiveTree`、`model` 必填 `string`、`getSessions()` 四分支、门禁不禁 `vs/sessions`、Map 按传入 key）。
- **未采纳：** 「把 S3w 拆成独立 session-windows 修订方案」——第三 / 四轮已决定 S3w 写在本稿，拆分是结构变更，等用户拍板 A / C 时一并决定是否拆。

2026-09-14：用户拍板 SessionBar 所有权 **方案 C（叶级 bar，每扇一份）** 并签收整稿。A 移入 §1 拒绝列，§3.4 对照表右列只作代价说明；S3w 不拆成独立方案，仍在本稿；PRD-016 / ADR-002 正文不动；`revealSessionWindow` 增 `{ replace? }` 供 SelectBox 两叶场景指定让位叶。

`status` = `accepted`（2026-09-14 用户签收）。S1 可开；S3w 仍以 §4 DoD / 测试 13–17 绿为完成条件。
