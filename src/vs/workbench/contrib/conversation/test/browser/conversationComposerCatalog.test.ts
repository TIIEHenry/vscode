/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { conversationLensDockNoAgent, conversationLensDockNoModel } from '../../browser/conversationLensDockStrings.js';
import { composerAgentSelectOptions, composerModelIds, composerModelSelectOptions, composerToolNames } from '../../browser/conversationComposerCatalog.js';
import { loadConnectedComposerCatalogs, type IConversationLensComposerHost } from '../../browser/conversationLensComposer.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

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
		const models = [
			{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' },
			{ id: 'fallback', type: 'chat', enabled: false, level: 1, provider: 'p', modelId: '' },
		] as const;
		const options = composerModelSelectOptions(models);
		assert.deepStrictEqual(options, [
			{ text: conversationLensDockNoModel },
			{ text: 'gpt-test' },
			{ text: 'fallback' },
		]);
		assert.deepStrictEqual(composerModelIds(models), ['', 'gpt-test', 'fallback']);
	});

	test('tool names drop blanks', () => {
		assert.deepStrictEqual(composerToolNames([
			{ name: 'bash' },
			{ name: '  ' },
			{ name: 'read' },
		]), ['bash', 'read']);
	});

	test('loadConnectedComposerCatalogs keeps No agent / No model / empty tools when three hooks reject', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const agentOptions: { text: string }[] = [{ text: conversationLensDockNoAgent }];
		const modelOptions: { text: string }[] = [{ text: conversationLensDockNoModel }];
		const host = {
			composerCatalogGeneration: 1,
			catalogToolNames: [] as string[],
			catalogModelIds: [''] as string[],
			modelSelectedIndex: 0,
			agentSelectBox: {
				setOptions(options: { text: string }[]) {
					agentOptions.splice(0, agentOptions.length, ...options);
				},
			},
			modelSelectBox: {
				setOptions(options: { text: string }[]) {
					modelOptions.splice(0, modelOptions.length, ...options);
				},
			},
			getBoundSessionId: () => 's1',
			getSessionConfig: () => ({ agentIndex: 0 }),
			uaConnection: createConversationConnectionTestStub({
				getCapabilitySnapshot: () => ({
					...capabilities,
					agentProfiles: { support: 'SUPPORTED' },
					tools: { support: 'SUPPORTED' },
					models: { support: 'SUPPORTED' },
				}),
				listAgentProfiles: async () => {
					throw new Error('listAgentProfiles exploded');
				},
				listModels: async () => {
					throw new Error('listModels exploded');
				},
				listTools: async () => {
					throw new Error('listTools exploded');
				},
			}),
		} as unknown as IConversationLensComposerHost;

		await loadConnectedComposerCatalogs(host, 1);

		assert.deepStrictEqual(agentOptions, [{ text: conversationLensDockNoAgent }]);
		assert.deepStrictEqual(modelOptions, [{ text: conversationLensDockNoModel }]);
		assert.deepStrictEqual([...host.catalogToolNames], []);
		assert.deepStrictEqual([...host.catalogModelIds], ['']);
		assert.ok(!agentOptions.some(option => option.text === 'Coder'));
		assert.ok(!modelOptions.some(option => option.text === 'gpt-test'));
	});
});
