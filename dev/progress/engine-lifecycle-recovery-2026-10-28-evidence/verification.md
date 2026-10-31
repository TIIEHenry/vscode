---
title: "Engine 生命周期修复基线验证"
type: reference
status: active
phase: M7
updated: 2026-10-28
summary: "固定 d91、原 src 项目 noEmit exit 0；首轮 358 条环境诊断及未达到的运行/集成边界分记"
---

# 基线验证

C 槽固定 HEAD `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`、`src` tree `cc646e22c00cff331f59c430aaddbe8a39a90256`。两次均实际运行：

```bash
NODE_DISABLE_COMPILE_CACHE=1 npm run typecheck-client -- --incremental false
```

原命令为 `tsc --project ./src/tsconfig.json --noEmit --skipLibCheck --incremental false`；每次开始前无活跃编译，执行期间独占 `/tmp/vscode-compile.lock` 与 `/tmp/vscode-loop-compile.lock`，未 emit、未跑测试。

两次脚本继承调用环境后显式设置 `NODE_DISABLE_COMPILE_CACHE=1`，没有主动清除或采样 `NODE_COMPILE_CACHE`。后续工具进程检查该变量未设置，但不能倒推当次环境。没有采集外部 merge 的 715 项共享产物守卫，故本记录不证明完整共享 cache 元数据不变。后续 Node 调用统一使用 `env -u NODE_COMPILE_CACHE NODE_DISABLE_COMPILE_CACHE=1`；不为补此边界重跑本次基线。

| 执行 | 真实结果 | 原始身份/时间/前后状态 |
|:---|:---|:---|
| 首轮 | exit 1，358 条 TS 诊断；当前工位缺 `.build/typings/electron.d.ts`，Electron/original-fs 类型缺失及级联错误 | [metadata](baseline-missing-typings-metadata.json) · [进程前置](baseline-missing-typings-processes-before.json) |
| 补前置后的同命令 | exit 0，0 条 TS 诊断，约 9 秒；仅 npm 现存配置 warnings | [metadata](baseline-ready-metadata.json) · [进程前置](baseline-ready-processes-before.json) |

两次间没有源码变更。只在目标原不存在、来源真实可读时，补 ignored 本地 `electron.d.ts` → merge 已生成声明的链接，不写来源。声明 1119351 bytes，SHA256 `24bd380cc4aec824e8c7e8b18bdfcb8a4078d522fc607645b38774dac094da41`，前后一致。第二次 HEAD 与源树不变，父级两份看板文档及本次指南的 git status 前后保持。首轮是已定位并修复的环境前置问题，不作为本轮源码失败。长期步骤见[构建指南](../../../docs/guides/getting-started.md#隔离-worktree-的-electron-类型前置)。

完整日志留在本机 `/tmp/vscode-c-d91-baseline-20261028/typecheck.log` 与 `attempt2/typecheck.log`；仓内仅保留短证据和元数据。日志身份分别为：

- 首轮：47774 bytes，SHA256 `c6b7e251f78ae7f2fccd34ad41dc8d809c45b90bf833659b546f24a02b456b4b`。
- 第二次：1041 bytes，SHA256 `332ad90642bc4929df6bf60607ca4fe32ac1a3d1299ac58116962a7b4de0fcfd`。

该结果只证明固定基线原项目 noEmit；不能替代 `compile-client`/`compile`、新实现的旧红/新绿、真实业务验证或最终集成。外部唯一 merge 槽未移交，本执行者没有改动其 git 状态、源码或产物。本轮实现与后续验证见[并行看板](../../parallel/active/engine-lifecycle-recovery-2026-10-28.md)。

## 独立方案提交前文档门禁

2026-10-28，C 的已审方案、产品合同、指南、行动层与本目录一并检查；没有源码变更、编译或测试产物刷新。

- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-docs-health.py`：exit 0，0 errors / 46 links warnings。
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/generate-docs-status.py --check`：exit 0，生成列一致。
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/tests/test_docs_status.py`：实际 6 过 / 1 失败，`test_head_requirements_fixture_parses_all_prds` 将 PRD 数硬编码为 28，而当前为 29。
- 固定 `git show d91a7a8d361:docs/product/requirements.md` 由未改的 parser 解析同样得到 29 项 / 0 findings，含 `PRD-029`；该 SHA 的原测试同样断言 28。此为既有测试陈旧问题，已报告父调度，不在本次纯文档方案提交中修改测试。
- `git diff --check`：exit 0。两方案只完成文档签收，产品与运行验收状态不因此升档。

## Skills 独立方案接收与文档门禁

F 在只含一份未跟踪方案时，执行 `git merge --ff-only 425940ed354` 成功接收 C 共享文档；原 Skills 方案 SHA256 前后均为 `b2957fa426a5719e8a63b720a1bbe18927f16c85472e9ee5d952d9c7576f6617`。方案已由 Astra 复审签收 C0/I0/M0。F 仅补本方案索引、生成状态与进度记录，`src` tree 仍为 `cc646e22c00cff331f59c430aaddbe8a39a90256`。

F 的 `generate-docs-status.py`、`generate-docs-status.py --check`、`check-docs-health.py`、`git diff --check` 均 exit 0；健康检查为 0 errors / 73 links warnings，其中包含该槽尚未填充 `dev/loop` 子模块的本地断链，不以 C 的 46 warnings 代报 F。未重新跑已经证明陈旧的 PRD 数量单测、未初始化或改动子模块、未编译、未改共享产物。两槽纯文档依赖通过 ff-only 同步，不表示已经进入外部唯一 merge 或产品集成分支。
