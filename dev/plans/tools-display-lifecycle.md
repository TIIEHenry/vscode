---
title: "Tools 固定高度列表的呈现与保存生命周期"
type: plan
status: accepted
phase: M7
created: 2026-11-02
updated: 2026-11-02
summary: "完整修复 Tools 固定高度行重绘、刷新提交顺序、保存互斥与晚编辑保留；原业务红断言保持。"
---

# Tools 固定高度列表的呈现与保存生命周期
状态：当前有效。负责：agent:codex。范围：Tools 一个完整冲突域；实施自动层与独立OV通过，真实默认窗口/引擎验收仍待。

覆盖需求：无（修复已有 Tools 交互合同，不新增产品能力）。

## 1. 问题、基线与边界

[D1395](../progress/deferred-gaps.md) 的新业务断言在 `51e790607b0` 真实失败：三套 163 passing / 1 failing，保存后 aria-checked 期望 false、实际 true。Astra 已核源码：固定高度 WorkbenchList 的 `rerender()` 直接返回，Tools 的 pending、save、toggle、profile-select 四条路径都依赖该 no-op；当前 save 已递增 refreshGeneration，旧 List 续体会被闸拒绝，不能把该失败直接说成旧请求越闸。

下一波从 `0ac6a61fe86087ed5fa690764ae98178239276b0` 开始。其 src/build/scripts/extensions tree 与完整 compile exit 0 的 `51e790607b0` 相同；Tools 原红作为既有基线保持，不删除或放宽断言。生产仅 `engineToolsSection.ts`，测试以 `engineToolsSection.test.ts` 为主，并按已签收合同迁移 `engineCatalogSections.test.ts` 的真实重连覆盖；公共 catalog 原有 false 断言保持。不得修改 List 基础组件、CSS 行高或其他设置页来绕开问题。

## 2. 呈现合同

### 2.1 稳定行身份与一次有效重绘

保留 24px 固定行高、现有 identityProvider 和虚拟化。四处 no-op 统一进入局部呈现方法：提交当前 entries 的一次 splice，必要时局部单行 splice；不切 dynamic heights、不复制 List 实现、不叠加多次整体重绘。

同数据纯重绘保存选中、列表逻辑焦点、scrollTop 与实际 DOM/checkbox 键盘焦点。List 的 splice 即使逻辑选择不变仍可触发 selection 事件，因此局部重绘须抑制内部选择副作用；不能在 splice 后 restoreToolSelection 再重复发 ToolInfo 请求，也不能制造对外重复选择事件。真正用户选择仍只执行一次详情加载。

renderTemplate 中创建的监听只注册一次，并在 disposeTemplate 释放；虚拟行复用不累积监听或重复 toggle。重建时不得把焦点移到未选行，滚动中复用的行显示当前项，不能保留上个项的 checked/disabled。

### 2.2 状态先提交，再呈现

完整 refresh 成功先一次提交 profiles、activeProfile、pending、mode、count 等相互依赖状态，再一次 setTools/splice。不能先画新工具、后清旧 pending，导致新行短暂继承旧 profile 的覆盖值。详情显式更新一次，列表重绘不能额外触发 ToolInfo。

进入 loading、failed、disconnected、pairing 或 capability 不可用时，先提交模式，再重绘仍显示的行，使 disabled/checked/aria 与真实写闸一致。恢复同 profile 的普通刷新不视作新授权，不应取消合法在途保存。

**pending 重基规则**：同 engine/link、workroot/source 的普通 List/完整 refresh 必须保留各 profile 未提交 pending，包含已 submitted 但尚未结算的值及 save 期间 late edit；先提交新 profiles baseline，再将各 profile pending 与新 baseline 重基，不能 `pendingEnablement.clear()` 整表吞稿。只有与新 baseline 已相同且不再有未结算授权的冗余覆盖才可移除，仍不同的覆盖留存。profile A→B→A 保留各自草稿。engine/link、workroot/source 实变则失效旧 op 并清旧 scope 覆盖，不向新 scope 搬旧稿；profile 从目录中消失时作废该目标/op、移除该 profile 无效覆盖并诚实显示无可写目标，不清其他 profile；用户主动清空仅清目标 profile 的覆盖并作废展示授权，不影响别的 profile；清空、切选、refresh 或隐藏都不提前释放未结 RPC 的后端 reservation。上述三类清理必须分别测试，不能把普通 refresh 当成主动清空。

