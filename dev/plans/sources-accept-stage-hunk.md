---
title: "Sources Accept：暂存光标所在 hunk"
type: plan
status: accepted
phase: M7
updated: 2026-09-28
summary: "2026-09-25 产品与架构裁定。Accept 是把光标所在 hunk 暂存进索引。S0 的唯一实施位置是 sources-architecture P1。S1 仍属本稿。未实施。"
---

# Sources Accept：暂存光标所在 hunk

> **slice_id**：`accept-stage-hunk`
> **冲突域**：`contrib/sources` 的 Accept 载荷与 Diff 光标
> **取代** [sources-accept-empty-success](sources-accept-empty-success.md) 的 A2 行。A1 拒空仍有效。
> **不改引擎仓。** 不新增 proto 或 RPC。
> **2026-09-25：** 用户指令将产品与架构裁定入账。规则 16 审查随本稿。

## 产品

用户在对话窗口或底部 Panel 的 Diff 里，把光标放在某个改动块上点 Accept，这一块进入暂存区。整文件接受仍用 Stage，再用 Commit 收尾。未连接引擎时不显示 Accept。Conflict、未跟踪、已整文件暂存的行不显示 Accept。判断用打开 ref 上的 `kind` 与 `indexState`，不能只看 `groupId`，冲突行也会标成 workingTree。

Agent 的改动已经在工作区。再往工作区 apply 一次没有产品意义。空 `patches` 的成功空操作仍不是接受成功（[ADR-008](../decisions/008-write-git-apply-hunks-empty.md)）。

## 架构

`git_service.proto` 写明 argv 与 patch 由客户端预组，引擎只在 `workDir` 上执行。引擎桌面客户端 `RemoteGitChangesProvider.stageHunks` 就是解析 diff、用 `GitHunkPatchBuilder` 切出单个 hunk，argv 为 `git apply --cached --whitespace=nowarn`。本仓镜像这套客户端逻辑，协议字段不变。

patch 字节只来自点击 Accept 时现拉的 `ReadGitFileDiff`。请求用该行的 `path`，`index_state` 固定 `Unstaged`；其它状态或空 path 则 0 次 Apply。文件头是第一个 `@@` 之前的全部行（含 rename / mode），不是只留四行。二进制 diff 不切 hunk，0 次 Apply。光标不在任一 hunk 的新侧行号范围内也是 0 次 Apply。monaco 两侧只回答光标行，不用其正文或 `parseSourcesGitUnifiedDiff` 重新生成 patch。打开时缓存的整段 diff 不得当 patches。

组装放在 `workbench/contrib/sources/common` 的纯函数。传输层原样上线。`sessions` 不参与。

## 与停线的关系

推翻 [sources-accept-empty-success](sources-accept-empty-success.md) 的 P5「不开 A2」。协议没有单独的 hunk 列表，是因为 patch 本来就由客户端预组，不是阻塞。

仍拒绝：把整段 `unified_diff`（含打开时缓存）当 `patches`；只送 path、空 patches；新 proto；用 monaco / parse 两侧重新 diff。Stage 的 `{ argv: [path] }` 不映射到 Apply。失败不退回 `git.stage`。

## HEAD 要先拆的传递

当前 `sourcesGitApplyHunksPatches` 把打开时带上的 `unifiedDiff` 当成 patches，两个 pane 的 `runAccept` 仍传空 `argv`。按钮能显示，点下去引擎因 argv 为空失败。S0 拆掉这条传递（`ISourcesChangeRef.unifiedDiff` 上的 apply 载荷、`attachSourcesGitApplyHunksPatch` 及相关 WeakMap）。展示用的打开时 diff 解析保留。拆完后 Accept 隐藏，直到 S1。

**2026-09-28：** S0 的唯一实施位置是 [sources-architecture](sources-architecture.md) P1，与 `sources-git-diff:` 内容提供者同一切片。S1 仍在本稿，排在 P1 之后。P1 合入后、S1 合入前，Diff 能打开也不得显示 Accept。HEAD 上引擎 Diff 行会在 `createModelReference` 失败，宿主因此收起写按钮；上文「按钮能显示」只描述载荷门本身，不描述这条打不开的路径。

## 切片

| Slice | 做什么 | 退出 |
|:------|:-------|:-----|
| **S0** | 拆掉带着走的 apply patch。`hasSourcesGitApplyHunksPayload` 门保留 | 两 pane 空 patches，Accept 隐藏。0 次 `WriteGitApplyHunks` |
| **S1** | `sourcesGitHunkPatch.ts` 切文件头与单个 hunk，固定 argv。`runAccept` 现拉 diff，按光标定位，三侧（session / argv / patch）都非空才发 RPC。成功后刷新 Changes | 见下表测试。S1 未落不得显示 Accept |

## 测试要锁

1. 第一个 `@@` 之前的行全部保留；多 hunk 只切光标所在块；`\ No newline`、rename 头有覆盖。二进制 diff 不发 RPC。
2. argv 恒为 `['git','apply','--cached','--whitespace=nowarn']`；patches 恒为一条。任一侧空则 0 次 hook。
3. Conflict / Untracked / 已暂存行不显示 Accept。
4. 源码扫描：`runAccept` 在点击时调用 `readGitFileDiff`；无带着走的 apply patch；patch 构造不 import `parseSourcesGitUnifiedDiff`，不读 monaco 正文；`runAccept` 内无 `git.stage`。
5. 引擎 `success=false` 时显示 `error_message`，不算接受成功。

## 禁止

- 新 proto、新 RPC、改引擎仓。
- 整段 `unifiedDiff` 当 `patches[0]`。
- argv 为空，或 argv 不是上面那条 apply 命令。
- 本方案做 hunk 级 Revert（`git apply -R` 不在 Desktop 的暂存 argv 矩阵里）。
- 未连接引擎时显示 Accept。
- S0 之后、S1 之前把 Accept 显示出来。

F4 隔离 profile 冒烟仍记 [D31](../progress/deferred-gaps.md)，本方案不代跑，不升 PRD-009 为 `implemented`。
