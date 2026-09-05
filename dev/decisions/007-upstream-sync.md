---
title: "ADR-007 上游同步策略"
type: decision
status: accepted
phase: N/A
updated: 2026-09-05
summary: "第一次合入为专项波次（清单须覆盖全部 371 文件、机器对照为零漏项），之后跟随月度 stable tag；上游快照指针是不可变 tag，不非快进移动 main；上游只留最小 hook（含 build / package.json / resources / CI 装配）；清单路径 dev/progress/upstream-min-patch.md；本稿不授权搬迁 371 文件。2026-09-05 第二轮对抗审查后签收"
---

# ADR-007 上游同步策略

> **编号说明**：本仓 ADR 编号与外仓 UniverseAgentDesktop 互不相关。本文件是 007，因为 001–006 已占用；不采纳、不映射任何 Desktop「上游 / fork」编号。

## Context

本仓是 Code - OSS 的产品 fork，产品集成分支是 **`agent-ide`**，不是 `main`（[worktree-pool](../progress/worktree-pool.md)）。本仓工位 / merge 槽基线是 **`agent-ide`**，不是 `origin/main`。[worktrees.md](../loop/worktrees.md) 仍按通用套件写 `main` / `origin/main`；本 ADR `accepted` 后须在该文补本仓特例，本稿不改那份文件。按 [架构概览](../../docs/architecture/overview.md)，自定义能力应落在 `platform/` 服务域与 `workbench/contrib/`（以及本仓自有 `sessions` 产品面），工作台核心（`layout` / `parts` / 入口 `*.main.ts` / `product`）只做注册与拓扑。

2026-09-04 核对（只读；本仓 **没有** `microsoft/vscode` remote，唯一 remote 是 `origin` → `TIIEHenry/vscode.git`）：

| 项 | 事实 |
|---|---|
| 克隆深度 | **shallow**；`.git/shallow` 只有 `004a1fbb` 一项，该 commit 是 **graft 根、无 parent**。对 `origin` 做 `--unshallow` / `--deepen` **空转**——`origin` 上没有更早历史；上游对象图只能从 `microsoft/vscode` 远端取 |
| tags | **0**（本仓没有 `microsoft/vscode` 月度 tag） |
| 上游基线 | `origin/main` = `main` = `004a1fbb`（2026-08-30，`update label and description. (#219949)`；作者 xiejialong，PR 号指向 microsoft/vscode，故该 SHA **大概率**存在于上游对象图，实施时以 `git cat-file -e` 复证）。**不是**月度 stable tag |
| 默认分支 | `origin/HEAD` → `main`。**`main` 是本仓远端默认分支**，受 [worktrees.md](../loop/worktrees.md)「禁止 force push 默认分支」约束 |
| merge-base(`origin/main`, `HEAD`) | 同为 `004a1fbb`（`main` 未再前进） |
| 产品 HEAD | `agent-ide` @ `b12a5472`（2026-09-03） |
| 侵入面（相对基线，排除自定义树） | **371 文件、+16379 / −3114**（约 106 新增、265 修改；含仓根 `AGENTS.md` / `.idea` 等配置）。其中 `contrib/chat` 114、`resources/` 44、`build/` 6（`filters.ts`、`gulpfile.vscode.linux.ts`、`lib/electron.ts` 等）、`package.json` / `product.json`、`scripts/` 6；`.github/` **零改动** |

自定义树（不算「改上游文件」）：`src/vs/platform/universeAgent/`、`src/vs/workbench/contrib/conversation|navigator|sources`、`dev/`、`docs/`。`workbench/browser/parts/{conversation,sources}` 是本仓新增 Part，但仍挂在上游 `parts/` 树下，合并时会碰到，**算 hook 面**。

VS Code 月度发版。侵入面若再漂两三个迭代，月度 tag 将不可合并。[DOCUMENTATION.md](../../docs/DOCUMENTATION.md)「不污染上游」禁止在 `src/vs/` 新建文档树，但**没有** ADR 回答「怎么跟上游」。壳不变量已由 [ADR-006](006-shell-invariants.md) 钉在 `layout.ts`；引擎宿主已由 [ADR-003](003-engine-adapter-boundary.md) 钉在 `code/electron-main/app.ts`。缺的是节奏、分类与操作规范。

候选：

1. **继续漂**：只在产品分支上长功能，不跟 tag。
2. **fork 永久脱离**：放弃合入 microsoft/vscode。
3. **每周追 `main`**：把 daily tip 合进 `agent-ide`。
4. **跟随月度 stable tag + 收缩 hook 面**（本 ADR；第一次合入降级为专项波次）。

