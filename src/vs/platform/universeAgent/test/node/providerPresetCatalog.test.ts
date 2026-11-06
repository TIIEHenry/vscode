/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { loadProviderPresetCatalog } from '../../node/providerPresetCatalog.js';

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
