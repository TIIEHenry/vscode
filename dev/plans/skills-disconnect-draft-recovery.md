---
title: "Skills 断连草稿保留与异步归属恢复"
type: plan
status: accepted
phase: N/A
updated: 2026-10-28
summary: "清空断连实时目录时独立保留未保存正文；原引擎显式刷新恢复比较基线，并隔离旧连接开关结果。"
---

# Skills 断连草稿保留与异步归属恢复

## 问题与依据

默认编辑器 Engine Preferences 的 Skills 是本方案唯一产品入口。以 `d91a7a8d361` 为源码基线，`engineSkillsSection.ts` 的 `applyDisconnectedRefresh()` 在真实断连时调用 `clearCatalogPresentation()`；该方法同时清目录、正文和比较基线。用户正在编辑 USER / PROJECT 技能时，普通连接中断会销毁未保存文字。现有新连接恢复测试只直接切 `published link`，没有经过 `connected=false`，未覆盖这个触发序列。

`toggleSkill()` 还没有 New / Save 已有的连接归属检查。旧引擎发出的启用请求在切换连接后返回，会继续刷新当前引擎并在当前节写出旧操作的成功或失败。dispose 后晚回也缺少同等检查。

产品依据是 [PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性) 的 Skills 补充验收；正文比较写入与刷新约定沿用 [队列与技能正文方案](engine-queue-and-skill-contracts.md) 及 [Engine catalog](../../docs/systems/workbench/engine-catalog.md#2026-10-27-skills-正文保存)。实时目录真断连清空、计数消失的既有合同继续成立；未保存正文不等于 RPC 目录缓存。

## 修复合同

### 1. 未保存正文独立于实时目录

- 清实时目录、选中行及计数时，若当前正文已编辑，保留正文、原引擎 identity、技能名、来源以及已加载的原文比较基线。残稿与当前引擎目录分开持有，不能因新引擎出现同名技能就改归属。
- 保存调用在途时也保留当前正文：用户可能在提交后把文字改回旧基线，此时 `bodyDirty=false` 仍不能证明当前正文已保存。旧保存结果和规范化读回不能越过断连代次改写残稿。
- 保存互斥归属具体操作 token，而不是跨连接的全局 boolean。断连、连接归属失效或 dispose 先保留当前正文，再使旧保存脱离当前编辑器互斥与结果资格；旧 RPC 可以继续在传输层 pending，但不能阻止新 link 的显式 Refresh 或后续保存。每个保存的 `finally` 只能释放自己的当前 token，旧请求 settle 不能解开新请求的锁。
- 断连、配对保持、能力 UNKNOWN / UNSUPPORTED、列表失败、原技能缺席或来源变化时，残稿保持只读，Save 关闭，正文旁说明恢复路径。目录清空不伪造实时条目，不为保稿保留计数。
- 未编辑的干净缓存仍按既有断连合同清除；真正 dispose 释放本组件内存。只保当前面板的在内存稿，不新增 storage、磁盘写入、跨窗口草稿或后台恢复。

### 2. 只有原引擎显式 Refresh 可以恢复写入

- 原引擎的新 link 连接成功只恢复目录，不自动授权残稿，也不自动用新正文替换残稿。当前正文保持只读，Save 关闭。
- 点现有 **Refresh skills** 后，必须在同一具体引擎 identity 下验证目录中原技能名和来源，再成功调用 `getSkillInfo` 取得该来源的当前原文，才更新比较基线并开放写入。刷新不覆盖残稿正文；正文与新基线相同则按真实比较清 dirty。
- 技能消失、来源变化、读取失败、配对保持、连接再次改变或组件 dispose 时，不恢复写入，也不丢稿。随后回到原引擎再次显式刷新可以重试。
- 异引擎即使有完全相同的技能名、来源及正文，也不能为原稿重设基线或开启 Save。选择其他技能或来源分组不能丢弃残稿。继续使用现有正文状态区域与幽灵刷新按钮，不改布局、密度、CSS 或主题 token。
- 编辑器撤销旧操作资格不等于取消引擎端写入。若同一引擎的旧写请求在重连后的比较基线读取之后才实际生效，后续写仍使用引擎 CAS 诚实拒绝冲突；保留新草稿并要求再次显式 Refresh，不把旧结果当成当前保存成功，也不以本地 token 保证跨连接 RPC 的服务器执行顺序。

### 3. 启用开关的异步结果归属

- `toggleSkill()` 发请求前捕获具体 published engine identity 与 link；无明确连接身份不发写请求。
- `ok:true`、`ok:false` 和异常路径均须在回包后及刷新后重验同一连接和未 dispose。旧连接结果不触发新引擎列表刷新、不重涂当前状态，也不改变当前选择或正文。
- 同一有效连接中的成功仍刷新目录并显示 Updated；失败仍恢复权威勾选状态并显示失败。现有请求形状、权限与能力门控不变。

## 文件边界与实施

生产修改限定 `src/vs/workbench/contrib/conversation/browser/engineSkillsSection.ts`；回归限定同域 `test/browser/engineSkillsSection.test.ts`。复用当前正文 owner / 比较基线和连接身份 helper，避免建立全局草稿服务或把技能放进 roster。不改 Providers / Models、Sources、visible lease、协议、引擎端或其他主工位 WIP。

文档先写产品补充验收，再同步 Engine catalog 的行为正文；方案、实施与验证分阶段提交。公共索引、状态和并行看板由父调度统一协调，实施 agent 不交叉编辑。

## 验证合同

所有编译、转译、typecheck 与产物更新只由父指定的唯一编译执行者在编译车道持 `/tmp/vscode-compile.lock` 执行。本槽只改源码、测试和本方案，不启动第二路构建。

1. 对 USER 与 PROJECT 真正经过 `setConnected(false)`：目录 / 计数清空，原稿逐字保留，正文只读且 Save 关闭，断连保存不发 RPC。原引擎换新 link 后仍不能直接保存；显式 Refresh 成功后正文不变，下一次保存携带重新读取的 raw CAS 基线。
2. 保存期间继续输入、改回旧基线、真实掉线：晚到的保存成功、失败与规范化读回均不能覆盖残稿或为新连接授权。旧 save 始终 pending 时，真实断连 → 原引擎新 link → 显式 Refresh 必须成功恢复；启动新 save 后再使旧 save 分别成功、业务拒绝、reject，新 save 的互斥不能被旧 `finally` 释放，第三次并发保存仍拒绝，新稿与比较基线不被旧结果改写。再模拟旧服务器写晚于恢复读取而生效，当前新写收到 CAS 拒绝时保持草稿，可再次 Refresh 恢复。
3. 异引擎同名技能、原技能缺席、来源变化与 SkillInfo 失败不能恢复；回原引擎再次刷新成功可恢复。清空正文也是合法未保存稿，不能因空串丢失。
4. Deferred 开关请求分别以 `ok:true`、`ok:false`、reject 在切引擎 / 同引擎换 link 后返回：当前列表读取次数、选择、正文和状态不被晚结果改变；dispose 后同等无副作用。有效同连接成功 / 失败旧覆盖继续成立。
5. 保留既有 `disconnect clears RPC catalog rows` 与 `leftover body stays after pairing re-select, then true disconnect clears` 的干净 bundled 缓存断言，不把它们改成保留所有缓存。完整 `EngineSkillsSection (E1)` 套件验证不回退已有 dirty 选择、能力三态、配对保持、CAS 和异常清理。
6. 唯一车道先以旧生产源码 / 新回归验证业务断言红，再以修复后生产源码验证绿；记录 source / out 身份、命令与真实结果。运行定向 ESLint 与原 project 约束检查；不把局部检查称为全仓编译通过。

新增只读残稿状态需由运行测试核对可见正文、只读属性、Save 门控和真实 Refresh 点击路径。未执行真实默认窗口联调时明确记录，不据源码或自动测试提升 PRD-025 总状态。

## 只读审查与当前状态

2026-10-28 Astra 独立规则 16 首轮只读审查为 Critical 0 / Important 1。已核实并改入 I1：原 `bodySaveInFlight` 同时阻止恢复读取与新保存，旧 `finally` 又无条件释放；本方案改为具体保存 token 的归属、失效与独占释放，新增旧 RPC 始终 pending 时的恢复和旧 settle 不释放新锁验收，并写明服务器旧写晚生效仍由 CAS 拒绝冲突。

同日 Astra 修订复审为 **Critical 0 / Important 0 / Minor 0**，确认 §1 token 独占释放与旧 pending 脱离当前互斥、§2 不误称取消服务器旧写并依 CAS 拒绝、验证 2 的 old pending → 重连 Refresh → new save → old success / refusal / reject → 第三写仍被拦完整覆盖 I1，方案可实施。方案先独立提交，再进入实施；当前未改生产代码、未转译、未运行单测，不宣称修复完成。
