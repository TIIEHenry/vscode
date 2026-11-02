---
title: "从本仓库构建与运行"
type: guide
status: accepted
phase: N/A
updated: 2026-11-02
summary: "本仓库已核对的安装、构建、启动命令与隔离 worktree Electron 类型前置；完整贡献与排错以官方 wiki How to Contribute 为准"
---

# 从本仓库构建与运行

完整的前置工具、排错、调试与提 PR 流程以官方 wiki 为准，本文**不复述** wiki 全文：

- [How to Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute) — 构建、运行、调试、测试、PR
- 仓库入口也指向同一页：[README.md · Contributing](../../README.md)

下面只收录本仓库 `package.json`、[Copilot Instructions](../../.github/copilot-instructions.md) 与上述 wiki **能核对到**的命令。

## 1. 环境

- Node.js 版本以仓库根 [`.nvmrc`](../../.nvmrc) 为准（当前为 `24.18.0`）。wiki 要求 `>= 22.x`。
- 推荐在仓库根执行 `fnm use`（wiki）。
- 克隆路径不要含空格（wiki）。
- 也可跳过本机工具链，用仓库自带的 Dev Container / Codespaces，见 [README.md · Development Container](../../README.md)。

系统编译器、Python、`node-gyp` 等平台细节只在 wiki「Prerequisites」维护，此处不抄。

## 2. 安装与构建

在仓库根：

```bash
npm install
```

然后二选一（均来自 wiki / `package.json`）：

| 目的 | 命令 | 来源 |
|------|------|------|
| 持续增量编译（核心 + 内置扩展） | `npm run watch` | wiki · `package.json` |
| 一次性编译 client + copilot | `npm run compile` | `package.json` |
| 只编译 client（gulp compile） | `npm run compile-client` | `package.json` |
| 只要较快产出、测试只需新的输出文件 | `npm run transpile-client` | Copilot Instructions · `package.json` |

在已打开本仓库的 VS Code 窗口里，wiki 也写了用 **Ctrl+Shift+B**（macOS 为 **Cmd+Shift+B**）跑构建任务。Copilot Instructions 要求：已有 workspace task 在出诊断时，不要再另起一份等价的 shell 构建。

首次完整编译结束后，watch 会打印含 `Finished compilation` 的消息（wiki）。若构建或启动失败，wiki 建议在仓库根 `git clean -xfd` 后再 `npm install`——这是破坏性清理，只在排错时按 wiki 使用。

### 隔离 worktree 的依赖与单路编译

固定工位根与产品基线见[工位池](../../dev/progress/worktree-pool.md)。复用已安装依赖时，不只检查根 `node_modules`：还包括 `build/node_modules`、`extensions/node_modules`、`extensions/*/node_modules`、语言扩展的 `server/node_modules`、`remote/web/node_modules` 和 `.vscode/extensions/*/node_modules`。缺聚合 `extensions/node_modules` 会让 `extensions/esbuild-common.mts` 找不到 esbuild；缺 selfhost 扩展依赖会报 `istanbul-to-vscode`、`cockatiel` 以及连带隐式 any。只链接来源真实存在、目标尚不存在的目录，禁止覆盖他人工位或并行 install。

**完整编译会写依赖树内的生成包**：`extensions/copilot/.esbuild.mts` 写 `node_modules/@vscode/copilot-typescript-server-plugin`；其 postinstall 还会写 `node_modules/@github/copilot` 的 SDK、prebuilds 与 package.json。完整 compile 的执行槽不能把整个 Copilot `node_modules` 直链到另一工位；应创建本槽真实 `node_modules` 目录，普通包逐个链接，`@vscode` / `@github` 两个 scope 也创建真实目录，仅将上述两个可写包复制为私有目录，其余包继续链接。若对应包尚不存在，保留本槽私有目标供构建生成。不要用 hardlink 或把可写子目录再次链接回共享来源；这些复制仅是构建依赖隔离，不用于同步仓库源码。

各槽的 `out`、`out-build`、`.build` 与 Copilot `dist` 保持独立。仅验证者持有编译测试通道，类型检查也算占用该通道。完整命令的 runner 默认并行 client/Copilot，单路要求下使用已核对支持的 `--max-parallel 1`：

```bash
mkdir -p .build/task-tmp .build/task-cache
TMPDIR="$PWD/.build/task-tmp" XDG_CACHE_HOME="$PWD/.build/task-cache" \
  NODE_DISABLE_COMPILE_CACHE=1 npm run compile -- --max-parallel 1
```

先使用 `.nvmrc` 对应 Node，再执行此命令。日志保存在仓外工位根的本次协调目录；失败重跑使用新文件，保留原退出码和环境错误。基线完整编译绿后才创建字母槽，合并结果在 merge 槽重新编译；本次真实证据见[2026-11-02 看板](../../dev/parallel/active/session-owner-wave-2026-11-02.md)。

新 worktree 的 `dev/loop` 也需要 `git submodule update --init dev/loop` 检出父仓固定 gitlink。已有同版本本地子模块时可加 `--reference /absolute/path/to/existing/dev/loop` 复用对象；不修改源码或升级指针。未初始化会使 wiki check 对 loop 链接报错，属于工位前置。官方 Electron 定向单测先准备本槽 `.build/electron`；可复制既有同版本 runtime，再用 `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run <测试文件.ts>`，无图形环境时通过 `xvfb-run -a` 执行，避免预启动下载与额外编译。

