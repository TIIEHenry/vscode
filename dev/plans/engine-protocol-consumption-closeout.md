---
title: "引擎协议消费遗漏修复"
type: plan
status: implemented
phase: M7
updated: 2026-10-26
summary: "补齐已正式发布的 Create/Fork/Provider/Profile/Info 字段与两条 RPC 的 IDE 契约、proto bytes、IPC 和能力门闩；保留默认产品范围，队列与技能保存的跨仓协议另行同步。"
---

# 引擎协议消费遗漏修复
状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 1. 依据与范围

用户于 2026-10-26 授权将 [功能缺口分析](../../docs/reference/universe-agent/ide-engine-feature-gaps.md) 落仓并修复实现。当前主窗口另有 Composer/时间线视觉 WIP、`subscription-recovery-closeout.md` 草案，均保留，不抢占它们的改动。本稿先完整处理已存在正式引擎合同的消费遗漏；跨仓队列读回/技能保存已获用户授权同时修改 UniverseAgent，进入下一独立方案，不以本稿替代后续闭合。

基线 IDE `09f6da72d305`；引擎 proto `f538eb162cd3`。新字段均 additive，不手改 vendored sessionCore，不凭目录存在宣称产品入口完成。不新建任意 RPC 或 Agent switchAgent。

## 2. S1 现有消息字段

| 消息 | 精确修改与语义 |
|------|----------------|
| CreateSessionRequest | 类型和编码新增 systemPrompt(1)、provider(2)、promptLocale(5)、clientHost(6)、workDir(7)，model(3)/clientSessionId(4) 保持。clientHost 使用正式六个非 optional 字段与 optional versionId/kernel；仅写存在值。title 继续不伪装成 systemPrompt。本切片限定类型/codec；实际创建由 SessionViewHost.bindEngineSession 发出，不改变该调用的目录语义，不把本机映射根发给远端引擎。选定目录创建需另补跨 lease/IPC 的捕获身份、Resume 优先与失效合同 |
| SessionInfoResponse | title(8) 解码并映射到结果；List 的 title 仍是目录来源 |
| ForkRequest/Response | anchorTurnId(7) 与 message(4)；空 anchor 省略，不用本地 turn 索引猜 id，不改变 parent 默认 root；不丢引擎失败原因 |
| Provider credentials/status | refreshModels(5)，discoveredModels(8)、modelSyncError(9)；false/0/空保留 proto3 语义。新字段从原 UI 保存路径可选使用，不自动请求网络 discovery |
| AgentProfileProto | maxRewinds(20) 的 optional presence 全程保留，显式 0 不能被当默认剔除。List/Save/Reset/编辑模型字段回传不能悄悄丢已有值。明确修复 engineToolProfile.summaryToProfileDetail 显式复制路径，并测列出 0 → 编辑其他字段 → 保存仍带 0；同时覆盖缺省与正数。encodeInt32Field 会省略 0，须增加 presence 编码并断言 field 20 实际存在 |

S1 先修传输与保存保持语义，不把未消费参数写成已经拥有对应完整 UI。是否在 UI 新增 discovery、回退次数或创建目录选择器，须按真实用户任务与当前产品需求落实。

## 3. S2 两条正式 RPC

- `PermissionService.SetClientToolProfile`：request session_id(1)、profile(2，ALL=1/READ_ONLY=2/NONE=3)，response success(1)/error(2)。加类型、可选 connection hook、node service、bytes codec、client、transport、IPC allowlist。只允许明确有效枚举从产品写入口发出，UNSPECIFIED 不映射为 ALL。
- `TriggerService.RegisterSessionEngineTrigger`：request session_id(1)、name(2)、type(3)、prompt_template(4)、watch_paths(5 repeated)、dedupe_key_field(6 optional)，response trigger(1)。同样贯穿类型/connection/node/bytes/IPC；不把它偷偷替换成 UpsertTrigger，不引入新订阅权威。
- 能力门闩采用现有 Connect.methods 的显式 SUPPORTED/UNSUPPORTED/UNKNOWN 机制；老钉死引擎缺 SetClientToolProfile 时不可写。只以 optional JS 方法存在判断会 fail-open，不采用。
- RegisterSessionEngineTrigger 使用空请求做无副作用探测：正式实现先验证 session_id 并返回 INVALID_ARGUMENT，该状态仅对此方法计为 SUPPORTED；OK 也为 SUPPORTED，缺广告/UNIMPLEMENTED 为 UNSUPPORTED，传输等错误为 UNKNOWN。SetClientToolProfile 空请求的 success:false/gRPC OK 按原判据支持，不用有效 session 注册触发器探测。为两者各加三态回归。
- 基础合同与传输完成不等于默认窗口产品入口完成。S2 的命令或表单接入另核产品入口、绑定会话、同一 published link、晚到结果、失败反馈与取消。