## Decision

选形态 4。

### 1. 跟随节奏：第一次专项波次，之后月度 stable tag，不追 daily `main`

- 同步目标是 `microsoft/vscode` 的月度 **stable 发布 tag**（`1.N.0`，含该次稳定版必要的 patch tag `1.N.x`），**不是** daily `main` tip。
- **第一次合入降级为专项波次**：不按月度日历硬赶。必须先有**覆盖全部侵入面**的清单（见 Decision 3 的完备性闸门），再合；清单对照有漏项不得 merge tag。后续同步才走月度节奏。
- 当前基线 `004a1fbb`（2026-08-30）视为「上一次吸入的上游快照」，**不是**月度 tag，也不是产品分支。
- **第一次同步前的只读准备**（本仓 shallow、graft 根就是 `004a1fbb`，`origin` 上没有可加深的历史）：
  1. 添加只读 remote `microsoft`（fetch URL 指向 `microsoft/vscode`）：只 `fetch`，**不**向该 remote push。
  2. `git fetch microsoft --tags`，再 `git fetch --unshallow microsoft`（补史只能来自这里；对 `origin` 补史空转）。
  3. `git cat-file -e 004a1fbb^{commit}` 且 `git rev-list --parents -1 004a1fbb` 出现 parent → 祖先判断可用；否则 `004a1fbb` 不在上游对象图（fork 曾改写），走下条兜底。
- **如何从 `004a1fbb` 选下一个 `1.N.0`**：祖先判断可用时，在 `microsoft` 的 `1.N.0` tag 中选 `git merge-base --is-ancestor 004a1fbb 1.N.0` 成立的**最旧**一枚（`release/1.N` 从 `main` 分出，`004a1fbb` 早于分叉点即为祖先；这是常态，不是特例）。若尚无任何满足者（快照落在最新月度之后），专项波次等待下一枚，不硬赶日历。**兜底**（祖先判断不可用）：选日期晚于 2026-08-30 的最旧 `1.N.0`，merge 时以 `004a1fbb` 为人工指定的 merge-base（`git merge` 无共同祖先会整树冲突，此时用 `git replace --graft` 在本地临时接根，只用于这一次，不推 replace ref）。
- **上游快照指针是不可变 tag，不是 `main`。** 已吸入的上游版本记录在 `dev/progress/upstream-min-patch.md` 文件头（`上游快照：1.N.0 @ <sha>`）与 merge commit 信息里。本仓 `main` 保持 `004a1fbb` 作为历史基线，**只允许快进**，目标 tag 不是其子孙时**就不动它**——不做非快进对齐，因为 `origin/HEAD` 就是 `main`，非快进推送等于对默认分支 force push，与 [worktrees.md](../loop/worktrees.md) 冲突（第一轮稿允许「一次非快进对齐」，第二轮审查指出该矛盾，已撤回）。若将来要让 `main` 重新有意义，先由用户在 GitHub 把默认分支切到 `agent-ide`（仓设置动作，不在本 ADR 授权范围），再另议。**禁止**对 `microsoft/vscode` 或任何第三方 remote 推送。产品分支 `agent-ide` 只 merge 吸入结果。

### 2. 侵入分类：必须留在上游文件的 hook vs 应迁回自定义树

对「自定义树之外、相对 `004a1fbb` 有 diff 的文件」只分两类。分类标准是**合并冲突面**，不是目录好看。

**A. 必须留在上游文件的 hook**（允许长期存在，但每条都要进最小清单，且只保留「注册 / 拓扑 / 产品标识 / 宿主装配」）：

