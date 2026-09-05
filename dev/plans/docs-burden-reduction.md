---
title: "文档负担收敛：状态列生成、单一真相与术语对外可读"
type: plan
status: accepted
phase: N/A
updated: 2026-09-05
summary: "plans INDEX 状态列与 traceability 产品状态列由脚本生成，test-baseline-ci 的 docs-health job 是唯一机器调用方；status.md 只留当前迭代；glossary 增补对外可读约束与允许的缩写。2026-09-05 第二轮对抗审查后签收"
---

# 文档负担收敛

> **触发：** 过程产物远多于验证产物。2026-09-05 点数：`docs/` + `dev/` 合计 **209** 篇 Markdown（不含路径含 `archive/` 的 2 篇），`src/vs/workbench/contrib/conversation/test/**/*.ts` **56** 个文件。同一件事的状态在 `status.md`、`deferred-gaps.md`、`traceability.md`、各 plan 的 `summary` / INDEX 行上重复手写，每次收口改一圈。术语高度私有，外人无法接手。  
> **基线：** 相对本方案落盘时的仓库树。已读 [DOCUMENTATION.md](../../docs/DOCUMENTATION.md)（规则 3a / 3c / 10 / 10a / 11）、[DOCS-SPEC.md](../../docs/DOCS-SPEC.md)、[glossary.md](../../docs/glossary.md)、[traceability.md](../../docs/product/traceability.md)、[plans/INDEX.md](INDEX.md)、[status.md](../progress/status.md)、[check-docs-health.py](../../scripts/check-docs-health.py)、[docs/INDEX.md](../../docs/INDEX.md)。  
> **不推翻：** 规则 3a 的 `status.md` ≤ 200 行；规则 7 只归档不删除；规则 10 单一事实源；`check-docs-health.py` **只读、不写文件**。规则 10a 的需求顺序（先 requirements，再追踪，再系统 / 方案）与状态闭集保留；**第 2 步合同本稿实施时同步改**（见 §1.5）。禁止写「不推翻 10a」却把 `traceability.md` 产品状态列改成生成区。  
> **本稿用词：** 正文按 §3 对外可读约束书写。旧称只出现在 §3.2 对照表。  
> **审查：** 规则 16 第一轮已改入；2026-09-05 第二轮对抗性审查（Reject）复核改入后**签收**。记录见文末。  
> **机器调用方（签收裁定）：** 本方案所有「健康检查失败」都只有在被 CI 调用时才是门禁。`check-docs-health.py` 今日无任何生产调用方（`package.json` / gulp / workflows 均不调；health-gates.md 只写「建议」）。**唯一**机器调用方定为 [test-baseline-ci](test-baseline-ci.md) 的 `docs-health` job（先 `check-docs-health.py`，S1 合入后追加 `generate-docs-status.py --check`）。本方案不自建 workflow；`docs-health` job 未合入前，本方案的检查只是本地工具，不得在任何文档里写成「门禁」。

## 0. 目标 / 非目标

### 目标

1. **状态只在一处手写，索引只展示。** `dev/plans/INDEX.md` 的「状态」列、`docs/product/traceability.md` 的「产品状态」列（以及按产品状态机械分组的分桶表）由脚本从源生成；健康检查发现手改生成区或忘跑脚本则失败，并由 `docs-health` CI job 阻断合入。
2. **四份手写账各司其职，禁止互抄枚举。** 见 §1。
3. **术语对外可读。** `docs/glossary.md` 增补约束与允许的缩写；**对外闭集 = glossary 主表 ∪ glossary 第二张表（旧称对照）**——S3 前由本稿 §3.2 暂代第二张表，S3 合入后 §3.2 改成一行指针，避免双写；只约束本稿之后新写正文。
4. **定归档标准，本波不批量搬家。** 见 §5。只把「明确过时且已有取代者」的篇目列为后续候选，本波不移。

### 非目标

| 不做 | 理由 |
|------|------|
| 删除历史 plan（M0–M7 等） | 它们是 traceability「实施方案」列的落点；完成线就地保留（INDEX 引言已写） |
| 本波批量移入 `dev/archive/` | 标准先于搬家；`dev/archive/INDEX.md` 今日仍空。未读到「已有完整取代且无人再链」的篇目 |
| 改 PRD 正文语义、验收句、用户可观察陈述 | 10a 第 1 / 3 / 4 步与状态闭集仍在；本方案只改**状态列的维护方式**与 **10a 第 2 步合同**，不改需求含义 |
| 生成 `status.md` 或 `deferred-gaps.md` | 二者是手写真相，不是索引 |
| 生成 `docs/INDEX.md` 或各模块 / 系统 INDEX | 那些表没有「从 frontmatter 可推导的状态列」 |
| 生成 plans INDEX 的「摘要」列 | 本波只收状态枚举；摘要仍手写。残留重复见 §1.2 |
| 把生成写进 `check-docs-health.py` | 该脚本文件头与 [DOCS-SPEC §1.2](../../docs/DOCS-SPEC.md) 约定**只读**；写文件另开脚本 |
| 批量改写旧 plan / 旧进度 / 旧对外文档里的黑话 | 术语约束只约束**本稿之后新写正文**；存量豁免到另波 |
| 新增 `dev/iterations/`、放宽 status 200 行 | 规则 4 / 3a 保持 |

