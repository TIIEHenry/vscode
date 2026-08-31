---
title: "产品需求层建设方案"
type: plan
status: implemented
phase: N/A
updated: 2026-08-31
summary: "已批准：建立本仓产品需求 SSOT；文末为 Grok 4.6 Fast 可执行实施计划"
---

# 产品需求层建设方案

## 背景

本仓后续将与 UniverseAgentDesktop 分开独立演进。当前产品目标、范围和完成线主要散落在外仓引用、B2 对照分析与 M0–M4 实施方案中；`docs/` 已有架构和系统设计层，`dev/` 已有计划与进度层，但没有稳定承载“为谁解决什么问题、交付什么结果、怎样算成功”的产品需求层。

本方案建立本仓产品需求 SSOT。UniverseAgentDesktop 从持续权威降为迁移来源与历史出处；迁入本仓并标为 `accepted` 的产品陈述，以本仓为准。

## 目标

1. 在 `docs/product/` 建立独立、可导航的产品需求层。
2. 将已有证据充分的 Agent IDE 产品壳需求从历史方案中提炼为稳定需求，不复制实施细节。
3. 建立“产品需求 → 系统规格 → 实施方案 → 验证证据”的追踪关系。
4. 明确产品需求、技术设计、实施计划和进度证据之间的边界。

## 非目标

- 不在本次系统迁移 UniverseAgentDesktop 的全部产品文档。
- 不替未决的引擎、Diff owner、产品身份或扩展分发问题做产品决策。
- 不重写 M0–M4 历史方案，也不把实现文件表搬入产品需求。
- 不创建没有实际任务内容的 roadmap 骨架。
- 不修改产品代码。

## 结构

```text
docs/product/
├── INDEX.md
├── vision.md
├── requirements.md
└── traceability.md
```

### `INDEX.md`

产品层导航入口，说明权威范围、推荐阅读顺序、文档职责和生命周期。

### `vision.md`

稳定回答：

- 目标用户是谁；
- 用户当前遇到什么问题；
- Agent IDE 提供什么核心价值；
- 哪些体验原则不能被局部实现破坏；
- 当前产品范围和明确非目标是什么。

### `requirements.md`

用稳定 ID `PRD-NNN` 管理产品需求。每条需求至少包含：

- 状态：`proposed`、`accepted`、`implemented` 或 `blocked`；
- 用户价值；
- 用户可观察的需求陈述；
- 产品验收标准；
- 依赖或未决决策（如有）。

首批需求只覆盖本仓已有事实支撑的默认 Agent IDE 壳：以 Conversation 为中心、会话上下文、时间线与输入、权限座位、Preview/Sources、默认无 Copilot/Chat 冒充、诚实降级，以及尚未完成的引擎、Changes/Diff、产品身份边界。

### `traceability.md`

维护轻量追踪矩阵：

```text
PRD-ID → 产品状态 → 系统/架构规格 → 实施方案 → 测试或验证证据
```

追踪表只链接事实来源，不复制需求、设计或计划正文。没有验证证据的需求必须明确标为待验证，不以 `implemented` 代替验证结论。

## 文档边界

| 区域 | 回答的问题 | 禁止承载 |
|------|------------|----------|
| `docs/product/` | 为什么做、给谁用、交付什么结果、怎样算成功 | 文件切片、类名、排期 |
| `docs/architecture/`、`docs/systems/` | 系统如何组成、如何协作、契约与不变量是什么 | 产品优先级、阶段排期 |
| `dev/plans/` | 怎样实施、如何切片、改动边界是什么 | 产品需求唯一正文 |
| `dev/progress/` | 当前做到哪里、阻塞与验证证据是什么 | 新产品需求或架构决策 |

历史方案中的产品完成线保留为当时记录；新增产品需求成为后续变更的 SSOT，历史方案只增加回链。

## 权威与迁移规则

1. 本仓 `docs/product/` 是 Agent IDE 产品需求 SSOT。
2. UniverseAgentDesktop 相关文档可作为 `source` 或历史链接，但不再是本仓持续演进的前置依赖。
3. 只有已迁入并通过本仓评审的陈述才成为本仓需求；不得通过链接整篇隐式继承外仓规范。
4. 外仓与本仓发生冲突时，已接受的本仓需求优先；冲突应在追踪表中留出处，而不是静默覆盖。
5. 产品行为变化先更新对应 `PRD-NNN`，再更新系统规格和实施方案。

## 需要同步的入口

- `AGENTS.md`：新增产品需求入口。
- `docs/README.md`：将产品需求加入角色阅读路径和目录结构。
- `docs/INDEX.md`：新增产品需求快速入口与分类入口。
- `docs/DOCS-SPEC.md`：由四层扩展为五类职责，并加入产品需求模板。
- `docs/DOCUMENTATION.md`：规定需求变更顺序、需求 ID 和权威边界。
- `dev/plans/m2-product-shell.md`：仅增加产品需求层回链，保留历史正文。

## 验收

1. 新会话可从 `AGENTS.md` 或 `docs/INDEX.md` 一跳进入产品需求。
2. 产品愿景、当前壳需求和追踪关系分别有唯一正文。
3. 首批需求均有稳定 ID、明确状态和用户可观察的验收标准。
4. 已实现、待验证、未决和明确排除的内容没有混写。
5. M2 历史方案回链产品需求，但不被重写为当前需求 SSOT。
6. `python3 scripts/check-docs-health.py` 返回 0 error。

---

# 实施计划

> **For agentic workers:** 后续正文由 **Grok 4.6 Fast** 按本计划逐任务编写。每步用 checkbox 跟踪。REQUIRED：先读本文件「背景」到「验收」，再执行；不要重写本文件已批准的设计正文，只把下方 checkbox 勾成 `[x]` 并在全部任务完成后把本文件 `status` 改为 `implemented`。

**Goal:** 在本仓落下 `docs/product/` 产品需求 SSOT，并把入口、规范、M2 回链和进度对齐，使新会话能一跳进入产品需求。

**Architecture:** 先写四份产品正文（导航 / 愿景 / 需求 / 追踪），再改入口、五类职责规范（含文体指南）与 M2 回链。外仓 UniverseAgentDesktop 只作迁移来源：读其 `docs/product/` 提炼本仓已有事实支撑的陈述，禁止整篇搬入，禁止把外仓路径写成持续前置依赖。

**Tech Stack:** Markdown + YAML frontmatter；健康检查 `python3 scripts/check-docs-health.py`。不改 `src/**`，不跑 compile。

## Global Constraints

