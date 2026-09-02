/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applyToolEnablementChange, isToolEnabledInProfile } from '../../browser/engineToolProfile.js';

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
});
