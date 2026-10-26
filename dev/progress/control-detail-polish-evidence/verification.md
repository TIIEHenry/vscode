---
title: "控件细节精修验证"
type: reference
status: accepted
phase: M7
updated: 2026-10-27
summary: "四CSS精修；四主题16组基本控件、8组本地工具栏、4组禁用ActionBar通过；保留运行基线和fixture边界。"
---

# 控件细节精修验证

对应[方案](../../plans/control-detail-polish.md)。规则16方案C0/I1（Back hidden）已改；实施独立复读C0/I1（HC缺active token）后补foreground回退，最终C0/I0/M0。

## 范围与结果

| 验证 | 结果 |
|---|---|
| UniverseAgentStudio Light / Dark、Dark High Contrast / Light High Contrast | 四主题通过 |
| Navigator筛选框输入、Tab/Shift+Tab焦点、清除 | 描边可辨，清除钮内缩4px，清除后为空 |
| Sources选中标签 hover + mouse-down | 浅深色与HC均有不同按压底，原selected合同保持 |
| Connection / Engine Back | 1440宽窗隐藏且零占位；700窄窗24高/1px键盘焦点；hover、focus+active均有反馈；返回后隐藏 |
| Sources本地工具栏（1440 / 1024） | 8组；22×22命中区、16图标；宽区清除钮20×20、输入右内衬28px、不越界；窄区原换行/停靠保持；筛选/清除可用 |
| 禁用ActionBar | 四主题禁用项aria-disabled=true，hover/按压不恢复颜色、底色或透明度 |

原始测量：[matrix.json](matrix.json)、[toolbar.json](toolbar.json)、[disabled.json](disabled.json)。截图本地在 `.build/control-detail-polish/`，含四主题Navigator、按压Back、1440/1024工具栏；父与非作者reviewer已查看代表截图。此记录不签全仓UI或引擎业务。

## 身份与限制

- [after-manifest.json](after-manifest.json)记录四个源CSS和实际out逐字SHA一致；本轮只刷新这四个CSS，没有编译或改写TS/JS。三个相关宿主JS前后hash见[runtime-js.json](runtime-js.json)。运行沿用工作区既有JS，不代表其他未提交TS的运行验收。
- 空白临时profile使用launch skill，默认编辑器，独立Xvfb :117，未使用日常profile；未启动引擎。窗口本身默认自动连接了已有本机引擎，基础矩阵发生在此背景下；父未提交消息、确认权限或执行引擎业务动作。补验前仅断开测试窗口连接，不停止既有引擎。
- Sources因session保留engine工作根，工具栏补验显式采用本地根数据fixture：临时替换运行时AgentSessionContext.prototype.getSessionWorkDir，指向本轮临时workspace，触发已有session事件。渲染、Explorer、筛选、Toolbar均为正式组件，未覆盖CSS/DOM结构，验证后恢复方法并通知。禁用态采用正式ActionBar+disabled Action挂到同作用域的测试容器，验证后dispose并移除；不声称已有业务动作自然进入该禁用态。
- Matrix脚本使用实际键盘及鼠标；截图按压后mouse-up未始终触发click，返回动作再由显式click核验。第一轮导航处于详情态导致隐藏行点击超时，改脚本先返回导航；此为脚本前置状态修正，不计产品失败。
- 定向stylelint命令exit0，但报告45处既有未知自定义变量及78条token建议；与HEAD四CSS基线诊断数量/变量集合一致，无新增，不称无告警。
- 全工作区docs health曾被其他会话未索引方案阻断；本主题暂存树导出docs/dev/scripts/.github后检查：Errors 0、generated_status 0，通过；局部导出不用于判定源码/子模块链接完整性。全工作区仍有其他会话未索引的subscription-recovery-closeout.md，未改其文件。没有全量构建或无关测试。

## 可重复命令

Node使用仓库.nvmrc指定版本；本轮样式检查：

```bash
npm run stylelint -- src/vs/workbench/contrib/sources/browser/media/sourcesTabs.css src/vs/workbench/contrib/conversation/browser/media/conversationSessionsInlineFilter.css src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css src/vs/workbench/contrib/conversation/browser/media/connectionPreferencesPane.css
python3 scripts/check-docs-health.py
```

本轮隔离Electron进程组与Xvfb已清理，临时探测脚本已删除，截图与测量证据保留。

启动继续遵循[壳冒烟](../../../docs/guides/shell-smoke-verification.md)，本地临时脚本不作为新的长期启动入口。CSS逐文件刷新只用于此次局部验证，不覆盖其他WIP产物。

## 只读 Agent 箭头补修（2026-10-27）

默认编辑器实际绑定失败状态下，`Session unavailable` 已是只读 span，容器仍继承 select 的伪元素箭头，覆盖文字末尾。CSS 仅在 Agent 容器包含该只读 span 时隐藏箭头，真实选择器保留。初始真实窗口的 before/after 测量确认三个控件尺寸不变，截图在主工位 `.build/visual-review-20261027/`。

后续仅向既有 out CSS 添加这条规则，重载后的原会话叶没有恢复；四主题补验因此使用实际 Conversation 宿主下相同类名/结构的 DOM fixture，不宣称完整会话业务或窄叶键盘验收。未注入样式。每个主题重载，隔离 profile 设置 `workbench.colorTheme` 并关闭 `window.autoDetectHighContrast`，避免外部高对比检测覆盖手工选择；不更改产品默认值。700/420px 两种 fixture 容器宽度共8项均通过：只读 Agent 箭头 none，真实 Model select 箭头 block。见 [测量](readonly-agent-chevron-matrix.json)，以及 [浅色](readonly-agent-vs.png)、[深色](readonly-agent-vs-dark.png)、[深色高对比](readonly-agent-hc-black.png)、[浅色高对比](readonly-agent-hc-light.png)。深色与两种高对比窄图已人工复看。

本修复不改变设计合同，不需要新增方案；独立 worktree 整文件提交，避免主工位同文件其他 WIP。没有全量编译或 TS 修改。完整会话状态矩阵仍属于持续视觉审查范围。
