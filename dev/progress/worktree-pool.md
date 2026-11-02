---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M7
created: 2026-08-30
updated: 2026-11-02
summary: "2026-11-02：D1393全链修复f370已发布；外部两提交保留合入51e790，完整compile绿，Tools163/1记D1395；A/B待最终ff-only，C/D其他候选保留。"
---

# Loop 并行工位池（本仓）

## 2026-11-02 Tools/Wiki 新波

**当前hard hold：** [D1397/P1](deferred-gaps.md) Profile Save/Delete/Reset 缺main发前归属链已获父/Astra确认，正式push批准撤回。保留A/B已集成成果及只读runtime现场，19入口补充合同已获规则16签收，独立docs提交后单作者实施解除，不增本波成员/新占letter，不接管C/E/F。

方案 `5a48ed3cba2` 已逐篇规则16签收；A/B 新分支为 `codex/tools-display-lifecycle-A` / `codex/wiki-git-context-B`，旧分支保留，不覆盖旧 tip。A 主题 `1ec07a675d5`、B 主题 `cb784d97706` 已本地提交并真三路合入 `6b3515f2135`；A 自动三套206/0与编译/lint通过，B 完整18真Git矩阵及原hooks通过，两域综合OV PASS。B 保留 D 的 9d471 原commit身份，D1394本地代码/自动层关闭；D1395真实窗口/引擎门仍open。Node24固定环境组合完整compile已通过；真实Tools交互子集有证据，但实际Save失败来源未定，D1395仍open，publish继续hold。A/B仍属本波，不释放重占。实际两域冲突矩阵、预约锁补充及唯一通道见[新看板](../parallel/active/tools-wiki-wave-2026-11-02.md)。C/D/E/F 外部候选与 WIP 不接管，不重用这些槽。

## 2026-11-02 独立核查

### 产品远端指针的实际 fetch 限制

本仓 `remote.origin.fetch` 当前仅为 `+refs/heads/main:refs/remotes/origin/main`。普通 `git fetch origin` 不刷新 `origin/agent-ide`，因此旧 tracking SHA 不能证明产品远端当前状态。每次产品同步或 push 前显式更新产品 ref，并用 `ls-remote` 独立核对；不修改用户的远程或全局配置：

```bash
git fetch origin refs/heads/agent-ide:refs/remotes/origin/agent-ide
git ls-remote origin refs/heads/agent-ide
```

核实真实远端是本地候选祖先后才正常 push；远端新增则先真三路保留与相应复验，禁止 force。2026-11-02 首次实施推送的真实远端证据是 push 回执与后续 `ls-remote=f3705ba4da04fdb5538c70bdb0ca51e5fa7ac2ba`，不是仍滞后的旧 tracking 值。

当前 merge 已包含 D1393 全链修复 `f3705ba4da0`（已发布），并将主工位外部两提交无冲突真三路合入 `51e790607b0`，39 路径保留门通过、完整 compile exit 0、19 TS hash 保持。外部三套 163/1 中唯一 Tools 呈现债记 D1395，不改原断言、不阻止保全提交；外部提交与记录已随 `b71bdeb88a2` 正常发布；本页关仓文档随后独立提交，A/B 仅 ff-only 跟最终集成 HEAD，保持原槽分支、idle 等待下一分派。主工位仍为 `agent-ide=629d8b33df8` 加原 WIP；ff-only 因 status/roster 修改重叠被拒，81 hash 和状态字节均保留，不强行同步。C cabefc81b36/D 9d4719459aa 为其他在途候选，不测试、不接管、不整树覆盖。