## 3. 保存与异步结果合同

- 保存与 immediate toggle 共享按实际后端写目标及 profile id 分组的 in-flight reservationMap，不用全局 busy 阻止别的 profile。每次持有独立 op token；同一写目标的未结 RPC 互斥，一次用户操作只提交一次写请求。展示授权与后端预约分离，旧 finally 不能释放另一个操作的忙状态。
- 发起时复制 submitted pending 快照。成功只清理当前 pending 中仍等于 submitted 值的项，保存过程中产生的晚编辑保留；失败不清 pending，保持可重试内容。只用 pending.clear() 不成立。
- 保存成功作废之前的 List 请求，使旧 success/error 不能覆盖新 enablement、pending、mode 或状态文案。由保存作废 loading 的情况下，只在原 source/context 仍有效时恢复稳定模式，不能永久停在 loading，也不能依赖被作废请求退出 loading。
- success、catch、finally 都按 captured engine/link、profile id、工作根/source context、dispose 和 op token 校验；不能只保护 success。scope 变化后不画旧结果、不清新稿、不释放新操作。
- **A→B→A 的明确结果合同**：不以 `profileSelectionGeneration` 的历史次数单独否决写。若结果回来时仍为原 engine/link、workroot/source，目标 A 仍有效且当前回到 A，原 op 仍持有结算权，则接收结果；同 profile 普通 refresh 不失效。若仍在 B、目标被清空/移除、scope 实变、dispose 或后继 op 已取代授权，则旧结果不得作用于当前目标/新 token。新增返回 A 接收与仍在 B/清空/后继 op 拒绝的正反测试，不能只写“沿用写闸”。
- 保存成功必须以 `result.profile` 的返回 enablement 作为新 baseline 再重绘 DOM，不能只把请求值当成功结果。RPC 拒绝、返回缺少有效 profile 或 target 不匹配都保留未提交覆盖并显示可重试失败；catch/finally 同样过 scope/token 闸。
- 保存后有效重绘不能重复发后端写入或自动附加新的 refresh；若原流程有后续 refresh，继续受当前 scope/代次约束。

### 3.1 后端 in-flight 预约的已签收补充

Astra 对本窄补充独立 C0/I0/M0 APPROVED，父调度完整采纳，不引入新 Clear 控件。`SaveAgentProfile` 仅提交 profile，不带 projectPath，因此预约 key 明确是 `[stable engine identity, profile id]`；workroot/source/link 都不是锁 namespace，selectionGeneration 也不是 key。同一 engine 重连不能因新 link 绕过同目标的未结 RPC。匿名 identity 采用双向保守冲突：旧 op 或新请求任一缺 identity，同 profile 一律拒并发；两个明确且不同的 engine identity 才可并行。展示授权仍按原 engine/link/workroot/source 校验，与后端未结 RPC 的生命周期分开。

A1 未结时允许不同目标 B1，回到 A 再发 A2 必须被拒；只有 A1 的成功、拒绝或异常真正终态才释放自己的预约，且 finally 必须 `reservationMap.get(key) === op` 才删除。切选、同 profile refresh、清草稿、隐藏不提前解锁；反序结算不得互相释放。结果的展示授权仍单独检查 current engine/link/source/workroot/profile/dispose；结果回来仍在 B 时不修改 B，旧 A 只退休自己的预约，回 A 不留永久 busy。A1 尚未结束、回到 A 且原 scope/op 有效时仍可接 A1。此约束是当前面板/进程内预约，不宣称跨窗口 CAS 或服务端并发控制。

