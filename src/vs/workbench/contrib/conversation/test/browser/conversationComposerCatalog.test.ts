/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { conversationLensDockNoAgent, conversationLensDockNoModel } from '../../browser/conversationLensDockStrings.js';
import { composerAgentSelectOptions, composerModelSelectOptions, composerToolNames } from '../../browser/conversationComposerCatalog.js';

suite('conversationComposerCatalog', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('agent options stay honest-empty then use profile names', () => {
		const options = composerAgentSelectOptions([
			{ id: 'coder', name: 'Coder', source: 'user' },
			{ id: 'empty-name', name: '  ', source: 'project' },
		]);
		assert.deepStrictEqual(options, [
			{ text: conversationLensDockNoAgent },
			{ text: 'Coder' },
			{ text: 'empty-name' },
		]);
	});

	test('model options are display-only labels from engine registry', () => {
		const options = composerModelSelectOptions([
			{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' },
			{ id: 'fallback', type: 'chat', enabled: false, level: 1, provider: 'p', modelId: '' },
		]);
		assert.deepStrictEqual(options, [
			{ text: conversationLensDockNoModel },
			{ text: 'gpt-test' },
			{ text: 'fallback' },
		]);
	});

	test('tool names drop blanks', () => {
		assert.deepStrictEqual(composerToolNames([
			{ name: 'bash' },
			{ name: '  ' },
			{ name: 'read' },
		]), ['bash', 'read']);
	});
});
