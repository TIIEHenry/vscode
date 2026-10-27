---
title: "Skills 断连草稿恢复验证"
type: progress
status: completed
phase: M7
updated: 2026-10-28
summary: "固定 d91 原生产3过23业务红；首轮新实现选择重入失败保留，补修后26及完整89通过，原项目 noEmit / 两文件 lint 通过；独立可重放归档"
---

# Skills 断连草稿恢复验证

[实施方案](../../plans/skills-disconnect-draft-recovery.md)的源码验证已完成。固定旧生产配冻结新测试为 3 过 / 23 个业务 AssertionError；首轮新实现 afterEach 选择事件递归失败，补修后 focused 26 过、完整 EngineSkillsSection 89 过（含官方 meta），均 0 失败。原项目 noEmit 0 诊断、主题两文件 ESLint 0 errors / 0 warnings。实际合并后的验证与真实引擎产品验收尚未执行，PRD-025 仍 accepted。

## 身份与证据

固定产品基线 `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`，当次文档 HEAD `c38973b33015f1e70ce3bca643595f0021515b20`。旧生产原字节从 Git 读取，没有为测试适配实现。26 个新用例覆盖真断连后的编辑 / 空草稿、原 engine 重连显式 Refresh、raw CAS、foreign / missing / changed-source / failed read 隔离、旧 save / read / toggle 晚到与 dispose。

| 冻结源码 | SHA-256 |
|:---|:---|
| `src/vs/workbench/contrib/conversation/browser/engineSkillsSection.ts`（最终） | `9d5f00350454f439c2e767e4aaa51968a9a100941d6bc81be984343bf0bd3b24` |
| `src/vs/workbench/contrib/conversation/test/browser/engineSkillsSection.test.ts`（各轮不变） | `9c107bb93461bd6eddea91fc731a673fef60ff2daf88340b87367e669393f4a2` |
| `engineSkillsSection.ts`（首轮失败候选） | `9c66a9749202b7b6c1a3473c7cd24e22600dbc5e2466ba41587c5dedfaabb037` |

[独立原始归档](skills-runtime-artifacts.tar.gz)为 2,220,139 bytes / 34 个成员，SHA-256 `ce2af4d01f2dbe428e9a446e1eb205d9c782ceaec2d068bd5326bb6e5debbdfd`；[清单](skills-artifact-inventory.json)列出各成员大小与 hash。归档自带冻结测试、最终与首败生产、原始日志 / JSON、依赖输入和产物身份、执行器及重放清单，不依赖 C 工位的 ignored scratch，也未复制完整依赖产物树。[质量记录](skills-quality-results.json)保存原项目 noEmit 与两文件 lint 的命令、exit code 和日志身份。

最终 2379 项活动源码 / 产物绑定为归档 `final-active-source-out-identities.json`；首败候选另有 `initial-failed-active-source-out-identities.json`。历史 `runs/F/new-identities.json` 的 `sourceSha256` 是基线快照列，不能当作新生产的活动身份；原文件保留，最终判断用活动身份表。

## 红绿与首轮失败

| 阶段 | 实际结果 | 归档内路径 |
|:---|:---|:---|
| 原生产 focused | 3 过 / 23 个业务 AssertionError | `runs/F/old-focused-result.json` |
| 首轮新生产 focused | 首例过，afterEach 栈溢出；其余 25 例未跑 | `runs/F/new-focused-result.json`、`new-focused.log` |
| 补修后 focused | 26 过，0 失败 | `runs/F/retry1/new-focused-result.json` |
| 补修后完整套件 | 89 过，0 失败 | `runs/F/retry1/new-full-result.json` |
| 原项目 noEmit / 主题 ESLint | exit 0 / 0 errors、0 warnings | `quality/F-noemit.log`、`quality/F-eslint.log` |

首轮递归链为 `restoreSkillSelection → setSelection → selection listener → restoreSkillSelection`，不是 green。owner 为 empty 与 singleton 选择都增加幂等判断，26 例测试逐字保留；非作者静态复核 C0/I0/M0 后，执行者确认其余 2378 项依赖产物未变，仅刷新最终生产再跑 focused 和完整套件。没有重复原生产红测，首败源码 / 日志均保留。

## 重放与边界

[重放准备脚本](skills-replay-inputs.py)校验归档与成员 hash，按固定 Git 基线重建 2379 项输入，再提供 `old` / `new` 增量产物生成器。[Python-only 准备检查](skills-replay-preparation-check.json)已实际通过，未启动 Node、编译或测试。令 `TASK_REPO` 指向独占且依赖齐全的 worktree，`TASK_SCRATCH` 指向尚不存在的私有目录，不使用共享 merge。以下从该 worktree 根执行：

```bash
rtk proxy python3 dev/progress/engine-lifecycle-recovery-2026-10-28-evidence/skills-replay-inputs.py --repo "$TASK_REPO" --scratch "$TASK_SCRATCH"
rtk proxy mkdir -p "$TASK_SCRATCH/tmp" "$TASK_SCRATCH/xdg-cache"
```

每次 Node 运行前检查实际 compile/test 进程并协调外部 owner 的时间段；两把锁非等待获取。先用 `old` 刷新全部私有 out 并跑 focused（预期 exit 1），再用 `new` 仅刷新最终生产后跑 focused / 完整。生成器使用官方 `build/next/transpile.ts` 的 `transpileFile`，拒绝 out 内软链接与多硬链接。历史首败源码另存于 `inputs/initial-failed/`；其日志证明已发生的失败，默认 `new` 重放最终修复。

```bash
rtk proxy flock -n /tmp/vscode-compile.lock flock -n /tmp/vscode-loop-compile.lock env -u NODE_COMPILE_CACHE NODE_DISABLE_COMPILE_CACHE=1 TMPDIR="$TASK_SCRATCH/tmp" XDG_CACHE_HOME="$TASK_SCRATCH/xdg-cache" node "$TASK_SCRATCH/replay-transpile.mjs" old
rtk proxy flock -n /tmp/vscode-compile.lock flock -n /tmp/vscode-loop-compile.lock env -u NODE_COMPILE_CACHE NODE_DISABLE_COMPILE_CACHE=1 TMPDIR="$TASK_SCRATCH/tmp" XDG_CACHE_HOME="$TASK_SCRATCH/xdg-cache" VSCODE_SKIP_PRELAUNCH=1 bash scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/engineSkillsSection.test.ts --grep 'disconnected draft ownership' --no-sandbox --disable-gpu --reporter json
```

将 transpile 参数改为 `new` 后再跑同一 focused 命令；完整套件去掉 `--grep`。质量命令为同样环境 / 双锁下的 `npm run typecheck-client -- --incremental false`，及 `node node_modules/eslint/bin/eslint.js --no-cache --format json` 后接表中最终两条完整源码路径。原执行器记录了当次完整命令与进程 / 双锁检查，带历史绝对路径，仅作证据。

当次依赖只读；所有 runtime / transpile / quality 子进程 unset `NODE_COMPILE_CACHE`、设置 `NODE_DISABLE_COMPILE_CACHE=1`，临时目录 / XDG cache / 实际 Electron userData 均私有。准备阶段曾遇 `/tmp` ENOSPC，发生于 Node 运行前；仅迁移本轮 scratch，不算业务红。官方原项目检查前置与基线环境问题见[基线证据](verification.md)。没有全仓编译、默认编辑器真实引擎点按或外部 owner 715 项共享元数据的独立全量采样；不将 89 项完整目标套件扩大为这些结论。
