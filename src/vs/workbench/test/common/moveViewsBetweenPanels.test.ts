/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { planMoveViewsBetweenPanels, MoveViewsBetweenPanelsStep } from '../../common/moveViewsBetweenPanels.js';

suite('moveViewsBetweenPanels', () => {

	function assertSteps(actual: readonly MoveViewsBetweenPanelsStep[], expected: readonly MoveViewsBetweenPanelsStep[]): void {
		assert.deepStrictEqual(actual, expected);
	}

	test('source [a,b], active a — panel destination', () => {
		assertSteps(
			planMoveViewsBetweenPanels(['a', 'b'], 'a', true),
			[
				{ type: 'move', id: 'a' },
				{ type: 'move', id: 'b' },
				{ type: 'showPart', part: 'panel' },
				{ type: 'open', id: 'a', preserveFocus: true },
			],
		);
	});

	test('source [a,b], active a — auxiliaryBar destination', () => {
		assertSteps(
			planMoveViewsBetweenPanels(['a', 'b'], 'a', false),
			[
				{ type: 'move', id: 'a' },
				{ type: 'move', id: 'b' },
				{ type: 'showPart', part: 'auxiliaryBar' },
				{ type: 'open', id: 'a', preserveFocus: true },
			],
		);
	});

	test('source [a], active a — open even when target side state is irrelevant to planner', () => {
		assertSteps(
			planMoveViewsBetweenPanels(['a'], 'a', true),
			[
				{ type: 'move', id: 'a' },
				{ type: 'showPart', part: 'panel' },
				{ type: 'open', id: 'a', preserveFocus: true },
			],
		);
	});

	test('empty source — no steps even if activeId is set', () => {
		assertSteps(planMoveViewsBetweenPanels([], 'a', true), []);
		assertSteps(planMoveViewsBetweenPanels([], undefined, false), []);
	});

	test('source [a,b], active undefined — moves and showPart only', () => {
		assertSteps(
			planMoveViewsBetweenPanels(['a', 'b'], undefined, true),
			[
				{ type: 'move', id: 'a' },
				{ type: 'move', id: 'b' },
				{ type: 'showPart', part: 'panel' },
			],
		);
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