## 1. 单一真相：哪一列生成、哪一列手写

今日四写（同一产品或方案状态被抄四次）：

| 文件 | 今日实际 | 本波后角色 |
|------|----------|------------|
| [status.md](../progress/status.md) | 当前迭代 **加上** 复述 plan / PRD / 延期枚举 | **当前迭代唯一手写账** |
| [deferred-gaps.md](../progress/deferred-gaps.md) | 延期缺口表 + 长证据附录 | **延期账唯一手写账**（表行手写；附录仍属本文件） |
| plan `frontmatter.status` | 方案自身生命周期 | **方案状态唯一手写源** |
| plan `frontmatter.summary` / INDEX 摘要 | 与 status、traceability 抢着写「已落 / 未验」 | summary 仍手写；**INDEX 状态列改为生成** |
| [traceability.md](../../docs/product/traceability.md)「产品状态」 | 手抄 requirements，还常加括号注 | **改为生成**；括号注不得再出现在该列 |
| requirements 各 `PRD-NNN` 下「状态」行 | 产品状态源（不在该文件 frontmatter） | **产品状态唯一手写源**（规则 10a 第 1 步） |

`requirements.md` 的 YAML `status` 是**整篇文档**的生命周期（今日为 `accepted`），**不是**各 PRD 的产品状态。各 PRD 的权威在标题下第一项：

```markdown
- **状态**：`accepted`
```

取值闭集与规则 10a 一致：`proposed` | `accepted` | `implemented` | `blocked`。

### 1.1 生成列（机器写，禁止手改单元格）

| 目标 | 源 | 写入方式 |
|------|----|----------|
| `dev/plans/INDEX.md` 表列「状态」 | 该行第一列链接指向的 plan 的 `frontmatter.status` | **列重写**：只改「状态」单元格，方案名与摘要不动 |
| `docs/product/traceability.md` 表列「产品状态」 | `requirements.md` 对应 `### PRD-NNN` 下第一条 `- **状态**：`（解析见 §2.2） | **列重写**：只改「产品状态」单元格，规格 / 方案 / 证据列不动 |
| `traceability.md`「状态分桶」整表 | 同上（各 PRD 产品状态） | **区间覆盖生成**：只按四值机械分组，见 §2.3。**不再存在「验证」分组**；读者看证据列和 [deferred-gaps.md](../progress/deferred-gaps.md) |

生成单元格的唯一字形：`` `accepted` ``（反引号 + 枚举 + 反引号）。禁止在生成列追加「（方案已签收…）」之类手写尾巴。今日 PRD-008 的 `` `blocked`（方案已签收，待接通证据）`` 在 S1 接通时收成 `` `blocked` ``；括号里的语义先落到「测试或验证证据」列再收（§4 S1 硬条件），不丢。

### 1.2 保持手写的列与字段

| 位置 | 仍手写 | 禁止再写 |
|------|--------|----------|
| `status.md` | 见 §1.3 | plan / PRD / D 项的状态枚举正文 |
| `deferred-gaps.md` 表（ID、Priority、Gap、Why、Exit、Track、Status） | 整表 | 「某 PRD 已是 implemented」这类应去 requirements 的句子 |
| plan frontmatter：`status`、`summary`、`title`、`updated`… | 全部 | — |
| plans INDEX：方案链接、**摘要**列、表外引言 | 摘要与引言 | 「状态」单元格 |
| traceability：系统/架构规格、实施方案、测试或验证证据、表外 precedence 引言、区间外非 PRD 手写句 | 这三列 + 引言 + 区间外手写 | 「产品状态」单元格；分桶内任何验证叙事 |
| `docs/INDEX.md`、模块 / 系统 INDEX | 整页 | 不新增可生成状态列 |
| requirements 各 PRD 的状态行与需求正文 | 整段 | 不在本方案改语义 |

INDEX「摘要」与 plan `summary` 仍可能近似重复。本波**不**生成摘要列，以免把导航句与方案一行强行合一。后续若要收，另开切片，源仍是 `frontmatter.summary`。

### 1.3 `status.md` 仍手写的字段（当前迭代账）

`status.md` **不是**产品状态账，也不是方案生命周期账。收口时只改下面这些，其它用链接：

