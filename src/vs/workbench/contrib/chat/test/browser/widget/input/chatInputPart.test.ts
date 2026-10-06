/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from "assert";
import * as dom from "../../../../../../../base/browser/dom.js";
import { IDimension } from "../../../../../../../base/browser/dom.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../base/test/common/utils.js";
import { ChatInputPart, INPUT_EDITOR_MIN_WIDTH } from "../../../../browser/widget/input/chatInputPart.js";

suite("ChatInputPart - layout", () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test("clamps editor width to INPUT_EDITOR_MIN_WIDTH in compact mode when subtraction is negative", () => {
		let laidOutDimension: IDimension | undefined;
		let relayoutCount = 0;
		let toolbarItemsWidth = 100;

		const followupsContainer = dom.$(".followups");
		const contextUsageWidgetContainer = dom.$(".context-usage");

		const part = Object.assign(Object.create(ChatInputPart.prototype), {
			options: { renderStyle: "compact" },
			followupsContainer,
			_inputEditor: {
				getScrollWidth: () => 100,
				getContentHeight: () => 30,
				layout: (dimension: IDimension) => {
					laidOutDimension = dimension;
				},
			},
			inputEditorMaxHeight: 200,
			_maxHeight: undefined,
			inputSideToolbarContainer: undefined,
			executeToolbar: {
				getItemsWidth: () => 0,
				getItemsLength: () => 1,
			},
			inputActionsToolbar: {
				getItemsWidth: () => toolbarItemsWidth,
				getItemsLength: () => 1,
				relayout: () => {
					relayoutCount++;
				},
			},
			contextUsageWidgetContainer,
			previousInputEditorDimension: undefined,
		});

		// Compact padding: 16 (horizontal) + 2 (border) + 12 (inside) = 30.
		// Width 50 -> available width 20.
		// Toolbar width 100 + 12 = 112 -> subtraction = 20 - 112 = -92 < INPUT_EDITOR_MIN_WIDTH (20).
		(part as any)._layout(50);

		assert.strictEqual(relayoutCount, 1, "Toolbar relayout must be called when subtraction < min width");
		assert.strictEqual(laidOutDimension?.width, INPUT_EDITOR_MIN_WIDTH, "Editor width must be clamped to INPUT_EDITOR_MIN_WIDTH");

		// When subtraction is larger than min width:
		// Width 200 -> available width 170.
		// Toolbar width: 30 + 12 = 42 -> subtraction = 170 - 42 = 128 > 20.
		part.previousInputEditorDimension = undefined;
		toolbarItemsWidth = 30;
		(part as any)._layout(200);

		assert.strictEqual(laidOutDimension?.width, 128, "Editor width must equal subtraction result when above min width");
	});
});
