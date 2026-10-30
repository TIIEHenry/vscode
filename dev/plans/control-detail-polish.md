---
title: "默认编辑器控件细节精修"
type: plan
status: implemented
phase: M7
updated: 2026-10-26
summary: "Sources 工具栏与页签、Navigator 筛选和首选项返回按钮的尺寸、对齐及状态一致性；避开既有 Composer WIP。"
---

# 默认编辑器控件细节精修
状态：已完成。
覆盖需求：PRD-028。


## 目标与边界

用户要求并行优化控件细节。遵循 [UI 规范](../../docs/architecture/cross-cutting/ui-design-principles.md) 与 PRD-028，收敛安静、紧凑、一致的控件语言，不新增产品行为。仅默认编辑器窗口，排除 Agents Window、上游组件、大布局以及既有 Composer / SessionBar WIP。

## 实施切片

- A：`sourcesTabs.css`：工具栏图标保持16，命中区由20对齐22栏高；输入内清除钮从16扩为20但留在22高输入内。保留 selected 的 toolbar.hoverBackground 合同；修复 active 被 hover / selected 覆盖的问题。禁用动作不出现可操作的悬停或按压反馈，遵循 ActionBar 的既有禁用语义。
- A：`conversationSessionsInlineFilter.css`：聚焦时既有透明描边改用 focusBorder，保留高对比焦点；清除钮内缩到输入边界内，使用中性 hover / active，保持文字预留与清除操作。
- B：`enginePreferencesPane.css` 与 `connectionPreferencesPane.css`：同角色 Back 按钮统一控件档24高、水平8内衬、居中、小圆角与1px键盘焦点；保留文字及窄窗返回逻辑；居中display只放在:not([hidden])，不得覆盖HTML hidden。移除焦点态额外背景，只用焦点描边；active排在hover后，保留焦点与按压并存。补Engine的monaco-reduce-motion返回按钮覆盖。只调这些选择器，不扩大到整个表单和状态卡。

新增样式使用已有尺寸与主题 token；不新增全局 token，不改文字、RPC、数据或布局拓扑。视觉状态按默认、hover、hover+active、focus-visible+active、disabled及高对比核对；禁用仅在组件已有语义时处理。

## 验证

- 父唯一负责运行环境与产物，不覆盖既有未提交的 TS/JS。CSS采用逐文件源/产物一致检查，只刷新本轮四个CSS。
- 在隔离默认编辑器窗口读取真实控件 computed style、盒模型、焦点；浅色/深色与两种高对比主题，1440和1024窗口，相关面板窄宽检查文字、图标与清除钮不越界。
- 实际点击Sources标签、输入并清除Navigator筛选、键盘聚焦、首选项窄窗返回，核对原行为与焦点。截图在 `.build/control-detail-polish/`；验证摘要落行动层，说明当前运行JS基线与既有WIP不一致的边界。
- 运行四个CSS的stylelint与文档健康检查；纯CSS局部精修不新增镜像断言测试、不全量编译。若现有行为测试或实拍发现回归，修后补针对性验证。

## 审查与进度

- [x] 规则16只读审查及改稿：reviewer C0/I1；hidden可见性风险已改稿，焦点/按压组合与减少动效一并纳入。
- [x] A Sources / Navigator实施
- [x] B 首选项返回控件实施
- [x] 浅深色/高对比/窄宽/键盘验证与独立复读：16+8+4组；[验证与fixture边界](../progress/control-detail-polish-evidence/verification.md)。
- [x] 文档与范围提交：本主题CSS、方案、证据与并行看板；其他WIP保留。

方案先独立提交；实现与本主题验证/行动层一并提交。保留所有其他WIP，不升PRD-028整体状态。
