---
title: "从本仓库构建与运行"
type: guide
status: accepted
phase: N/A
updated: 2026-08-30
summary: "本仓库已核对的安装、构建、启动命令；完整贡献与排错以官方 wiki How to Contribute 为准"
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

## 5. 接下来读什么

| 目的 | 文档 |
|------|------|
| 分层与 import | [分层规则](../architecture/cross-cutting/layers.md) · [AGENTS.md](../../AGENTS.md) |
| 术语 | [glossary.md](../glossary.md) |
| 写 docs/ | [文体指南](doc-style-guide.md) |
| 编码风格 | [Copilot Instructions](../../.github/copilot-instructions.md) |
| 贡献、调试、PR | [How to Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute) |
