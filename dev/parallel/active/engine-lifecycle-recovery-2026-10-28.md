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
- C/F 接受其after完成前共享依赖只读：不install/upgrade/rebuild/clean，不写共享或包内缓存；各槽临时目录、out及Node缓存私有。I仅为外部after工位候选，未视为已占用，本波不使用I。
- C/F 原工作区干净，旧 `loop/C`、`loop/F` 分支完整保留；用新分支指向固定基线，未 reset、stash 或清理其他工作。
- 两份已审方案独立提交为 `425940ed354` 与 `c38973b3301`，C/F 经 Git 快进到共同文档头 `c38973b33015f1e70ce3bca643595f0021515b20` 后开始并行实施；其源树仍与固定 d91 完全相同。
- 编译只由 `integration_executor` 执行；实施 agent 不启动编译或 transpile。C 固定基线的原项目 `npm run typecheck-client -- --incremental false` 已 exit 0、0 TS；首轮缺 Electron 类型文件的环境诊断单独保留，补前置后同源复跑通过。见[基线证据](../../progress/engine-lifecycle-recovery-2026-10-28-evidence/verification.md)。

## 冲突域矩阵

| 域 | 槽位 / 分支 | 唯一实施者 | 边界 | 当前状态 |
|:---|:---|:---|:---|:---|
| Providers/Models 写入归属 | C / `fix/c-engine-write-ownership-20261028` | `providers_implementation` | `engineProviderModelSection`、connection service 导入链、对应测试 | 旧 browser34业务红、旧node11业务红；新完整browser65/node480、原项目noEmit通过，lint0errors/3既有warnings |
| Skills 断连草稿 | F / `fix/f-skills-draft-recovery-20261028` | `module_review` | `engineSkillsSection`、对应测试 | 旧3过23业务红；新重入修正复核C0/I0/M0，新26及完整89、原项目noEmit通过，lint0/0 |
| 编译与集成 | C，后续使用唯一 merge 槽 | `integration_executor` | 单路验证、主题提交、无损合并 | 基线与两域修复的原项目noEmit通过；实际集成编译与全池同步尚未执行 |

两实施域不共享生产文件。公共需求、规格、索引与进度文件由父协调分配，禁止并行覆盖同一文件。每域本波最多一次集成合入。

## 已核实缺陷与架构决定

1. Providers/Models 的对话框、确认、改名后的删除及批量导入未绑定开始时的 engine/link。A 中开始的操作可能在 B 继续写入；node 导入每一步重新取当前 transport，单修 UI 不足。捕获原身份与 transport，异步边界及后续破坏性步骤复核；换引擎、同引擎换 link 或 dispose 后停止续写，不回滚 A 已接受的写入，旧结果不刷新或覆盖 B。
2. Skills 真断连清目录时同时清除 dirty 正文与 CAS 基线。目录与计数仍清空；未保存草稿及原 engine/name/source/基线作为只读编辑状态独立保留。回原引擎必须显式 Refresh 并验证来源及当前正文后恢复；异引擎同名项不得重设旧稿基线。toggle 的成功、业务失败、异常与刷新返回均检查归属。

架构裁定：`direction_review`（Astra）已只读核实上述范围。实施方案仍各自遵守规则 16，只读审查后才进入源码变更。

## 运行中发现与处理

- C/F 原有 out 均陈旧，不能当作 d91 runtime；执行者固定真实依赖源码后，通过官方 transpileFile 刷新私有产物并保留 source/out 身份。node 旧新阶段用同一精确 ESM hook 替换本地 harness reader，仅固定假数据；生产原字节不变，不读取真实用户凭据。
- `/tmp` 分区 ENOSPC 发生于准备快照时，候选尚未启动，不算业务红。仅迁本轮 scratch 到 C 私有 `.build`，Node/Electron 临时目录与缓存均私有；不清其他任务文件。
- F 原生产配新26例实际3过23个业务 AssertionError。首轮新实现首例通过，但 afterEach 报选择事件重入栈溢出，其余25例未运行；该轮不能称 green。owner 将恢复选择改为只在目标索引确有变化时写入，26例逐字保留，补修独立复核C0/I0/M0；只刷新新生产后26/0、完整89/0。原失败证据保留，无重复旧红。
- 两域独立静态复核 C0/I0，C 的同一 transport 换 link 诊断分支盲点已追加第13项 node 回归；静态结论不替代运行结果。
- C 原 browser34/34业务红，原 node 完整480项中469过11业务红；新 browser focused34/0、完整65/0，新 node 完整480/0（含13项新增）。同一精确fake-reader hook与fixture隔离两阶段，旧service原字节保留；计数与阶段区别以短证据为准，不伪报旧失败后未达路径。
- C/F原项目noEmit均0诊断，主题lint均0errors；C新增重复import已合并，测试体逐字不变。只刷新其browser test后完整65/0、原项目0诊断、lint3既有warnings，未重复node/F/旧红。两域共634项完整套件通过，不扩大为全仓compile或真实引擎产品验收。

## 验收与提交

- [x] 固定基线类型检查获得当前结果，并区分既有诊断与本波新增诊断。
- [x] 两份方案分别只读审查、修订、独立提交后实施。
- [x] Providers/Models 延迟 dialog/confirm/upsert/import 首项，覆盖换引擎、同引擎换 link、dispose；B 零写入，无后续旧删除/导入与提示污染，正常流程保留。
- [x] Skills 真断连到同引擎重连显式 Refresh 保稿；foreign/missing/source-change/read failure 不丢稿且不可写；旧 save/read/toggle 晚到及 dispose 不污染。
- [x] 唯一执行者运行有业务断言的旧生产红 / 新生产绿；原项目与lint检查单独收取，不将定向通过称为全量通过。
- [x] 独立源码复核（含F重入补修）与两槽原项目noEmit、主题lint通过；PRD-025仍accepted。
- [ ] 记录独立复核、文档门禁、精确提交 SHA、实时 merge 归属及安全同步结果。

## 下一批已确认问题

- [D1390](../../progress/deferred-gaps.md) Engine Terminal 关闭/error 终态与 Promise 拒绝处理，按完整生命周期处理。
- [D1391](../../progress/deferred-gaps.md) Memory 异步动作的原 engine/link 归属，下一批优先独立处理。
- [D1392](../../progress/deferred-gaps.md) 文档工具单测硬编码 28 个 PRD、固定基线实际 29；6 过/1 既有失败的对照已记录，不掩盖为全绿。

以上只是已核实后续任务，不是完成声明；后续调度继续核对当前代码与外部状态。