| 区块 | 仍手写 | 写法 |
|------|--------|------|
| YAML frontmatter | `title` / `type` / `status`（文档生命周期，现为 `active`）/ `phase` / `updated` / `summary` | `summary` 写本会话做了什么，不写「PRD-0xx 仍 accepted」 |
| Current Session | 本会话事实：合入的提交、跑过的命令、未提交的范围 | 链到 plan / PRD / D 项，不抄它们的枚举 |
| 工位表（与 `git worktree list` 对照） | 路径、分支、工位忙闲 | 这是操作态，不属于产品状态 |
| Blockers | 有 / 无；若有则 **只写 D 项 ID 链接** | 缺口正文在 `deferred-gaps.md` |
| Next | 下一步指针（文件链接 + 一句） | 不把 plan 状态或 PRD 状态写进格子 |
| 不做 | 本迭代明确不做的项 | 与产品「非目标」重复时链 vision / 对应 plan |

规则 3a 的「已写本次摘要」继续针对 **Current Session**，不是针对 INDEX 或 traceability。行数上限 **≤ 200** 不变（2026-09-05 为 43 行，空间在「停止复述」而不在再砍结构）。

历史段仍按规则 4 / 7：超长则把旧 Current Session 移入 `dev/archive/`，不在 status 里滚雪球。

### 1.4 翻转时谁改一手

| 事件 | 人手改 | 然后跑脚本 | 规则 3c |
|------|--------|------------|---------|
| 方案生命周期变化（如 `accepted` → `implemented`） | 该 plan 的 `frontmatter.status`（及 `updated` / `summary`） | `generate-docs-status.py` 刷新 INDEX「状态」 | 仍须扫 `docs/` 叙述里的「未实施 / 仍 open」；**生成列不再手扫** |
| 产品状态变化 | `requirements.md` 该 PRD 的「状态」行（规则 10a 第 1 步；无验证证据不得 `implemented`） | `generate-docs-status.py` 刷新 traceability「产品状态」与分桶（**10a 第 2 步**，见 §1.5） | 同上 |
| 延期开闭 | `deferred-gaps.md` 对应行 `Status` | 不跑状态生成脚本 | status 的 Blockers 只改 ID 列表 |
| 当前迭代推进 | `status.md` §1.3 字段 | 不跑状态生成脚本 | — |

### 1.5 规则 10a 第 2 步（本稿实施时同步改）

规则 10a **第 1 / 3 / 4 步与状态闭集不改**。今日第 2 步写的是「更新 `docs/product/traceability.md`」，会读成「手改产品状态列」。产品状态列改成生成区之后，这条合同必须一起改，**不要再说「不推翻 10a」却改生成区**。

**第 2 步改为：**

改完 `requirements.md` 对应 PRD 的「状态」行之后，跑 `python3 scripts/generate-docs-status.py`。`traceability.md` **只手写**「系统/架构规格」「实施方案」「测试或验证证据」三列（及表外引言、区间外非 PRD 句）；禁止手改「产品状态」单元格或分桶生成区。新 PRD 行仍手写 PRD-ID 与上述三列，再跑脚本填产品状态与分桶。

第 1 步仍是先改 `requirements.md`（必要时先改 `vision.md`）；第 3 / 4 步仍是系统 / 架构 / B2 与实施方案。无验证证据不得标 `implemented`。

落点：S1 接通生成列的**同一提交**改 DOCUMENTATION 规则 10a 第 2 步正文。S3 只改 3a / 10 / 3c，不再重写第 2 步。

## 2. 生成脚本

### 2.1 新脚本，扩展检查；不把写入塞进健康检查

读过 [check-docs-health.py](../../scripts/check-docs-health.py)：它是只读检查（必备入口、`status.md` 行数、模块 / 系统 INDEX、frontmatter、断链）。[DOCS-SPEC §1.2](../../docs/DOCS-SPEC.md) 写明「只读健康检查，不覆写人工索引」。

| 路径 | 职责 |
|------|------|
| `scripts/docs_status.py`（新，可被 import） | 解析 frontmatter、「状态」行、带标记的表；计算期望单元格；比较 |
| `scripts/generate-docs-status.py`（新） | 默认**写入**生成列 / 生成区间；`--check` 只比较；`--dry-run` 打印将改的单元格 |
| `scripts/check-docs-health.py`（扩展） | `import` 比较函数，新增 error 组 `generated_status`；**不写任何文件** |

禁止把「检查时顺便写回」做进健康检查。忘记跑生成脚本时，健康检查以 **error**（默认，不躲在 `--strict-*` 后面）失败，提示先跑 `python3 scripts/generate-docs-status.py`。

DOCS-SPEC 在 S1 须改口：人工索引仍然是默认；**仅**本方案点名的状态列 / 分桶区间改为生成。这不是「健康检查覆写索引」。

### 2.2 标记：列标记 + 区间标记，不是整文件覆盖

