---
title: "草稿会话提交后保留 Agent 浏览器页归属"
type: plan
status: draft
phase: M7
updated: 2026-10-05
summary: "草稿 chat URI 被正式 URI 替换后，只凭替换事件建立 owner 映射；删除时按映射目标匹配原始 removed 事件。后续工具访问与存储上下文分别验证。"
---

# 草稿会话提交后保留 Agent 浏览器页归属
状态：草案。
覆盖需求：无（正文未引用需求编号）。


> 范围：`src/vs/sessions/contrib/browserView/browser/sessionBrowserView.ts` 与对应测试；若工具访问验证失败，再扩到浏览器 group / Playwright 服务。此稿只定实施与验证边界，不将 PRD 状态升级。

## 问题与触发

首轮对话调用 `open_browser_page` 时，`getSessionId(invocation)` 取 `invocation.context.sessionResource`，新页的 `owner.sessionId` 因而可能是 `untitled-*` 草稿 chat URI。Copilot 首发的 `sendRequest` 与提交事件异步交错，提交后 provider 删除草稿缓存并把它替换为正式 session。`SessionBrowserViewController._rebindBrowsers` 已迁移打开页的内部 `tracked.session`，但上下文筛选仍优先用不可变的 `input.model.owner.sessionId` 查当前会话；旧 URI 找不到时直接返回 `false`。因此页没有被销毁，也可能从正式会话的浏览器上下文消失。

证据入口：`browserToolHelpers.ts#getSessionId`、`openBrowserTool.ts#_openNewPage`、`copilotChatSessionsProvider.ts#sendNewChatRequest`、`sessionBrowserView.ts#_rebindBrowsers` / `registerContextualFilter`。现有 `draft graduation keeps the browser with the committed session` 测试只造无 Agent owner 的页，不能覆盖该分支。

## 必须保持的合同

1. 只有 `onDidReplaceSession({ from, to })` 明确确认过的旧 owner 才能映射到 `to`。任意解析失败的 Agent owner 继续隐藏，不能借当前会话或已跟踪页来兜底，避免把别的会话页面露出来。
2. 草稿期创建、替换事件前未显示的 Agent 页也要跟随正式会话；替换事件后才完成创建、仍带旧 URI 的页亦须有确定归属。
3. 真正删除或归档正式会话时，旧 owner 页仍会销毁；映射随目标会话失效而清理，不跨会话复用。删除事件到达前目标可能已离开当前目录，清理不能依赖重新查询。
4. 不能把 `workbench` 反向依赖到 `sessions`。浏览器 owner 的访问控制、CDP group 与页面存储作用域不得因 UI 显示修正而放宽。

## 选定方向

在 Sessions 浏览器绑定控制器中记录**替换事件提供的旧 chat URI → 新 session 资源与 sessionId** 映射。映射覆盖 `from.resource`、`from.mainChat` 和当时 `from.chats` 的 URI；显示和认领时先按当前目录解析 owner，再仅对这些旧 URI 查映射，并从管理服务取当前目标。连续替换时把已有映射指向最新身份。映射不得按当前活动会话猜测。

删除路径另走事件中的身份：`onDidChangeSessions` 的 `e.removed` 和 `onDidDeleteSession` 给出被移除的 `ISession`，直接与映射保存的目标 resource / sessionId 比对，**先销毁已打开和未打开的匹配页，再清映射**。此时 provider 可能已把目标从缓存移除，不得调用当前目录解析来决定是否销毁。替换事件紧随的草稿 removed 仍按现有 `_replacedSessionKeys` 豁免；正式目标的真实删除不豁免。

不直接修改 `IBrowserViewOwner`：它也是 main 进程浏览器视图的 owner，当前没有更新 API；只在 renderer 改 `input.model.owner` 会让两侧身份分叉。也不把 `tracked.session` 当所有未知 Agent owner 的兜底，因为它可能只是页面出现时恰好打开的会话。

## 实施切片与验证

1. 先补 `sessionBrowserView.test.ts`：以草稿 chat URI 创建 Agent owner 页，替换为不同正式 URI 后仍只在正式会话可见；覆盖已打开页、未打开但已知的页、替换后才出现的旧 owner 页、二次替换与真实删除。删除用例先从管理服务的当前目录移除目标，再发 `removed` / `onDidDeleteSession`，确认旧 owner 页仍被销毁。保留未知 owner 不可见的反例。
2. 实现替换映射、统一解析和清理。映射以 owner URI 为键，只接受替换事件；正式会话资源查找失败时不显示页面。
3. 用一次首发真实工具调用验证 `open_browser_page` 在替换前创建页的时序；提交后切到其他会话再回来，页面仍在。继续用新 chat 的浏览器工具读/操作原页，并分别记录 CDP group 能否访问旧页、旧页 cookie/storage 是否保留、提交后新页是否进入另一 `ephemeral` affinity。**本计划要求旧页可继续使用及其页面内状态保留，不要求后来新开的页与旧页共享存储上下文**；若产品要跨页共享，另立合同。若新工具不能访问旧页，先补浏览器服务层的受控迁移方案及测试，再关闭本计划，不能只以 UI 可见作为通过。
4. 跑 Sessions 浏览器绑定单测与相关浏览器工具测试；最后做一次桌面时序复现。未复现竞态时保留静态回归测试，并把动态证据记为待验证。

## 退出条件

Agent 页在草稿提交前、提交中、提交后创建的三种时序下都归到正确的正式会话；切走不销毁，真实删除会销毁；未知 owner 不泄露；后续浏览器工具可操作原页。动态证据未齐前，方案不升 `implemented`。

## 只读审查与改稿

2026-10-05 独立只读审查指出：provider 发 `removed` 前已删目标缓存，删除不能复用显示路径的重新查询；泛 Agent audience 与旧 `ephemeral` affinity 还要求把工具访问和存储连续性拆开验证。本稿已按这两项改写删除完成式与验证边界；方案仍待实施与动态复现。
