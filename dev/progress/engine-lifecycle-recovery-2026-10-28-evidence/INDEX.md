---
title: "Engine 生命周期并行修复证据"
type: index
status: active
phase: M7
updated: 2026-10-28
summary: "阶段一634与S1共享602保留；S2独立C200/F133全过、两原项目noEmit0，lint C4既有warnings/F0，证据封装与主题提交准备，产品集成待"
---

# Engine 生命周期并行修复证据

- [基线类型检查](verification.md)：首轮环境前置缺失与修复后的同源 noEmit 结果、命令、身份和边界。
- [Providers / Models 写入归属](providers-verification.md)：原 browser34/node11 业务红，新完整65/480；精确 reader 隔离、import-only 后修、原始归档与可重放输入。
- [IPC 共享 owner 合同](ipc-shared-verification.md)：S1冻结身份、Astra源码复核、旧2f业务红/新shared验证准备及实际运行结果。
- [固定共享依赖真三路接入F](ipc-shared-dependency-merge.json)：原始两parent、保护字节、文档冲突决定与门禁结果；只同步依赖，不作S2或产品验收。
- [S2 UI接线验证](ipc-ui-verification.md)：两域目录owner补修、最终C200/F133完整绿与原项目/lint、首TS/fixture/lint失败及旧红首断言边界；独立树验证，产品集成待。
- [S2运行原件归档](ipc-ui-runtime-artifacts.tar.gz) / [清单](ipc-ui-artifact-inventory.json) / [执行身份](ipc-ui-execution-identities.json)：五次attempt、首失败与精确映射；最终包SHA及证据边界见S2验证正文。
- [S2输入重建脚本](ipc-ui-replay-inputs.py) / [实际核验](ipc-ui-replay-preparation-check.json)：纯Python解包与23,872快照prepare，五manifest均禁止运行，六仓库目的地拒绝；不运行测试。
- [并行看板](../../parallel/active/engine-lifecycle-recovery-2026-10-28.md)：任务、冲突域与当前验收状态。