| 面 | 典型路径 | 为何不能迁走 |
|---|---|---|
| 默认窗拓扑 | `workbench/browser/layout.ts`（`createGridDescriptor`、INV-TOPO / INV-052） | [ADR-006](006-shell-invariants.md) 中心叶与 `Conversation ∨ (Editor ∨ Sources)` 只能改 Layout |
| Part 注册与工厂 | `workbench.ts`、`workbench.contribution.ts`、`workbench/common/{contextkeys,configuration}.ts`、`workbench/services/layout/**`、`parts/editor/{editorPart,editorParts}.ts` | Conversation / Sources 要进 `Parts` 枚举、`createPart`、第四类 `IEditorPart`（[ADR-002](002-conversation-session-windows.md)） |
| 新增 Part 挂点与瘦 chrome | `workbench/browser/parts/conversation/**`、`parts/sources/**` | Layout 拥有 Part；**只留挂点与瘦 chrome**，按 A 记账。目录不能整包搬到 contrib |
| 入口装配 | `workbench.{common,desktop,web}.main.ts`、`code/electron-main/app.ts` | contrib 必须被入口引用才进产物；UA 宿主 = electron-main（ADR-003） |
| 产品标识 | `product.json`、`platform/product/**` | 发行身份，不是功能 contrib |
| 壳按钮 / 显隐 | `parts/titlebar/**`、`parts/panel/**`、`parts/auxiliarybar/**`、`globalCompositeBar.ts` | 四钮与 Panel/Aux 相对 Conversation 的显隐，与 Layout 合同绑死 |
| 构建装配 | `build/filters.ts`、`build/gulpfile.vscode.linux.ts`、`build/lib/electron.ts`、`.moduleignore*`（[packaging-and-release](../plans/packaging-and-release.md) 将改） | 发行包必须带 `@grpc/grpc-js` 与品牌图标；gulp 管线是上游文件，没有贡献点可挂 |
| 依赖与产品声明 | `package.json`（`@grpc/grpc-js` 等依赖）、`product.json` | 依赖声明只能在根 `package.json`；发行身份不是功能 contrib |
| 品牌资源 | `resources/**`（当前 44 文件）、`build/brand/**` | 随产品身份维护，整目录记**一行**（不逐文件）；不算功能侵入，但合并时会碰到，必须在清单里 |
| CI 装配 | `.github/workflows/agent-ide.yml`（[test-baseline-ci](../plans/test-baseline-ci.md) 新建；今日 `.github/` 零改动） | 新文件用 `agent-ide` 前缀避免与上游同名；不改 `pr.yml` |
| 仓根配置 | `AGENTS.md`、`scripts/{code.sh,check-docs-health.py,sync-*}`、`.idea/**` 等 | 开发工具面；记一行，收缩条件为「上游不会新增同名文件」 |

**A 的「只减不无故增」**：增行必须在清单里写明依据（哪份已签收方案、哪条 ADR）。packaging-and-release 对 gulp / `.moduleignore` 的改动是**有据的增**（发行合同），不违反本条；无据的增（顺手改上游文件）在 code review 里退回。

**B. 产品功能面迁回 `contrib/` / `platform/`**（目标：功能实现从上游文件消失，合并时不再冲突。**不是**「Part 整目录只留在 contrib」）：

- 产品功能面（对话逻辑、Navigator、Sources 功能、Engine·Connection Preferences）落在 `contrib/conversation|navigator|sources` 与 `platform/universeAgent`。
- Conversation / Sources 的 Part **不**整包迁走：只留挂点与瘦 chrome，按 **A** 记账；功能实现不得继续摊在 `parts/`。
- 上游 `contrib/chat` 上的大面积改写（当前约 114 文件）：[INV-NO-COPILOT](006-shell-invariants.md) 只允许**薄门闩**（例如 `chatShellRouting` 一类路由 / 隐藏），禁止把产品对话逻辑继续摊进 Chat 树。
- Welcome / Walkthrough / Onboarding / Agent Sessions / Voice 等文案与入口改写：能用贡献点或产品配置关掉的，不改上游正文。
- `contrib/files|scm|notebook|mcp|terminal|search|remote|preferences` 等顺手补丁：能做成本仓 contrib 或设置的，迁走；不能迁的降级为清单上的一条 hook，并写收缩条件。
- 品牌资源（`resources/`、`build/brand/**`）与脚本：不是 B，也不算功能侵入——按 A 表「品牌资源」「仓根配置」各记一行（合并时会碰到，必须在清单里）。
- `src/vs/sessions/**` 上为 [ADR-001](001-chat-compare-form.md) 比对做的改动：尽量收进 `sessions/contrib/providers`；只有 grid / 入口级无法外置的才留 hook。

新增功能默认落 B（产品功能面）。只有「不改这个上游文件就无法挂上 Part / 入口 / 产品标识」才进 A。Part 挂点与瘦 chrome 按 A，不算 B 的「只留 contrib」。

### 3. 最小 patch 清单的存放位置

权威清单：`dev/progress/upstream-min-patch.md`（行动层 progress；**本稿只规定路径与闸门，不创建该文件**——创建它是本 ADR 签收后即可开的 **docs-only 切片 U0**，见 Decision 5）。