必测 A1→B1→回 A 的 A2 被拒，A1 终态后 A2 才可执行；A1/B1 反序 success/reject/throw 不互相解锁；同 engine 新 link 不绕预约，回 A 可接 A1。原延迟/失败/草稿保留与 busy/finally 矩阵继续成立。

### 3.2 预约终态与当前控件派生的已签收补充

Astra 窄审 C0/I0/M0 APPROVED，父调度采纳：旧 RPC 真正终态、按身份安全退休自己的 reservation 后，未 dispose 时允许无条件 `updateSaveChrome`，只按当前实际 reservation 派生保存控件；不得读取或应用旧 result、error、pending、baseline。行与详情重绘仍要求原 context 有效。必测同 backend/profile 换 link 或 workroot 后旧操作结算使 Save 恢复，当前 B 自己仍有 reservation 时继续禁用，旧 success/error 不改新数据、草稿或错误；dispose 后不触碰 DOM。

### 3.3 ToolInfo 同名详情的已签收补充

Astra 窄审 C0/I0/M0 APPROVED，父调度采纳：`loadToolInfo` 发起时捕获 engine/link、workroot/source；success 与 catch 共同校验详情 generation、当前选择和 dispose。scope 实变必须推进 info generation，防止 A→B→A 让旧详情复活；同 scope 普通 refresh 不机械取消合法在途详情。保持现有 pairing/disconnect 的 leftover 呈现，不扩大清空行为，不改变 reservation，也不增加 RPC。

使用真实 DOM 与 Deferred 覆盖三组：engine/link 改变、同名新 List pending 时旧 Info success/error 拒绝而新正常；workroot/source 同名切换（含 A→B→A）拒绝旧结果；同 scope 在途 Info 正向可回、真实选择一次仅一个 RPC、纯重绘零额外 RPC、dispose 晚回零 DOM 访问。

### 3.4 首次异步布局与 Catalog 重连覆盖的已签收补充

Astra 对实际代码复审确认首次 `ensureList` 创建没有重放已分配的 `lastLayout` 是生产问题：activate/layout 可先于 RPC 返回，count 事件不会自动触发布局。首次创建 List 时只重放一次已保存布局，保持 24px 固定行高与虚拟化。保留 layout-before-deferred-list 用例，不能 await 后补 layout 掩盖；其余交互使用真实 host 尺寸。

Astra 已批准 `engineCatalogSections.test.ts` 的点名合同迁移：原 `successful reconnect refresh clears pending enablement and keeps catalog ready` 实际只在已 connected=true 后再 `setConnected(true)`，同 engine/link1，没有 false。补真实 false→true，断开中间验证 disconnected、rows 清空和 dirty=false，恢复后 ready，保留原 false 断言；另增 true→true 同 scope 保稿的 dirty、真实 DOM pending、ready 和零 Save 对照。不全局 mock 换 link，也不直接把旧 false 改为 true。该第三文件属于本合同修正，不扩大生产域。

## 4. 四步实施与停止条件

1. 用真实 WorkbenchList/Checkbox 锁定原红及纯重绘选择、焦点、滚动和无重复 ToolInfo 合同，明确生产状态提交点；不删除原失败断言。
2. 收敛四处有效重绘及 refresh 状态先提交，处理虚拟模板监听回收和模式切换；保持 24px 与稳定身份。
3. 实现保存 op token、提交快照 compare-clear、旧 List 作废及 loading 退出，覆盖 success/catch/finally 与 scope 变化。
4. 唯一验证者运行原用例与完整 Tools 回归、聚焦 eslint、完整 compile 和文档门；非作者只读 OV。源码、测试、必要知识和行动层同主题提交，双域均终态后经 merge 安全集成。

若发现 List 基础组件需要修改、另一模块共享状态必须改合同、或已存在后端数据损坏证据，先报告父调度交 Astra，不擅扩域。普通既有红测按 health-gates 分类，不为追绿改口径。

