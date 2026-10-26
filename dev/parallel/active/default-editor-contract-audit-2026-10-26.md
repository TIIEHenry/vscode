---
title: "2026-10-26 默认编辑器合同与功能缺口续审"
type: progress
status: active
phase: M7
updated: 2026-10-26
summary: "D1383已按旧生产red与新生产19 passing闭合。C会话导航与J配置初始化仍待merge运行。唯一全量仍是先前55/36失败。"
---

# 默认编辑器合同与功能缺口续审

前轮 [UI 与权限看板](ui-visual-review-2026-10-26.md) 的 D1379–D1381 已有范围内验证。本轮重新检查当前实现，不从旧进度枚举推断没有可执行项目。产品范围仅默认编辑器；`src/vs/sessions/` 保留作上游对照。

## 基线与分工

起始基线实读：人类工位 `agent-ide` 与 merge、C、D、J 均为 `4963799b1e95101cc267615cb01b4ebee6939c70`，当时五处均无未提交改动。人类工位已完成用户要求的安全同步，未 push。后续仅将经过验证的提交安全 ff 到人类工位，遇到其他 WIP 保留并重新核对。

| 工位 / 子代理 | 整体模块与审查目标 | 当前阶段 |
| --- | --- | --- |
| C / conversation_navigation_contracts | D1382：默认编辑器 ReviewNav 工作根变化失效与正式 Context/DI 合同 | 方案 `27a9087c1a7` 经 Astra 只读 C0/I0，已进入实施；运行/实拍待验 |
| D / tunnel_retry_contracts（Astra） | D1383：Tunnel 引用身份、getExisting 所有权与 provider 失败后重试；同时审查 C/J 方案 | 方案 `e451d5da071` / 实施 `22386bcf3ae` 已合入；merge 旧生产 red / 新生产 19 passing、定向语义 0，范围内 closed |
| J / configuration_initialization_contracts | D1384：RemoteUserConfiguration 显式重试共有等待、reload 及销毁边界 | 方案 `f3006a5f30e` 经 Astra 复核 C0/I0/M0，已进入实施；首次缓存快返保留 |
| merge / 集成者（待源提交） | 串行合入、旧生产身份核验、受控 red/green、唯一编译与必要真实界面复验 | D1383范围内验证已完成；C/J源未齐，未全量编译 |

## 工作约束与验收

子代理只写自己的字母槽，不写人类工位或 merge。父只协调、记录和安全同步；产品实现交子代理。非 trivial 修复先满足 [规则 13/16](../../../docs/DOCUMENTATION.md#规则-13方案与实施分离) 的方案独立提交和只读审查，Critical/Important 核验后改入；设计决策按原则驱动设计交 Astra，不要求人类逐项决策。

全部编译、转译、类型检查和 `out/` 刷新集中在 merge 单一流水线。字母槽只准备源码、必要回归和静态检查；不删除测试、不用宽泛类型强断言掩盖诊断。测试优先通过公共入口与可控屏障证明失败、取消、重试及资源归属。实际 UI 变化需要非作者检查真实画面与交互。报告区分本次实际运行、既有失败及未验证范围；完整编译旧原始 55 诊断 / 36 文件仍为失败，不将其后修复估算为新的全量结果。

## 方案签收与审计边界

C 从旧日志确认当前 18 条未修 conversation 类型诊断，未将它们一概当作运行故障。上层 Lens 的 roster 回调未刷新 Review sidecar，而 reviewNav 自有事件承担投影；本刀只补当前会话、工作区与 SCM 输入的失效传播，覆盖非活动并列叶，沿用 Context API 和路径归因 gate。SCM 子根与 workspace gate 的差异及其他不直接相关诊断保留为后续审查事实。

D 没有采用泛化 test subclass 才能构造的 empty/string 三代 pending 清理假设。此次公共入口证据集中于旧 wrapper 释放同地址新连接、getExisting 返回原资源绕过引用所有权、provider 同步 throw 留 factory gate 及裸 finally 拒绝出口。计划覆盖最后一个引用释放、强制 close/reopen 隔离、地址别名与 closed 事件次数。这些行为已由 merge 的旧生产 red / 新生产 green 验证，见[证据](../../progress/default-editor-contract-audit-2026-10-26-evidence/verification.md)。

J 保留首次远端环境 pending 时读取缓存，以及无远端环境的终态；仅失败后的显式重试让所有参与者共同等待同一次结果，reload 参加重试。Astra 的三项 Important 已纳入：attempt 身份归属、用显式错误记录保留 undefined/null 原拒绝、销毁取消与原始失败的优先规则。D747 一个远端实现源码字符串 pin 的替代必须映射真实公共行为回归，其他六项与历史证据保留。

以上是合入前的方案与源码审计结论。D1383 随后已按该边界完成范围内运行并闭合。C/J 仍未经 merge 运行，不记 closed，也不把它们的 accepted 方案写成落地证明。

D1383源码合入只发生status文档冲突，保留父当前分工/同步记录及D实施事实。验证完成后方案为 implemented、缺口 closed。新产物由 merge 锁内顺序刷新：先钉 496 旧生产正文，再 test-only red，记录原始结果后才刷新生产。详情见[证据](../../progress/default-editor-contract-audit-2026-10-26-evidence/verification.md)。

## 接班与已验证同步

原 C/J 实施者及集成子代理因服务额度耗尽退出，已有源码与方案提交全部保留。依本轮用户授权，接班执行使用 Grok CLI 的 `grok-4.7` / `xhigh`，C、J 仍各自独占原字母槽，merge 仍是唯一编译与产物工位；接班不构成重新签收设计，沿用 Astra 已审方案，新增关键设计问题仍需独立决策。

D1383 验证元数据提交为 `0345517385bbc7938d2f82f01d538a880ec04b77`。父已复核两份 TS / 两份 JS 的四个 SHA256 与入库摘要一致，安全 ff 人类 `agent-ide` 与 D 到该提交；与 merge 三处均 clean，未 push。C/J 尚有其任务 WIP，父未合入、未 stash/reset/覆盖，也未把它们声明已验证。C/J 接班进程已实读存活，后续按实际实施提交接入同一 merge 流水线。