清单两张表：**A 表**（hook：路径或目录、改了什么、对应 ADR / 不变量 / 方案、收缩条件）与 **B 表**（待迁回：路径或目录、迁到哪、对应迁回切片；可按目录粗记，例如 `contrib/chat/**` 114 文件一行）。

**完备性闸门（第一次专项波次的硬前置，第二轮审查 C3）：** 清单不是「列已知路径」，而是**覆盖全部侵入面**。合入 tag 前跑：

```bash
git diff --name-only 004a1fbb agent-ide -- . \
  ':!src/vs/platform/universeAgent' ':!src/vs/workbench/contrib/conversation' \
  ':!src/vs/workbench/contrib/navigator' ':!src/vs/workbench/contrib/sources' ':!dev' ':!docs' \
  | sort > /tmp/intrusion.txt
# 清单 A/B 表里的路径（目录行按前缀展开）→ /tmp/listed.txt
comm -23 /tmp/intrusion.txt /tmp/listed.txt   # 必须为空
```

`comm` 输出非空 = 有文件既不是 hook 也没排进迁回，**不得 merge**。这条检查写进清单文件头，每次月度同步后重跑；新出现的上游改动必须归 A 或列入 B。A 的条目只减不无故增（有据的增见 Decision 2）。目标是 A 表文件数随迭代单调下降。

`dev/decisions/INDEX.md` **已有**本 ADR 的 `draft` 行；`draft` 即可占行。接受本 ADR 时只改该行状态，不另补登记。

### 4. 同步操作规范

1. **只在 merge 槽做合入。** 工位 [worktree-pool](../progress/worktree-pool.md) 的 `loop/merge`（`$REPO-WorkTrees/merge`）是唯一允许把上游 tag merge 进产品历史的地方；A–D 工位禁止私自 merge 上游。合入后再快进 `agent-ide`。字母槽与 merge 槽的产品基线是 **`agent-ide`**，不是 `origin/main`。
2. **禁止 force push 任何默认分支，包括本仓 `main`。** `main` 不是产品分支，也不再是快照指针（Decision 1）：只快进，不子孙就不动。产品历史的 rebase 若发生，只限未推送的工位分支。依据见 [worktrees.md](../loop/worktrees.md)，不在 `status.md`。
2a. **第一次专项波次独占 merge 槽，并冻结 A 表文件。** 波次期间不得有在途 PR 改 A 表任一路径（含 `code/electron-main/app.ts`、`layout.ts`、`build/**`、`package.json`）；[m7-gap-closeout](../plans/m7-gap-closeout.md) GC-1b 若要碰 `app.ts` 宿主装配，与本波次串行。波次前后 [test-baseline-ci](../plans/test-baseline-ci.md) 的 `agent-ide` workflow 必须绿（合入结果要能 compile 且账本外零新红）——因此第一次专项波次**排在 test-baseline-ci 切片 4 之后**。[giant-file-split](../plans/giant-file-split.md) GFS-1–3 只改自定义树，与本波次无文件重叠，可并行。
3. **冲突：自定义逻辑优先，hook 面尽量缩小。** 冲突时保留本仓产品语义（ADR-002/003/005/006、UA 权威、INV-*），不得为了「合得过」把中心叶改回 `EDITOR_PART` 或把 Copilot Chat 当产品对话。同时禁止用「整文件以我为准」把本可迁走的 B 类逻辑重新打回上游文件；能改写成更小 hook 或迁回 contrib 的，在解决冲突时就改写，并更新清单。
4. **不污染上游文档。** 继续遵守 DOCUMENTATION「不在 `src/vs/` 新建文档树、不给上游 `.md` 加 frontmatter」。
5. **Vendored 树仍回各自上游。** `platform/universeAgent` 里 session-core / sessionView 的同步规则不变（改 Desktop 再 sync）；与本 ADR 的 VS Code tag 节奏是两条线。
6. **`accepted` 后须改 [worktrees.md](../loop/worktrees.md) 本仓特例**：通用套件仍写 `main` / `origin/main`；本仓工位基线是 `agent-ide`。该修改随 U0 同一提交落地（Decision 5）。

### 5. 本 ADR 不授权本轮去做 371 文件搬迁；只授权 U0 与 U1

本稿只拍板节奏、分类、清单位置与操作规范。把现有侵入面按 A/B 拆完、迁回 contrib、收缩 hook，必须另开 plan（规则 16）再切片。不得把本 ADR 的 `accepted` 解释成「现在就可以改那三百多个上游文件」。

