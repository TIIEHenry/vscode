---
title: "Chat 并排比对：fork / 子 agent 落位到侧边"
type: plan
status: accepted
phase: N/A
updated: 2026-08-31
summary: "同一会话内两个 chat 并排比对：落位上限策略（2，可放开 N）与既有落位启发式的次序，fork 与子 agent 两个入口收敛；已签收"
---

# Chat 并排比对方案

> 需求：[PRD-011](../../docs/product/requirements.md#prd-011-chat-并排比对)。形态决策：[ADR-001](../decisions/001-chat-compare-form.md)（同 session 多 chat；双 session 孪生延后）。
> 就近 SSOT：`src/vs/sessions/LAYOUT.md`、`src/vs/sessions/SESSIONS.md`、`src/vs/sessions/LAYERS.md`。
> 本方案已经 Opus 5.0 审查（规则 16），Critical / Important 已当轮改入，见文末审查记录。2026-08-31 签收复查已改入上限复用目标澄清；`status: accepted`。

## 1. 目标与范围

**目标**：在同一个会话（同一个 agent 树）内，让 fork 出的分支对话、以及打开到侧边的子 agent 对话，与原对话**并排显示**以便比对。由比对入口触发的并排**上限为 2**；架构上为将来放开 N 预留。

**范围内**：chat group 落位上限策略及其与既有落位启发式的次序、fork 入口改造、子 agent「打开到侧边」入口收敛、单测。

**范围外（明确不做）**：

- session 级并排（同工作区双 session 孪生）——见 [ADR-001](../decisions/001-chat-compare-form.md)，延后而非否决。
- 同步滚动、diff 式高亮等比对增强。
- 用户手动拖拽 tab 分组能力的任何削减（手动路径不受上限约束）。

## 2. HEAD 事实锚点（写入时核对）

| 事实 | 位置 |
|------|------|
| chat group grid 支持 N 组：拖 tab 到边缘 split、按 `sessionId` 持久化（storage key `sessions.chatGroupsLayout`，L72） | `src/vs/sessions/browser/parts/chatGroupsView.ts` |
| `openChatInNewGroup(resource)`：chat 已在某组且组内多 chat → `_splitChatIntoNewGroup` 拆出新组；已单独成组 → 原地激活；未分配 → `openChat` → 守卫 → 在 active 组右侧新建组并从 reconcile 临时分配组 detach。**无组数上限** | `chatGroupsView.ts` L530–575 |
| `_splitChatIntoNewGroup` 有**组数 +1** 副作用（`_grid.addView` + `_insertGroup`） | `chatGroupsView.ts` L490–511 |
| **既有落位启发式**（`_reconcile` 内）：新出现的 chat 依次尝试 ① restore 保存的组 ② 当该 chat 是 session 的 active chat 且其 `origin.parentChat` 已分配时，落**父 chat 所在组的相邻组**（`_findAdjacentGroup`）③ 回落 `_activeGroup`。已有单测锁定（"opening a subagent … uses the group adjacent to its parent"） | `chatGroupsView.ts` L352–367 · `src/vs/sessions/test/browser/chatGroupsView.test.ts` L376 |
| `splitChatToSide(resource)`：side chat 创建时落位；未分配且有邻可靠时兜底调 `openChatInNewGroup`（L625） | `chatGroupsView.ts` L607–627 |
| `SessionView.openChatToSide(resource)` → `_groupsView.openChatInNewGroup(resource)` | `src/vs/sessions/browser/parts/sessionView.ts` L293–295 |
| `ISessionsService.openChatToSide(session, chatResource, options?: { preserveFocus })`：`_startOpenSession` 取消 token → 解析 superseded 重定向 → show session → `getSessionView` 拿不到视图时 **throw**；`preserveFocus` **并未**转发给 `sessionView.openChatToSide` | `src/vs/sessions/services/sessions/browser/sessionsService.ts` L189 / L957–971 |
| **fork 入口现状**：agent host 会话 `supportsMultipleChats` 时 `forkChatInSession` 后调 `sessionsService.openChat(...)`。**单组时**表现为原地切 tab、原对话不可见；已有 ≥2 组时，reconcile 的父组相邻启发式会把新分支落到父组邻组 | `src/vs/sessions/contrib/providers/agentHost/browser/agentHostForkActions.ts` L48–49 |
| **子 agent 入口现状**：`context.toSide && view` 时已调 `view.openChatToSide(...)`，无上限策略 | `src/vs/sessions/contrib/providers/agentHost/browser/openSubagentChat.ts` L81–85 |
| **focus 联动已接好**：组 `onDidFocus` → `_onGroupFocused` → 提升 active 组，组内 active chat 与 `session.activeChat` 不一致时自动 `openChat` 同步 | `chatGroupsView.ts` L295 · L661–695 |
| 每组一个 `AbstractChatView`（经 `IChatViewFactory` 创建，内部托管 `ChatWidget`）；同组多 tab 是单视图 `setChat` 切换。并排两个对话必须是两个组 | `src/vs/sessions/browser/parts/chatGroupView.ts` L200–213 · `src/vs/sessions/contrib/chat/browser/chatView.ts` |
| 手动并排入口：拖 tab 到边缘、Alt+点击 chat、会话列表「Open to the Side」；`SplitChatGroupRight/Down` 走 `splitActiveChat` → `_splitChatIntoNewGroup`，**不经过** `openChatInNewGroup` | `chatGroupsView.ts` · `src/vs/sessions/contrib/sessions/browser/sessionsActions.ts` L578 / L1430 |

**结论**：focus 联动、布局持久化、多视图共存是现有能力。仓内**已有一套落位启发式**（restore → 父组相邻 → active 组）；本方案新增的是「上限 + 到达上限时的复用」策略，并显式定义两套规则的次序（§3.1）。

## 3. 设计

### 3.1 落位策略（core，`ChatGroupsView`）

给 `openChatInNewGroup` 增加可选参数：

```ts
interface IOpenChatBesideOptions {
	/**
	 * 由比对类入口传入的组数上限。语义是「达到或超过上限时不再新增组」，
	 * 不收敛用户手动拆出的更多组。省略 = 不限（现行为）。
	 */
	readonly maxGroups?: number;
}

async openChatInNewGroup(resource: URI, options?: IOpenChatBesideOptions): Promise<void>
```

记 `atCapacity = this._groups.length >= (options?.maxGroups ?? Infinity)`。分支表：

| # | 前置 | 行为 |
|---|------|------|
| A1 | chat 已在某组，`!atCapacity` | 现行为不变：组内多 chat → `_splitChatIntoNewGroup` 拆出；单独成组 → 原地激活 |
| A2 | chat 已在某组，`atCapacity` | **禁止拆组**（`_splitChatIntoNewGroup` 会组数 +1，违反 PRD-011 验收 3）：在所属组内激活——`activeResourceId` 置为该 chat、`_setActiveGroup(所属组)`、`openChat` 同步 `session.activeChat`。组数不变 |
| B | chat 未分配，`!atCapacity` | 现行为不变：`await openChat` → 守卫 → 在 active 组右侧新建组，事务内从 reconcile 临时分配组 detach 后 attach 新组 |
| C | chat 未分配，`atCapacity` | **复用**，操作顺序与分支 B 同构：① `await openChat`（此时 `_reconcile` 会按既有启发式把 chat 临时分配到某组）② 守卫：`this._session` 未变且 chat 已出现在 `visibleChatTabs` ③ 事务内 `_detachChatFromGroup(reconcile 分配组)` → attach 到 `_pickCompareTargetGroup(parentResource)` → 该组 `activeResourceId` 置为该 chat ④ `_setActiveGroup(落点组)`。持久化由既有收尾兜底 |

目标组选择函数独立成员，便于将来替换：

```ts
/**
 * 到达上限时选择承接比对对象的组。次序：
 * ① 若有 parentChat：父 chat 所在组的相邻组（_findAdjacentGroup）
 * ② 否则：第一个非 active 组。
 * 权威是本函数（reconcile 的临时分配已被 detach）。maxGroups=2 时 ① 与 ② **不等价**（见下表）。
 */
private _pickCompareTargetGroup(parentResource?: URI): IGroupEntry | undefined
```

**两组（maxGroups=2）选择表**（勿写成「两者等价」）：

| 前置 | ① `_findAdjacentGroup(parentGroup)` | ② 第一个非 active 组 |
|------|--------------------------------------|----------------------|
| parent 在 `_activeGroup` | 邻居 = 非聚焦侧 | 同左 |
| parent 在另一组（首次 toSide 后 `_setActiveGroup(newGroup)`，HEAD L572） | **聚焦侧**邻居（父组保持可见） | 非聚焦的父组 |
| 无 `parentChat` | 不适用 | 覆盖 reconcile 的 `_activeGroup` 回落 |

PRD-011 验收 3 的「非聚焦一侧」按 **`_pickCompareTargetGroup` 结果**验收，不是字面「没有 focus 的那一组」。有 parent 且 parent 不在 active 组时，① 会选聚焦邻居，父对话保持可见。

**两套落位规则的次序（明确约定）**：未带 `maxGroups` 时，一切维持 `_reconcile` 既有启发式与 `openChatInNewGroup` 现行为；带 `maxGroups` 且到达上限时，落位以 `_pickCompareTargetGroup` 为权威，reconcile 的临时分配被 detach 覆盖。分支 C 在 `openChat` 之后，用已打开 chat 的 `origin?.parentChat` 作为 `parentResource`（与 `_reconcile` L359 同源）。将来放开 N 时需要同时审视这两处策略（不是一处）。

**边界结论（写明，勿留给实现者猜）**：

- 分支 C 不会让任何组变空（落点组既有 tabs 保留、来源组 detach 前至少含该 chat 及原有 tabs），不触发 `_removeGroups`。
- `_restorePending` 期间触发：`_persistLayout` no-op（L843）、空组被刻意保留，`_pickCompareTargetGroup` 可能选中空组——结果良性：chat 落入空组，restore 结束后 reconcile 补持久化。§5 用例 5 以往返恢复锁定净效果。
- 混合态：用户手动拆出 3 组后触发比对（`_groups.length > maxGroups`）→ 走 A2/C，不新增组也不收敛既有组。PRD-011 未描述此态，此处为方案自决，验收 6（手动不受限）不受影响。

**为 N 预留的约束**：不引入「左 / 右」「第一 / 第二」的布尔或字段；上限是调用方参数，core 内不写死 2；放开 N 时入口改常量或升级为配置（预留名 `sessions.compare.maxChatGroups`），并同步审视 `_pickCompareTargetGroup` 与 `_reconcile` 启发式两处策略。

### 3.2 API 透传（core）

- `SessionView.openChatToSide(resource, options?: IOpenChatBesideOptions)` → 透传给 `_groupsView.openChatInNewGroup`。
- `ISessionsService.openChatToSide(session, chatResource, options?: { preserveFocus?: boolean } & IOpenChatBesideOptions)` → **仅新增转发 `maxGroups`**。HEAD 现状 `preserveFocus` 不转发给 `sessionView.openChatToSide`，本方案不顺手改动该行为。
- `IOpenChatBesideOptions` 定义在 core 侧，contrib 只 import 类型（合规先例：`sessionsPartService.ts` L7 `import type { SessionView }`）。

### 3.3 入口改造（contrib）

比对上限常量单点定义（`contrib/providers/agentHost/browser/` 内共享）：`const COMPARE_MAX_GROUPS = 2;`

1. **fork**（`agentHostForkActions.ts` `_tryForkAsChat`）：

```ts
const newChat = await sessionsManagementService.forkChatInSession(session, sourceSessionResource, turnId);
try {
	await sessionsService.openChatToSide(session, newChat.resource, { maxGroups: COMPARE_MAX_GROUPS });
} catch (err) {
	// openChatToSide 在会话视图未挂载时 throw；fork 不应因此整体失败
	logService.warn(`[AgentHostSessions] openChatToSide failed, falling back to openChat`, err);
	await sessionsService.openChat(session, newChat.resource);
}
```

fork 默认即并排（PRD-011 验收 1 拍板），不做变体入口。

2. **子 agent**（`openSubagentChat.ts`）：`context.toSide` 分支改为 `view.openChatToSide(match.chat.resource, { maxGroups: COMPARE_MAX_GROUPS })`（该分支已有 `view` 判空，不经 `ISessionsService.openChatToSide` 的 throw 路径）。

3. **手动路径不动**：拖 tab、Alt+点击（`sessionsActions.ts` L1430）、会话列表「Open to the Side」（L578）、`splitChatToSide` 的兜底调用（`chatGroupsView.ts` L625）均不传 `maxGroups`，保持无上限（PRD-011 验收 6）。`SplitChatGroupRight/Down` 不经过 `openChatInNewGroup`，天然不受影响。

### 3.4 不新增的东西

- 不新增视图宿主、不动 `SessionsPart` / session 级 grid、不动布局控制器。
- 不新增持久化：`sessions.chatGroupsLayout` 现有序列化覆盖新落位结果（含 §3.1 边界结论中的 restore 时序）。
- focus / active chat / toolbar 联动零改动（PRD-011 验收 4）。
- **不改就近 SSOT**（`LAYOUT.md` / `SESSIONS.md`）：落位策略不是 part ownership 或跨 part 契约，未触其 specification change gate。

## 4. 实施切片

| # | 切片 | 内容 | 验证 |
|---|------|------|------|
| S1 | 落位策略 | `openChatInNewGroup` options + 分支 A2/C + `_pickCompareTargetGroup`；`SessionView` / `ISessionsService` 透传 | `chatGroupsView.test.ts` 新增用例（§5）+ 既有用例不回归 |
| S2 | fork 入口 | `agentHostForkActions.ts` 改调 `openChatToSide` + catch 回落 + 上限常量 | 手动冒烟（该入口无现成测试基建）：fork → 并排；再 fork → 落非聚焦侧 |
| S3 | 子 agent 入口 | `openSubagentChat.ts` toSide 分支带上限 | 手动冒烟：连续三次打开到侧边不出第三组（含 A2 路径：重开已是后台 tab 的子 agent） |

S1 与 S2/S3 分 commit；每个实施 commit 满足 DOCUMENTATION 规则 3a/3b。

## 5. 测试计划

`chatGroupsView.test.ts` 新增（fixture 注意：`createChat(id, status, parentChat?)` 固定生成 Tool origin；新用例须**显式控制 `parentChat` 有无**，避免无意命中父组相邻启发式导致断言的是既有行为；覆盖 fork origin 需小改 fixture）：

1. 单组时带 `maxGroups: 2` 打开未分配 chat（无 parentChat）→ 组数变 2，新组 active。
2. 两组时带 `maxGroups: 2` 打开未分配 chat → 组数仍 2，chat 落 `_pickCompareTargetGroup` 选中组并激活该组，被替换 chat 仍在该组 tabs 中。分别覆盖：(a) parent 在 `_activeGroup`（落邻居 = 非聚焦）；(b) parent 在非 active 组（落 ① = 聚焦邻居）；(c) 无 parent（落 ②）。
3. 两组时**不带** options 打开未分配 chat → 组数变 3（缺省行为不回归；本方案最重要的一道锁）。
4. 两组时带 `maxGroups: 2`，目标 chat 已在某组且该组多 tab → **不拆出第三组**，在原组内激活（分支 A2，锁 PRD-011 验收 3）。
5. 布局往返恢复：两组 + 复用落位后 `setSession(undefined)` → 重新 `setSession` 往返，分配与 active 组恢复（沿用既有 restore 用例基建；注意 `_persistLayout` 在组数 ≤1 时会清除条目，断言须在两组状态下做）。

手动冒烟（实施后计入 traceability 证据）：fork 并排、上限复用、focus 切换联动、重开会话恢复布局。

## 6. 风险与开放点

| 风险 | 缓解 |
|------|------|
| `openChatInNewGroup` 有多个既有调用方（Alt+点击、列表 Open to the Side、`splitChatToSide` 兜底） | options 为可选参数，缺省行为逐字保留；§5 用例 3 锁定 |
| fork 从 `openChat` 换成 `openChatToSide`，新增「视图未挂载 throw」「取消在途 open」路径 | catch 回落 `openChat`（§3.3）；子 agent 入口走 `view.openChatToSide` 不经该 throw |
| superseded 重定向：会话正被 adopt 时，`_resolveSessionForOpen` 会把落到侧边的换成 superseding 的 mainChat，fork 语义下表现为「比对对象丢失」 | 既有行为，非本方案引入；记录留观察，不在本方案处理 |
| fork 语义变化（单组场景从原地切 tab 变为并排）用户可感 | 产品已拍板默认并排（PRD-011 验收 1）；原对话保持可见 |
| 复用落位时目标组正在流式输出 | `setChat` 切换为既有能力（同组 tab 切换同路径），无新增风险面 |
| 复用分支产生空组 / 与 `_removeEmptyGroups` 竞态 | 不成立：分支 C 不会让任何组变空（§3.1 边界结论），不触发 `_removeGroups` |
| 上限常量放 contrib，将来多入口分散 | 常量单点定义；放开 N 时升级为配置项 |

**开放点（不阻塞本方案）**：到达上限且两组都在流式输出时是否提示用户？当前方案静默复用 `_pickCompareTargetGroup` 选中组（有 parent 时可能是聚焦邻居），如需提示留待实施后按反馈补。

## 7. 验收对照

| PRD-011 验收 | 由谁满足 |
|--------------|----------|
| 1 fork 并排 | S2 |
| 2 子 agent 并排 | S3（现有 toSide 基础上收敛策略） |
| 3 上限 2、复用 `_pickCompareTargetGroup`（非字面「无 focus 的组」）、被替换对话可回切、不出第三面板 | S1 分支 C + 分支 A2（§5 用例 2、4） |
| 4 focus 联动 | 现有能力，冒烟确认 |
| 5 布局恢复 | 现有持久化（§5 用例 5）+ 冒烟确认 |
| 6 手动拖拽不受限 | S1 缺省行为保留（§5 用例 3） |

## 8. 审查记录（规则 16）

- 2026-08-31 Opus 5.0 只读审查完成。已当轮改入：
  - **C1**：原分支表把「chat 已在某组」写成不增组数——与 HEAD 相反（`_splitChatIntoNewGroup` 组数 +1，可从子 agent 入口三击造出第三组）。已新增分支 A2 禁止到限拆组，原测试用例 4 重写为锁定该行为。
  - **C2**：原 §2 漏掉 `_reconcile` 既有落位启发式，「fork 现状原地切 tab」限定到单组场景；§3.1 明确两套落位规则的次序与 `_pickCompareTargetGroup` 的选择次序。
  - **I1**：分支 C 操作顺序改为与现有未分配分支同构（先 `openChat` + 守卫，事务内 detach + attach）。
  - **I2**：fork 改 `openChatToSide` 的 throw / 取消路径已加 catch 回落并入风险表；「透传」限定为仅 `maxGroups`。
  - **I3**：补「不新增组≠收敛」语义、手动 3 组混合态、restore pending 时序结论、superseded 重定向风险、空组竞态排除。
  - **I4**：补 [ADR-001](../decisions/001-chat-compare-form.md)。
  - Minor 已吸收：每组为 `AbstractChatView` 而非 `ChatWidget`；`SplitChatGroupRight/Down` 从受影响清单移出；用例 5 改往返恢复断言；fixture origin 注意事项;§3.4 增加不改就近 SSOT 的理由；S2/S3 验证改为手动冒烟。
- 2026-08-31 签收审查（并行只读 / inherit Grok 4.6；Opus 5.0 因账单未付未派）。HEAD 与上次 C1/C2/I1–I4 无漂移。已当轮改入：
  - **I1**：删掉「maxGroups=2 时两者等价」；补两组选择表；验收 3 改为复用 `_pickCompareTargetGroup`；分支 C 的 `parentResource` 取自 `origin?.parentChat`；§5 用例 2 分 (a)(b)(c)。
  - Minor 未改（不阻塞）：`IOpenChatBesideOptions` 建议放在 `ISessionsService` 旁以免循环 import。
