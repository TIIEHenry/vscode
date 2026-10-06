/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { computePanelPartContentDimension, PanelPartLayoutPosition } from '../../common/panelPartLayout.js';

suite('panelPartLayout', () => {

	const allocatedWidth = 200;
	const allocatedHeight = 100;

	const positions: PanelPartLayoutPosition[] = ['left', 'right', 'top', 'bottom'];

	test('classic single border with main editor visible', () => {
		const floating = false;
		const editorVisible = true;

		for (const position of positions) {
			const { width, height } = computePanelPartContentDimension(position, allocatedWidth, allocatedHeight, floating, editorVisible);
			switch (position) {
				case 'left':
				case 'right':
					assert.strictEqual(width, 199);
					assert.strictEqual(height, 100);
					break;
				case 'top':
					assert.strictEqual(width, 200);
					assert.strictEqual(height, 99);
					break;
				case 'bottom':
					assert.strictEqual(width, 200);
					assert.strictEqual(height, 100);
					break;
			}
		}
	});

	test('floating panels enabled', () => {
		const floating = true;
		const editorVisible = true;

		for (const position of positions) {
			const { width, height } = computePanelPartContentDimension(position, allocatedWidth, allocatedHeight, floating, editorVisible);
			switch (position) {
				case 'left':
					assert.strictEqual(width, 200);
					assert.strictEqual(height, 100);
					break;
				case 'right':
					assert.strictEqual(width, 199);
					assert.strictEqual(height, 100);
					break;
				case 'top':
					assert.strictEqual(width, 200);
					assert.strictEqual(height, 99);
					break;
				case 'bottom':
					assert.strictEqual(width, 200);
					assert.strictEqual(height, 100);
					break;
			}
		}
	});

	test('main editor area not visible', () => {
		const floating = false;
		const editorVisible = false;

		for (const position of positions) {
			const { width, height } = computePanelPartContentDimension(position, allocatedWidth, allocatedHeight, floating, editorVisible);
			switch (position) {
				case 'left':
					assert.strictEqual(width, 200);
					assert.strictEqual(height, 100);
					break;
				case 'right':
					assert.strictEqual(width, 199);
					assert.strictEqual(height, 100);
					break;
				case 'top':
					assert.strictEqual(width, 200);
					assert.strictEqual(height, 99);
					break;
				case 'bottom':
					assert.strictEqual(width, 200);
					assert.strictEqual(height, 100);
					break;
			}
		}
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