签收后可直接开的两个切片：

| 切片 | 内容 | 前置 |
|:-----|:-----|:-----|
| **U0 清单初稿（docs-only）** | 创建 `dev/progress/upstream-min-patch.md`：文件头写 `上游快照：004a1fbb（非 tag）`、完备性 `comm` 命令；A 表按 Decision 2 六 + 六面填实际路径（由 `git diff --name-only` 过滤得出）；B 表按目录粗记（`contrib/chat/**` 等）；`comm` 输出为空才算完成。同一提交改 [worktrees.md](../loop/worktrees.md) 本仓特例（基线 = `agent-ide`）与 [dev/progress/INDEX.md](../progress/INDEX.md) 登记 | 本 ADR `accepted` |
| **U1 只读准备** | Decision 1 的三步（加 `microsoft` remote、fetch tags、unshallow、复证 `004a1fbb` 祖先关系），把结论（可用 / 兜底、候选 `1.N.0`）写回清单文件头 | U0；需网络 |
| U2 第一次专项合入 | 在 merge 槽 merge 选定 tag；按 Decision 4 冲突规则；合入后重跑 `comm` 与 `agent-ide` workflow | U0 完备、U1 结论、test-baseline-ci 切片 4 绿、A 表文件冻结窗口 |

## Consequences

- 新会话读 `dev/decisions/` 即知道：第一次合入是专项波次（清单覆盖全部侵入面再合），之后跟月度 tag；产品在 `agent-ide`；上游快照指针是 tag，`main` 只快进、永不 force push；合入只走 merge 槽且冻结 A 表文件。
- 功能默认进自定义树，上游文件上的 diff 成为要解释的负债，而不是习惯。Part 挂点与瘦 chrome、构建装配、依赖声明、品牌资源、CI 装配都按 A 记账，不假装「整包只留 contrib」。
- 第一次专项波次之前，清单的 `comm` 对照必须为空；有漏项就 merge tag，等于继续漂。不按月度日历硬赶第一次合入。
- 不推翻 ADR-001–006。壳 hook 仍以 ADR-006 为准；引擎宿主仍以 ADR-003 为准。
- 知识层（架构概览 / 分层规则）在清单 U0 落地后，用链接引用即可，不必复述分类表。
- `status: accepted`：授权 U0 / U1 立即开工，U2 等前置；不授权任何搬迁切片。INDEX 行改 `accepted`。

## Alternatives

- **继续漂（形态 1）：** 两三个月度 tag 之后，`layout.ts` / `*.main.ts` / `contrib/chat` 会不可合并。拒绝。这正是要立本 ADR 的原因。
- **fork 永久脱离（形态 2）：** 丢掉安全补丁、编辑器与 LSP 月度改进，且本仓明确以 Code - OSS 为基座（ADR-006 采纳外仓 ADR-061 的基座结论）。拒绝。
- **每周追 `main`（形态 3）：** daily tip 无发布纪律，冲突频率高于本仓迭代速度；merge 槽会被上游噪音占满。拒绝作为默认节奏。安全紧急修复用 cherry-pick，不改默认节奏。
- **只合 tag、不收缩 hook：** 月度还能合，但 300+ 文件冲突会逐月恶化。拒绝作为完整策略；节奏与收缩必须一起拍板。
- **第一次就按月度日历硬赶：** 本仓 shallow、0 tags、`004a1fbb` 不是月度 tag，且尚无 A 类清单。拒绝；第一次降为专项波次。
- **把 `main` 非快进对齐到 tag 当快照指针（第一轮稿）：** `origin/HEAD` 就是 `main`，这是对默认分支 force push。撤回；快照指针改为不可变 tag + 清单文件头。

## 相关

- 壳 / 宿主：[ADR-006](006-shell-invariants.md) · [ADR-003](003-engine-adapter-boundary.md) · [ADR-002](002-conversation-session-windows.md)
- 架构：[overview](../../docs/architecture/overview.md) · [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md)
- 工位：[worktree-pool](../progress/worktree-pool.md) · [worktrees.md](../loop/worktrees.md)（禁 force push 默认分支；本仓基线特例待 `accepted` 后补）
- 进度：[status.md](../progress/status.md)
- 文档：「不污染上游」见 [DOCUMENTATION.md](../../docs/DOCUMENTATION.md) 原则表与规则 4 / 5

