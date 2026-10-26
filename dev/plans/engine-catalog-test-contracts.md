---
title: "Engine Catalog 测试合同基线修复"
type: plan
status: implemented
phase: M7
updated: 2026-10-26
summary: "D1376：Catalog 十套件 294 passing，MCP 原14场景全部保留且20项运行通过；恢复既有页级CTA合同；当前编译命名诊断清零，生产补修定向语义0。"
---

# Engine Catalog 测试合同基线修复

基线 `e2442d8b3ec`；诊断以 [followup-compile-client.log](../progress/ui-visual-review-2026-10-26-evidence/followup-compile-client.log) 为起点，最终结果以 merge 新编译为准。范围只在 Engine Catalog，不扫 review/split/terminal/ExtHostOutput。

## 事实与原则

[Engine catalog SSOT](../../docs/systems/workbench/engine-catalog.md) 已明确 MCP Add/Update 走 `IDialogService.input`，含 name/transport/command/url/args/env。旧 `engineMcpSection.test.ts` 仍调用已删除的内联表单 test API，且用按钮文字定位已经改成图标的工具栏。这属于覆盖滞后，不是要求恢复旧 UI。沿用已签收产品行为，真实 DOM 工具栏触发公共对话框服务，检验校验、取消、无改动、字段保留与 RPC；不新增生产 test-only API，不删除或 skip 场景。

其余诊断来自能力 snapshot readonly、事件应携带 `UniverseAgentConnectionSnapshot`、Triggers 列表能力实际为 `conversationEntryCapability.listTriggers`（不是 catalog capability key）、工作根不再是只有 `workDir` 的对象、通用 TestDialogService 实现未声明 input 参数、回调赋值被控制流窄化为 never，以及废弃生产 import/helper。修复测试事实模型，保持 UNKNOWN/UNSUPPORTED/SUPPORTED 明确且 fail-closed，不把空能力夹具整体改为支持。

## 实施范围

1. `conversation/test/browser/engineMcpSection.test.ts`：逐项迁移旧内联表单断言。通过真实工具栏 aria-label 点击 Add/Edit；捕获 `IInput` 并调用其公开 validate，模拟确认与取消。断言完整请求与次数，覆盖 stdio 空 command、sse/streamable_http 空 URL、未知 transport 必须显式选择、编辑无变化、args/env 保留、取消无写入。已存在公共 add/update 路径测试保留。
2. MCP/Tools 共享完整测试 session/workroot fixture：以正式工作根 resolver 构造 identity/source/access/localRoot/projectKey，提供实际 SessionViewSnapshot 空值与所有 session 事件；移除不完整对象断言和 any。工作根变化仍驱动实际事件与请求观察。
3. 就近 Clipboard/Context/Triggers 测试在创建 snapshot 时声明只读能力项；连接事件映射到实时快照；Triggers 使用实际能力键；配套新增或保留 unknown/unsupported 阻断断言。`engineCatalogSections` 保留请求数组，以 length=0 验证未写入，避免 deepStrictEqual([], ...) 将后续数组元素窄化为 never。Clipboard/Providers 的 dialog 与 DOM/Markdown 文案类型按真实接口修复。
4. `platform/dialogs/test/common/testDialogService.ts` 的 input 方法接收正式 `IInput` 参数，保持当前默认返回与 setInputResult 行为；这只是测试实现补齐已存在服务合同。移除 Engine 文件不再使用的 import/helper，不改生产写闸；集成真实运行发现 Agents body 重复 CTA，按既有 SSOT §2 恢复仅页级 banner 的合同，属于已有界面的行为修复。

## 验证与文档

D 仅静态读码、目标 ESLint、diff/docs 检查，不编译/转译/watch/写 out。merge 统一新编译后运行本次涉及 Engine 套件；若新诊断或行为失败，先修复再记录实际结果，不预宣称约 80 条全修。失败场景保留、不放宽断言。

更新现有 status、D1376 延期条目与本轮并行看板；知识层只补测试入口和当前合同说明，不重写产品设计或提升 PRD。`status.md` 保持 ≤200 行，历史超限归档。方案先独立 commit，经独立只读 reviewer 后进入实施。

## 只读审查

J 于 2026-10-26 对照生产 MCP/Dialogs/Triggers 只读审查：Critical 0、Important 0。采纳三项 Minor：未知 transport 预填为空；补等待确认期间断连或选中变化拒绝写入；本次初稿已独立提交，审查修稿再独立提交后实施。方案文案已校准 snapshot readonly 与列表能力命名空间。

## 实施进度

2026-10-26 原三提交已合入 merge；当前唯一 compile-client 中本切片旧映射85条均消失。首次十套件287过/7败，按真实合同补修后官方Electron十套件294 passing，MCP精确20 passing，旧14场景全部保留；真实共享对话框DOM已运行。初始static与实际运行分开保留于[场景映射/结果](../progress/ui-visual-review-2026-10-26-evidence/d1376-catalog-contracts.md)。

集成补修包括：Agents四处body重复Open Connection入口违背既有[SSOT §2](../../docs/systems/workbench/engine-catalog.md#2-状态机)，现恢复页级banner拥有连接CTA，原无CTA断言保持；MCP用真实禁用说明aria-label定位并同时断言disabled、无对话框/无写入及选中后恢复；Triggers断言预分配状态容器隐藏且空、显示引擎真实returned enabled并保持错误tone、catch路径明确选择触发器且验证发送请求。没有删测、skip或恢复旧form API。

Astra独立只读复核生产补修Critical0/Important0，页级banner仍在EnginePreferencesPane中。当前全仓编译原始结果仍exit1、59条/37文件；唯一新增MainThread夹具诊断已在另一切片定向修正，11个集成补修文件语义0；未再全量编译，不把定向0写成全仓绿。D1376按范围闭合，不升PRD。
