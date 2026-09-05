/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	canSendEngineTriggerListRequest,
	ENGINE_TRIGGER_LIST_EMPTY_COPY,
	engineTriggerListRequest,
	formatEngineTriggerListLabel,
} from '../../browser/engineTriggerList.js';

suite('Engine trigger list bind', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ListTriggers gate is connected + hook; empty ids stay empty', () => {
		assert.strictEqual(canSendEngineTriggerListRequest(false, true), false);
		assert.strictEqual(canSendEngineTriggerListRequest(true, false), false);
		assert.strictEqual(canSendEngineTriggerListRequest(true, true), true);
		assert.deepStrictEqual(engineTriggerListRequest(), {
			scope: '',
			scopeId: '',
			typeFilter: '',
		});
	});

	test('trigger label keeps empty fields as-is', () => {
		assert.strictEqual(formatEngineTriggerListLabel({
			triggerId: '',
			name: '',
			type: '',
			promptTemplate: '',
			enabled: false,
			pauseReason: '',
			target: { kind: 'unspecified' },
			intervalMs: 0,
			cronExpression: '',
			runAtEpochMs: 0,
		}), ' —  — ');
		assert.strictEqual(formatEngineTriggerListLabel({
			triggerId: '  trig  ',
			name: '  Nightly  ',
			type: 'cron',
			promptTemplate: '',
			enabled: false,
			pauseReason: '',
			target: { kind: 'self' },
			intervalMs: 0,
			cronExpression: '',
			runAtEpochMs: 0,
		}), '  Nightly   — cron —   trig  ');
		assert.strictEqual(ENGINE_TRIGGER_LIST_EMPTY_COPY, 'No triggers.');
	});
});
