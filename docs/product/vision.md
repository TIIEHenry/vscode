---
title: "Agent IDE 产品愿景"
type: concept
status: accepted
phase: N/A
updated: 2026-09-02
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

1. **主流程在对话，配套可完整。** 拒绝「编辑器为中心、Agent 当聊天插件」。允许临时隐藏 Conversation；允许配套区域包含完整编辑器能力（Preview），但编辑器不是主工作区。
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
- 不把 Diff 做成第二个主工作区：Diff 归属已裁决（[PRD-009](requirements.md#prd-009-changes-与-diff)：默认 Preview，可移对话窗口 / 底部），但对话窗口里的 Diff 只是审阅面，不是可编辑文件的编辑器
- 不改产品名称与图标，不接扩展市场分发
- 不把 Agents Window 升为生产入口
- 不重写 M0–M4 历史方案，不把实现文件表搬进本目录
