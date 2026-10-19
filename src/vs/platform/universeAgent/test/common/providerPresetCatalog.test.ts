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
import { loadProviderPresetCatalog } from '../../node/providerPresetCatalog.js';

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

suite('loadProviderPresetCatalog', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const originalFetch = globalThis.fetch;

	teardown(() => {
		globalThis.fetch = originalFetch;
	});

	test('a failed fetch with no cache keeps builtin presets and flattens the error', async () => {
		globalThis.fetch = async () => {
			throw new Error('network down\nline two');
		};
		const result = await loadProviderPresetCatalog(true);
		assert.strictEqual(result.cloudStatus, 'unavailable');
		assert.strictEqual(result.cloud.length, 0);
		assert.ok(result.builtin.some(preset => preset.id === 'openai'));
		assert.strictEqual(result.cloudError, 'network down line two');
	});

	test('a loaded catalog is cached, reused after a later failure, and dropped on force', async () => {
		const body = JSON.stringify({
			groq: {
				id: 'groq',
				name: 'Groq',
				api: 'https://api.groq.com',
				npm: 'openai',
				env: ['GROQ_API_KEY'],
				models: {},
			},
		});
		globalThis.fetch = async () => new Response(body, { status: 200 });
		const loaded = await loadProviderPresetCatalog(true);
		assert.strictEqual(loaded.cloudStatus, 'loaded');
		assert.strictEqual(loaded.cloudError, undefined);
		assert.ok(loaded.cloud.some(preset => preset.id === 'groq'));
		assert.ok(loaded.builtin.some(preset => preset.id === 'deepseek-anthropic'));

		let fetches = 0;
		globalThis.fetch = async () => {
			fetches++;
			throw new Error('later');
		};
		const cached = await loadProviderPresetCatalog(false);
		assert.strictEqual(fetches, 0);
		assert.ok(cached.cloud.some(preset => preset.id === 'groq'));

		const realNow = Date.now;
		Date.now = () => realNow() + (24 * 60 * 60 * 1000) + 5;
		try {
			const stale = await loadProviderPresetCatalog(false);
			assert.strictEqual(fetches, 1);
			assert.strictEqual(stale.cloudStatus, 'loaded');
			assert.ok(stale.cloud.some(preset => preset.id === 'groq'));
		} finally {
			Date.now = realNow;
		}

		const forced = await loadProviderPresetCatalog(true);
		assert.ok(fetches >= 2);
		assert.strictEqual(forced.cloudStatus, 'unavailable');
		assert.strictEqual(forced.cloud.length, 0);
	});

	test('http errors, an empty object, and invalid JSON stay unavailable without the body', async () => {
		globalThis.fetch = async () => new Response('nope sk-body', { status: 503 });
		const http = await loadProviderPresetCatalog(true);
		assert.ok(http.cloudError?.includes('HTTP 503'));
		assert.ok(!http.cloudError?.includes('sk-body'));

		globalThis.fetch = async () => new Response('{}', { status: 200 });
		const empty = await loadProviderPresetCatalog(true);
		assert.ok(empty.cloudError?.includes('empty'));

		globalThis.fetch = async () => new Response('not-json sk-secret', { status: 200 });
		const invalid = await loadProviderPresetCatalog(true);
		assert.strictEqual(invalid.cloudError, 'cloud catalog is not valid JSON');
		assert.ok(!invalid.cloudError.includes('sk-secret'));
	});
});
