---
title: "UniverseAgent 真实编辑器联测"
type: plan
status: in_progress
phase: M7
created: 2026-10-31
updated: 2026-10-31
summary: "通过生产本地引擎发现、Electron main/SessionViewHost 和默认编辑器 DOM 验证真实工具与助手行，并覆盖 reload 恢复。"
---

# UniverseAgent 真实编辑器联测

`test/scenario/scenarios/universe-agent-real-editor.cjs` 是默认编辑器的真实联测剧本。它要求生产 UniverseAgent CLI 使用与 Electron 相同的 `UNIVERSE_AGENT_HOME`，等待 `Engine · Loopback`，提交真实 prompt，核对真实 tool/assistant timeline root 唯一性和 marker，最后 reload 并复核持久身份。`test/scenario/scripts/run-universe-agent-real-editor.sh` 负责隔离 cwd、启动生产 CLI、等待 lock/socket、运行 Electron scenario，并在结束时等待引擎退出。

该剧本不使用 `ScriptedSessionView`、Chromium frame fixture 或 renderer 旁路；本地模型 Provider 只应在外层启动器中配置，scenario 本身不保存密钥。执行前必须具备 `.build/electron` 与生产引擎；缺少任一项时结果是未执行，不得记为通过。

静态验证：`node --check test/scenario/scenarios/universe-agent-real-editor.cjs`、`bash -n test/scenario/scripts/run-universe-agent-real-editor.sh` 和 `npm run compile` 通过；automation 编译器显式启用 Node 类型并补齐其本地 `ncp`/`axe-core` 依赖。真实 Electron 运行、引擎停止/重启和 SQL 冷读仍待 `.build/electron` 与本地确定性 Provider 后执行。