实际槽位与编译记录见[会话归属并行看板](../../archive/dev/parallel/active/session-owner-wave-2026-11-02.md)。固定 `merge` 已建立，分支 `codex/merge`，源码基线为 `agent-ide` 已提交的 `b99dc5cdf52`；完整 compile exit 0 后建立 A/B，分支分别为 `codex/slot-a-delete-owner`、`codex/slot-b-session-owner`。Astra 只读审查批准仅本次启动保留脏人类工位、先建仅验证/修基线的 merge 两项例外，完整 compile 绿仍是字母槽前置。用户本轮明确要求子代理执行、父代理调度；下方旧槽表仅为历史，不代表当前占用。依赖与可写生成包隔离见[构建指南](../../docs/guides/getting-started.md#隔离-worktree-的依赖与单路编译)；全部编译测试由 merge 执行者串行运行。

> **通用规则 SSOT**：[`dev/loop/worktrees.md`](../loop/worktrees.md)。  
> **本文**：本仓路径、分支、槽占用快照。

> **本仓特例（ADR-007 Decision 4.6 / 5）**  
> 通用 [`worktrees.md`](../loop/worktrees.md) 仍写 `main` / `origin/main`；**本仓工位与 merge 槽的产品基线是 `agent-ide`，不是 `origin/main`。** Agent 读该文时须把文中「对齐 `main`」理解为对齐 **`agent-ide`**（或本地 `git rev-parse agent-ide`）。**禁止** force-push 本仓 `main`；**禁止**在 merge 槽以外 merge `microsoft/vscode` tag（见 [ADR-007](../decisions/007-upstream-sync.md) Decision 4）。U0 曾计划在同提交补 `worktrees.md` 本仓段；子模块未含该对象，特例暂记于此。

## Wiki 新波 B 的候选承接

2026-11-02 新波方案 `5a48ed3cba2` 已逐篇规则16签收，A/B 保留旧分支并新建 `codex/tools-display-lifecycle-A` / `codex/wiki-git-context-B`。B 仅真三路承接 D `9d4719459aa` 的 Wiki 三处外仓隔离及原四例，保持其原 commit 身份；本段合并不代表 D1394 残余合同通过，原四例已由唯一检查通道真实运行 4 过/0 败、exit 0；D1394 完整残余和新规范回归仍待，不因四例关闭。旧 C/D 候选与其他外部工作不接管、不将其树覆盖 D1393 或本波。

## 本机子模块布局与 Wiki 提交检查

新工位的 `dev/loop` 是 gitlink，空目录不含其正文。需要恢复时，在目标工位先核对父 gitlink、本机主仓模块的提交与干净状态，并确认目标目录为空、独立 metadata 路径不存在；被占就保留现场，不删目录重建。2026-11-02 的 C 用以下方式建立独立 gitdir，避免共享主工位子模块的 index、HEAD 或 `core.worktree`：

```bash
REPO_ROOT="/home/clarence/Projects/Agents/vscode"
SLOT_GIT_DIR="$(git rev-parse --absolute-git-dir)"
MODULE_PIN="$(git rev-parse HEAD:dev/loop)"
mkdir -p "$SLOT_GIT_DIR/modules/dev"
git clone --no-local --no-checkout --separate-git-dir "$SLOT_GIT_DIR/modules/dev/loop" "$REPO_ROOT/dev/loop" dev/loop
git -C dev/loop checkout --detach "$MODULE_PIN"
```

完成后核对目标模块 HEAD 等于父 gitlink、工作区干净，父 `dev/loop` 没有暂存或未暂存差异，主工位模块 HEAD/工作区未变。C 的实测 pin 为 `44a684b04fc41098f5aa1373812606ed251c0d13`；不修改 `dev/loop` 套件正文、父 gitlink、共享模块配置或提交钩子。

正常提交的 hook 会导出父 `GIT_DIR` 等局部环境。`scripts/wiki/wiki.py` 只在读取子仓捕获 pin 的树和 blob 时，清除 `git rev-parse --local-env-vars` 列出的子进程变量；父仓快照仍保留 `GIT_INDEX_FILE`。未检出模块或 pin 对象缺失继续报告断链，不回落子模块当前 HEAD/工作树。对应本仓集成回归与命令见 [Wiki 工具测试](../../scripts/wiki/README.md#测试)。

## J 本轮占用快照（2026-10-27）

> **J 当前 peer 已采纳（2026-10-27）**：原 Astra 固定 ae902 正式窄 peer C0/I0/M0 PASSED/root 采纳，v1 唯一 I1 源码关闭；`occupied / 固定候选等lease业务门`。accepted/runtime pending，先等 lease 固定671…/src3dc…当前业务门，root后定Sources真实三路接入/最终源码runtime。[来源摘要](sources-pane-cancelled-model-resolution-source-v2-20261027-evidence/source-peer-root-transferred-summary.md)；本次只补docs，源码与历史原件不动，下方保留旧时点。

> **J 当前 v2（2026-10-27）**：原 Astra 固定 5cbc 源码 peer C0/I1/M0/root 采纳；仅 cleanup 提前拒绝 I1，另授最窄 Promises import/settled 修订。单 test 一次 parse/lint0，生产/10 矩阵与 v1 证据不变；`occupied / v2窄peer待`，accepted/runtime pending，唯一 lane 另授。[v2 证据](sources-pane-cancelled-model-resolution-source-v2-20261027-evidence/INDEX.md)。下方 v1 与 docs 阶段段落均为各当时时点。

> **J 当前（2026-10-27）**：root 已独核 D→J 固定 df44 并另授首 await 窄源码；四行 guard 与 10 项真实 resolver 回归源码已写，两 TS 各一次 parse/双文件一次无缓存 lint 通过。固定候选待 root/原 Astra 源码 peer，状态 `occupied / source候选待peer`；accepted/runtime pending，唯一运行 lane 和所有产物/工具准备另授。见[源码证据](sources-pane-cancelled-model-resolution-source-20261027-evidence/INDEX.md)。下段为 docs 阶段历史，不代表当前授权。

J仅负责[Sources Pane取消解析窄方案](../plans/sources-pane-cancelled-model-resolution.md)纯docs accepted。原Astra固定ff224规则16 C0/I0/M0 PASSED经root独核采纳，无必改项；本次仅签文档，源码/工具/运行未授。重新核clean `468d805ef929298de9113f72665a3de0bdf4742a`为`3fc83b388a0977b36ecc8add7863d1f9a2a46eac`祖先后，一次普通ff-only成功；当前独立分支`fix/j-sources-pane-cancelled-model-resolution-20261027`，状态`occupied / accepted待源码授权`。未改源码/测试/工具或运行，未动D/E/merge/main。D未合候选与lease优先队列保持，未来实施基线另由root固定。下方2026-10-26表保留历史，不代表其他工位当前状态。

## 路径与基线

| 项 | 值 |
|:---|:---|
| 主仓 | `/home/clarence/Projects/Agents/vscode` |
| 工位根 `$WT_ROOT` | `/home/clarence/Projects/Agents/vscode-WorkTrees` |
| 集成分支（当前） | **`agent-ide`**（与 `loop/merge` 同一产品历史；不是上游 `main`） |
| 集成尖端（`agent-ide`） | D1313 在 `341c018ff8d`。本账本提交只记合入；写完后 merge 与字母槽、人类工位 `merge --ff-only` 到本提交。 |
| 相对 `origin/agent-ide` | 远程仍是 `9128b870dbe`（2026-09-26）。本提交 ahead 1838、behind 0。未跑 `npm run compile`，未 push。`6ecaeaa3f91` 上 compile-client 退出码 1（505 条 `error TS`，114 个文件）未复跑。 |

## 槽位表（2026-10-26 合入 D1313 后）

| 槽 | 路径 | 分支 | tip | 状态 |
|:---|:-----|:-----|:-----|:-----|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `341c018ff8d`，随后快进到本账 | 干净，不是 `parked`。快进合入，没有二父 merge commit，没有 `npm run compile` |
| A | `vscode-WorkTrees/A` | `loop/A` | 同上 | `occupied`。对照代码重选下一刀并自行实施。不重做 D1305–D1313，优先编辑器。不把 compile-client 的 505 / 147 条 error TS 当成这一刀 |
| B、C、D、E、F、G、I、J | `vscode-WorkTrees/{槽}` | `loop/{槽}` | 同上 | `idle`。工作区干净 |
| H | `vscode-WorkTrees/H` | `loop/H` | 同上 | `blocked`。未跟踪 `attachments/`。勿 add，勿 `checkout -B` |
| 人类工位 | `Projects/Agents/vscode` | `agent-ide` | 本账本提交 | 只记合入。禁止 reset / stash / restore / clean / `checkout -B` |

P0 旧账：字母槽与 merge 曾停在 `59120887458`，人类工位曾在 `10e04195bf0` 上带着审查改动。那些改动已在 `279f2c18f08`。本轮核对时 stash 未再查；不把文档里的进度当成已完成。

并行归属见 [status.md](status.md)。M7 看板已归档：[m7-ui-completion](../parallel/archive/m7-ui-completion.md)。本波无独立 parallel board。`dev/parallel/active/` 里 2026-09 至 2026-10-05 的看板不是本波，本次未归档。

IDE 调试用引擎 **不是** 本表槽位：仓外 `vscode-debug-engine/`（UA 分离头指针），见 [钉死引擎调试](../../docs/guides/debug-engine.md)。

## 扩容（E–J）

```bash
REPO_ROOT="/home/clarence/Projects/Agents/vscode"
WT_ROOT="/home/clarence/Projects/Agents/vscode-WorkTrees"
BASE="agent-ide"
SLOT=E
git -C "$REPO_ROOT" worktree add "$WT_ROOT/$SLOT" -b "loop/$SLOT" "$BASE"
```

## 相关

- [health-gates.md](health-gates.md) · [status.md](status.md) · [deferred-gaps.md](deferred-gaps.md)