- 新建 `docs/` / `dev/` 文件必须有完整 frontmatter：`title`、`type`、`status`、`phase`、`updated`、`summary`；每次编辑更新 `updated` 为实施当日（`YYYY-MM-DD`）。
- `AGENTS.md` 豁免 frontmatter，只改导航表，不补 YAML。
- 每个概念只在一份文件定义：愿景只在 `vision.md`，需求正文只在 `requirements.md`，追踪只在 `traceability.md`，入口只导航。
- 禁止把类名、文件切片、排期、M0–M4 实现表写进 `docs/product/`。
- 禁止重写 `dev/plans/m0-topology-surgery.md`、`m1-shell-followon.md`、`m2-product-shell.md`、`m3-shell-closeout.md`、`m4-validation-wave.md` 的历史正文；M2 只在文首增加回链。
- 外仓 `../UniverseAgentDesktop/docs/product/` 只作 `source` / 历史出处；不得 `](../../../../UniverseAgentDesktop/...)` 整篇继承，不得把外仓写成新会话必读。
- 已实现、待验证、未决、明确排除必须分节或分状态，不得写在同一条需求里混称「已完成」。
- 没有启动冒烟证据的需求不得标 `implemented`；代码已落但 D4 未跑的标 `accepted`，追踪表写「待验证」。
- 不创建 `docs/product/README.md`，不新建 roadmap 骨架，不改产品代码。
- 产品层 frontmatter 类型固定：`INDEX.md` 用 `index`；`vision.md` 用 `concept`；`requirements.md` 用 `demand`；`traceability.md` 用 `reference`。不要用 `spec`。
- `vision.md` 与 `requirements.md` 只写用户可见概念，禁止内部类/模块/文件标识：`workbench.desktop.main`、`ChatEditorInput`、`IChatModel`、`vs/sessions`、`product.json`、`EDITOR_PART`。
- `docs/guides/doc-style-guide.md` 必须与 DOCS-SPEC / DOCUMENTATION 一起改为五类职责，不得用「不在本波改」跳过。
- 不要改 File Map 以外的文件。
- `dev/progress/status.md` 总行数必须 ≤ 200。

## File Map

| 路径 | 动作 | 职责 |
|------|------|------|
| `docs/product/INDEX.md` | Create | 产品层导航；`type: index` |
| `docs/product/vision.md` | Create | 用户、问题、价值、原则、范围；`type: concept` |
| `docs/product/requirements.md` | Create | `PRD-001`–`PRD-010` 唯一正文；`type: demand` |
| `docs/product/traceability.md` | Create | PRD → 规格 → 方案 → 证据；`type: reference` |
| `AGENTS.md` | Modify | 文档导航表增加产品需求一跳入口 |
| `docs/README.md` | Modify | 角色路径与目录树加入 `product/` |
| `docs/INDEX.md` | Modify | 快速入口与分类入口加入产品需求 |
| `docs/DOCS-SPEC.md` | Modify | 四层扩为五类职责，加入产品模板与 type 约定 |
| `docs/guides/doc-style-guide.md` | Modify | 「四层定位」改为五类职责，更新 `updated` |
| `docs/DOCUMENTATION.md` | Modify | 需求变更顺序、ID、权威边界、产品 type |
| `dev/plans/m2-product-shell.md` | Modify | 仅文首回链，不改正文完成线 |
| `dev/progress/status.md` | Modify | Current Session 记本波文档落地，不写新产品需求 |
| `dev/plans/product-requirements-layer.md` | Modify | 勾选本计划；全部完成后 `status: implemented` |
| `dev/plans/INDEX.md` | Modify | 计划修订时已改为 `accepted`；实施完成后改为 `implemented` |

---

### Task 1: 创建产品层导航 `docs/product/INDEX.md`

**Files:**
- Create: `docs/product/INDEX.md`

**Interfaces:**
- Consumes: 本方案「结构」「文档边界」「权威与迁移规则」
- Produces: 产品层入口；后续入口文件都链到本文件，不链散页当总入口

- [x] **Step 1: 写入完整文件**

```markdown
---
title: "产品需求层入口"
type: index
status: accepted
phase: N/A
updated: YYYY-MM-DD
summary: "本仓 Agent IDE 产品需求导航：愿景、需求、追踪；外仓只作历史出处"
---

# 产品需求

本目录是本仓 **Agent IDE 产品需求 SSOT**。回答：为谁解决什么问题、交付什么结果、怎样算成功。

系统如何组成见 [架构概览](../architecture/overview.md) 与 [systems](../systems/workbench/INDEX.md)。怎样实施见 [dev/plans](../../dev/plans/INDEX.md)。当前做到哪里见 [status](../../dev/progress/status.md)。

## 权威范围

1. 已迁入本目录并标为 `accepted` / `implemented` / `blocked` 的陈述，以本仓为准。
2. UniverseAgentDesktop 的 `docs/product/` 只是迁移来源与历史出处，不是本仓持续演进的前置依赖。
3. 不得通过链接整篇隐式继承外仓规范。外仓与本仓冲突时，已接受的本仓需求优先；冲突在 [traceability.md](traceability.md) 留出处。
4. [B2 壳分析](../reference/code-oss-b2/INDEX.md) 只写本仓实现真相，不再充当产品需求权威。

## 推荐阅读顺序

1. [vision.md](vision.md) — 用户、问题、价值、原则、范围
2. [requirements.md](requirements.md) — `PRD-NNN` 需求正文
3. [traceability.md](traceability.md) — 需求到规格、方案、证据

## 文档职责

| 文件 | 回答 | 禁止承载 |
|------|------|----------|
| [vision.md](vision.md) | 为什么做、给谁用、原则与边界 | 需求 ID、验收步骤、排期 |
| [requirements.md](requirements.md) | 交付什么、怎样算成功 | 类名、文件切片、验证命令 |
| [traceability.md](traceability.md) | 需求连到哪份规格/方案/证据 | 复制需求或设计正文 |

## 生命周期

- 新产品行为：先改对应 `PRD-NNN`，再改系统规格，再改实施方案。
- 历史 M0–M4 方案保留当时完成线；现行需求以本目录为准，历史方案只回链。
- 过时产品文档移入 `dev/archive/`，不删除。

## 相关入口

- 全局索引：[docs/INDEX.md](../INDEX.md)
- 维护规则：[DOCUMENTATION.md](../DOCUMENTATION.md)
- 结构模板：[DOCS-SPEC.md](../DOCS-SPEC.md)
```

把 `updated` 写成实施当日。不要增加第五个产品文件。

- [x] **Step 2: 验证文件存在且 frontmatter 完整**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
p = Path("docs/product/INDEX.md")
text = p.read_text(encoding="utf-8")
assert text.startswith("---\n")
for field in ("title:", "type: index", "status: accepted", "phase:", "updated:", "summary:"):
    assert field in text.split("---", 2)[1], field
