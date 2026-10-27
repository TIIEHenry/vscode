---
title: "Engine 写入归属与 Skills 断连草稿并行修复"
type: progress
status: in_progress
phase: M7
updated: 2026-10-28
summary: "从当前代码重新核实两个独立生命周期缺陷；C/F 分槽实施，C 独占编译，保留外部 merge 在途工作"
---

# Engine 生命周期并行修复

## 真实基线与归属

- 固定产品基线：`d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`，集成分支 `agent-ide`。
- 父 agent 只调度、记录与决策协调；源码、验证及 git 集成由子 agent 执行。
- `merge` 槽由另一活跃任务 `01a17877-4c48-73b2-8082-3250b8a46434` 使用，含 lease/Sources 在途文档与证据。本波不覆盖、不暂存其改动；集成前重新核对实时归属。
- C/F 原工作区干净，旧 `loop/C`、`loop/F` 分支完整保留；用新分支指向固定基线，未 reset、stash 或清理其他工作。
- 编译只由 `integration_executor` 执行；实施 agent 不启动编译或 transpile。C 固定基线的原项目 `npm run typecheck-client -- --incremental false` 已 exit 0、0 TS；首轮缺 Electron 类型文件的环境诊断单独保留，补前置后同源复跑通过。见[基线证据](../../progress/engine-lifecycle-recovery-2026-10-28-evidence/verification.md)。

## 冲突域矩阵

| 域 | 槽位 / 分支 | 唯一实施者 | 边界 | 当前状态 |
|:---|:---|:---|:---|:---|
| Providers/Models 写入归属 | C / `fix/c-engine-write-ownership-20261028` | `providers_implementation` | `engineProviderModelSection`、connection service 导入链、对应测试 | 方案只读 C0/I0/M3，落审查与独立提交后实施 |
| Skills 断连草稿 | F / `fix/f-skills-draft-recovery-20261028` | `module_review` | `engineSkillsSection`、对应测试 | 方案只读 C0/I1，修订保存互斥 owner 后复核 |
| 编译与集成 | C，后续使用唯一 merge 槽 | `integration_executor` | 单路验证、主题提交、无损合并 | 固定基线原项目 noEmit 通过，未开始修复验证 |

两实施域不共享生产文件。公共需求、规格、索引与进度文件由父协调分配，禁止并行覆盖同一文件。每域本波最多一次集成合入。

## 已核实缺陷与架构决定

1. Providers/Models 的对话框、确认、改名后的删除及批量导入未绑定开始时的 engine/link。A 中开始的操作可能在 B 继续写入；node 导入每一步重新取当前 transport，单修 UI 不足。捕获原身份与 transport，异步边界及后续破坏性步骤复核；换引擎、同引擎换 link 或 dispose 后停止续写，不回滚 A 已接受的写入，旧结果不刷新或覆盖 B。
2. Skills 真断连清目录时同时清除 dirty 正文与 CAS 基线。目录与计数仍清空；未保存草稿及原 engine/name/source/基线作为只读编辑状态独立保留。回原引擎必须显式 Refresh 并验证来源及当前正文后恢复；异引擎同名项不得重设旧稿基线。toggle 的成功、业务失败、异常与刷新返回均检查归属。

架构裁定：`direction_review`（Astra）已只读核实上述范围。实施方案仍各自遵守规则 16，只读审查后才进入源码变更。

## 验收与提交

- [x] 固定基线类型检查获得当前结果，并区分既有诊断与本波新增诊断。
- [ ] 两份方案分别只读审查、修订、独立提交后实施。
- [ ] Providers/Models 延迟 dialog/confirm/upsert/import 首项，覆盖换引擎、同引擎换 link、dispose；B 零写入，无后续旧删除/导入与提示污染，正常流程保留。
- [ ] Skills 真断连到同引擎重连显式 Refresh 保稿；foreign/missing/source-change/read failure 不丢稿且不可写；旧 save/read/toggle 晚到及 dispose 不污染。
- [ ] 唯一执行者运行有业务断言的旧生产红 / 新生产绿及定向检查，不将窄验证称为全量通过。
- [ ] 记录独立复核、文档门禁、精确提交 SHA、实时 merge 归属及安全同步结果。

## 下一批已确认问题

- Engine Terminal 关闭/error 后未收敛为不可逆终态，正常远端关闭可能出现第二次失败出口；另有 write/resize/close 拒绝处理缺口。下批按完整 Terminal 生命周期处理。
- Memory 异步对话框后只检查当前可写，缺少开始时 engine/link 身份校验。下批独立处理，不扩散本波文件范围。

以上只是已核实后续任务，不是完成声明；后续调度继续核对当前代码与外部状态。
