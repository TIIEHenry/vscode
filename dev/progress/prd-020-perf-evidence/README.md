---
title: "PRD-020 回合夹具时延证据"
type: progress
status: active
phase: N/A
updated: 2026-10-01
summary: "无引擎 1,000 回合 Dock 发送时延证据目录模板。本文件不记录跑次数字；results.json 由 bench 写出。"
---

# PRD-020 回合夹具时延证据

本目录只放模板。一次跑次落在子目录 `<UTC-YYYYMMDD-HHMM>-<shortSHA>/`，里面的 `results.json` 与 `README.md` 由夹具写出，不要手抄毫秒数，也不要把未跑出来的 p50 写进仓库。

命令：

```bash
./scripts/prd-020-turn-fixture-bench.sh
```

或：

```bash
PRD020_BENCH=1 scripts/test.sh --grep 'PRD-020 turn fixture bench'
```

没有环境变量 `PRD020_BENCH` 时，该用例 `this.skip()`。通过线、预热与样本数以 [方案 §3](../../plans/prd-020-turn-fixture-bench.md) 为准。不挂 GitHub workflow。
