---
title: "Providers / Models 写入归属验证"
type: progress
status: completed
phase: M7
updated: 2026-10-28
summary: "固定 d91 原生产获 browser34/node11 业务红；新完整 browser65/node480、原项目 noEmit 与主题 lint 通过，保留精确 reader 隔离和 import-only 复验"
---

# Providers / Models 写入归属验证

本页记录[实施方案](../../plans/engine-write-ownership.md)的阶段一源码验证。旧生产配冻结新测试：browser 0 过 / 34 个业务断言失败，node 完整套件 469 过 / 11 个业务断言失败；新生产完整 browser 65 过、node 480 过，均 0 失败且包含官方 meta 检查。续查确认main换代早于renderer通知的IPC窗口仍未封闭，任务已重开；这些原件、数字和归档保留为阶段证据，不能证明后续expectedOwner补修通过。实际合并后的验证和真实引擎产品验收尚未执行，PRD-025 仍 accepted。

## 身份与证据

固定产品基线为 `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`，当次文档 HEAD 为 `c38973b33015f1e70ce3bca643595f0021515b20`。原生产逐字从 Git 读取，没有适配旧实现；冻结新测试覆盖 engine 切换、同 engine 换 link、dispose、延迟确认 / 输入、改名后删除及批量导入继续步骤。最后一次 node 测试含 13 个新增归属用例。

| 冻结源码 | SHA-256 |
|:---|:---|
| `src/vs/platform/universeAgent/node/universeAgentConnectionService.ts` | `3140ecdd41fe35d743678e018e41d550fe21cd26849ea80ed6ab53e9c2893c63` |
| `src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts` | `77166cf4c4513a6c063907fd414113695968f7e2a061037bf46834c46d4c49e1` |
| `src/vs/workbench/contrib/conversation/browser/engineProviderModelSection.ts` | `2d7494bfc0b42baba9102912dc7fb8d3417fbf6fc54931ad70a6dc23a17047d3` |
| `src/vs/workbench/contrib/conversation/test/browser/engineProviderModelSection.test.ts` | `3d535b0ee51dfb6f085c0923d797d8e50765ecbf827de893fc96835dfef722d6` |

[原始归档](providers-runtime-artifacts.tar.gz)为 1,910,959 bytes / 47 个成员，SHA-256 为 `cc60c122a83e13e75cbe260605903e9c7414094eebe32f9349c1ee4b93565cff`；[清单](providers-artifact-inventory.json)逐成员列出大小与 hash。内含原始 runner 日志 / JSON / node JUnit、冻结目标源码、依赖输入与产物身份、执行器和 fake reader。依赖源码由固定 Git 重建，未复制数千文件的依赖产物树。

归档中的 `final-active-source-out-identities.json` 是最终 2454 项实际输入 / 输出绑定；历史 `runs/C/new-identities.json` 的 `sourceSha256` 列记录基线快照，不代表新生产的活动输入，须以最终活动身份表为准。原文件保留供审计。

## 运行结果与后修

| 阶段 | 结果 | 归档内路径 |
|:---|:---|:---|
| 原生产 browser focused | 0 过 / 34 个 AssertionError | `runs/C/old-browser-focused-result.json` |
| 原生产 node 完整 | 469 过 / 11 个 AssertionError | `runs/C/old-node.log`、`runs/C/runner-results/linux-x64-import-old-results.xml` |
| 新生产 browser focused / 完整 | 34 / 65 过，0 失败 | `runs/C/new-browser-*-result.json` |
| 新生产 node 完整 | 480 过，0 失败 | `runs/C/new-node.log`、对应 `import-new-results.xml` |
| 最终 import-only 后 browser 完整 | 65 过，0 失败 | `runs/C/import-fix/browser-full-result.json` |
| 最终原项目 noEmit / 四文件 ESLint | exit 0 / 0 errors、3 既有 warnings | `runs/C/import-fix/results.json`、`noemit.log`、`eslint.log` |

初次 lint 为 0 errors / 4 warnings；作者仅合并测试文件重复 import，反向还原后 hash 精确回到 `aee4a99738b431db14197a58652a08e4e582d324286fcc3a545a70bc587e4780`，测试体未变。随后只刷新该 browser test，再跑完整 browser、原项目 noEmit 和四文件 lint；未重跑旧红、node 或 F。最终该 JS 为 117275 bytes，SHA-256 `2cced757718aff8be4e303790294849b6d1fcd271ad803026116916dfa978b31`。首轮静态检查元数据另见[质量记录](providers-quality-results.json)。