## 5. 回归矩阵与验收

| 触发 | 必须证明 |
| --- | --- |
| 原 stale-list 用例及初次成功 | 原断言通过；首次可操作，保存后 aria-checked 真变，不借测试 stub 代替真实 Checkbox |
| 完整 refresh / 切 profile / pending 编辑 | 完整状态先提交；同来源 dirty refresh 保留并重基各 profile 覆盖，旧 pending 不画入新 profile；pending/profile 变化即时反映 |
| save晚编辑→同profile List先回→save再回；无save dirty refresh | submitted/late edit 不被 List 清空；成功只清提交值仍相同项，晚编辑保留；返回 profile baseline 决定 DOM |
| profile A→B→A、仍B、清target、source实变、后继op | 回A且原scope/token有效接收；其余旧结果拒绝且不改新token；普通refresh不因selectionGeneration误拒 |
| 延迟 save 与 List 两种交错、List/save 失败、返回空/无效 profile | 旧 List 不盖新值或错误；稳定 scope 正确退出 loading；拒绝/无有效profile留稿可重试，成功按返回profile而非请求值呈现 |
| save 期间晚编辑、重复 Save、immediate toggle | compare-clear 保留晚编辑；互斥只一次后端写；旧 finally 不释放新 token |
| engine/link/profile/workroot 改变、dispose | 旧 success/catch/finally 无新 scope 副作用；同 profile 普通刷新仍可正常结算 |
| 大列表滚动、键盘 Space、选择和 DOM 焦点 | 24px/虚拟化保持，行复用无错 checked/disabled，无滚动跳动、焦点丢失、重复监听或额外 ToolInfo |

检查全部经 integration 单通道，不由开发者另起编译或检查。`scripts/test.sh` 使用真实组件 fixture；这些结果不等于真实默认窗口、在线引擎或全产品验收。基线、命令、hash、退出码与原始日志落[本波看板](../parallel/active/tools-wiki-wave-2026-11-02.md)。

## 6. 真实默认窗口与真实引擎验收门

组件 fixture 是代码回归，不代替产品验收；分列两组证据，不借旧 ui-adaptation 窗口或 Sessions 壳过关。

| 门 | 实际操作与证据 | 缺环境或未验的状态 |
| --- | --- | --- |
| 默认编辑器窗口 | 以候选构建、[测试配置](../../docs/guides/test-profile.md) 的 user-data/extensions/shared-data 和 `--new-window` 打开，不加 `--agents`；实际鼠标与键盘 Space 操作至少两个 profile，检查 pending/save、A→B→A、焦点、滚动与大列表复用；延迟/失败注入与重试记录注入层，证明可见忙态及旧结果丢弃 | 组件测试/受控连接不能替代这一窗口操作。若未实际完成，记录待验，不能宣称真实交互通过 |
| 真实引擎持久化 | 按[钉死引擎](../../docs/guides/debug-engine.md) 接通同一 UNIVERSE_AGENT_HOME，使用可恢复的测试 profile，Save 后重新 List/切换并重新读回（需要时重开窗口）核服务端 enablement，最后恢复测试前值；与受控 RPC fixture 明确分开 | 引擎不存在、无两个可写测试 profile、读取或保存未实现等均诚实记缺口；不能拿请求成功或 UI 字段代替持久化回读 |

2026-11-02 17:02（Asia/Makassar）只读环境探测：测试 profile 三目录存在但记录 PID 已不存在；50061 无监听；merge Electron/out/Playwright 文件具备，尚未启动候选窗口/引擎。现 CDP 37567 属旧 ui-adaptation fixture-repo，不能作本波验收。该时点仅为准备事实，不证明将来环境一直可用；实施验收时重新核实。探测没有改 profile 或启动进程。

