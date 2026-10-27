---
title: "Engine Providers 与 Models 写操作连接归属"
type: plan
status: accepted
phase: N/A
updated: 2026-10-28
summary: "绑定 Providers/Models 对话框、后续删除及本地导入的原连接，换引擎或连接代次后停止旧意图。"
---

# Engine Providers 与 Models 写操作连接归属

## 范围与源码依据

默认编辑器的 Engine Preferences Providers/Models 是本轮一个完整冲突域。基线为 `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`，实施槽为 `vscode-WorkTrees/C`。本轮不改 Skills、Sources、visible lease 或其他在途主题。

- `engineProviderModelSection.ts` 的 Provider 输入、清除、导入确认只在动作开始检查当前是否可写；对话框期间切换引擎后，旧输入会提交到新连接。改名在 upsert 之后清除旧 id，也缺归属复核。
- 同文件的 Model 输入、改名后删除、确认删除有同类问题；启停与 Test 的晚到结果可能覆盖新连接的动作反馈。
- `universeAgentConnectionService.ts` 的 `importHarnessProviders` 先等待状态，再逐项调用服务自身的写方法；`_withTransport` 每次取得当前 transport。导入期间换引擎会让后续凭据或模型写入新引擎，UI 单独拦截不能修复该执行链。

现行产品约束见 [PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性)，系统接线见 [Engine catalog](../../docs/systems/workbench/engine-catalog.md)。本轮修复原写意图的归属，不增加新 RPC、设置项或持久化密钥存储，不升 PRD 总状态。

## 连接归属不变量

1. UI 动作在开始时捕获已发布的 `engineIdentityId` 与正整数 `linkId`，两者缺失时不开始写操作。沿用现有能力、连接、pairing-hold 与列表可写门。
2. 输入/确认返回、RPC 成功或拒绝后、改名后删除之前、导入预览后与导入结果返回后，都复核同一 engine/link、当前可写与 section 未销毁。失效时直接结束，不使用新连接补做后续步骤，不绘制旧成功/失败，也不触发旧操作的刷新。
3. 同引擎重连产生新 link，同样终止原意图；切换离开再切回不能恢复旧动作。已经由原引擎接受的单次写入保留，不做跨引擎回滚。
4. Models 的启停与 Test 使用相同归属边界，避免晚到结果写入当前页。Test 不改变既有请求字段或结果含义。
5. 动作提示也属于原连接：连接身份切换时清除旧动作提示，随后新连接自己的正常操作仍能报告结果。

## Node 导入执行边界

导入开始时捕获原 transport 对象、已发布 link serial 与已发布 engine identity。后续所有状态读取、凭据和模型写入只允许在此归属仍有效、连接仍可写且服务未销毁时执行。

每个 await 前后检查归属。读取 provider 状态失败时，若连接仍为原归属，保持既有收集错误并继续导入的行为；若归属已失效，则立即终止整个导入，不能被逐项业务错误 catch 吞掉后继续。凭据或模型写失败同理：当前连接的业务失败仍进入聚合 errors，换代则取消剩余项。固定 transport 上的调用继续复用 `_withTransport` 的正常诊断/重连状态处理，但不得重新绑定后续调用。自造归属取消在该诊断包装之外判定，不修改 transport 健康或启动重连，也不改变其余 RPC 的全局语义。

已完成的导入计数代表原引擎接受的操作；失效后的整体调用以固定、无秘密内容的取消拒绝结束，即使底层旧调用同时以带敏感内容的异常拒绝，也不把原异常拼接进取消。UI 对已失效调用保持静默，不伪报新引擎成功。当前归属业务错误保留既有计数与脱敏聚合。不输出 API key；UI Provider 保存失败文案也按本次提交的 API key 脱敏。transport reference 是 node 的执行目标权威，published serial 额外覆盖同对象重连；engine identity 按开始值逐次比较，不虚构 identity。

测试需要控制本地导入数据源时，在已有 `UniverseAgentConnectionServiceOptions` 增加可选 node-only reader 注入，默认仍调用 `readLocalHarnessProviderDrafts`，不增加 renderer/IPC API，不改 `HOME` 或真实用户文件。

## 实施与验证

实施源码限定为 `engineProviderModelSection.ts` 与 `universeAgentConnectionService.ts`；定向回归扩展现有 browser provider/model 套件及 node connection service 套件，必要时增加同目录专用测试。继续保留现有参数、确认框、能力与断连断言。

| 行为 | 受控边界 | 必须证明 |
|:-----|:---------|:---------|
| Provider / Model 添加与编辑 | 延迟 input 后换 engine、同 engine 新 link、dispose | 无旧写入；新连接无旧反馈 |
| Clear / Delete / Import | 延迟确认或 preview 后换代 | 新引擎零写入；不发送旧确认意图 |
| Provider / Model 改名 | 原 upsert 在途时换代 | 不清除/删除新连接的旧 id；不刷新或绘制旧结果 |
| Models 启停与 Test | 延迟成功、失败、拒绝后换代 | 新页面无旧结果；正常路径仍反馈 |
| Node 批量导入 | provider list、首个 credential、首个 model 在途时换代或 dispose | 原引擎已接受写入保留；后续 provider/model 停止；新 transport 零写入 |
| 正常连接与业务失败 | 归属始终不变 | 正常导入计数、错误脱敏、正常编辑/改名/启停/确认保持 |

先由唯一编译执行者用新测试配旧生产验证业务红，再刷新本主题生产验证绿。所有 typecheck、转译和 out 写入由 `integration_executor` 单路执行并持 `/tmp/vscode-compile.lock`；本实施 agent 不另开编译。验证使用现有 `scripts/test.sh --run ... --grep ...` 与 node unit runner；最终执行原 project noEmit、主题 ESLint、`git diff --check` 及文档健康门禁，记录实际命令、exit 与基线环境限制，不把定向通过扩大为全仓构建通过。

## 文档与合入

- 本方案须按 [文档维护规则 16](../../docs/DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿) 由独立 reviewer 只读审查，Critical/Important 当轮收敛后单独提交方案，再进入生产实施。
- 验证证据落 `dev/progress/engine-lifecycle-recovery-2026-10-28-evidence/`，父 agent 统一维护本轮并行看板、进度与索引，保持 `status.md` 不超过 200 行。
- 行为文档按 PRD-025 → Engine catalog → 本方案顺序同步。实现修复与对应测试、知识层、行动层一同提交；不纳入其他 WIP，不 push。
- 合入仅经获独占的 merge 槽；另一活跃任务的 merge WIP 不覆盖、不暂存、不重置。当前槽位交付和真实集成状态分别记录。

## 只读审查

2026-10-28，独立 Astra `direction_review` 对本方案及当前源码作只读审查，未改文件或执行编译。

- **Strengths**：UI 覆盖输入、确认、预览、upsert 后删除旧项、启停及 Test；node 导入独立绑定 transport，取消逃离逐项 catch，保留原引擎已接受操作，实施边界和验证具体。
- **Critical**：0。
- **Important**：0。
- **Minor**：3，全部采纳：归属取消在正常 transport 诊断之外处理，不污染健康或改变全局 RPC 语义；测试区分当前连接业务错误的原计数/脱敏聚合，与换代后底层拒绝转换的固定无秘密取消；UI 凭据保存错误按本次提交 API key 脱敏并加回归。
- **Assessment**：方案可实施。固定 transport、serial 与原 identity 的逐次比对及 node-only reader 注入获接受；无 identity 的 node 测试夹具不伪造 identity。方案独立提交后进入生产实施。