不覆盖整份 INDEX 或整份 traceability。引言、其它列、YAML frontmatter 仍手写。

**列标记**（紧挨在目标表的表头行上一行）：

```markdown
<!-- generated-col id="plans-index-status" source="plan-frontmatter-status" column="状态" key="first-link" -->
```

```markdown
<!-- generated-col id="traceability-prd-status" source="prd-status-line" column="产品状态" key="prd-id" -->
```

脚本行为：

1. 找到该 HTML 注释，解析紧随其后的 Markdown 表。
2. 按 `column` 锁定列下标（表头文字必须恰好等于该值）。
3. 每一数据行用 `key` 解析源：
   - `first-link`：第一列第一个 Markdown 链接，相对 INDEX 解析，必须是 `dev/plans/*.md` 且不是 `INDEX.md`。
   - `prd-id`：第一列匹配 `PRD-\d{3}`，到 `docs/product/requirements.md` 找 `### PRD-NNN`。**节边界** = 从该标题到下一个任意级别标题（`#` / `##` / `###`）之前——HEAD 里 `## 待验证说明` 一节含 `implemented` 字样、PRD-011 依赖行含三个闭集词，都不得被抽到。节内**只读第一条**状态行：匹配 `^- (\*\*)?状态(\*\*)?[：:]`（粗体可无——[DOCS-SPEC](../../docs/DOCS-SPEC.md) 的模板示例是无粗体的 `- 状态：`；全角／半角冒号皆可）；节内其它行（依赖、验收）一律不扫。从该行只认闭集 token（`proposed` \| `accepted` \| `implemented` \| `blocked`）：**只取第一个**；抽不到、或同一行出现**多个不同**闭集 token → **error**（不取第二个、不拼接、不默默跳过）。同一 token 重复仍算一个值。夹具必须包含一份从 HEAD `requirements.md` 截取的真实节（含 PRD-007 + 「待验证说明」+ PRD-011），断言 26 个 PRD 全部抽对且零 error。
4. 只替换目标列单元格为 `` `枚举` ``。其它列原样写回（分隔竖线与单元格内空白按「整行重建、非目标列文本 trim 后保留」实现，避免把证据列里的链接弄断）。摘要列与表外引言不得改写（S1 夹具按 byte-stable 断言）。
5. 若本次确有单元格变化：更新该文件 YAML `updated:` 为当天。无变化则不动 `updated`。

**区间标记**（分桶，整段覆盖）：

```markdown
<!-- generated:start id="traceability-prd-buckets" source="prd-status-line" -->
| 分桶 | PRD |
|------|-----|
| `proposed` | … |
| `accepted` | … |
| `implemented` | … |
| `blocked` | … |
<!-- generated:end id="traceability-prd-buckets" -->
```

分桶改四值后，**「验证」分组不再存在**（今日的「代码已落、D4 已验」「已接受、代码已落、待产品验证」「EH 探针已验」等一律取消）。读者看主表「测试或验证证据」列和 [deferred-gaps.md](../progress/deferred-gaps.md)，不在分桶里找验证结论。

D5 等非 PRD 行不进四值表。S1 **先搬家再覆盖**：把这类行从现分桶表剪出，写到即将加上的 `generated:end` **之后**（手写一句或一小节，链到 `deferred-gaps.md` 对应行；**不得**从 traceability 整体消失）；**然后**再加 start/end 并跑写入覆盖区间。禁止先覆盖再补救——覆盖会丢掉 D5 锚点。

手改生成区的定义（健康检查失败）：

- 改了带标记列的单元格，使之与源不一致；
- 删改 `generated-col` / `generated:start|end` 导致少标记、id 对不上、或 start/end 不成对；
- 期望闭集（§2.6）少任一 id，含删光全部标记；
- 分桶区间内的文字与脚本将写出的规范表不完全相同（空白按行 trim 后比较）；
- 表头没有脚本认识的「状态」/「产品状态」列。

未跑脚本但源已变（例如只改了 plan frontmatter）→ 同样失败（单元格仍是旧枚举）。这与「手改生成区」同一检查。

### 2.3 分桶生成规则

只使用 requirements 的产品状态，不读证据列、不读 D 项。四值之外不另设验证分组。

| 分桶（表头取值） | 内容 |
|------------------|------|
| `proposed` / `accepted` / `implemented` / `blocked` | 该状态的 `PRD-NNN` 列表，升序，以 ` · ` 连接，链到 `requirements.md` 现有锚点 |

缺「状态」行、抽不到闭集 token、同一行多个不同闭集 token、或同一 `PRD-NNN` 出现两次 → 生成与检查都 **error**，不默默跳过。

### 2.4 孤儿与缺行

对本波点名的两张表，检查（error）：