实际窗口必须从本波合入后的已验证源码启动，不读主仓 WIP 构建、不接管旧 CDP 37567。沿用测试 profile 三目录与原登录，不复制到 throwaway；可使用新的 CDP 端口或独立 DISPLAY，避免干扰外部 ui-adaptation 窗口。编译、启动和验收仍由 integration 唯一路执行，先核 50061 再按钉死引擎文档启动，避免双起。真实引擎能力、账号、可写配置或回读不可用时记录具体阻挡并保持 D1395 open，不因此阻断 wiki 主题或已验证代码的安全合入，也不要求人类先答复。此方案阶段不提前启动窗口或引擎。

代码与自动层可按证据提交；若默认窗口或真实引擎门未验，D1395 保持 open，方案不升整体 implemented，也不把组件自动绿升级为全产品体验完成。真实验收由唯一检查通道协调，保留既有登录与其他 worktree，不复制日常目录。

## 7. 知识与审查

实现时精确同步现有 Tools/catalog SSOT 与 [engine-write-gate-unification](engine-write-gate-unification.md) 的 S3 验证叙述，D1395 必须本方案自动层和上述真实验收门都有对应证据后才整体关闭，不升宽 PRD 状态。若未改变 API，不新增接口或远端 proto。

规则16已经执行：Astra 首轮 C0/I3/M1，要求明确 A→B→A、pending 重基与真实验收门；integration 当轮全部改入。修订正文固定 392b926… 和补充真实运行边界固定 56dce948… 分别获 Astra C0/I0/M0 APPROVED，父调度完整采纳。本文 accepted 仅表示方案签收，不表示实现、组件运行或真实窗口/引擎已通过；独立方案提交后才授权 A 实施。

采纳的执行解释：结果回来时若仍在 B，不修改 B 的展示或草稿；旧 A 仅退休自己仍持有的 token，不释放后继操作，之后切回 A 不得遗留永久 busy。若 A 还未完成且原 scope/op 仍有效，在结果返回前 A→B→A 可正常接收；不能用历史选择代次单独否决。

后端 key 的上述精确化亦经 Astra 窄审 C0/I0/M0 APPROVED，父调度采纳；不是跨窗口/服务端锁。

预约终态派生 UI 与 ToolInfo scope 两项增量均另获 Astra C0/I0/M0 APPROVED；只扩充上述必要防回流合同与回归，不以旧候选冻结 hash 代表最终代码。

2026-11-02 实施自动层：固定 production 309ae6f4 / ToolsTest d8820b09 / Catalog ee6ca0c5 在 A 独立 out 通过 compile-client、三文件聚焦 eslint、官方 Tools/Catalog/Agents 三套 206 passing；前序失败、修复及环境重试详见本波看板。Astra 最终独立 OV C0/I0/M0 PASS，真实默认窗口/引擎持久化尚待，D1395 保持 open，本文 accepted 不升整体 implemented。

真实默认窗口已在Node24组合绿的集成源码上执行鼠标/Space、两自有profile切换保稿与大列表滚动焦点子集；一次实际UI Save失败，wire来源关联未定。没有追加Save或故障注入，不把最终期望字段读回当成功保存。D1395仍open、本文不升整体implemented；[完整分层证据](../progress/tools-wiki-wave-2026-11-02-evidence.md)保留环境、无效准备样本、有限只读来源核对与未验门。

历史独立硬门[D1397/P1](../progress/deferred-gaps.md)曾确认Profile Save/Delete/Reset的renderer→main归属链缺失；现已由[19写入口方案](engine-catalog-mutation-ownership.md)完成本地代码/自动层及独立最终CommitGate签收，仅该owner专题closed。当前[D1398/P1](../progress/deferred-gaps.md)继续全局push hold，D1395真实Save来源未定P2保持open，本文accepted不升整体implemented或产品PRD。上文固定309ae6f4/d8820b09/ee6ca0c5为A阶段当时证据，不代表当前19owner源码未变；本轮未追加真实Save、内容修复或现场清理，不把自动层签收等同真实产品验收。
