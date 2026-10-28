---
title: "D1389 收尾独立静态审计"
type: reference
status: accepted
phase: M7
updated: 2026-10-28
summary: "八TS静态核对、原始日志缺失与当前验证范围；不作新运行证明。"
---

# D1389 收尾只读审计（2026-10-28）

审计者 `/root/closeout_subscription`。只读主工位 `/home/clarence/Projects/Agents/vscode`，基线 `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`；未编辑仓库、未暂存/提交、未编译/typecheck/transpile/写 out、未运行测试。本文件是收尾调度交接，不是新的验收绿。

## 结论

当前四类修复在静态上均与 `subscription-recovery-closeout.md` 合同吻合，未发现可确认的 Critical / Important 源码问题；运行完整性尚不具备可复核证据。方案和 status 声称的旧生产 AHP3/Automation3/UA6 红、新 AHP common71/protocol104/Automation41/UA17/相邻52绿，当前未找到原始日志或 source/out 身份快照，不能只凭叙述再次宣称这些数字覆盖当前 WIP。

`/tmp/vscode-subscription-recovery-out` 保留了输出目录。主工位当前八项 out 中七项与该目录字节相等，唯 `sessionViewHostReopen.test.js` 不同；该源测试修改时间比保留目录中的测试输出晚约18分钟。所有八项当前 JS 的 inline source map 指向主工位源码路径，但没有 sourcesContent，不能据此证明当前源码和产物相等。因此建议唯一 merge 车道绑定当前八源 SHA，fresh 对应产物后实际重跑最小套件，保存确切命令、日志、exit 和源/产物 hash；不得将历史数字或七项相等当作当前已验。

默认产品范围：AHP 和 UniverseAgent 属 platform 共用合同；`AgentHostAutomationStore` 仅由 `src/vs/sessions` 下 reconnectable store/local/remote providers 引用。对 workbench/platform/code 的现行引用搜索未找到消费者。Automation 两 TS 属既有 Sessions 兼容修复，不能称默认编辑器产品自动化功能或 UI 验收。D405 / V-S5 真窗口和引擎手测仍 open，不升 PRD。

## Included：15 条现有路径

八份源码/测试：

1. `src/vs/platform/agentHost/browser/agentHostProtocolClient.ts`
2. `src/vs/platform/agentHost/common/state/agentSubscription.ts`
3. `src/vs/platform/agentHost/test/common/agentSubscription.test.ts`
4. `src/vs/platform/agentHost/test/electron-browser/agentHostProtocolClient.test.ts`
5. `src/vs/platform/universeAgent/node/sessionViewHost.ts`
6. `src/vs/platform/universeAgent/test/node/sessionViewHostReopen.test.ts`
7. `src/vs/sessions/contrib/providers/agentHost/browser/agentHostAutomationStore.ts`
8. `src/vs/sessions/contrib/providers/agentHost/test/browser/agentHostAutomationStore.test.ts`

七份文档/行动层：

9. `dev/plans/subscription-recovery-closeout.md`（当前未跟踪）
10. `dev/plans/session-subscription-lifecycle.md`
11. `docs/reference/universe-agent/engine-protocol-surface.md`
12. `docs/systems/agent-host/overview.md`
13. `dev/plans/INDEX.md`
14. `dev/progress/deferred-gaps.md`
15. `dev/progress/status.md`

INDEX/status/deferred 是与 UI/其他主题共用路径，须由 root 指派一个文档作者串行收束，不要并行写或摘半文件。其余七订阅文档/源路径应与本主题一并提交。建议新增 durable 验证证据和索引链接也放同一提交。主工位其他 Conversation/theme/UI 暂存文件均 Excluded，不 reset/stash/restore/clean，不 broad add。

## 静态核对

- AHP：普通 snapshot 对 active 集合取差集，root 独立用 `isAhpRootChannel` 检查；fresh preservePending 不提前清 managed pending。root-missing 对 root state setError；后续 snapshot 可恢复。三个新增业务场景覆盖 root/error 与 pending 不重放，既有 fresh 恢复用例应同跑。
- UA：溢出先登记 fail-closed 和 recovery 债务并替换普通 timer；recovery fire 检查连接/lease/attempt，按 Actor 所需最多补两次 Up；同步 throw 让 S2 接手；成功清债核当前 attempt 且无新 fail-closed。attempt 时间以 nowFn 注入，短存活不重置退避；down/末lease清计时并保留债务；重入溢出不清新债务。当前新增/改写测试覆盖同连接、reacquire、S2续恢复、一次 Up、2s/30s退避及重连二次溢出。未手改 vendored core。
- Automation：可替换 binding、统一 invalidation、generation guard、单个30秒retry，旧等待器绑定旧订阅并在旧代Error结束；dispose取消retry。projection在 Error 时无旧 catalogue 显示。新增三用例覆盖替换/重复失败与dispose/旧等待器新代重试。
- 未发现公共 API/wire/migration 变化；nowFn 是可选测试注入。