- `dev/plans/*.md` 除 `INDEX.md` 外，必须在 INDEX 表有且仅有一行（`*.canvas.tsx` 等非 md 不计入）；
- `requirements.md` 每一个 `### PRD-NNN` 必须在 traceability 主表有且仅有一行；
- INDEX / traceability 行的 key 解析失败（断链、无 frontmatter.status、无「状态」行、状态行抽不到或多个不同闭集 token）；
- plan `frontmatter.status` 不在 [DOCS-SPEC](../../docs/DOCS-SPEC.md) 的 plan 状态闭集内（今日有 `draft` / `accepted` / `implemented` 等；以 DOCS-SPEC 为准，不在本稿重抄）。

这把规则 11「结构变更要改 INDEX」从自觉变成可检查，且不扫描 `docs/modules/**`。

### 2.5 命令与验收钩子

```bash
python3 scripts/generate-docs-status.py
python3 scripts/generate-docs-status.py --check
python3 scripts/generate-docs-status.py --dry-run
python3 scripts/check-docs-health.py
```

`--check` 与健康检查的 `generated_status` 组必须同一套比较函数，禁止两套解析各算各的。

S1 必须带入仓的 `scripts/tests/test_docs_status.py`（`python3 -m unittest scripts/tests/test_docs_status.py` 可跑；`docs-health` job 一并调用）。**不接受**「对临时副本手跑」——手跑不能证明空实现没有过关。至少六条断言：

1. 源为 `accepted`、生成列为 `implemented` → `--check` 非零；
2. 删掉任一 `generated-col` 注释或 `generated:start|end` → 健康检查非零；
3. 改源并跑默认写入后，目标列变成新枚举且其它列链接仍在；
4. **摘要列 / 表外引言 byte-stable**：夹具在 INDEX「摘要」列与表外引言（及 traceability 三手写列 / 表外引言）放入独特字符串，跑默认写入后这些字节与写入前完全相同；
5. 删光全部标记 → 健康检查非零；
6. §2.2 的 HEAD 真实节夹具：26 个 PRD 全抽对、零 error；把 PRD-007 的状态行改成 `- 状态：\`blocked\``（无粗体）仍抽到 `blocked`。

### 2.6 期望标记闭集（从第一天起非空）

期望 id 闭集钉死为下列三个，**没有「零标记短路」**——脚本与标记在同一切片（S1）一起合入，仓库不存在「有脚本无标记」的中间态：

- `plans-index-status`
- `traceability-prd-status`
- `traceability-prd-buckets`

少任一 id、id 对不上、start/end 不成对、或**删光**全部标记 → 健康检查 **error**。（第一轮方案曾把 S1 / S2 拆开并引入「接通前短路」；第二轮审查指出这让 S1 可空转 PASS，已合并。）

## 3. 术语对外可读

glossary 今日是一张产品 / 架构术语表，**没有**过程黑话，也没有「对外文档禁止未定义词」的约束。本波只增补约束与对照表，不把黑话提升成对外推荐词。

### 3.1 约束（写入 glossary 正文，文首定义段之后）

**时效：** 只约束**本稿落盘之后新写**的对外文档与方案正文。存量正文豁免，另波清理（与 §0 非目标一致）。本稿自身按 §3.3 自检。

**对外闭集** = `docs/glossary.md` 主表已定义术语 ∪ glossary 第二张表「旧称 → 对外读名」。S3 合入前该第二张表尚不存在，由本方案 §3.2 暂代；S3 合入的**同一提交**把 §3.2 正文替换为一行「见 glossary 第二张表」，此后唯一源是 glossary。不在此闭集的过程黑话不得写进新对外正文。

1. **对外文档**（`docs/product/`、`docs/architecture/`、`docs/systems/`、`docs/guides/` 中非 Loop 工位操作的指南、`docs/INDEX.md`、`docs/glossary.md` 除对照表以外的正文）：禁止使用闭集外黑话。需要过程概念时，用 §3.2 的「对外读名」。
2. **方案正文**（`dev/plans/`）：按对外文档同一约束——方案要给外人接手。允许在「允许的缩写」表里出现旧称，正文用对外读名。
3. **对内过程文**（`dev/progress/`、`dev/loop/`、`dev/parallel/`）：可以使用旧称，但**每一节首次出现**必须括注对外读名，或链到 glossary 本表。对内过程文的存量同样豁免到另波。
4. 新黑话想进对外文档：先在 glossary 给**一条**定义（对外读名作术语名），再在正文用定义名。禁止只在某 plan 里发明。

[DOCUMENTATION.md](../../docs/DOCUMENTATION.md) 规则 10 与 [doc-style-guide.md](../../docs/guides/doc-style-guide.md)「术语定义只写在 glossary」各加一句指针，不复制本表。指针须写明闭集 = glossary ∪ §3.2 对外读名，且只约束新写正文。

