---
title: "D1376 Engine Catalog 合同迁移证据"
type: reference
status: active
phase: M7
updated: 2026-10-26
summary: "MCP 基线 14 场景逐项迁移，预期注册 20 项；D 静态检查完成，统一编译与行为结果待 merge。"
---

# D1376 合同与覆盖映射

基线 `e2442d8b3ec`，方案初稿 `b8ef18a4041`、J 只读审查后签收修稿 `1c4f891bc32`。当前结果是源码与静态检查，不是运行通过；新诊断以 merge 统一编译为准，不能从旧 160 条推算最终剩余数。

## MCP 原 14 项逐项对应

测试文件：`src/vs/workbench/contrib/conversation/test/browser/engineMcpSection.test.ts`。旧 API 的可见性断言迁到真正拥有界面的 BrowserDialogHandler；不为旧测试恢复生产 form API。所有原业务场景保留，无 skip。

| 原场景 | 当前公共交互与断言 |
|:---|:---|
| addServer 完整配置 | 原公共 addServer 测试保留；完整 stdio 配置、scope 与请求次数 |
| updateSelectedServer partial | 原公共 updateSelectedServer 测试保留；serverId、name 与 command 保留 |
| sessionWorkDir list/add/update/toggle/remove | 原五条请求路径保留；fixture 以正式 resolver 补 sessionId/engineIdentityId/source/access/localRoot/projectKey |
| Add 展开空表单且不写入 | 真实工具栏 Add → 捕获 IInput 的六字段与空值；确认前无 RPC；真实对话框 DOM 初始输入 |
| stdio 空 command 不写且表单留着 | IInput.validate 精确错误 + 防御式无效 confirmed 不写；真实 BrowserDialogHandler DOM 点击提交后仍存在、错误 alert、请求 0 |
| 有效 stdio 添加一次后关闭 | 完整请求精确匹配、trim/scope/未设 enabled；真实对话框填写 command 后提交，DOM 消失且一次 RPC |
| sse/streamable_http URL 校验 | 原测试名含两类但仅执行 sse；现循环注册两项，空 URL 校验/拒写、合法 URL 只一次完整请求 |
| Update 无选中不打开不写 | 工具栏 Update 点击，input 调用 0 / RPC 0 |
| Update 选中预填 | 工具栏 Update → IInput 六字段（含 args/env）完整预填 |
| unchanged 不更新 | trim 后相同、args/env 留空，不发 UpdateMcpServer；不再断言已退休的内联容器 |
| 改 name 保留其余字段 | 一次 Update 请求，id/name/transport/command/args/env/url/enabled 完整匹配 |
| unknown transport 需显式改合法 | 当前真实 IInput 预填空串，validate 拒绝且未写；明确选 stdio 并补 command 后只写一次 |
| cancel 关闭并重置 | 公共 input 返回取消无写；真实共享 DOM Cancel 后消失，重开六字段为空 |
| active session/workroot 刷新 | 原两个事件路径保留，新 sessionId 与 workRoot 一致且请求携带新 workDir |

当前预期注册 **20 项**：原 14 场景完整映射，URL 拆两项 +1，缺名/坏 env +1、args/env 与仅 args 修改 +1、确认跨断连 +1、确认跨选中变化 +1、真实共享对话框 DOM 生命周期 +1。源中 19 处 `test(...)`，其中 URL 循环展开为 2。该数是静态注册清单，**不是 passing 数**。

## 其他合同

- Clipboard / Context Variables 的 readonly capability snapshot 改为创建时显式覆盖需要的能力；连接 Emitter 携带 `UniverseAgentConnectionSnapshot`，并登记 dispose。Triggers 列表能力仍在 `conversationEntryCapability.listTriggers`，删除误塞进 catalog snapshot 的伪字段；现有 UNKNOWN / UNSUPPORTED 断言保留。
- `engineCatalogSections` 只将两个需要后续检查元素的空数组断言改成 `length === 0`，保留“未写入”强度，避免 TypeScript assertion 窄化成 never[]。
- `TestDialogService.input(_input?: IInput)` 补公共输入参数，兼容原无参调用和派生类正式参数；返回默认、一次性 setInputResult 不变。
- Clipboard 状态 DOM 用 HTMLElement 类型；Provider detail 先断言 string 再检验原三段文案。生产只删除无用 import 与已无调用的 Provider 摘要 helper。
- MCP / Tools 完整 fixture 共用 resolver 与 emptySessionViewSnapshotWithRejects；无 `{ workDir } as IAgentWorkRoot` 或 `{ } as any`。

## 静态与待运行验证

D 工位目标 ESLint：15 份 TS，0 errors / 57 warnings；warning 为现有就近测试目录 import/DOM、Triggers 本地化与 Provider 测试重复 import。详见 [日志](d1376-eslint.log)。D 未执行 compile、转译、watch 或写 out。文档健康 0 errors / 46 既有链接 warnings，generated-status --check 与 diff-check 通过，status 当前 142 行；2026-10-16 十二批历史完整归档。

merge 待运行：`conversation/browser/engineClipboardSection.test.ts`、`engineContextVariableSection.test.ts`、`engineTriggersSection.test.ts`、`engineToolsSection.test.ts`；`conversation/test/browser/engineCatalogSections.test.ts`、`engineClipboardSection.test.ts`、`engineMcpSection.test.ts`、`engineProviderModelSection.test.ts`、`engineToolsSection.test.ts`、`engineTriggersSection.test.ts`。应同时覆盖 shared dialog 参数继承的 Clipboard/Providers/Triggers，而非只跑 MCP。使用 merge 新产物与现有官方 Electron/browser 入口，不用旧 out 作为本轮通过证据。