assert "[vision.md](vision.md)" in text
assert "[requirements.md](requirements.md)" in text
assert "[traceability.md](traceability.md)" in text
assert "SSOT" in text
assert "UniverseAgentDesktop" in text
print("INDEX.md OK")
PY
```

Expected: 打印 `INDEX.md OK`，无 AssertionError。

---

### Task 2: 创建愿景 `docs/product/vision.md`

**Files:**
- Create: `docs/product/vision.md`

**Interfaces:**
- Consumes: 外仓 `../UniverseAgentDesktop/docs/product/experience-principles.md` §2 与 `INDEX.md`「用户与场景」作迁移来源；本仓 M0–M3 已落地壳事实
- Produces: 用户、问题、价值、原则、范围的唯一正文；`requirements.md` 只引用，不重写原则

- [x] **Step 1: 读取迁移来源，禁止整篇粘贴**

Run:

```bash
test -f ../UniverseAgentDesktop/docs/product/experience-principles.md && echo "source readable" || echo "source missing — use in-repo facts only"
```

Expected: 打印 `source readable` 或 `source missing — use in-repo facts only`。缺外仓时仍按下方正文写，不阻塞。

- [x] **Step 2: 写入完整文件**

```markdown
---
title: "Agent IDE 产品愿景"
type: concept
status: accepted
phase: N/A
updated: YYYY-MM-DD
summary: "本仓 Agent IDE：主流程在 Conversation，配套按完整 IDE 配齐；当前范围是无引擎默认窗产品壳"
---

# Agent IDE 产品愿景

> 产品陈述的唯一正文。需求 ID 见 [requirements.md](requirements.md)。历史迁移来源（非持续权威）：UniverseAgentDesktop `docs/product/experience-principles.md` §2。

## 目标用户

| 角色 | 要完成的事 |
|------|------------|
| 本地开发者 | 打开本机项目，在对话里推进改码，需要时查看 Preview / Sources，而不是先找聊天插件 |
| 后续团队成员 | 将来连接远程引擎与权限代理；**当前产品壳不交付此能力** |
| 后续多 Agent 操作者 | 将来查看 Agents / Team 并干预权限；**当前产品壳不交付此能力** |

首批只把「本地开发者使用默认桌面窗口」写成现行范围。后两行是愿景方向，不是已接受的现行需求。

## 用户当前遇到的问题

1. 传统 IDE 把 Agent 做成侧栏或编辑器标签里的聊天插件，主工作区仍是代码编辑器。
2. 打开默认桌面窗口时，Copilot Chat 或右侧栏容易冒充产品 Conversation。
3. 没有引擎时，界面容易用假队列、假接通或空壳文案假装能力已齐。
4. 产品目标散落在外仓与 M0–M4 方案里，后续独立演进时没有本仓可引用的稳定陈述。

## 核心价值

本产品是 **Agent IDE**：IDE 多功能区保留；**主工作流程在 Conversation**。原 IDE 在编辑器里完成的主工作，现在在对话里完成。Preview、Sources、导航、终端等是配套设施，按完整 IDE 配齐，但不是主工作区。

默认入口是 **默认桌面窗口**，不是 Agents Window。Agents Window 只作对照参考，不是用户打开产品时的主窗口。

## 体验原则

这些原则不能被局部实现破坏：

1. **主流程在对话，配套可完整。** 拒绝「编辑器为中心、Agent 当聊天插件」。允许临时隐藏 Conversation；允许窗口右侧配套区域是完整编辑器。
2. **默认窗中心是 Conversation。** 中心不是 Chat 编辑器标签，不是右侧栏里的 Chat，也不是 Agents Window。
3. **诚实降级。** 无引擎、无队列权威、无可用能力时省略或明示空，禁止伪造列表或「已连接」。
4. **熟悉但不侵权。** 可参考常见 IDE 的信息密度与键鼠习惯；禁止复制 Cursor / Codex 商标、图标与像素级外观。
5. **产品行为先改需求。** 用户可见行为变化先更新对应产品需求，再改系统规格与实施方案。

## 当前产品范围

现行交付（无引擎产品壳，代码已落、启动冒烟待验证）：

- 默认窗中心 Conversation：会话标题条、时间线、权限座位、可写输入区、诚实收件箱行
- 四钮：导航 / Conversation / Preview / Sources
- 窗口右侧配套：Preview + Sources 文件列表只读投影
- 右侧栏默认关；Chat 不作为产品 Conversation
- 默认路径不再把对话做成 Copilot Chat 编辑器标签
- 导航区可有本地会话列表（配套，不是中心工作区）

## 明确非目标

- 不在本层系统迁移 UniverseAgentDesktop 的全部产品文档（信息架构全文、交互规格全文、外仓功能对照全表）
- 不把引擎、远程连接或会话权威写成已交付
- 不裁定 Changes / Diff 深查看归属（仍是未选分叉）
- 不改产品名称与图标，不接扩展市场分发
- 不把 Agents Window 升为生产入口
- 不重写 M0–M4 历史方案，不把实现文件表搬进本目录
```

- [x] **Step 3: 验证愿景边界**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("docs/product/vision.md").read_text(encoding="utf-8")
fm = text.split("---", 2)[1]
assert "type: concept" in fm
assert "status: accepted" in fm
for needle in ("目标用户", "核心价值", "体验原则", "当前产品范围", "明确非目标"):
    assert needle in text, needle
assert "PRD-00" not in text
for banned in ("workbench.desktop.main", "ChatEditorInput", "IChatModel", "vs/sessions", "product.json", "EDITOR_PART", "conversationLens.ts", "layout.ts"):
    assert banned not in text, banned
print("vision.md OK")
PY
```

Expected: 打印 `vision.md OK`。失败则删掉需求 ID / 内部标识后重跑。

---

### Task 3: 创建需求正文 `docs/product/requirements.md`

**Files:**
- Create: `docs/product/requirements.md`

**Interfaces:**
- Consumes: `vision.md` 的范围与非目标；本仓 M0–M3 已落地事实与 M2 未完成线
- Produces: `PRD-001`–`PRD-010`；`traceability.md` 必须使用这些 ID，不得改名

- [x] **Step 1: 写入完整文件**

每条需求必须含：状态、用户价值、用户可观察陈述、产品验收标准；有依赖或未决时单独写。状态只能是 `proposed`、`accepted`、`implemented`、`blocked`。

