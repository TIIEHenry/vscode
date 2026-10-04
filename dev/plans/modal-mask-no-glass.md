---
title: "对话框与引导页遮罩去掉背景模糊"
type: plan
status: draft
phase: N/A
updated: 2026-10-05
summary: "PRD-028 原则六：对话框与引导页的模态遮罩去掉 backdrop-filter，半透明底色和浮层投影保留。不改对话图示与子代理浮层。不升 PRD-028。"
---

# 对话框与引导页遮罩去掉背景模糊

系统规格：[UI 设计原则与规范](../../docs/architecture/cross-cutting/ui-design-principles.md) 原则六与 §9。需求：[PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度) 验收 7。

## 合同

- 只删这两处遮罩上的 `backdrop-filter` 与 `-webkit-backdrop-filter`：
  - `src/vs/base/browser/ui/dialog/dialog.css` 的 `.monaco-dialog-modal-block.dimmed`（现为 `blur(4px)`）
  - `src/vs/workbench/contrib/welcomeOnboarding/browser/media/variationA.css` 的 `.onboarding-a-overlay`（现为 `blur(8px)`）
- 遮罩继续用半透明底色：对话框保留 `var(--vscode-widget-shadow, rgba(0, 0, 0, 0.45))`；引导页保留 `rgba(0, 0, 0, 0.4)`。
- 对话框 `.monaco-dialog-box` 的 `box-shadow: var(--vscode-shadow-xl)` 与引导卡 `.onboarding-a-card` 的投影保留。原则六允许浮层投影。
- 不改圆角、描边、字号、动效。对话框 `cornerRadius-large` 的 12px 回退，以及引导卡写死的 12px 圆角，不在本刀。
- `src/vs/workbench/contrib/conversation/` 不改。图示浮层与子代理浮层的 `backdrop-filter` 留在原处。
- 不升 PRD-028。本稿保持 `draft`（本轮没有独立只读审查、无产品目视签收）。

## 不做

- 不改 Conversation 透镜、阅读面、Composer 圆角与投影、发送钮尺寸。
- 不改 Agents 窗口追问卡（已另案落地）。
- 不改 Preview 类别条、活流回合 join、会话订阅。
- 不顺手收表外圆角（手机壳 16px、账号条 14px 等）。

## 验证

- 新增 `src/vs/workbench/test/node/modalMaskGlassScan.test.ts`：去掉注释后，上述两份 CSS 不再出现 `backdrop-filter`；两处遮罩的半透明 `background` 仍在；对话框与引导卡的 `box-shadow` 仍在。
- 命令：`scripts/test.sh --grep "modal mask has no backdrop-filter"`。

## 只读自审

本轮没有 Cursor Task 审查器。写稿时对照当前 HEAD 与原则六自审。Critical 与 Important 已写进合同。稿不标成可签收。

- Critical：无。全仓非对话域的 `backdrop-filter` 只剩这两处。
- Important：只删模糊，不删半透明底，不删浮层投影。对话域两处浮层本刀禁止改。
- Minor：对话框回退圆角注释写 12px，token `cornerRadius.large` 是 8px，模态档 `xLarge` 才是 12px。引导卡阴影写死。都不在本刀。
