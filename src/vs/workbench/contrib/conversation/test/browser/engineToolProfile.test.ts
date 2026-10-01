/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applyToolEnablementChange, isToolEnabledInProfile, summaryToProfileDetail } from '../../browser/engineToolProfile.js';

suite('engineToolProfile', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('disabledTools mode: tool enabled unless listed', () => {
		assert.strictEqual(isToolEnabledInProfile('read_file', { disabledTools: ['bash'] }), true);
		assert.strictEqual(isToolEnabledInProfile('bash', { disabledTools: ['bash'] }), false);
	});

	test('whitelist mode: tool enabled only when listed', () => {
		assert.strictEqual(isToolEnabledInProfile('read_file', { enabledTools: ['read_file'], whitelistMode: true }), true);
		assert.strictEqual(isToolEnabledInProfile('bash', { enabledTools: ['read_file'], whitelistMode: true }), false);
	});

	test('applyToolEnablementChange writes disabledTools via SaveAgentProfile shape', () => {
		const next = applyToolEnablementChange(
			{ id: 'demo', name: 'Demo', disabledTools: [] },
			'bash',
			false,
		);
		assert.deepStrictEqual(next.disabledTools, ['bash']);
	});

	test('summaryToProfileDetail keeps model fields and drops a non-positive max turns', () => {
		const detail = summaryToProfileDetail({
			id: 'demo',
			name: 'Demo',
			source: 'user',
			model: '  gpt  ',
			modelType: 'chat',
			maxTurns: 6,
			disabledTools: ['bash'],
		});
		assert.strictEqual(detail.model, 'gpt');
		assert.strictEqual(detail.modelType, 'chat');
		assert.strictEqual(detail.maxTurns, 6);
		assert.deepStrictEqual(detail.disabledTools, ['bash']);

		const cleared = summaryToProfileDetail({
			id: 'demo',
			name: 'Demo',
			source: 'user',
			model: ' ',
			maxTurns: 0,
		});
		assert.strictEqual(cleared.model, undefined);
		assert.strictEqual(cleared.maxTurns, undefined);
	});
});