## 文档须收束

- `dev/plans/INDEX.md` lifecycle 状态列已 accepted，摘要仍写“仍 draft”且只说 S4b，明显与 S5 合同冲突，应更新该行手写摘要并用生成脚本校验状态列。
- D1389 plan / deferred / status 当前已写 implemented / closed（代码与自动回归），应在新的真实运行证据到位后保留这些结论；若暂不跑则必须明确“历史声称未复核，当前未验”，不能继续照搬旧绿。
- D405/V-S5 始终保持未验，Sessions Automation 仅兼容范围须在最终交付说明写清。
- 规则16摘要声称已有 reviewer 改入 Critical/Important，当前没有独立原始报告链接；这是已有叙述，不冒充本次源码运行或 UI 验收。当前静态审计可作为独立收尾复核，但不能捏造以前的审查记录。

## 最小官方套件选择（交唯一 merge，未执行）

必跑四套：

- `vs/platform/agentHost/test/common/agentSubscription.test`
- `vs/platform/agentHost/test/electron-browser/agentHostProtocolClient.test`
- `vs/platform/universeAgent/test/node/sessionViewHostReopen.test`
- `vs/sessions/contrib/providers/agentHost/test/browser/agentHostAutomationStore.test`（兼容源码）

UA 触及跨 attempt/重连/关闭调度，三套相邻回归有意义：

- `vs/platform/universeAgent/test/node/sessionViewHostEngineBind.test`
- `vs/platform/universeAgent/test/node/sessionViewHostActorLoop.test`
- `vs/platform/universeAgent/test/node/sessionViewHostChatClose.test`

按 `scripts/test.sh --run ...` 官方入口，以实际runner支持的Node/Electron分类运行；先检查唯一通道与产物身份，不从字母/主工位另起编译。八文件 ESLint、repo docs生成/health/diff门禁需要实际结果；如整个最终WIP需要一次 compile-client，由唯一merge统一运行，不再为本主题重复全编译。过去 StubModel:478 TS18048 只是历史叙述，是否仍存在须以本次实际编译结果为准。

## 当前身份（SHA256）

| 简名 | 当前 TS | 当前 JS | 保留旧目录 JS |
| --- | --- | --- | --- |
| ProtocolClient | 9e21846fef095ef80badaee57bb28690e3133bb3480d761aae823e0f2841ee18 | d942d14aab7d494024dbb323139ce2f62cb91e9290fd5ba4d2b5f5d23ced5cea | 同当前 |
| AgentSubscription | 67a4d74ebff361959cf227565ab99137ea9963d992d86dc2e17c1c8483ccbb9d | 8923ce0ae8d40466f781f760cbb24b74a174eb0e0262ff293b5d5d85caa6037e | 同当前 |
| AgentSubscription test | f4f9c12dd2826aba8c61d1b239d95913e7c987f527c6c5bfc430321b4d23589f | 0cecd6a9d717a7742f4ab43bbb8a4514318e155ffce7bb62caacecede8bcf142 | 同当前 |
| ProtocolClient test | 76fd9919d66bcc20c6b6fddde9cfbad46e7e9026a64040ae3aa0cabfd2343e21 | df01d76968c8e44a907a672cd7ac198b7068742931adb78b21915394ec45964a | 同当前 |
| SessionViewHost | 4d64f070cca72208d452ec5c7cd5b0739d00bc7236e46247da37ef96a4cfa5db | 7330ae0e9b3b088a351d8e7a5e3b91852bc5fbfe93c6b4e7daec84f2515e8497 | 同当前 |
| Reopen test | cb8881aa70e5ab4f9ca518d4ac94992d8fcea5ca11b4b0700f199647b78084b8 | 39ee603535427f683e20e5ac38d858e27687ad45df9950c7866953ae1d2a185b | d3f63330498c47a10a352eb6cbcfb54e4bd165dfb72525ca5f0cd8d7f2bd5f6d |
| AutomationStore | 03b8a7efa86d348a387cabfe75590f1895f0cce8a065bb8eb3f883103961c867 | 61be1683f4498b91ef391b080e66206f60727dadea0c8229f22d8d1445754a8c | 同当前 |
| AutomationStore test | a30e49643206e6fca221b751a4df8a079a002d82930566dc04984e359e2ae35c | 0320a4c9639bff9a93b0ef78cf1f13aefa81a54b64853f1bc0117849b93e57c9 | 同当前 |