**worktree 提交钩子的已知环境问题**：Git 会给 hook 设置本槽 `GIT_DIR`。当前 wiki `Snapshot._expand_gitlinks` 的子模块 Git 调用继承它，可能在普通 check 通过、固定子模块也已检出时，令 `check --staged` 误报 loop 断链。经本轮实测，可让 hook 的 `PYTHON` 指向仓外可执行包装脚本，先清仓库定位变量，再原样执行同一个 Python 检查；保留绝对 `GIT_INDEX_FILE`，核对它仍是本槽正在提交的 index。包装脚本正文如下，通过 `PYTHON=/absolute/path/to/wrapper git commit ...` 使用；原 pre-commit/commit-msg 均继续运行，不禁用钩子。

```sh
#!/bin/sh
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR
exec python3 "$@"
```

### 隔离 worktree 的 Electron 类型前置

复用另一工位的 `node_modules` 时，仍需检查**当前工位**的 `.build/typings/electron.d.ts`。`src/tsconfig.base.json` 将 `electron` 映射到这个路径；只链接依赖目录不会提供它。缺少该文件会导致 `electron`、`original-fs` 和 `Electron` namespace 的连带类型错误，先修复这一环境前置再判断源码诊断。

若已有使用同一 Electron 版本的构建工位，可在目标工位内复用其已生成的声明文件。先核实来源真实可读，目标不存在时才创建链接，禁止覆盖已有文件或通过链接向来源写入：

```bash
TYPINGS_SOURCE=/absolute/path/to/built-worktree/.build/typings/electron.d.ts
test -r "$TYPINGS_SOURCE"
mkdir -p .build/typings
ln -s "$TYPINGS_SOURCE" .build/typings/electron.d.ts
```

该路径属于 ignored 构建前置，不是源码同步方式。仅需检查类型且要保持各工位输出时，可运行 `env -u NODE_COMPILE_CACHE NODE_DISABLE_COMPILE_CACHE=1 npm run typecheck-client -- --incremental false`；该命令不生成测试所需的 JavaScript。各槽仍按[工位池规则](../../dev/progress/worktree-pool.md)协调唯一编译执行者，不能因为 `--noEmit` 就另开并行编译。

隔离验证前分别检查仓库盘与临时盘：`df -h . /tmp`。它们可能是不同分区，仓库还有空间时，临时源快照或 Electron 的默认临时目录仍可能报 `ENOSPC`。本轮已遇到 `/home` 约 2.7 GB 可用、`/tmp` 分区仅 4 KiB 的情况；只迁移本任务自有 scratch 到当前槽的私有 `.build/`，并为子进程设置同一任务目录下的 `TMPDIR` 与 `XDG_CACHE_HOME` 后恢复验证。不要清理其他任务的 `/tmp`、缓存或依赖；共享工位的 `out`、`.build`、`node_modules` 保持只读。

## 3. 启动 Code - OSS

先完成上一节的构建。未 watch/compile 就启动时，wiki 提到可能出现 “not a valid Electron app”。

| 目标 | macOS / Linux | Windows |
|------|----------------|---------|
| 桌面（Electron） | `./scripts/code.sh` | `.\scripts\code.bat` |
| CLI（如 `--version`） | `./scripts/code-cli.sh` | `.\scripts\code-cli.bat` |
| VS Code for the Web | `./scripts/code-web.sh` | `.\scripts\code-web.bat` |
| Code Server Web | `./scripts/code-server.sh --launch` | `.\scripts\code-server.bat --launch` |

Web 场景 wiki 额外要求：除 `npm run watch` 外再跑 `npm run watch-web`（`package.json` 中对应 `gulp watch-web`）。

`package.json` 明确：`npm run web` **已废弃**，改用上面的 `scripts/code-server` 或 `scripts/code-web`。

改代码后不必每次重启进程：wiki 建议用命令面板 **Reload Window**。

用户说「启动」或「启动一下」时，用 [Agents 测试配置](test-profile.md) 打开默认编辑器窗口（`~/.universe-agent-studio-test`，命令里带 `--new-window`），并同时拉起钉死引擎 `127.0.0.1:50061`。不要用 `launch.sh` 去拷 `~/.vscode-oss-dev`。

远程相关自测：在 Code - OSS 窗口用命令面板搜 `TestResolver`（wiki）。

## 4. 校验（按影响面选用）

不要把全量 typecheck / 整仓构建当成收尾仪式。原则与命令见 [测试与校验](../architecture/cross-cutting/testing.md) 与 [Copilot Instructions](../../.github/copilot-instructions.md)。

常用入口（均已在仓库中核对）：

```bash
./scripts/test.sh --grep <pattern>          # 单测；Windows 为 scripts\test.bat
./scripts/test-integration.sh               # 集成测；Windows 为 scripts\test-integration.bat
npm run typecheck-client                    # 仅在需要时检查 src/
npm run gulp compile-extensions             # 内置扩展
npm run valid-layers-check                  # 仅当改动可能影响分层
python3 scripts/check-docs-health.py        # 文档结构变更后
```

`npm test` **不会**跑测试：`package.json` 会退出并提示改用 `scripts/` 下的脚本。

编辑器窗口的产品壳剧本不在上面几条里。入口、断言和「不要跑 Sessions e2e」见 [壳冒烟验证](shell-smoke-verification.md) §8，选用说明见 [测试与校验](../architecture/cross-cutting/testing.md)。

## 5. 接下来读什么

| 目的 | 文档 |
|------|------|
| 分层与 import | [分层规则](../architecture/cross-cutting/layers.md) · [AGENTS.md](../../AGENTS.md) |
| 术语 | [glossary.md](../glossary.md) |
| 写 docs/ | [文体指南](doc-style-guide.md) |
| 编码风格 | [Copilot Instructions](../../.github/copilot-instructions.md) |
| 贡献、调试、PR | [How to Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute) |
| 连一份不受 UA 开发影响的引擎 | [钉死引擎调试](debug-engine.md) |
| 交互测试沿用同一次登录 | [Agents 测试配置](test-profile.md) |
