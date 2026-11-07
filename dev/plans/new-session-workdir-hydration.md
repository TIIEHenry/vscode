---
title: "新建引擎会话的工作目录补全"
type: plan
status: implemented
phase: complete
updated: 2026-11-05
summary: "新建会话绑定后读取有连接归属的 Session.Info，补齐名册缺失的 workDir；定向门禁与真实 SGLang 首屏验证已通过。"
---

# 新建引擎会话的工作目录补全
状态：已完成。负责：agent:codex；Sol 完成代码与门禁，Terra 完成真实首屏验证。

覆盖需求：PRD-029。

## 现象与既有合同

真实 SGLang 默认编辑器的冷 DB session_meta.work_dir 是隔离 workspace，file_read 也成功读取该目录中的 marker；身份条却显示 agent-home。`conversationEngineRosterService.ts` 在 lease 绑定成功后 adopt 新记录，只写 id/title/turns/source，没有补会话 workDir。`AgentSessionContext` 正常按[会话工作根合同](session-work-root-and-workbench-scope.md)回落 Connect.workDir，PIN 的该字段是 agent home；这是缺少会话元数据导致的显示偏差。

Session.Info.work_dir field7 在 PIN 和当前 IDE wire/mapper 中均存在，不需要改引擎、协议或 actor schema。当前 getSessionInfo 是可选 API，workbench 尚无调用；main 实现没有 expectedOwner。本方案沿用已有 expectedOwner 机制，使新查询绑定原始连接；仅在 renderer 前后比较连接不足以防止排队中的 RPC 发给后来连接。

## 实施边界

1. `IUniverseAgentConnection.getSessionInfo` 增加可选第二参数 expectedOwner；传给 renderer 的 IPC 将该方法加入已有 owner 参数位置 1 的 gate。main 用 `_withExpectedOwner` 在当前可信 transport 上执行并核返回时归属；Node 内部不带 owner 的历史调用保持兼容。owner 不进入引擎 request。补当前连接、缺 owner、错 identity/link、等待期间切换后 resolve/reject 的行为验证。
2. `monitorPendingEngineSessionBind` 成功、以 local id adopt 后，异步发一次 best-effort Info 查询。以绑定得到的实际 engineSessionId 查询，以 local sessionId 更新名册；不能假设两者相同。缺 hook、未知 owner、空目录、同步抛错或异步拒绝只保留当前 fallback，不能将已成功绑定降成失败或阻塞 Composer/queue。
3. 在 adopt 会触发的同步通知之前，捕获原名册记录对象、local/engine id、绑定所属连接 generation、identity/link；不能在通知后重新从可能已切换的连接或替换记录获取请求意图。请求前后核未 dispose、连接仍有效且非 pairing、同 generation/identity/link、原记录仍是同对象、response.sessionId 匹配实际 id，且当前 workDir 仍为空。有效返回只补该记录 workDir、持久化并发该 session 的变更事件；不改标题、active id、选择、队列或 lease。切到另一会话时允许补原记录，不能切回或抢焦点。
4. 不调用 `refreshEngineCatalog`：它会清绑定与待处理选择。已有 workDir 不覆盖；本轮只补新 adopt 的缺失值，不扩展成周期同步或自动重试框架。失败后继续保留既有名册刷新路径。
5. 不修改 `AgentSessionContext` 的优先级或 AutoMount 策略。connection fallback 可能在 Info 回来前已挂 agent-home，因此本方案只验收最终身份条/会话工作根正确；不声称阻止首次挂载，尤其不删除已挂工作区。文件树/代码编辑器原版尺度与 GPT 视觉合同不变。

## 验证与实施次序

- 规则16独立只读审查通过前不改代码；a3 真实运行及清理完成后才开放 source/out 写通道，避免运行中漂移。
- Sol 实施。名册行为覆盖实际/本地 id 不同、异步成功且 ready/queue/lease 不变、切到另一会话不回切、同 identity 换 link、generation 变化、dispose、记录替换、adopt 同步 listener 换 link/替换记录（不发送 Info）、响应 id 不符、已有目录、缺 hook/空/拒绝。用实际事件验证更新只通知对应会话；Context 对该事件刷新 work root。
- main/IPC owner 行为覆盖原始归属拒绝及等待后过期结果/错误，不以源码字符串断言代替。直接 Node 无 owner 的旧调用仍通过。
- 单一通道按影响选择定向编译、Node 与浏览器测试；完成独立实现审查，再做一次隔离默认窗口观察，将身份条最终目录与冷 DB 对照。真实模型仍为 SGLang Local。仅组件成功不升真实窗口验收。
- 同步长期事实到 [透镜与轨迹](../../docs/systems/conversation/lens-and-trajectory.md) 及 [引擎协议面](../../docs/reference/universe-agent/engine-protocol-surface.md)，过程保留 [SGLang 验证记录](../progress/sglang-provider-validation-2026-11-05.md)；不提交或暂存无关 WIP。

## 审查

agent:sol_fixture_modes 已按规则16完成独立只读审查，C0/I0。Minor 已采纳：明确用 local id adopt、用实际 engine id 查询，避免混淆。父窗口核验并接受方案；a4 的 reload 前 agent-home 证据促成本方案。Sol 已完成代码与定向门禁，Terra a5 在真实 SGLang Local 默认编辑器中于 reload 前验证 workspace folder chip，并完成原四步；实现与运行边界均已核验。

返回 [方案索引](INDEX.md) · [持续优化看板](../parallel/active/gpt-visual-sglang-goal.md)。

## 实施检查点

初次正式编译仅新增测试访问 private adopt 导致 TS2341；已改为夹具准备记录后走公开 switchSession，原证据保留在构建根 attempt1。第二次编译及connection/IPC套件通过，但源码peer发现重入I1：若adopt通知同步换link，通知后捕获owner会把旧session发给新连接；同时须在通知前保留原record引用。父窗口采纳并明确上述捕获时机，Sol补区分性回归后重新编译；第二次构建保留为attempt2，不作为最终源验收。证据根 `/tmp/session-workdir-build-20261105/`。

最终实现peer C0/I0，重入I1关闭：owner/generation在adopt前捕获，adopt返回原record；同步换link/替换record不发Info。最终正式compile-client exit0、src编前后相同；Node owner/IPC753通过，Chromium新增16通过，Electron完整roster+Context237通过，ESLint0error/6warning与HEAD多集一致，测试后src/out无变化。Chromium完整套件有17项process未定义的宿主失败，保留为该host结果，不把Electron通过混成Chromium全绿。中间attempt1–3保留；最终证据根顶层对应最后源。

实际验证已在原连接步骤后、提交前增加独立只读 initial-session-workdir 检查：唯一可见folder chip 的 title 为合成 workspace 完整路径、文本为目录名，30秒上限；原四步函数/断言/模型提示不改。该新工作根检查与 observer setup、原四步分别记账；v6 观察包的 a5 已通过，不依赖 reload 补齐目录。