```markdown
---
title: "Agent IDE 产品需求"
type: demand
status: accepted
phase: N/A
updated: YYYY-MM-DD
summary: "首批 PRD-001–PRD-010：默认窗产品壳已接受；引擎、Diff、产品身份未决或阻塞"
---

# Agent IDE 产品需求

> 需求唯一正文。原则见 [vision.md](vision.md)。追踪见 [traceability.md](traceability.md)。

状态约定：`accepted` = 产品陈述已接受，代码可能已落但启动冒烟未完成，不得当成验证结论。`implemented` = 用户可观察行为已交付且有验证证据。`blocked` = 已知缺口，等待未决决策。`proposed` = 尚未接受。

## 已接受的现行壳需求

### PRD-001 以 Conversation 为中心

- **状态**：`accepted`
- **用户价值**：打开产品就能在对话里工作，不必先找到聊天插件。
- **用户可观察陈述**：用户打开默认编辑器窗口时，中心工作区是 Conversation，不是右侧 Chat，也不是一张 Chat 编辑器标签。
- **产品验收标准**：
  1. 默认窗口中心可见 SessionBar、时间线、输入区。
  2. 用户不能把中心 Conversation 理解成 Copilot Chat 标签页。
  3. 用户可以临时隐藏 Conversation；隐藏后仍能用四钮回到对话，而不是被送到 Chat 侧栏。
- **依赖或未决**：无。启动冒烟待验证，故保持 `accepted`。

### PRD-002 会话上下文

- **状态**：`accepted`
- **用户价值**：用户知道自己在哪个会话里，并能在多个会话之间切换。
- **用户可观察陈述**：SessionBar 显示当前会话标题；用户可以在至少两个本地会话之间切换；无 History / Route / Snapshots 能力时这些控件不出现。
- **产品验收标准**：
  1. 切换会话后，时间线换成该会话的内容。
  2. 没有云端或引擎会话权威时，不出现「已同步远程会话」之类文案。
  3. Sidebar 里可以有配套会话列表，但它不是中心工作区。
- **依赖或未决**：真实会话权威依赖引擎（PRD-008），本条只约束无引擎时的本地上下文。

### PRD-003 时间线与输入

- **状态**：`accepted`
- **用户价值**：用户能阅读对话过程，并继续输入下一句。
- **用户可观察陈述**：时间线是当前会话的对话列表，角色可辨、可以滚动；输入区可以打字并发送，发送后用户这句话出现在当前会话时间线。
- **产品验收标准**：
  1. 时间线不是两行写死的说明文案。
  2. 发送后新回合留在当前会话，而不是跳到 Chat 插件。
  3. 若出现助手回复，必须能看出这是本地 stub，而不能看起来像已经接上引擎。
- **依赖或未决**：真实助手回合依赖 PRD-008。

### PRD-004 权限座位

- **状态**：`accepted`
- **用户价值**：用户能在对话里批准或跳过一次工具/写入请求，并留下记录。
- **用户可观察陈述**：权限请求出现在时间线里；用户点 Allow 或 Skip 后按钮消失，该条记录仍在列表中。
- **产品验收标准**：
  1. 待处理请求可见 Allow / Skip。
  2. 处理后不再留可点按钮。
  3. 无引擎时只改变本地状态，不声称已向远端授权。
- **依赖或未决**：真实引擎权限请求依赖 PRD-008。

### PRD-005 Preview 与 Sources Files

- **状态**：`accepted`
- **用户价值**：用户需要看文件时，能在配套区域打开预览和文件列表，而不把编辑器当成主流程。
- **用户可观察陈述**：窗口右侧配套区域上方是 Preview，下方是 Sources 的文件列表；点击列表中的文件会在 Preview 打开。
- **产品验收标准**：
  1. Files 列表是只读投影，不是再造一棵与资源管理器对等的主工作区。
  2. 资源管理器仍是 Sidebar 文件树的权威。
  3. 本条不包含 Changes / Diff 完成（见 PRD-009）。
- **依赖或未决**：无。

### PRD-006 默认无 Copilot / Chat 冒充

- **状态**：`accepted`
- **用户价值**：用户不会把 Copilot Chat 或右侧栏当成产品 Conversation。
- **用户可观察陈述**：新工作区默认不打开右侧栏；Chat 视图即使能被命令打开，也只是对照，不是产品对话。
- **产品验收标准**：
  1. 第一次打开默认桌面窗口时，右侧栏默认关闭。
  2. 打开 Chat 不会把中心 Conversation 换成 Chat 视图。
  3. 默认命令/启动路径不把用户带进 Chat 编辑器标签作为主对话。
- **依赖或未决**：无。命令/还原路径的卫生已有代码，启动路径待验证。

### PRD-007 诚实降级

- **状态**：`accepted`
- **用户价值**：能力缺失时用户看到空或省略，而不是假数据。
- **用户可观察陈述**：没有队列/任务权威时，Inbox 不显示假任务列表；没有引擎时，界面不显示已连接引擎。
- **产品验收标准**：
  1. Queue / Tasks 要么整槽省略，要么诚实空（例如 “No queue”）。
  2. 无 capability 的 History / Route / Snapshots 不画假按钮。
  3. 文档与 UI 都不把未完成的引擎或 Diff 写成已齐。
- **依赖或未决**：无。

## 待验证说明

PRD-001 至 PRD-007 的代码已在 M0–M3 合入，但 D4 启动冒烟（T1–T3 与 M3 目视）仍阻塞于 compile。因此这些需求保持 `accepted`，不升 `implemented`。验证证据只写在 [traceability.md](traceability.md)。

## 未决或阻塞

### PRD-008 引擎与会话权威

- **状态**：`blocked`
- **用户价值**：用户的对话、工具执行和权限应来自真实 Agent 引擎，而不是本地 stub。
- **用户可观察陈述**：用户发送后由引擎产生助手回合与工具请求；会话列表来自引擎诚实枚举。
- **产品验收标准**：未决。在引擎接线方案接受之前，本条不算成功，也不许 stub UI 冒充已接通。
- **依赖或未决**：引擎未接入本产品；禁止用内置 Chat 会话模型顶替引擎权威。

### PRD-009 Changes 与 Diff

- **状态**：`blocked`
- **用户价值**：用户需要在配套区域审阅 Agent 改过的文件。
- **用户可观察陈述**：Sources 有 Changes；文件级 Diff 有明确打开位置。
- **产品验收标准**：未决。在 Diff owner 选定之前，本条不算成功。
- **依赖或未决**：本仓 Diff 深查看仍落在编辑器区域，对照合同要底部面板；这是未选分叉，不是「已实现但待验证」。

### PRD-010 产品身份

- **状态**：`proposed`
- **用户价值**：窗口名称、图标与发行身份应是本产品，而不是上游 Code - OSS 默认身份。
- **用户可观察陈述**：用户能从窗口标题与图标认出 Agent IDE。
- **产品验收标准**：未决。本批不改产品名称与图标。
- **依赖或未决**：产品身份与扩展分发尚未决策。

## 明确排除（不是需求）

以下不是 `PRD-NNN`，不得在追踪表里标成待办需求：

- 整仓迁移 UniverseAgentDesktop 产品文档
- 把 Agents Window 当作默认产品壳
- 复制 Cursor / Codex trade dress
- Open VSX / Marketplace 完整扩展分发
- 在 `docs/product/` 重写 M0–M4 实现切片
```

- [x] **Step 2: 验证十条需求与状态分桶**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import re
text = Path("docs/product/requirements.md").read_text(encoding="utf-8")
assert "type: demand" in text.split("---", 2)[1]
ids = re.findall(r"^### (PRD-\d{3}) ", text, re.M)
assert ids == [f"PRD-{i:03d}" for i in range(1, 11)], ids
assert text.count("**状态**：`accepted`") == 7
assert "**状态**：`blocked`" in text and text.count("**状态**：`blocked`") == 2
assert "**状态**：`proposed`" in text and text.count("**状态**：`proposed`") == 1
assert "`implemented`" not in text.split("## 已接受的现行壳需求")[1].split("## 待验证说明")[0]
for field in ("用户价值", "用户可观察陈述", "产品验收标准"):
    assert text.count(field) >= 10