## 审查记录（规则 16）

**2026-09-04 第一轮：** 只读审查 **Approve with changes**（1 Critical + 5 Important）。`status` 保持 `draft`。处理：

| 意见 | 处理 |
|------|------|
| C1 本仓 shallow、0 tags、`004a1fbb` 不是月度 tag | Context 表补克隆深度 / tags / 「不是月度 tag」。Decision 1 补第一次同步前只读 `microsoft/vscode`、`fetch` tags、加深浅克隆；写明从 `004a1fbb` 如何选下一个 `1.N.0`；tag 不是 `origin/main` 子孙时允许一次非快进对齐到 tag，仍禁 force push 别人的 `main` |
| I1 「禁推上游 main」不在 `status.md` | 改指向 [worktrees.md](../loop/worktrees.md) |
| I2 B 类「只留在 contrib」过满 | 改口：产品功能面在 contrib/platform；Part 只留挂点与瘦 chrome，按 A 记账 |
| I3 本仓工位基线是 `agent-ide` 不是 `origin/main` | Context / Decision 4 / Consequences 写明；`accepted` 后须改 worktrees.md 本仓特例 |
| I4 第一次合入节奏 | **选定**：第一次降为专项波次（不按月度日历硬赶），先有 A 类清单初稿再合；后续才月度 |
| I5 INDEX 已有 `draft` 行；清单文件不存在 | 改口：`draft` 即可占行，接受时只改状态。清单路径改为反引号 `dev/progress/upstream-min-patch.md`，不建 markdown 链 |

**2026-09-05 第二轮（对抗性，Cursor CLI · grok-4.6，结论 Approve with changes）→ 复核改入后签收。** 前两次运行（2026-09-04 并行批、2026-09-05 重跑）因远端连接丢失无输出；第三次把 ADR 正文内联进提示后 4 分钟出结果。

| 意见 | 复核 | 处理 |
|------|------|------|
| C1 「加深浅克隆」是幻影：`.git/shallow` 只有 `004a1fbb`，它是 graft 根、无 parent，对 `origin` 补史空转 | 属实（`cat .git/shallow`；`git rev-list --parents -1` 无 parent） | Context 表改口；Decision 1 准备步骤改为从 `microsoft` remote `--unshallow`，加 `cat-file` 复证与 `git replace --graft` 兜底 |
| C2 「一次非快进对齐 `main`」与 worktrees「禁止 force push 默认分支」互斥：`origin/HEAD` 就是 `main` | 属实（`git symbolic-ref refs/remotes/origin/HEAD`） | 撤回非快进对齐；快照指针改为不可变 tag + 清单文件头；`main` 只快进、不子孙就不动；Decision 4.2、Alternatives 新增一条 |
| C3 清单初稿「哪怕只列已知 A 路径」是假绿闸门 | 属实 | Decision 3 改为完备性闸门：`git diff --name-only` 与清单 `comm` 对照为空才可 merge；A/B 两表；Decision 5 U0 以 `comm` 为空为完成条件 |
| I1 `build/` 6、`resources/` 44 不在 A 表；packaging 将增 gulp / `.moduleignore`，与「A 只减不无故增」冲突 | 属实（`git diff --name-only 004a1fbb HEAD -- build/ resources/`） | Decision 2 A 表增六行（构建装配 / 依赖与产品声明 / 品牌资源 / CI 装配 / 仓根配置）；「有据的增」条款 |
| I2 与 test-baseline-ci / GFS / GC-1b 无顺序 | 属实 | Decision 4.2a：第一次波次独占 merge 槽、冻结 A 表文件、排在 test-baseline 切片 4 之后；GC-1b 碰 `app.ts` 则串行；GFS-1–3 可并行 |
| I3 `1.N.0` 在 release 支，祖先算法「过度设计」 | 部分采纳 | release 支从 main 分出，基线早于分叉点即为祖先，算法可执行；保留但把「常态」写明，并加兜底 |
| Minor INDEX 摘要漏「专项波次」；status.md 状态陈旧；`.idea` / `AGENTS.md` 计入 371 | 属实 | INDEX / status.md 本轮更新；Context 表注明含仓根配置；A 表「仓根配置」一行 |

**签收裁定：** 本 ADR 只在两点上有机器真值——`comm` 对照为空、`agent-ide` workflow 绿——其余是纪律。签收即授权 U0（docs-only）与 U1（只读准备）；U2 第一次合入等 test-baseline-ci 切片 4。
