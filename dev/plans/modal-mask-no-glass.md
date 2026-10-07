---
title: "对话框与引导页遮罩去掉背景模糊"
type: plan
status: draft
phase: N/A
updated: 2026-10-05
summary: "去模糊代码已落，但默认浅色主题的对话框遮罩因 widget.shadow 为透明而没有半透明底色；需独立遮罩色和目视验证。方案仍 draft，不升 PRD-028。"
---

# 对话框与引导页遮罩去掉背景模糊

2026-10-05：去模糊改动已落入 `dialog.css` 与 `variationA.css`，但只读补审发现对话框遮罩在默认浅色主题下透明；本稿仍 `draft`，不升 PRD-028。

系统规格：[UI 设计原则与规范](../../docs/architecture/cross-cutting/ui-design-principles.md) 原则六与 §9。需求：[PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度) 验收 7。

## 合同

- 两处遮罩的实施前基线分别是 `blur(4px)` 与 `blur(8px)`；当前 `dialog.css` 的 `.monaco-dialog-modal-block.dimmed`、`variationA.css` 的 `.onboarding-a-overlay` 已去掉 `backdrop-filter` 与 `-webkit-backdrop-filter`。
- 遮罩必须有半透明底色：引导页沿用 `rgba(0, 0, 0, 0.4)`。对话框改用独立的半透明遮罩色，例如 `rgba(0, 0, 0, 0.45)`；不得复用 `--vscode-widget-shadow`，因为默认 UniverseAgentStudio Light 继承的 `widget.shadow` 是 `#00000000`，`var()` 回退值不会生效。浅色、深色和高对比主题都要实际核对。
- 对话框 `.monaco-dialog-box` 的 `box-shadow: var(--vscode-shadow-xl)` 与引导卡 `.onboarding-a-card` 的投影保留。原则六允许浮层投影。
- 不改圆角、描边、字号、动效。对话框 `cornerRadius-large` 的 12px 回退，以及引导卡写死的 12px 圆角，不在本刀。
- `src/vs/workbench/contrib/conversation/` 不改。图示浮层与子代理浮层的 `backdrop-filter` 留在原处。
- 不升 PRD-028。本稿保持 `draft`（实施前审查曾缺失；本次追审发现问题，仍无产品目视签收）。

## 不做

- 不改 Conversation 透镜、阅读面、Composer 圆角与投影、发送钮尺寸。
- 不改 Agents 窗口追问卡（已另案落地）。
- 不改 Preview 类别条、活流回合 join、会话订阅。
- 不顺手收表外圆角（手机壳 16px、账号条 14px 等）。

## 验证

- 更新 `src/vs/workbench/test/node/modalMaskGlassScan.test.ts`：去掉注释后，上述两份 CSS 不再出现 `backdrop-filter`；对话框遮罩不再引用 `--vscode-widget-shadow`，两处半透明 `background` 与卡片投影仍在。测试应验证默认浅色主题实际 `widget.shadow` 值，不能只匹配 CSS 字符串。
- 按 [UI 设计原则与规范 §8](../../docs/architecture/cross-cutting/ui-design-principles.md#8-审查与验证) 目视检查浅色、深色、键盘与窄宽；至少保存浅色和深色遮罩截图，确认背景被压暗、对话内容与焦点仍可辨。
- 命令：`scripts/test.sh --grep "modal mask has no backdrop-filter"`。

## 只读审查与改稿

实施前未完成规则 16 的独立审查；2026-10-05 的独立只读追审发现默认浅色主题遮罩透明（Critical）、基线描述过时及缺少视觉验收（Important）。上文已将修复与验证写入合同；追审不能追溯补成实施前门禁。对话框回退圆角注释与 token 档位、引导卡阴影写死为 Minor，不在本刀。稿不标成可签收。