for banned in ("workbench.desktop.main", "ChatEditorInput", "IChatModel", "vs/sessions", "product.json", "EDITOR_PART", "conversationStubModel.ts", "layout.ts"):
    assert banned not in text, banned
print("requirements.md OK")
PY
```

Expected: 打印 `requirements.md OK`。`implemented` 不得出现在「已接受的现行壳需求」各条状态里。内部标识不得出现。

---

### Task 4: 创建追踪矩阵 `docs/product/traceability.md`

**Files:**
- Create: `docs/product/traceability.md`

**Interfaces:**
- Consumes: `PRD-001`–`PRD-010`；本仓已有规格与方案路径
- Produces: 轻量矩阵；每格只放链接或「待验证 / 未决 / 不适用」，不复制需求正文

- [x] **Step 1: 写入完整文件**

```markdown
---
title: "产品需求追踪矩阵"
type: reference
status: accepted
phase: N/A
updated: YYYY-MM-DD
summary: "PRD-001–PRD-010 到规格、方案与证据的轻量追踪；无证据则标待验证"
---

# 产品需求追踪

> 只链接事实来源，不复制 [requirements.md](requirements.md) 或方案正文。没有验证证据的需求标「待验证」，不以产品状态 `accepted` 代替验证结论。

| PRD-ID | 产品状态 | 系统/架构规格 | 实施方案 | 测试或验证证据 |
|--------|----------|---------------|----------|----------------|
| [PRD-001](requirements.md#prd-001-以-conversation-为中心) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [parts-and-grid](../systems/workbench/parts-and-grid.md) · [desktop-shell-mapping](../reference/code-oss-b2/desktop-shell-mapping.md) | [m0](../../dev/plans/m0-topology-surgery.md) · [m1](../../dev/plans/m1-shell-followon.md) · [m2](../../dev/plans/m2-product-shell.md) | 待验证：D4 启动冒烟未跑。已有单测约束中心不是 Chat 编辑器标签，但单测不是产品启动证据 |
| [PRD-002](requirements.md#prd-002-会话上下文) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [session-roster-reuse](../reference/code-oss-b2/session-roster-reuse.md) · [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) | [m2](../../dev/plans/m2-product-shell.md) · [m3](../../dev/plans/m3-shell-closeout.md) | 待验证：D4 / M3 目视未做 |
| [PRD-003](requirements.md#prd-003-时间线与输入) | `accepted` | [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) · [agent-ui](../systems/chat/agent-ui.md) | [m2](../../dev/plans/m2-product-shell.md) | 待验证：D4 未跑 |
| [PRD-004](requirements.md#prd-004-权限座位) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) | [m2](../../dev/plans/m2-product-shell.md) | 待验证：D4 未跑 |
| [PRD-005](requirements.md#prd-005-preview-与-sources-files) | `accepted` | [parts-and-grid](../systems/workbench/parts-and-grid.md) · [desktop-shell-mapping](../reference/code-oss-b2/desktop-shell-mapping.md) | [m1](../../dev/plans/m1-shell-followon.md) | 待验证：D4 未跑。Files 列表代码已合入，不等于 Changes/Diff 已齐 |
| [PRD-006](requirements.md#prd-006-默认无-copilot--chat-冒充) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [panel-and-auxiliary-bar](../systems/workbench/panel-and-auxiliary-bar.md) · [views-and-composites](../systems/workbench/views-and-composites.md) | [m2](../../dev/plans/m2-product-shell.md) · [m3](../../dev/plans/m3-shell-closeout.md) | 待验证：D4 / M3 目视未做 |
| [PRD-007](requirements.md#prd-007-诚实降级) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) | [m2](../../dev/plans/m2-product-shell.md) | 待验证：D4 未跑 |
| [PRD-008](requirements.md#prd-008-引擎与会话权威) | `blocked` | [agent-host](../systems/agent-host/INDEX.md) · [agent-ui](../systems/chat/agent-ui.md) | 无本仓已接受的引擎实施方案 | 无。禁止把 stub echo 写成验证证据 |
| [PRD-009](requirements.md#prd-009-changes-与-diff) | `blocked` | [diff-footprint](../reference/code-oss-b2/diff-footprint.md) · [gap-vs-desktop-shell](../reference/code-oss-b2/gap-vs-desktop-shell.md) | [m1](../../dev/plans/m1-shell-followon.md) / [m2](../../dev/plans/m2-product-shell.md) 仅记录 FORK，不实施 | 无。FORK 未选，不是待验证 |
| [PRD-010](requirements.md#prd-010-产品身份) | `proposed` | 无本仓已接受的产品身份规格 | 无。M2 明确不改产品名称与图标 | 无 |

## 外仓冲突与出处

| 主题 | 外仓历史出处 | 本仓决定 |
|------|--------------|----------|
| Agent IDE 主流程在 Conversation | UniverseAgentDesktop `docs/product/experience-principles.md` §2 | 已迁入 [vision.md](vision.md)；外仓不再是持续权威 |
| 外仓 F1–F11 现行交付表 | UniverseAgentDesktop `docs/product/requirements.md` | **不迁入**。本仓只用 `PRD-001`–`PRD-010` |
| 编辑器窗口作为产品壳 | UniverseAgentDesktop ADR-061 | 壳拓扑已由本仓 M0–M3 落地；产品陈述以本目录为准 |
| Diff 落点 | 外仓合同要底部面板，本仓现状在编辑器区域 | 冲突保留为 PRD-009 `blocked`，表述为「编辑器区域 vs 底部面板」，不静默覆盖 |

## 状态分桶

| 分桶 | PRD |
|------|-----|
| 已接受、代码已落、启动待验证 | PRD-001–PRD-007 |
| 阻塞 / 未决 | PRD-008、PRD-009 |
| 仅提议 | PRD-010 |
| 明确排除 | 见 [requirements.md](requirements.md)「明确排除」，不进入上表当待办 |
```

- [x] **Step 2: 验证矩阵不复制正文且链接可解析**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("docs/product/traceability.md").read_text(encoding="utf-8")
assert "type: reference" in text.split("---", 2)[1]
assert "用户打开默认编辑器窗口时，中心工作区是 Conversation" not in text
assert "Goal：" not in text
for i in range(1, 11):
    assert f"PRD-{i:03d}" in text
assert "待验证" in text
assert "编辑器区域 vs 底部面板" in text
for banned in ("ChatEditorInput", "IChatModel", "product.json", "EDITOR_PART", "workbench.desktop.main", "vs/sessions"):
    assert banned not in text, banned
print("traceability.md OK")
PY
```

Expected: 打印 `traceability.md OK`。链接解析放到 Task 13 默认健康检查：本波 `docs/product/` 文件不得新增断链 warning。若锚点因标题标点不一致，把表格第一列改成 `requirements.md` 纯文件链接，不要为了对齐锚点去改需求标题语义。

---

### Task 5: 同步 `AGENTS.md` 产品入口

**Files:**
- Modify: `AGENTS.md`（文档导航表，约第 11–24 行）

**Interfaces:**
- Consumes: `docs/product/INDEX.md` 已存在
- Produces: 新会话从 `AGENTS.md` 一跳进入产品需求

- [x] **Step 1: 在文档导航表顶部增加一行**

把现有表：

```markdown
| 文档 | 说明 |
|:-----|:-----|
| [文档索引](docs/INDEX.md) | 全局导航 |
```

改成：

```markdown
| 文档 | 说明 |
|:-----|:-----|
| [产品需求](docs/product/INDEX.md) | Agent IDE 愿景、需求与追踪 SSOT |
| [文档索引](docs/INDEX.md) | 全局导航 |
```

不要改「新会话必读」三步顺序（仍是本文件 → `docs/DOCUMENTATION.md` → `dev/progress/status.md`）。不要给 `AGENTS.md` 加 frontmatter。

- [x] **Step 2: 验证一跳**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("AGENTS.md").read_text(encoding="utf-8")
assert "[产品需求](docs/product/INDEX.md)" in text
assert text.split("## 新会话必读")[1].split("## 文档导航")[0].count("docs/product") == 0
print("AGENTS.md OK")
PY
```

Expected: 打印 `AGENTS.md OK`。产品入口只出现在导航表，不挤进必读三步。

---

### Task 6: 同步 `docs/README.md`

**Files:**
- Modify: `docs/README.md`

- [x] **Step 1: 改角色表、目录树和更新日期**

1. 把 frontmatter `updated` 改为实施当日；`summary` 改为 `"docs/ 人类向导航：产品需求、架构知识库；行动层见 dev/"`。
2. 在「如何阅读」表**第一行**插入：

```markdown
| 产品 / 规划 | [产品需求](product/INDEX.md) → [愿景](product/vision.md) → [需求](product/requirements.md) |
```

保留原有「架构 / Agent」「改文档壳 / Agent UI」「分层开发」「测试 / 校验」行。
3. 把「文档结构」代码块改成：

```
docs/
├── product/           ← 产品需求 SSOT（愿景、需求、追踪）
├── architecture/      ← 全局架构
├── systems/           ← 跨层系统
├── modules/           ← 分层导航
├── guides/            ← 指南
└── reference/         ← 参考（含 code-oss-b2 分析簇）
```

4. 文末 `*最后更新：2026-08-30*` 改成实施当日。
5. 保留「产品级用户文档仍在 VS Code wiki / vscode-docs」这句：那是上游 VS Code 用户手册，不是本仓 Agent IDE 需求权威。不要删，也不要把 wiki 写成 Agent IDE SSOT。

- [x] **Step 2: 验证**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("docs/README.md").read_text(encoding="utf-8")
assert "product/INDEX.md" in text
assert "product/           ← 产品需求 SSOT" in text or "product/" in text
assert "VS Code wiki" in text
print("docs/README.md OK")
PY
```

Expected: 打印 `docs/README.md OK`。

---

### Task 7: 同步 `docs/INDEX.md`

**Files:**
- Modify: `docs/INDEX.md`

- [x] **Step 1: 增加快速入口与分类入口**

1. `updated` 改为实施当日；`summary` 改为 `"全局文档导航：产品需求、分层模块、跨层系统、B2 壳分析、行动层"`。
2. 在「快速入口」表第一行插入：

```markdown
| 看产品目标与怎样算成功 | [产品需求](product/INDEX.md) |
```

3. 在「分类索引」表**最上面**插入：

```markdown
| 产品需求 | [入口](product/INDEX.md) · [愿景](product/vision.md) · [需求](product/requirements.md) · [追踪](product/traceability.md) |
```

不要删 B2 / 壳分析行，也不要把 B2 索引改写成产品 SSOT。

- [x] **Step 2: 验证一跳**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("docs/INDEX.md").read_text(encoding="utf-8")
assert "[产品需求](product/INDEX.md)" in text
assert "product/vision.md" in text
assert "product/requirements.md" in text
assert "product/traceability.md" in text
print("docs/INDEX.md OK")
PY
```

Expected: 打印 `docs/INDEX.md OK`。

---

### Task 8: 扩展 `docs/DOCS-SPEC.md` 为五类职责并加模板

**Files:**
- Modify: `docs/DOCS-SPEC.md`

- [x] **Step 1: 改分类、目录、四层定位、模板、附录、日期**

按下面精确替换，不要重写第 6 节健康检查命令。

1. `updated` 改为实施当日。正文「版本」改为 `1.1`，「更新日期」改为实施当日。
2. §2 文档分类表，在「系统级文档」**之前**插入一行：

```markdown
| **产品需求** | 为什么做、给谁用、怎样算成功 | `docs/product/` |
```

3. §3 目录树在 `docs/` 下 `README.md` 之后插入：

```
├── product/                       # 产品需求 SSOT
│   ├── INDEX.md
│   ├── vision.md
│   ├── requirements.md
│   └── traceability.md
```

4. 把「四层定位」整段替换为：

```markdown
> **五类职责**  
> - `docs/product/` — 产品需求（为什么、给谁、怎样算成功）  
> - `docs/modules/` — 分层导航  
> - `docs/systems/` — 跨层协作  
> - `docs/architecture/` — 全景与横切  
> - `dev/` — 行动层（plan / ADR / status）
```

5. 在 §4.3 ADR 之后新增 §4.4。先写标题与说明，再用**独立**代码块给出需求条目模板（不要把模板再套一层 markdown 围栏）：

把下面整段写入 `docs/DOCS-SPEC.md`：

```
### 4.4 产品需求：docs/product/

INDEX.md 只导航，frontmatter type 为 index。vision.md 只写用户、问题、价值、原则、范围，type 为 concept。requirements.md 用稳定 ID，type 为 demand。traceability.md 只做追踪，type 为 reference。每条需求包含：状态（proposed / accepted / implemented / blocked）、用户价值、用户可观察陈述、产品验收标准、依赖或未决。

traceability.md 只维护 PRD-ID → 产品状态 → 系统/架构规格 → 实施方案 → 测试或验证证据。没有证据写「待验证」，不把 implemented 当成验证结论。禁止在产品文件里写类名、文件切片、排期。
```

需求条目在 DOCS-SPEC 里用缩进示例写出如下四行字段名即可，不要再嵌套围栏：`### PRD-NNN 短标题`，然后是状态、用户价值、用户可观察陈述、产品验收标准、依赖或未决。

6. §5.1 触发条件增加一条：`docs/product/` 增删或产品入口变更。
7. §8 附录表增加：`| 产品需求 | docs/product/ |`。
8. §1.1 中「官方 wiki / vscode-docs 仍是产品文档的外部来源；本树只维护本仓库实现真相」改为：「上游 VS Code 用户手册仍在 wiki / vscode-docs；本仓 Agent IDE 产品需求在 `docs/product/`；`docs/architecture|systems|modules` 仍是实现真相。」

- [x] **Step 2: 验证五类与模板**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("docs/DOCS-SPEC.md").read_text(encoding="utf-8")
assert "五类职责" in text
assert "docs/product/" in text
assert "### 4.4 产品需求" in text
assert "PRD-NNN" in text
assert "demand" in text and "concept" in text and "reference" in text
assert "四层定位" not in text
print("DOCS-SPEC.md OK")
PY
```

Expected: 打印 `DOCS-SPEC.md OK`。文中不再出现「四层定位」作为现行结构名。

---

### Task 9: 同步 `docs/guides/doc-style-guide.md` 五类职责

**Files:**
- Modify: `docs/guides/doc-style-guide.md`（frontmatter `updated` + 约第 54–61 行「四层定位」表）

**Interfaces:**
- Consumes: Task 8 已写入的五类职责
- Produces: 文体指南与 DOCS-SPEC / DOCUMENTATION 结构用语一致

- [x] **Step 1: 改 frontmatter 与四层表**

1. 把 `updated` 改为实施当日。不要改 `type: guide`。
2. 把「四层定位（不要写错目录）：」整段（含其后四行表）替换为：

```markdown
五类职责（不要写错目录）：

| 区域 | 写什么 |
|------|--------|
| `docs/product/` | 产品需求（为什么、给谁、怎样算成功） |
| `docs/modules/` | 单层导航 |
| `docs/systems/` | 跨层协作 |
| `docs/architecture/` | 全景与横切 |
| `dev/` | 行动层（plan / ADR / status），不属于知识库 |
```

不要改「禁止在 src/vs 建文档树」及之后各节。不要用「本波不改」跳过本文件。

- [x] **Step 2: 验证**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("docs/guides/doc-style-guide.md").read_text(encoding="utf-8")
fm = text.split("---", 2)[1]
assert "updated:" in fm
assert "2026-08-30" not in fm
assert "五类职责" in text
assert "docs/product/" in text
assert "四层定位" not in text
print("doc-style-guide.md OK")
PY
```

Expected: 打印 `doc-style-guide.md OK`。`updated` 已离开 `2026-08-30`。

---

### Task 10: 更新 `docs/DOCUMENTATION.md` 需求规则

**Files:**
- Modify: `docs/DOCUMENTATION.md`

- [x] **Step 1: 改目录摘要、frontmatter 类型、规则与速查**

1. `updated` 改为实施当日。
2. §1 目录表在「知识库」行后插入：

```markdown
| 产品需求 | `docs/product/` | Agent IDE 产品愿景、`PRD-NNN`、追踪；知识库的产品层 |
```

3. 把「四层定位」改为「五类职责」，并加上 `docs/product/` 产品需求。
4. §2 `type` 行保持现有枚举（已含 `demand` / `concept` / `reference` / `index`），不要再发明新 type。在规则 10a 中写明产品层文件：`INDEX.md` → `index`，`vision.md` → `concept`，`requirements.md` → `demand`，`traceability.md` → `reference`。
5. 在规则 10 之后新增 **规则 10a：产品需求变更顺序**，全文：

```markdown
### 规则 10a：产品需求变更顺序

用户可见产品行为变化按此顺序，禁止倒过来：

1. 更新 `docs/product/requirements.md` 对应 `PRD-NNN`（必要时先改 `vision.md`）
2. 更新 `docs/product/traceability.md`
3. 更新相关 `docs/systems/` / `docs/architecture/` / B2 实现真相
4. 更新或新增 `dev/plans/` 实施方案

需求 ID 格式为 `PRD-NNN`（三位数字，首批 `PRD-001` 起）。状态为 `proposed` | `accepted` | `implemented` | `blocked`。没有验证证据不得标 `implemented`。

权威边界：本仓 `docs/product/` 是 Agent IDE 产品需求 SSOT。UniverseAgentDesktop 相关文档只能作为 `source` 或历史链接。不得通过整篇外仓链接隐式继承规范。外仓冲突在 `traceability.md` 留出处，不静默覆盖。

产品层 frontmatter type：`INDEX.md` 用 `index`，`vision.md` 用 `concept`，`requirements.md` 用 `demand`，`traceability.md` 用 `reference`。
```

6. §4 检索提示增加：`了解产品目标 → docs/product/INDEX.md`。
7. §5 速查表在「项目全貌」后增加：`| 产品需求 | docs/product/INDEX.md |`。

不要把规则 1 的新会话三步改成四步。

- [x] **Step 2: 验证**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("docs/DOCUMENTATION.md").read_text(encoding="utf-8")
assert "规则 10a" in text
assert "PRD-NNN" in text
assert "docs/product/" in text
assert "五类职责" in text
assert "新会话三步走" in text
assert "type" in text and "demand" in text and "concept" in text and "reference" in text
print("DOCUMENTATION.md OK")
PY
```

Expected: 打印 `DOCUMENTATION.md OK`。

---

### Task 11: M2 历史方案只加回链

**Files:**
- Modify: `dev/plans/m2-product-shell.md`（仅 frontmatter `updated` + 标题下新增一段）

- [x] **Step 1: 在标题后、原 `>` 前置块之前插入回链，不改其后任何历史正文**

`updated` 改为实施当日。在 `# M2 产品壳（无引擎）` 后插入：

```markdown

> **产品需求层回链（后补，不改本方案历史正文）**：现行产品陈述以 [docs/product/requirements.md](../../docs/product/requirements.md) 为准；本文件「产品完成线」只是 M2 当时记录。入口：[docs/product/INDEX.md](../../docs/product/INDEX.md)。
```

禁止改「产品完成线」六条、切片文件表、验收四条、Goal / Architecture 原文。禁止把本文件改写成当前需求 SSOT。

- [x] **Step 2: 验证只增加回链**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("dev/plans/m2-product-shell.md").read_text(encoding="utf-8")
assert "docs/product/requirements.md" in text
assert "docs/product/INDEX.md" in text
assert "M2 出口 = 默认编辑器窗口作为 **UniverseAgentDesktop B2/ADR-061 产品壳**" in text
assert "Likely files（本切片独占）" in text
print("m2 backlink OK")
PY
git diff --stat -- dev/plans/m2-product-shell.md
```

Expected: 打印 `m2 backlink OK`。`git diff --stat` 只显示这一个文件的少量行变化（回链 + `updated`），没有大段删除。

---

### Task 12: 更新进度与方案状态

**Files:**
- Modify: `dev/progress/status.md`
- Modify: `dev/plans/product-requirements-layer.md`（本文件 frontmatter 与 checkbox）
- Modify: `dev/plans/INDEX.md`（本方案状态列）

- [x] **Step 1: 改 `status.md`，保持 ≤ 200 行**

`updated` 改为实施当日。在 `## Current Session` 列表**最上方**插入一条，不得删除 M4 / D4 阻塞原文：

```markdown
- **产品需求层** [product-requirements-layer.md](../plans/product-requirements-layer.md) **`implemented`**：`docs/product/` 已建立；首批 PRD-001–PRD-010 已落；入口、DOCS-SPEC、文体指南、DOCUMENTATION 已同步；M2 仅回链。未改产品代码，未升 PRD-001–007 为 `implemented`（D4 仍待验证）。
```

`summary` 保持 M4 阻塞为主，可改成 `"M4 D4 启动冒烟阻塞于 compile；产品需求层文档已落"`。禁止在 `status.md` 新写需求正文或架构决策。

- [x] **Step 2: 改方案索引与本计划状态**

`dev/plans/INDEX.md`：该行在计划修订时已是 `accepted`。实施完成后把它改为 `implemented`，`updated` 改为实施当日。不要改回 `proposed`。

本文件：`status: implemented`；把本实施计划中已完成步骤的 `- [x]` 改为 `- [x]`。不要改「背景」到「验收」的已批准设计文字。

- [x] **Step 3: 验证行数与状态**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
status = Path("dev/progress/status.md").read_text(encoding="utf-8")
assert len(status.splitlines()) <= 200, len(status.splitlines())
assert "docs/product/" in status
assert "PRD-001" in status
index = Path("dev/plans/INDEX.md").read_text(encoding="utf-8")
assert "| [product-requirements-layer.md](product-requirements-layer.md) | `implemented` |" in index
plan = Path("dev/plans/product-requirements-layer.md").read_text(encoding="utf-8")
assert "status: implemented" in plan.split("---", 2)[1]
print("status/index/plan OK", "status_lines=", len(status.splitlines()))
PY
```

Expected: 打印 `status/index/plan OK` 且 `status_lines=` ≤ 200。

---

### Task 13: 全量文档健康检查与验收对照

**Files:**
- Test: `scripts/check-docs-health.py`（只读；不修既有 warning）

本波通过门槛只看**默认**命令。当前基线（实施前已核对）：

| 命令 | 基线 | 是否本波门槛 |
|------|------|--------------|
| `python3 scripts/check-docs-health.py` | 0 error；warnings 来自既有无关文件（`dev/loop/INDEX.md` 两条断链；若工作树仍有 `docs/systems/chat/agent-ui.md` 重复 `summary`，会多一条 frontmatter warning） | 是：必须退出 0，且本波文件不新增 warning |
| `python3 scripts/check-docs-health.py --strict-frontmatter` | 可能把 `agent-ui.md` 重复 `summary` 升为 error | 否：只记录基线，不修、不作为通过条件 |
| `python3 scripts/check-docs-health.py --strict-links` | 两条既有断链会变成 error 并退出 1 | 否：只记录基线，不修、不作为通过条件 |

- [x] **Step 1: 跑默认健康检查（通过门槛）**

Run:

```bash
python3 scripts/check-docs-health.py
```

Expected: 退出码 0，Errors: 0。Warnings 可以仍是基线那几条。用下面脚本确认本波文件没有新增 warning：

```bash
python3 - <<'PY'
import subprocess, re
out = subprocess.check_output(["python3", "scripts/check-docs-health.py"], text=True)
assert "Errors: 0" in out or re.search(r"^Errors: 0$", out, re.M)
wave = (
    "docs/product/",
    "docs/guides/doc-style-guide.md",
    "docs/README.md",
    "docs/INDEX.md",
    "docs/DOCS-SPEC.md",
    "docs/DOCUMENTATION.md",
    "AGENTS.md",
    "dev/plans/m2-product-shell.md",
    "dev/progress/status.md",
    "dev/plans/product-requirements-layer.md",
    "dev/plans/INDEX.md",
)
for line in out.splitlines():
    if "broken local link" in line or "frontmatter" in line.lower() and "duplicate" in line.lower():
        if any(p in line for p in wave):
            raise SystemExit("new warning from this wave: " + line)
print("default health OK")
PY
```

Expected: 打印 `default health OK`。不要为了让默认检查更干净而去改 `dev/loop/INDEX.md` 或 `agent-ui.md`。

- [x] **Step 2: 记录严格模式基线（非正式门槛）**

Run:

```bash
python3 scripts/check-docs-health.py --strict-frontmatter; echo EXIT_FM:$?
python3 scripts/check-docs-health.py --strict-links; echo EXIT_LINKS:$?
```

Expected: 把退出码和既有 finding 记在实施笔记或 status 一条里即可。`--strict-links` 当前会因 `dev/loop/INDEX.md` 两条断链失败；`--strict-frontmatter` 可能因 `agent-ui.md` 重复 `summary` 失败。这两次失败不阻塞本波。禁止顺手修复这些无关 warning。

- [x] **Step 3: 对照本方案「验收」六条**

Run:

```bash
python3 - <<'PY'
from pathlib import Path

agents = Path("AGENTS.md").read_text(encoding="utf-8")
docs_index = Path("docs/INDEX.md").read_text(encoding="utf-8")
assert "docs/product/INDEX.md" in agents
assert "product/INDEX.md" in docs_index

vision = Path("docs/product/vision.md").read_text(encoding="utf-8")
reqs = Path("docs/product/requirements.md").read_text(encoding="utf-8")
trace = Path("docs/product/traceability.md").read_text(encoding="utf-8")
assert "type: concept" in vision.split("---", 2)[1]
assert "type: demand" in reqs.split("---", 2)[1]
assert "type: reference" in trace.split("---", 2)[1]
assert "type: index" in Path("docs/product/INDEX.md").read_text(encoding="utf-8").split("---", 2)[1]
assert "PRD-001" in reqs and "PRD-010" in reqs
assert "待验证" in trace and "明确排除" in reqs
assert "五类职责" in Path("docs/guides/doc-style-guide.md").read_text(encoding="utf-8")

m2 = Path("dev/plans/m2-product-shell.md").read_text(encoding="utf-8")
assert "docs/product/requirements.md" in m2
assert "M2 出口 = 默认编辑器窗口作为 **UniverseAgentDesktop B2/ADR-061 产品壳**" in m2

print("acceptance mapping OK")
PY
```

Expected: 打印 `acceptance mapping OK`。

对应关系（实施者自检，不要另写文档）：

| 原方案验收 | 由哪些任务覆盖 |
|------------|----------------|
| 1. `AGENTS.md` 或 `docs/INDEX.md` 一跳进入产品需求 | Task 5、Task 7 |
| 2. 愿景、壳需求、追踪各有唯一正文 | Task 2、Task 3、Task 4 |
| 3. 首批需求有稳定 ID、状态、用户可观察验收 | Task 3（PRD-001–PRD-010） |
| 4. 已实现/待验证/未决/排除不混写 | Task 3 分节 + Task 4 分桶；001–007 不标 `implemented` |
| 5. M2 回链且不被重写为当前 SSOT | Task 11 |
| 6. `check-docs-health.py` 返回 0 error | Task 13 默认命令；入口与规范由 Task 1、6、8、9、10 保证可发现 |

- [x] **Step 4: 确认没有越权改动**

Run:

```bash
git diff --name-only
```

Expected: 文件集合只能是本计划 File Map 中的路径，外加实施者勾选本文件 checkbox。不得出现 `src/**`、`docs/product/README.md`、`docs/roadmap/**`、被重写的 M0/M1/M3/M4 方案、`dev/loop/INDEX.md`、`docs/systems/chat/agent-ui.md`。不要在本任务 `git commit`。