## 4. 验证与收口

复用现有节点协议测试，以公开编码/解码/client/IPC 入口覆盖字段存在/缺省、optional 0、失败文本、重复 watch_paths 与能力三态；旧行为保持。先验证新增回归对旧实现出现业务失败，再只刷新本主题输出运行新实现。不得用源码字符串扫描代替 wire 行为。

所有编译、转译、out 写入串行并锁定本轮唯一执行者；共享目录有其他任务时不对 out 全量清理。Node 最小套件、ESLint、必要的当前 src/tsconfig 定向类型检查；不把 fullcompile 当收尾仪式，不改 src/tsconfig 隐藏错误。

同步 protocol surface、报告中的实施状态及 action status；生成计划索引状态并跑 docs-health。方案与实施分别提交；本主题显式 add，不包括既有 UI WIP。不 push，不升总体 PRD。

## 5. 只读审查（规则 16）

2026-10-26 独立 reviewer `review_protocol_closeout` 只读审查：Critical 0 / Important 3。已逐项对照源码改入：

1. 创建实际 owner 为 SessionViewHost，S1 仅补类型/codec，撤去未经设计的主工作台工作根发送承诺。
2. Register 的空 session 返回 INVALID_ARGUMENT，指定该方法的无副作用探测状态判据与三态测试。
3. 显式列出 Profile summary→detail→保存复制路径，覆盖 0/缺省/正数与实际 wire presence。

Minor：补 optional kernel、六个非 optional 字段的表述、presence helper 和切片完成边界。审查未运行构建或写 out。上述修改后进入实施。


## 6. 落地与验证

S1、S2 契约/传输切片已实施。Profile 实际编辑器的正文/模型保存保持 maxRewinds，另有工具复制回归。Create 产品目录传递、两项 RPC 的产品新入口不在本切片交付范围，现行能力见 [协议面增量](../../docs/reference/universe-agent/engine-protocol-surface.md#2026-10-26-协议消费补齐)。

- 业务 red：旧生产 + 新测试，8 passing / 8 failing；失败均是请求/响应/保存数据缺失。
- 新协议、IPC、Profile 与相邻 codec 8 套件：203 passing。
- connection、DeviceAuth、Pairing 3 套件：498 passing，含两条新 node 转发的实际调用。
- 官方 Electron Profile 编辑器正文/模型保存：3 passing（缺省、0、5）。
- mapper 扩展检查：10 passing / 1 既有失败，MCP summary 的 command/args/env/url 缺省属性差异；使用 3d522e76b99 的生产 mapper 另行复现。
- 所有 fresh output 使用 build/next/transpile.ts 的 transpileFile，在 /tmp/vscode-compile.lock 内串行仅刷新本主题 TS；无全量 out 清理。
- 原 src/tsconfig native tsc --noEmit 通过；定向 ESLint 0 errors，7 既有 warnings（动态记录断言、测试字符串、prefer-const 和 in 操作符）。
- 文档生成/health 已运行：既有未跟踪 subscription-recovery-closeout.md 缺索引造成 1 error，本主题入口齐全；不代改该草案或将其状态升级。

不把自动测试算成真实引擎默认编辑器端到端验收，不升 PRD。跨仓后续已获授权。

独立实施复审：`review_protocol_closeout` 只读确认 Critical 0 / Important 0 / Minor 0；未运行编译或写 out，结论限定协议与传输。
