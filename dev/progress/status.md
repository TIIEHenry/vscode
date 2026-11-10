---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-11-11
summary: "BYOK、automation/scenario 编译、Kotlin 离线回归与最终验收器整合已通过；新的真实模型与窗口矩阵尚未执行，后续产品 out 刷新仍按共享锁排队。"
---

# Development Progress

## 当前会话：MiMo 真实对话与过程显示

执行方案：[MiMo 双模型真实对话与过程显示矩阵](../plans/mimo-real-conversation-matrix.md)。方案及预算、Electron 别名修订分别提交为 `0a7a092ac91`、`cc79e1cb34d`、`e05a362249b`，均已通过规则 16 复核；方案签收不代表模型或窗口验收通过。

- 用户目标：flash/pro × 三协议完整真实 LLM 矩阵，必要复杂真实路由；重点是消息、工具过程、父子归属、取消和历史显示。全程仅一个编译通道。
- 干净 c4fa 引擎候选已完成 JVM 构建、完整运行依赖收集与清单核对。封存包在仓外 `vscode-debug-engine/candidates/c4fa6c3868-20261111/engine/`；原 PIN、50061 和其他工作区 WIP 未改。
- 候选冷启动已用生产 IDE 编译产物通过发现/叶证书 pin 与只读 RPC；空会话页、175 工具，未 seed 模型目录为 0。自有 50081 进程已正常停止；不计真实模型或窗口通过。
- 另在自有 50082 验证一次空会话 Create/Info/权限/队列/Delete；按 ADR-275 分别确认运行时已卸载、持久历史保留。原探针错误的永久删除判据已独立纠正并保留原件，服务已正常停止；没有改引擎生产代码或调用 Purge。
- 引擎矩阵 harness 在独立 `codex/mimo-real-display-matrix` 工位，保留 c4fa capabilities；编译前预注册完整任务集合，保护源码/产物身份。审计未知项、路由路径归属及实际 JVM 隔离修复已获只读复核 C0/I0，Kotlin 离线回归与运行依赖准备已通过；真实矩阵尚未执行。
- 默认窗口 runner、U01–U10 验收器、原流 raw-bytes tap 和独立 oracle 已实现。持久回答闭集、工具完整结果与执行事实一致性、精确路由路径/内容/阶段、真实 fold 内容/DOM 增量修复均经独立 C0/I0 复核；缺少可验证增量记 uncovered。离线通过不计真实 LLM 或真实窗口通过。
- 本轮 BYOK 单测、automation/scenario 编译及 Kotlin 离线回归已在唯一通道完成，自有 lane 已释放。随后发现外部 `routes-only --skip-compile` campaign（PID 407934）重新持有 `/tmp/universeagent-gradle.lock`；必要产品 out 刷新仍需同锁排队，不绕过或并行编译。
- Electron 包内文件别名窄实现与 Electron main 原生 bound getter 已独立复核 C0/I0；实际 Electron 包身份遍历复验已通过，automation/scenario 产物已编译。它们仍不构成新的真实窗口或模型结果。

## 当前工位与证据

| 工位 | 用途 | 状态 |
|---|---|---|
| `vscode` / `agent-ide` | 默认编辑器矩阵、验收器与文档 | 实现与定向验证已具备；待最终产物封存和真实验收，保留原有 `SHA256SUMS` |
| `vscode-debug-engine/universe-agent-c4fa6c3868` | 干净候选及运行包来源 | c4fa，构建完成；未换入当前运行包 |
| `vscode-debug-engine/universe-agent-mimo-display-tests` | 独立真实 LLM 测试 harness | 离线回归与运行依赖准备已通过；真实矩阵待执行，实施改动未提交 |

- 运行包、启动隔离和内存监控诊断：[引擎指南](../../docs/guides/debug-engine.md)。
- 最终离线整合：Node24 下 `python3 -m unittest scripts.tests.test_mimo_real_editor_matrix scripts.tests.test_real_editor_engine_lifecycle scripts.tests.test_real_editor_scenario scripts.tests.test_mimo_real_editor_budget_bridge -v` 已通过，含预算、oracle、Chromium DOM、真实 Node/Python 单调钟桥接、信号回收与凭据清理；运行前后源码摘要一致。证据在仓外 `vscode-debug-engine/logs/2026-11-11-offline-mimo-final-307a999c02.json`，SHA-256 `019f75e8b4e283d9450a3d78b576f8adc7ea56a30df0ef0d678d8e9f91e87e3e`。这次整合没有编译、启动 Java 或调用真实 Provider；Kotlin 与编译证据独立列于计划。
- 最初锁等待码 75、首次 automation 类型错误和随后 Kotlin fixture 负例失败均保留，修正后的重跑分别通过。串行阶段记录在仓外 `2026-11-11-serialized-validation-zs37k6nf/status.json` → `2026-11-11-serialized-retry-jfow8dy1/status.json` → `2026-11-11-kotlin-retry-sdjysvnk/status.json`，均位于 `vscode-debug-engine/logs/`；具体错误、命令和重跑边界见[计划实施记录](../plans/mimo-real-conversation-matrix.md#6-审查与实施记录)。锁等待没有记成源码测试失败，旧失败没有被后续通过覆盖。

## 下一步

1. 核对最终来源与正式协议，按共享锁完成必要产品 out 刷新。
2. 复核提交边界并封存最终源码、运行包和产物身份。
3. 串行执行完整真实模型矩阵与默认窗口显示矩阵；失败、未覆盖和 skipped 分开保留。
4. 按真实事件定位显示问题，修复后建立新 campaign，在最终身份上复验全表。

## BYOK 迁移维护

`51cd33c08ff` 已修旧配置多 Key 分组与逐桶失败重试。新增检查发现 Azure 构造迁移拒绝遗漏，以及 Ollama 分组导入成功后旧 endpoint 清理失败不能恢复。窄恢复方案已独立审查 C0/I0 并提交 `35a2a82dbd8`；后续实现也获独立 C0/I0，Azure/Ollama 四个目标文件 ESLint 通过，本轮 Custom OpenAI、Azure 与 Ollama 定向单元测试已在唯一通道通过，命令与原始输出保存在上述首轮串行目录的 `byok-unit.log`。实现仅认领并清理同一来源作用域的旧值，不覆盖已迁移组；非事务窗口仍按 [r15 方案](../plans/review-2026-11-07-r15-copilot-plan.md#d1421-后续ollama-迁移后的旧配置清理恢复2026-11-11) 留边界，未泛称全部恢复债关闭。

## 历史

进入本轮目标前的原始条目已逐字保全，并通过 wiki archive 预览/执行流程归档到[历史快照](../../archive/dev/progress/status-before-mimo-matrix-2026-11-11.md)。历史环境与目标不当作当前事实。
