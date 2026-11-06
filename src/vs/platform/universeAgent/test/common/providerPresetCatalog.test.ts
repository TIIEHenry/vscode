/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	builtinProviderPresets,
	inferApiTypeFromCatalogNpm,
	mergeProviderPresets,
	parseModelsDevCatalog,
} from '../../common/providerPresetCatalog.js';

suite('providerPresetCatalog', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('builtin overlays keep declaration order and omit the blank custom row', () => {
		assert.deepStrictEqual(builtinProviderPresets().map(preset => preset.id), [
			'openai',
			'anthropic',
			'gemini',
			'openrouter',
			'deepseek',
			'zhipu',
			'qwen',
			'deepseek-anthropic',
		]);
	});

	test('parse keeps a provider with an API URL or env, drops deprecated models, and skips custom', () => {
		const seeds = parseModelsDevCatalog(JSON.stringify({
			anthropic: {
				id: 'anthropic',
				name: 'Anthropic',
				api: ' https://api.anthropic.com/v1 ',
				npm: '@ai-sdk/anthropic',
				env: ['ANTHROPIC_API_KEY', '  ', 12],
				models: {
					old: { id: 'claude-old', status: 'deprecated', release_date: '2026-01-01' },
					a: { id: 'claude-a', release_date: '2025-01-01' },
					b: { id: 'claude-b', release_date: '2026-02-01' },
					c: { id: 'claude-c', release_date: '2024-06-01' },
					d: { id: 'claude-d', release_date: '2025-06-01' },
					e: { id: 'claude-e', release_date: '2025-03-01' },
					f: { id: 'claude-f', release_date: '2023-01-01' },
				},
			},
			custom: { id: 'custom', name: 'Custom', api: 'https://custom.example' },
			bare: { id: 'bare', name: 'Bare' },
			envonly: { name: 'Env Only', env: ['SOME_KEY'], npm: 'openai' },
			skip: 'not-an-object',
		}));

		const anthropic = seeds.find(seed => seed.id === 'anthropic');
		assert.ok(anthropic);
		assert.strictEqual(anthropic.api, 'https://api.anthropic.com/v1');
		assert.deepStrictEqual(anthropic.env, ['ANTHROPIC_API_KEY']);
		assert.deepStrictEqual(anthropic.modelIds, ['claude-b', 'claude-d', 'claude-e', 'claude-a', 'claude-c']);
		assert.ok(!seeds.some(seed => seed.id === 'custom' || seed.id === 'bare'));
		const envOnly = seeds.find(seed => seed.id === 'envonly');
		assert.strictEqual(envOnly?.name, 'Env Only');
	});

	test('a catalog that is not an object is rejected', () => {
		assert.throws(() => parseModelsDevCatalog('[]'), /not an object/);
		assert.throws(() => parseModelsDevCatalog('null'), /not an object/);
	});

	test('merge fills a matching builtin from the catalog and sends unknown ids to cloud', () => {
		const merged = mergeProviderPresets([
			{
				id: 'anthropic',
				name: 'Anthropic Cloud',
				api: 'https://catalog.anthropic.example',
				npm: '@ai-sdk/anthropic',
				env: ['ANTHROPIC_API_KEY'],
				modelIds: ['claude-from-catalog'],
			},
			{
				id: 'openai',
				name: 'OpenAI',
				api: 'https://override.example/v1',
				npm: '@ai-sdk/anthropic',
				env: ['OPENAI_API_KEY'],
				modelIds: [],
			},
			{
				id: 'groq',
				name: 'Groq',
				api: 'https://api.groq.com',
				npm: '@ai-sdk/openai',
				env: [],
				modelIds: ['llama'],
			},
			{
				id: 'mystery',
				name: 'Mystery',
				api: '',
				npm: '',
				env: ['MYSTERY_KEY'],
				modelIds: [],
			},
		]);

		const anthropic = merged.builtin.find(preset => preset.id === 'anthropic');
		assert.strictEqual(anthropic?.displayName, 'Anthropic Cloud');
		assert.strictEqual(anthropic?.defaultApiBaseUrl, 'https://catalog.anthropic.example');
		assert.strictEqual(anthropic?.defaultProtocol, 'anthropic');
		assert.deepStrictEqual([...(anthropic?.defaultModels ?? [])], ['claude-from-catalog']);
		const openai = merged.builtin.find(preset => preset.id === 'openai');
		assert.strictEqual(openai?.defaultProtocol, 'openai');
		assert.strictEqual(openai?.defaultApiBaseUrl, 'https://override.example/v1');
		assert.ok((openai?.defaultModels.length ?? 0) > 0);
		assert.ok(merged.builtin.some(preset => preset.id === 'deepseek-anthropic'));
		assert.ok(!merged.builtin.some(preset => preset.id === 'custom' || preset.id === 'groq'));
		assert.deepStrictEqual(merged.cloud.map(preset => preset.id), ['groq', 'mystery']);
		assert.strictEqual(merged.cloud.find(preset => preset.id === 'groq')?.defaultProtocol, 'openai');
		assert.strictEqual(merged.cloud.find(preset => preset.id === 'mystery')?.defaultProtocol, '');
		assert.ok(merged.cloud.every(preset => preset.quickPick === false));
	});

	test('npm inference reads anthropic and openai package ids only', () => {
		assert.strictEqual(inferApiTypeFromCatalogNpm('@ai-sdk/anthropic'), 'anthropic');
		assert.strictEqual(inferApiTypeFromCatalogNpm('openai-compatible'), 'openai');
		assert.strictEqual(inferApiTypeFromCatalogNpm(''), '');
		assert.strictEqual(inferApiTypeFromCatalogNpm('@google/genai'), '');
	});
});
