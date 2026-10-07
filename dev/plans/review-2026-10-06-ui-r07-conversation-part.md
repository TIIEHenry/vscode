---
title: "审查 r07：conversation-part"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "会话条 :empty 时隐藏钮压住网格右上角；编辑器宿主 0×0 时跳过 layout 且无补调度，尺寸会残留错位。"
---

# 审查 r07：conversation-part

范围：`src/vs/workbench/browser/parts/conversation`。已对照 [review-2026-10-06.md](review-2026-10-06.md) 与 [r08 conversation](review-2026-10-06-r08-conversation.md)（数据/草稿类，非本壳 UI）；下列条目不与之重复。

## r07-1 中

- 症状：Part 级会话条为空（`:empty` 被收起）时，「隐藏对话」钮叠在会话窗格网格右上角，挡住该处标签/按钮，点到的是隐藏而不是底下控件。
- 位置：`src/vs/workbench/browser/parts/conversation/media/conversationPart.css` 第 27–36、72–78、176–179 行；控件挂载见 `conversationPart.ts` 第 122–137 行、`partRegionHideControl.ts` 第 21–41 行。
- 引用：

```27:36:src/vs/workbench/browser/parts/conversation/media/conversationPart.css
.monaco-workbench .part.conversation > .conversation-region-chrome {
	position: absolute;
	top: 0;
	right: 0;
	z-index: 5;
	height: 35px;
	display: flex;
	align-items: center;
	pointer-events: none;
}
```

```72:78:src/vs/workbench/browser/parts/conversation/media/conversationPart.css
.monaco-workbench .part.conversation > .content > .conversation-session-bar:empty {
	display: none;
	height: 0;
	min-height: 0;
	max-height: 0;
	padding: 0;
}
```

```176:179:src/vs/workbench/browser/parts/conversation/media/conversationPart.css
.monaco-workbench .part.conversation .conversation-session-window-grid {
	flex: 1;
	min-height: 0;
}
```

非空会话条才有 `padding-right: 32px`（同文件第 80–88 行）给隐藏钮留位；条被 `:empty` 收起后网格没有对应右垫，而 `title-actions` 仍是 `pointer-events: auto`（第 38–40 行；`ua-common.css` 第 127–136 行同样保持可点）。
- 为什么是问题：隐藏控件与内容区抢同一块右上角命中区，属于重叠 / 点不到，不是纯样式偏好。
- 方向：`:empty` 时给网格（或 content）保留与隐藏钮同宽的右/上安全区，或把隐藏钮移入仍占位的条带。

## r07-2 中

- 症状：会话叶里的编辑器区在首次或某次窗口 layout 时仍按创建时的占位尺寸画，宿主已有实宽高后出现裁切、错位或空白，直到下一次外层再调 `ConversationPart.layout`（例如拖拽分割条、改窗口）才纠正。
- 位置：`src/vs/workbench/browser/parts/conversation/conversationPart.ts` 第 145–175 行。
- 引用：

```155:175:src/vs/workbench/browser/parts/conversation/conversationPart.ts
	/**
	 * Subsequent chrome / window resize must re-layout each conversation
	 * editor part from its leaf host size. Creation already does a first
	 * layout (host size or 800×600); skipping 0×0 hosts avoids clobbering
	 * that first layout when flex has not assigned pixels yet.
	 */
	private layoutConversationEditorParts(): void {
		for (const part of this.editorGroupsService.conversationParts) {
			const host = part.getContainer();
			if (!host) {
				continue;
			}

			const hostWidth = host.clientWidth;
			const hostHeight = host.clientHeight;
			if (hostWidth <= 0 || hostHeight <= 0) {
				continue;
			}

			part.layout(hostWidth, hostHeight, 0, 0);
		}
	}
```

`layout`（第 145–153 行）在可见时同步调用上述方法；注释已写明 flex 尚未分到像素时宿主会是 0×0，此时故意跳过以免写成 0×0，但本文件没有 `rAF` / `ResizeObserver` / 再次 `layout` 的补调度。跳过之后仍停留在创建时的 800×600（或上一次非零尺寸）。
- 为什么是问题：壳自己承认存在「本次 layout 时宿主还是 0×0」的窗口，却只靠以后偶然的外层 layout 纠正，用户会先看到编辑器与叶宿主尺寸不一致（裁切或错位）。
- 方向：宿主从 0×0 变为正尺寸时补一次 `part.layout`（下一帧或 ResizeObserver），不要只 skip。
