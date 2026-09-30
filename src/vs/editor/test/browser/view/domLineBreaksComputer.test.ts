/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getActiveWindow } from '../../../../base/browser/dom.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { DOMLineBreaksComputerFactory } from '../../../browser/view/domLineBreaksComputer.js';
import { WrappingIndent } from '../../../common/config/editorOptions.js';
import { FontInfo } from '../../../common/config/fontInfo.js';
import { ILineBreaksComputerContext, ModelLineProjectionData } from '../../../common/modelLineProjectionData.js';

function getDomLineBreakData(wrapOnEscapedLineFeeds: boolean, text: string): ModelLineProjectionData | null {
	const fontInfo = new FontInfo({
		pixelRatio: 1,
		fontFamily: 'testFontFamily',
		fontWeight: 'normal',
		fontSize: 14,
		fontFeatureSettings: '',
		fontVariationSettings: '',
		lineHeight: 19,
		letterSpacing: 0,
		isMonospace: true,
		typicalHalfwidthCharacterWidth: 7,
		typicalFullwidthCharacterWidth: 14,
		canUseHalfwidthRightwardsArrow: true,
		spaceWidth: 7,
		middotWidth: 7,
		wsmiddotWidth: 7,
		maxDigitWidth: 7
	}, false);
	const context: ILineBreaksComputerContext = {
		getLineContent() {
			return text;
		},
		getLineInjectedText() {
			return null;
		}
	};
	const factory = DOMLineBreaksComputerFactory.create(getActiveWindow());
	const lineBreaksComputer = factory.createLineBreaksComputer(context, fontInfo, 4, 80, WrappingIndent.None, 'normal', wrapOnEscapedLineFeeds);
	lineBreaksComputer.addRequest(1, null);
	return lineBreaksComputer.finalize()[0];
}

function escapedLineFeedBreakOffset(text: string): number {
	const index = text.indexOf('\\n');
	assert.ok(index >= 0);
	return index + 2;
}

suite('Editor View - DOMLineBreaksComputer', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('wrapOnEscapedLineFeeds: breaks after literal \\n in DOM measurement', () => {
		for (const text of [`'hello\\nworld'`, `"hello\\nworld"`]) {
			const expectedBreak = escapedLineFeedBreakOffset(text);

			const withWrap = getDomLineBreakData(true, text);
			assert.ok(withWrap, `expected line break data when wrap enabled: ${text}`);
			assert.ok(withWrap!.breakOffsets.includes(expectedBreak), `expected break after \\\\n at ${expectedBreak} in ${text}, got ${withWrap!.breakOffsets}`);

			const withoutWrap = getDomLineBreakData(false, text);
			if (withoutWrap) {
				assert.ok(!withoutWrap.breakOffsets.includes(expectedBreak), `expected no break at \\\\n when disabled: ${text}, got ${withoutWrap.breakOffsets}`);
			}
		}
	});
});
