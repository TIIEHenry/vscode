---
title: "外部对话界面密度对照"
type: reference
status: accepted
phase: N/A
updated: 2026-10-16
summary: "2026-10-15 对 Cursor、ChatGPT、Claude 的只读对照：可参考的是表面分层、单行元信息、过程折成动作行、长文档走现有 Preview、Composer 用芯片；行高与字号仍以 UI 设计原则为准，不改 PRD-028。2026-10-16 用户签收为只读记录"
---

# 外部对话界面密度对照

> 导航：[横切索引](../architecture/cross-cutting/INDEX.md) · 合同：[UI 设计原则与规范](../architecture/cross-cutting/ui-design-principles.md) · [PRD-028](../product/requirements.md#prd-028-视觉语言与信息密度)。  
> 本文记录 2026-10-15 的外部对照。密度上限、token、焦点、阴影和空态以 UI 设计原则为准。本文不新增验收，不放宽行高，不复制三家的商标、图标和像素级外观。  
> **签收（2026-10-16，用户）**：作为只读对照签收。不改 PRD-028，不放宽行高与字号，不把进行中空稿一行的实施（[向 Cursor 靠齐](../../dev/plans/cursor-visual-alignment.md) 的 S5，方案仍 draft）标成完成。

三家值得参考的是**信息怎么排**。Cursor 的 Agent 列表、ChatGPT 的未登录界面、Claude 的产品页，都把一屏留给事实和正文；它们的侧栏行高、空态标题和 Composer 高度比本仓上限松，不照搬。

## 1. 取样

| 来源 | 2026-10-15 看到的 | 没有看到的 |
|------|-------------------|------------|
| [Cursor 产品页](https://cursor.com/product) | Agent 列表、工具行、计划选项、检查点、模式与模型芯片的可访问结构 | 桌面 IDE 里登录后的真实会话。桌面观感仍以 2026-10-11 截图对照为准，见 [向 Cursor 靠齐](../../dev/plans/cursor-visual-alignment.md) |
| [Cursor 更新日志](https://cursor.com/changelog) | 截至 2026-10-13：Origin 应用市场、本机 Agent 的远程查看、Projects | 更新日志页没有给出桌面壳的尺寸 |
| [ChatGPT](https://chatgpt.com/) | 未登录、视口宽 500px：画布、空态标题、Composer、侧栏行 | 登录后的线程、代码块和思考行。视口没有拉到桌面宽度，下面的行高是该视口里组件自己的盒子 |
| [claude.com](https://claude.com/) 与 [产品概览](https://claude.com/product/overview) | 暖纸底、衬线大标题、对话与结果分列、Artifacts | [claude.ai](https://claude.ai/) 登录页被拦截，应用内线程未打开 |
| Claude 应用暗色取样 | 第三方对 claude.ai 的公开拆解：暖灰阶梯、抬起的 Composer、侧栏行高。与 claude.com 的暖纸底一致，不是 Anthropic 发布的 token 表 | 未在本机复测应用内样式 |

中文视频检索只回到界面设置教程，没有可引用的密度讨论，不写入结论。

## 2. 三家把一屏用在哪

### Cursor

产品页上的 Agent 列表按 Today / This Week 分组。一行里是标题、状态、仓库、文件数和增删行数（例如 `+26 −12`）。工具调用是一个动词加一个对象：Searched、Read、Grepped、Ran。并行的子任务一行一个，模型名跟在后面。计划是编号选项，旁边是 Skip / Continue，下面一条 “Add follow-up”。模式和模型是 Composer 上的两枚芯片，`@` 写在句子里。检查点是标题加相对时间。

[Projects](https://cursor.com/changelog/projects)（2026-09-10）从左侧导航进入。协调者负责计划和把任务交给执行中的 Agent，自己不写代码；做完的结果回到用户面前检查。

2026-10-11 对本仓窗口和 Cursor Agents 窗口的截图对照里，Cursor 侧栏已是 22px 行，时间在行右。表面三档大约是 `#F3F3F3` / `#F8F8F8` / `#FCFCFC`。用户回合是通栏、像输入框的卡片。会话进行中、稿子为空时 Composer 收成一行。身份是 Composer 下方的弱化文字。详见对照方案，不在这里复写整表。

### ChatGPT

未登录画布是 `rgb(252, 252, 252)`，字色 `rgb(13, 13, 13)`，字体是系统无衬线。空态标题 “What are you working on?” 为 24px、行高 28px、字重 400。Composer 是白底胶囊：高 48px、圆角 28px、边框 0.5px `rgba(0, 0, 0, 0.1)`、投影 `0 4px 16px rgba(0, 0, 0, 0.05)`，输入 16px / 24px。侧栏行高 44px、字号 16px、圆角 16px、纵向内边距 8px；入口是 Images、Plugins、Deep research。

公开的界面讨论把 ChatGPT 的可读性放在角色靠版式分开、思考收成一行、代码块只有一条语言与复制头。这些结构可以参考。44px 行、16px 正文和 48px 胶囊高于本仓上限。

### Claude

claude.com 底色 `rgb(250, 249, 245)`，字色 `rgb(20, 20, 19)`，界面字体是 Anthropic Sans。首页标题用 Anthropic Serif，约 70px、字重 330。产品概览标题约 72px、字重 500。产品页把界面写成两步：对话，然后结果。Artifacts、幻灯片和文档在对话旁边打开，用户可以直接改，也可以用一句话让它改。权限是先给出计划，再等确认。2026-10-15 产品页注明 Claude Cowork 并入 Claude，向 Pro 与 Max 推出。

第三方暗色取样：画布 `#1f1f1e`，抬起的表面 `#2c2c2a`，Composer 圆角 20、深色不投影，侧栏行大约 33px、字号 14–15px，强调色只给新建和发送。空态留白很大。暖纸底、衬线大标题和 33px 行不进入本仓；「对话留在中间、成品到旁边」进入本仓已有的 Preview。

## 3. 收进现有密度的做法

| 观察到的结构 | 本仓落点 |
|--------------|----------|
| 区域靠明度分档，分隔用发丝线 | [原则一](../architecture/cross-cutting/ui-design-principles.md#原则一中性底色强调色克制)、[原则五](../architecture/cross-cutting/ui-design-principles.md#原则五以面代线)。底色保持中性灰阶。Claude 的暖纸色和陶土色停在对方品牌 |
| 列表一行装完：名称在左，时间、计数、增删行数在右 | [原则三](../architecture/cross-cutting/ui-design-principles.md#原则三ide-级密度) 与 [§4](../architecture/cross-cutting/ui-design-principles.md#4-密度上限)。导航 22px，目录与弹出层 24px。ChatGPT 的 44px 行、Claude 取样的约 33px 行都收到这个上限 |
| 工具、终端、搜索是「动词 + 对象 + 状态」，输出放进展开 | [过程折](../glossary.md)（[PRD-013](../product/requirements.md#prd-013-conversation-过程折)）。对话默认收起，轨迹默认展开 |
| 长文档和可编辑成品离开时间线，时间线只留可点的入口 | [Preview](../glossary.md) 与 [PRD-027](../product/requirements.md#prd-027-preview-类别隔离与-surface-宿主)。Planning、Artifacts 尚无内容来源时仍是空态，不为此新开一块面板 |
| 用户回合是通栏输入卡片，助手回合是左对齐正文 | 已由 2026-10-11 签收，见原则 §5.1 与 [PRD-028](../product/requirements.md#prd-028-视觉语言与信息密度)。不改回右对齐气泡，也不加 YOU / AGENT 标签 |
| 模式、模型、附件是可关掉的芯片；进行中的空稿收成一行 | [Composer](../glossary.md) 控件集仍按 [PRD-015](../product/requirements.md#prd-015-conversation-空会话与输入面)：Tools、Permission、空会话才有的 Agent、Model、放大输入、发送。PreFirst 草稿至少两行。进行中空稿收成一行已写在 [PRD-028](../product/requirements.md#prd-028-视觉语言与信息密度) 的 2026-10-11 选定和原则 §5.2。条件细则沿用 [向 Cursor 靠齐](../../dev/plans/cursor-visual-alignment.md) 的 S5，方案仍 draft，尚未实施；本文不新增验收，也不提前实施 |
| 计划选项下面有一条 “Add follow-up” | 它在 Skip / Continue 下面，不是 Composer 上方、与已发送回合分开的队列。本仓未发跟进仍是 [MessageQueue](../glossary.md) / [Inbox](../glossary.md)，外观仍按原则：无数据的芯片不画框。这次没有打开登录后的线程，不把这条当成队列取样 |
| 身份用弱化文字，复制和重试在悬停或焦点时出现；接受、拒绝、停止留在明处 | 原则三。SessionBar 上的常驻控件以 [PRD-002](../product/requirements.md#prd-002-会话上下文) 与透镜规格为准，不按 Cursor 收成只剩一个 `…` |

对照里值得继续用现有合同核对的三处：过程折保持动词行，对话默认收起、轨迹默认展开；长文档走 [PRD-027](../product/requirements.md#prd-027-preview-类别隔离与-surface-宿主) 的 Preview，图示卡仍按 [PRD-014](../product/requirements.md#prd-014-conversation-图示卡visualize) 留在时间线；进行中空稿收成一行已写在 PRD-028 的 2026-10-11 选定和原则 §5.2，S5 只是尚未实施的条件细则，方案仍 draft，这篇对照不提前实施。侧栏行高、暖色、大标题和胶囊输入保持现有上限。

## 4. 量到的尺寸

上限的定义在 UI 设计原则 §4。下表只记外部尺寸，避免以后把它们当成目标。

| 表面 | 2026-10-15 量到的 | 本仓上限 |
|------|-------------------|----------|
| ChatGPT 侧栏行 | 44px，16px 字，圆角 16px | 导航 22px；目录与弹出层 24px；行悬停圆角 4px |
| ChatGPT Composer | 高 48px，圆角 28px，输入 16px | 控件 24px，底栏不高于 28px（原则 §4）。草稿字号维持 [Composer 规格](../systems/conversation/composer-and-inbox.md) 的 16px、行高 24px，本表不另写 13px 上限。圆角沿用已定的 20px |
| ChatGPT 空态标题 | 24px，字重 400 | 空态一行说明；页面标题少用，18px / 600 |
| Claude 营销标题 | Serif，约 70–72px；底色暖纸 | 系统字体栈；底色中性灰阶 |
| Claude 应用侧栏取样 | 约 33px，14–15px 字 | 收到 22–24px |
| Cursor 产品页 Agent 行 | 标题、状态、增删行数同一行 | 与原则三一致，元信息用 11px 弱化色 |
| 三家 Composer 的抬起方式 | ChatGPT 用胶囊和投影；Claude 暗色取样靠明度、不投影 | 明度分档为主。投影只留给浮层，Composer 的极淡投影是已签收的例外 |

## 5. 相关文档

- 合同：[UI 设计原则与规范](../architecture/cross-cutting/ui-design-principles.md) · [PRD-028](../product/requirements.md#prd-028-视觉语言与信息密度) · [主题与 token](../architecture/cross-cutting/theming.md)
- 表面：[透镜与轨迹](../systems/conversation/lens-and-trajectory.md) · [Composer 与 Inbox](../systems/conversation/composer-and-inbox.md) · [Preview 类别](../systems/workbench/editor-part-tabs.md)
- 方案：[向 Cursor 靠齐](../../dev/plans/cursor-visual-alignment.md) · [阅读面](../../dev/plans/conversation-reading-surface.md)
