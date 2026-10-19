/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	mergeHarnessDrafts,
	parseCcSwitchProviderRow,
	parseClaudeSettings,
	parseCodexFiles,
	parseGrokConfig,
	parseHermesConfig,
	parseOpenClawConfig,
	toHarnessProviderPreview,
} from '../../common/harnessProviderImport.js';

const SECRET = 'sk-test-secret-should-not-leak';

suite('harnessProviderImport', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('preview strips the api key and keeps the model id', () => {
		const draft = parseClaudeSettings(JSON.stringify({
			env: {
				ANTHROPIC_AUTH_TOKEN: SECRET,
				ANTHROPIC_BASE_URL: 'https://example.test/anthropic/',
				ANTHROPIC_MODEL: 'claude-sonnet',
			},
		}));
		assert.ok(draft);
		assert.strictEqual(draft.apiKey, SECRET);
		assert.strictEqual(draft.baseUrl, 'https://example.test/anthropic');
		assert.strictEqual(draft.providerId, 'harness:claude:current');
		const preview = toHarnessProviderPreview(draft);
		assert.strictEqual(preview.hasApiKey, true);
		assert.deepStrictEqual(preview.modelIds, ['claude-sonnet']);
		assert.ok(!JSON.stringify(preview).includes(SECRET));
	});

	test('skips a provider that has neither a key nor a base URL', () => {
		assert.strictEqual(parseClaudeSettings(JSON.stringify({ env: { ANTHROPIC_MODEL: 'claude-sonnet' } })), undefined);
		assert.strictEqual(parseCodexFiles('model = "gpt"\n', JSON.stringify({ tokens: { access_token: SECRET } })), undefined);
	});

	test('cc-switch row covers the live file for the same app', () => {
		const fromDb = parseCcSwitchProviderRow({
			id: 'row 1',
			appType: 'claude',
			name: 'Work',
			settingsConfig: JSON.stringify({
				env: { ANTHROPIC_API_KEY: SECRET, ANTHROPIC_BASE_URL: 'https://cc.example' },
			}),
		});
		const live = parseClaudeSettings(JSON.stringify({
			env: { ANTHROPIC_AUTH_TOKEN: 'live-secret', ANTHROPIC_BASE_URL: 'https://live.example' },
		}));
		assert.ok(fromDb);
		assert.ok(live);
		const merged = mergeHarnessDrafts([fromDb], [live]);
		assert.deepStrictEqual(merged.map(item => item.providerId), [fromDb.providerId]);
		assert.ok(!JSON.stringify(merged.map(toHarnessProviderPreview)).includes(SECRET));
		assert.ok(!JSON.stringify(merged.map(toHarnessProviderPreview)).includes('live-secret'));
	});

	test('unknown cc-switch apps and grok env-only keys are skipped', () => {
		assert.strictEqual(parseCcSwitchProviderRow({
			id: 'x',
			appType: 'not-a-harness',
			name: 'Nope',
			settingsConfig: JSON.stringify({ apiKey: SECRET }),
		}), undefined);
		assert.strictEqual(parseGrokConfig('[models]\ndefault = "main"\n\n[model.main]\napi_backend = "anthropic"\nmodel = "grok"\n'), undefined);
		const grok = parseGrokConfig('[models]\ndefault = "main"\n\n[model.main]\napi_key = "inline-key"\nbase_url = "https://grok.example/"\napi_backend = "anthropic"\nmodel = "grok-2"\n');
		assert.ok(grok);
		assert.strictEqual(grok.protocol, 'anthropic');
		assert.strictEqual(grok.apiKey, 'inline-key');
		assert.strictEqual(grok.baseUrl, 'https://grok.example');
		assert.deepStrictEqual(grok.models.map(model => model.modelId), ['grok-2']);
	});

	test('openclaw and hermes read their own credential fields', () => {
		const openclaw = parseOpenClawConfig(JSON.stringify({
			models: {
				providers: {
					remote: {
						baseUrl: 'https://claw.example',
						apiKey: SECRET,
						api: 'anthropic-messages',
						models: [{ id: 'claw-1' }],
					},
				},
			},
		}));
		assert.strictEqual(openclaw.length, 1);
		assert.strictEqual(openclaw[0].protocol, 'anthropic');
		assert.strictEqual(openclaw[0].providerId, 'harness:openclaw:remote');
		const hermes = parseHermesConfig([
			'custom_providers:',
			'  local:',
			'    base_url: https://hermes.example',
			`    api_key: ${SECRET}`,
			'    model: hermes-1',
		].join('\n'));
		assert.strictEqual(hermes.length, 1);
		assert.strictEqual(hermes[0].baseUrl, 'https://hermes.example');
		assert.strictEqual(hermes[0].models[0]?.modelId, 'hermes-1');
		assert.ok(!JSON.stringify(toHarnessProviderPreview(hermes[0])).includes(SECRET));
	});
});