node 官方 runner 不应用 `--grep`，因此旧新均跑完整 480 项。两阶段使用同一 `node:module.registerHooks` 同步 load hook，仅命中私有 `out/vs/platform/universeAgent/node/harnessProviderImport.js`，其他同名路径立即报错。hook 在 runner 前直接 import 并校验固定 fixture，原 reader 不会载入；没有读取真实 HOME 凭据。原 hook SHA-256 `26ed4e437fe6bc3e2f126d2ce02046ba5487ce5c3307ab78e777e281946e384c`，fixture 为 `1e448f7a9d4267b870d929833a435168e1db23a2eb884480ab7b79ea320bf170`。旧阶段实际 15 次 fixture 读取 = 1 次预检 + 14 次 runner；有一例在第二次导入前已失败，不能算作未到达的读取。新阶段是 1 次预检、0 次 runner（新 reader 注入 seam）。隔离 trace 与 fixture 原文均在归档中。

## 重放与环境边界

[重放准备脚本](providers-replay-inputs.py)只校验归档并重建文件；[Python-only 准备检查](providers-replay-preparation-check.json)已实际通过 2454 项，未启动 Node、编译或测试。选择一个独占、依赖齐全的 worktree，令 `TASK_REPO` 为其绝对路径、`TASK_SCRATCH` 为尚不存在的私有目录；不要指向共享 merge。准备命令：

```bash
rtk proxy python3 dev/progress/engine-lifecycle-recovery-2026-10-28-evidence/providers-replay-inputs.py --repo "$TASK_REPO" --scratch "$TASK_SCRATCH"
rtk proxy mkdir -p "$TASK_SCRATCH/tmp" "$TASK_SCRATCH/xdg-cache"
```

每次运行前查实际 compile/test 进程，确认外部 owner 已交出验证时间段。下例从该 worktree 根执行；双锁都为非等待获取，所有 Node 子进程禁用并清除编译缓存。先刷新 `old` 并跑旧 focused browser 与完整 node，再刷新 `new` 跑新 focused / 完整套件，最后刷新 `final` 后复验完整 browser。生成器拒绝 out 内软链接和多硬链接。`HARNESS_TRACE_PHASE` 分别设为 `old-node` / `new-node`；旧生产断言失败预期 exit 1。

```bash
rtk proxy flock -n /tmp/vscode-compile.lock flock -n /tmp/vscode-loop-compile.lock env -u NODE_COMPILE_CACHE NODE_DISABLE_COMPILE_CACHE=1 TMPDIR="$TASK_SCRATCH/tmp" XDG_CACHE_HOME="$TASK_SCRATCH/xdg-cache" node "$TASK_SCRATCH/replay-transpile.mjs" old
rtk proxy flock -n /tmp/vscode-compile.lock flock -n /tmp/vscode-loop-compile.lock env -u NODE_COMPILE_CACHE NODE_DISABLE_COMPILE_CACHE=1 TMPDIR="$TASK_SCRATCH/tmp" XDG_CACHE_HOME="$TASK_SCRATCH/xdg-cache" VSCODE_SKIP_PRELAUNCH=1 bash scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/engineProviderModelSection.test.ts --grep 'write ownership' --no-sandbox --disable-gpu --reporter json
rtk proxy flock -n /tmp/vscode-compile.lock flock -n /tmp/vscode-loop-compile.lock env -u NODE_COMPILE_CACHE NODE_DISABLE_COMPILE_CACHE=1 TMPDIR="$TASK_SCRATCH/tmp" XDG_CACHE_HOME="$TASK_SCRATCH/xdg-cache" HARNESS_TRACE_PHASE=old-node node --import "$TASK_SCRATCH/harness-fixture-preload.mjs" test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts --tfs import-old
```

新阶段将 transpile 参数改为 `new`；完整 browser 去掉 `--grep`，新 node 改 phase 与 `--tfs import-new`。`final` 仅更新最终 browser test。质量命令为同样私有环境 / 双锁下的 `npm run typecheck-client -- --incremental false` 及 `node node_modules/eslint/bin/eslint.js --no-cache --format json` 后接上表四条源码路径。归档执行器保留了当次完整命令、阶段顺序、进程与双锁检查；不要直接运行带历史绝对路径的原执行器。

当次 C/F 陈旧 out 均经官方 `build/next/transpile.ts` 的 `transpileFile` 按固定源码重建，未全仓编译。所有 runtime / transpile / quality 子进程明确 unset `NODE_COMPILE_CACHE`、设置 `NODE_DISABLE_COMPILE_CACHE=1`；TMPDIR、XDG cache 和实际 Electron 测试 userData 都落在本轮私有目录。初次 `/tmp` ENOSPC 发生于准备输入时、尚无 Node 运行；仅将本轮 scratch 移到 C 私有 `.build`，没有清别人的缓存。基线首轮缺 Electron typings、环境前置和基线缓存采样局限见[基线证据](verification.md)与[开发指南](../../../docs/guides/getting-started.md)。独立静态审查及架构裁定见[看板](../../parallel/active/engine-lifecycle-recovery-2026-10-28.md)。没有独立采样外部 owner 的全部 715 项共享元数据，不声称完成该项全量完整性证明。
