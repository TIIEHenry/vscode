---
title: "Agents 交互测试配置"
type: guide
status: accepted
phase: N/A
updated: 2026-10-01
summary: "「启动 / 启动一下」复用 ~/.universe-agent-studio-test，并同时拉起钉死引擎 127.0.0.1:50061。登录留在这一份。不进 git。不要改用 launch.sh 或 ~/.vscode-oss-dev。壳冒烟仍走 launch.sh 临时拷贝，不启动这份引擎。"
---

# Agents 交互测试配置

> 返回 [指南索引](INDEX.md)。壳冒烟的隔离启动见 [壳冒烟验证](shell-smoke-verification.md)。本页只写**要保留登录的那一次桌面进程**。

## 1. 用哪一份

交互测试（要保持 GitHub / 引擎登录）用这一份本机配置。它从 2026-10-01 那次 Agents 窗口的 user-data 挪出 `/tmp`，单独存放。

| 项 | 路径 |
|:---|:-----|
| user-data | `~/.universe-agent-studio-test/user-data` |
| extensions | `~/.universe-agent-studio-test/user-data/extensions` |
| shared-data | `~/.universe-agent-studio-test/shared-data` |

日常产品目录是 `~/.universe-agent-studio`。`launch.sh` 的默认种子是 `~/.vscode-oss-dev`。这两处都不是本页的测试配置。

目录在本机家目录，不进本仓 git。换机器要重新登录一次，再把新的三项目录写回本表。

## 2. 启动

用户说「启动」或「启动一下」时走本节。不要改用 `launch.sh`，也不要改用 `~/.vscode-oss-dev` 或 `~/.universe-agent-studio`。

在已编译的工位（`out/`、`.build/electron/` 齐全；否则先按 [快速开始](getting-started.md) 构建）：

```bash
unset ELECTRON_RUN_AS_NODE
export VSCODE_SKIP_PRELAUNCH=1
DEST="${HOME}/.universe-agent-studio-test"
./scripts/code.sh \
  --agents \
  --user-data-dir="${DEST}/user-data" \
  --extensions-dir="${DEST}/user-data/extensions" \
  --shared-data-dir="${DEST}/shared-data" \
  --disable-workspace-trust
```

`VSCODE_SKIP_PRELAUNCH=1` 只在构建产物已经是当前的时候用。源码或 `out/` 变了就去掉它，让 `scripts/code.sh` 自己跑 preLaunch。

登录写在上面的 user-data / shared-data 里。下次用同一组参数启动，沿用这次登录。

同一时刻拉起钉死引擎。IDE 起来后会探测 `127.0.0.1:50061`，没有再探 `50051`。端口已经在听就不要再起一份。引擎可以晚于窗口起来，探测会重试。

```bash
/home/clarence/Projects/Agents/vscode-debug-engine/start-engine.sh
```

数据、端口和停引擎的方式见 [钉死引擎调试](debug-engine.md)。这份引擎是前台进程，另开终端或放到后台。壳冒烟不要跑这条命令。

## 3. 和壳冒烟分开

[壳冒烟验证](shell-smoke-verification.md) 继续用 `launch.sh`。那个脚本把种子 profile 瘦拷贝到临时目录，登录留在当次进程里，进程结束就没了。冒烟要的是干净 profile。把本页目录交给 `launch.sh` 当 `--source-user-data-dir` 时，登录写在临时拷贝上，不会回到这里。

## 相关

- [快速开始](getting-started.md)
- [钉死引擎调试](debug-engine.md)