本波**不**做对外文档黑话的自动扫描（避免误伤「四钮」等已入表词，也避免误伤存量豁免）。若后续要扫，另开切片，词表以 §3.2 旧称为准。

### 3.2 允许的缩写（旧称 → 对外读名）

见 [glossary 第二张表「旧称 → 对外读名」](../../docs/glossary.md#旧称--对外读名)（唯一源）。

### 3.3 本稿自检（对外可读）

正文使用：工位、platform 工位、切片、合入收尾、伪装成普通消息、frontmatter、INDEX、PRD、SSOT。旧称只出现在 §3.2 与引用旧文件标题时。

## 4. 切片

实施按下列切片合入；方案 commit 与实施 commit 分开（规则 13）。每片改完跑 `python3 scripts/check-docs-health.py`。

| 切片 | 做什么 | 验收 |
|------|--------|------|
| **S1 脚本 + 标记 + 接通（一次合入）** | 新增 `scripts/docs_status.py`、`scripts/generate-docs-status.py`、`scripts/tests/test_docs_status.py`；健康检查加 `generated_status`（期望三 id，无短路）。**同一提交**：先把 D5 等非 PRD 行搬到分桶区间外（不得「只留 deferred-gaps」——追踪页必须保留一行指向 D 项），再给 plans INDEX、traceability 主表加 `generated-col`，分桶加 `generated` 区间并覆盖成四值机械表；跑一次写入。**验证叙事承接（硬条件）**：现分桶里每一句验证叙事（「D4 已验」「待产品验证」「EH 探针已验」等）在覆盖前逐条落到该 PRD 的「测试或验证证据」列或 `deferred-gaps.md` 对应行，PR 描述附「原句 → 落点」对照表；产品状态列的手写尾巴同法处理。改 DOCS-SPEC §1.2 / §5 / §6 点名两处例外；规则 11 补「状态列禁止手改」；**同步改 DOCUMENTATION 规则 10a 第 2 步**（§1.5）。合入后在 test-baseline-ci 的 `docs-health` job 追加 `generate-docs-status.py --check` 与单测调用 | 单测全绿；健康检查 0 error；故意改一个状态单元格 → 失败；删光三处标记 → 失败；改回后通过；分桶无验证分组；D5 在区间外仍可从 traceability 到达；对照表每一句都有落点 |
| ~~S2~~ | 并入 S1（见 §2.6 说明）。下文 S2 字样一律读作 S1 | — |
| **S3 glossary + 维护规则** | **等** stream-timeline §6 的 glossary 条目先入表。glossary 写入 §3.1–§3.2（含「只约束本稿之后新写正文；存量豁免」）；同一提交把本稿 §3.2 改成指针；DOCUMENTATION 规则 3a 清单加「生成列与源一致」；规则 10 加四份账边界（链到本方案或一小节）；规则 3c 注明「表内产品 / 方案状态枚举改靠脚本，叙述过时仍手扫」；doc-style-guide 加对外可读指针。**不重写** 10a 第 2 步 | 三份规则文有链；不复制对照表正文 |
| **S4 status 停止复述** | 按 §1.3 改 `status.md`：Current Session / Next / Blockers 去掉 plan·PRD·D 项枚举复述，改链接。不把延期表搬进 status | `status.md` ≤ 200；读一遍即可知道「去哪看状态」而不是「这里抄了一份」 |
| **S5 归档标准入规则 7** | 把 §5 标准写进 DOCUMENTATION 规则 7 补则（或短链本方案 §5）。**本波不移动文件** | 规则可执行；`dev/archive/INDEX.md` 仍可为空 |

### 4.1 与同批方案的顺序（签收裁定）

| 对方 | 关系 | 处理 |
|:-----|:-----|:-----|
| [test-baseline-ci](test-baseline-ci.md) `docs-health` job | 本方案唯一机器调用方 | 该 job 先只跑 `check-docs-health.py`；S1 合入后同 PR 追加 `--check` 与单测。本方案不自建 workflow |
| [prd-008-engine-e2e](prd-008-engine-e2e.md) E6 | E6 要改 `traceability.md` PRD-008 行与 `requirements.md` 状态行 | 若 S1 已合入：E6 只手改 requirements 状态行 + 证据列，然后跑 `generate-docs-status.py`；若 S1 未合入：E6 手改，S1 落地时以 requirements 为源覆盖。两边不互等 |
| test-baseline-ci 切片 5 | 改 `plans/INDEX.md` 摘要 / m7 §2 | 只碰摘要列与正文，不碰状态列；S1 前后都合法 |
| [conversation-stream-timeline](conversation-stream-timeline.md) §6 glossary 条目 | 与 S3 同写 `docs/glossary.md` | stream-timeline 的条目（帧源 / lease 等）**先**入表；S3 之后再加约束段与对照表。S3 不得重排或改写既有条目 |
| [m7-gap-closeout](m7-gap-closeout.md) GC-1b 收口 | 改 traceability 规格 / 证据列 | 与生成列无重叠，自由 |

知识层改口（规则 3c，S1/S3 时检索）：`DOCS-SPEC`「不覆写人工索引」、`DOCUMENTATION` 规则 11「手动更新 INDEX」、规则 10a 旧第 2 步「更新 traceability.md」、`docs/INDEX.md` 若仍写「本文件为人工维护」——全局 INDEX 仍人工，只需避免读者以为 **plans INDEX 状态列**或 **traceability 产品状态列**也必须手改。

## 5. 归档候选标准（本波只定标准）

同时满足再移入 `dev/archive/`（规则 7：改 `status: archived`，在 [archive/INDEX.md](../archive/INDEX.md) 登记原路径、日期、取代者）：

1. **已有取代者**：另一篇是该主题的 SSOT，本篇不再被 traceability「系统/架构规格」或「实施方案」列引用，或引用已改为取代者。
2. **过程已结束**：时间盒日志 / spike / 并行看板，决策或事实已吸进 `docs/systems/`、`docs/architecture/` 或已签收 plan，本篇只剩过程流水。
3. **不是实施记录本身**：`dev/plans/` 里已 `implemented` 的方案**默认不归档**——它们是完成线。归档的是「纯过程」：重复的审查日志、已被矩阵取代的草案、已被系统文档吸收且 INDEX 仍指旧 spike 的对照页。
4. **证据目录不归档进 `dev/archive/` 当「过时文」**：`dev/progress/*-evidence/` 随 D 项走，不因「过程多」而搬。

本波**不**搬家。读过但**未**达到「明确过时且已有完整取代」的篇目，仅作后续评估，不列入本波交付：

| 篇目 | 为何还不动 |
|------|------------|
| [spike-t1-t3-code-facts.md](../../docs/reference/code-oss-b2/spike-t1-t3-code-facts.md) | B2 INDEX 仍把它标进改造前读顺序；事实已部分进入 `parts-and-grid` / M0 plan，但本页仍是 spike 对照入口 |
| [eh-surface-notes.md](../../docs/reference/code-oss-b2/eh-surface-notes.md) | 原则草案；矩阵在 [eh-surface-matrix.md](../../docs/reference/code-oss-b2/eh-surface-matrix.md)，二者尚未宣告合并 |
| [review-docs-loop.md](../progress/review-docs-loop.md) | 仍是现行 15 分钟循环日志，不是历史包 |
| M0–M5 各 plan | 实施记录，traceability 在链 |

禁止以「Markdown 太多」为由整目录搬迁。

## 6. 验收

| 项 | 通过标准 |
|----|----------|
| status ≤ 200 | 健康检查现有 `check_status_md_line_limit` 仍为 error；S4 后正文不再复述四写枚举 |
| 生成区与手写区分离 | 两处 `generated-col`、一处 `generated:start/end`；引言与非状态列可手改且检查不因手改摘要 / 证据列而红。单测证明摘要列 / 表外引言 byte-stable |
| 标记必在 | 三 id 必在；删光标记红；无零标记短路 |
| 健康检查抓住漂移，且有人调 | §2.5 六条单测入仓并在 `docs-health` job 里跑；默认 `python3 scripts/check-docs-health.py`（无 `--strict-*`）即对漂移失败；`docs-health` job 未合入前不得称「门禁」 |
| 单一真相 | 改 plan `frontmatter.status` 而不跑脚本 → 红；跑脚本后 INDEX 状态列对齐。改 requirements「状态」行后跑脚本（10a 第 2 步）同理。分桶无验证分组 |
| 验证叙事不丢 | S1 PR 附「分桶原句 → 证据列 / D 项落点」对照表，逐句可查；D5 仍可从 traceability 到达 |
| 对外可读 | glossary 有约束 + 第二张表；S3 后 §3.2 只剩指针；只约束本稿之后新写正文；本稿正文不使用未定义旧称 |
| 历史保留 | `dev/plans/` 篇数不因本方案减少；`archive/` 本波可不新增行 |

## 7. 实施时改的路径（本稿不改）

S1：`scripts/docs_status.py`、`scripts/generate-docs-status.py`、`scripts/tests/test_docs_status.py`（必带）、`scripts/check-docs-health.py`、`dev/plans/INDEX.md`、`docs/product/traceability.md`、`docs/DOCS-SPEC.md`、`docs/DOCUMENTATION.md`（规则 10a 第 2 步 + 规则 11 一句）、`dev/progress/deferred-gaps.md`（承接验证叙事时）；合入后 `.github/workflows/` 里 test-baseline-ci 的 `docs-health` job 追加两条命令。  
S3：`docs/glossary.md`、`docs/DOCUMENTATION.md`（3a / 10 / 3c，不重写 10a 第 2 步）、`docs/guides/doc-style-guide.md`、本稿 §3.2（改指针）。  
S4：`dev/progress/status.md`。  
S5：`docs/DOCUMENTATION.md` 规则 7。  

不改 `docs/product/requirements.md` 需求语义；不改其它 plan 正文；不 `git commit`（除非用户另指令）。

## 审查记录（规则 16）

**2026-09-04 第一轮：** 只读审查。**Approve with changes**（1 Critical + 5 Important）。`status` 保持 `draft`。处理：

| 意见 | 处理 |
|------|------|
| C1 说「不推翻 10a」却把 traceability 产品状态列改成生成区，第 2 步合同未改 | 从「不推翻」列表去掉「10a 整条不动」。新增 §1.5：本稿实施时同步改 10a 第 2 步——改 requirements 状态行之后跑 `generate-docs-status.py`；traceability 只手写规格 / 方案 / 证据列。S2 同一提交落点；禁止再写「不推翻 10a」却改生成区 |
| I1 S1 未断言摘要列 / 表外引言不被写入改掉 | §2.5 第 4 条：摘要列 / 表外引言 byte-stable 夹具 |
| I2 分桶改四值后验证分组去向不明；D5 可能被覆盖丢掉 | §2.2 / §2.3 / S2：验证分组不再存在，读者看证据列和 deferred-gaps；D5 等非 PRD 行先搬到区间外再覆盖 |
| I3 术语约束像要立刻扫完全库 | §3.1：只约束本稿之后新写正文；存量豁免到另波；对外闭集 = glossary ∪ §3.2 |
| I4 S1 零标记短路若接通后仍在，删光标记会绿 | §2.6 / S1 / S2：短路只活在接通前；S2 钉死三 id；删光要红；S1 夹具第 5 条覆盖「非空期望闭集 + 删光」 |
| I5 产品状态行解析未钉死多 token / 抽不到 | §2.2 `prd-id`：只取第一个闭集 token；抽不到或多个不同值 → error |

**2026-09-05 第二轮（对抗性，Cursor CLI · grok-4.6，结论 Reject）→ 复核改入后签收：**

| 意见 | 复核 | 处理 |
|------|------|------|
| C1「忘跑则红」无生产调用方：`check-docs-health.py` 不在 package.json / gulp / workflows；同批 CI 稿也不收文档命令 | 属实 | 文首「机器调用方」裁定：唯一调用方是 test-baseline-ci 的 `docs-health` job（已回写该方案）；未合入前不得称门禁。§4.1、§6 |
| C2 S1 可空转 PASS：期望闭集空 + 零标记短路 + 测试可「手跑」 | 属实 | 合并 S1/S2 为一次合入；§2.6 删短路、闭集从第一天非空；§2.5 单测必须入仓且在 CI 跑，加 HEAD 真实节夹具 |
| C3 分桶验收把删信息定义成绿；D5 允许从追踪页消失 | 属实 | S1 硬条件：每句验证叙事逐条落证据列或 D 项，PR 附对照表；D5 必须仍可从 traceability 到达；§6 增「验证叙事不丢」 |
| I1 触发数字与 HEAD 不符（201/54/46；「约 85」无出处） | 属实（209 / 56 / 43） | 触发段改数；删「约 85」；§1.3 行数改 43 |
| I2 解析夹具不覆盖 HEAD：`## 待验证说明` 含 `implemented`、PRD-011 依赖行含三 token、DOCS-SPEC 示例无粗体 | 属实 | §2.2：节边界到下一个任意级标题、只读第一条状态行、粗体可无；§2.5 第 6 条 HEAD 夹具 |
| I3 与 prd-008 E6 / test-baseline 切片 5 / stream-timeline glossary 缺顺序 | 属实 | §4.1 顺序表；S3 等 stream-timeline 条目先入表 |
| I4 术语闭集双写（glossary ∪ §3.2，S3 又把表写入 glossary） | 属实 | §0 / §3.1 / §3.2 / S3 / §6：S3 后 §3.2 改指针，唯一源 glossary |
| Minor S1/S2 拆交可删、脚本可合一 | 采纳前者 | S1/S2 合并；`docs_status.py` 保留为可 import 模块（健康检查与写入脚本共用一套比较函数，是 §2.5 的硬要求） |
| Minor plan `frontmatter.status` 无枚举校验 | 采纳 | §2.4 增：`frontmatter.status` 不在 DOCS-SPEC 闭集 → error |

**签收裁定：** 本方案的价值全部系于「有机器调它」。实施顺序：S1（含接通）→ S3（等 stream-timeline glossary）→ S4 → S5；`docs-health` job 由 test-baseline-ci 先落，S1 合入后追加命令。
