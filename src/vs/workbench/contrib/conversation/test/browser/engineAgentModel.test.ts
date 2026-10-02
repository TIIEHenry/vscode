/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	agentProfileModelFieldsEqual,
	agentProfileModelFieldsFromInput,
	agentProfileModelFieldsFromProfile,
	agentProfileModelSaveUpdates,
	formatAgentProfileMaxTurns,
	parseAgentProfileMaxTurns,
} from '../../browser/engineAgentModel.js';

suite('engineAgentModel', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('profile fields trim strings and drop non-positive max turns', () => {
		assert.deepStrictEqual(agentProfileModelFieldsFromProfile({
			model: '  gpt  ',
			modelType: ' chat ',
			maxTurns: 4,
		}), { model: 'gpt', modelType: 'chat', maxTurns: 4 });
		assert.deepStrictEqual(agentProfileModelFieldsFromProfile({
			model: ' ',
			modelType: '',
			maxTurns: 0,
		}), {});
	});

	test('empty max turns is the engine default; zero and non-integers are rejected', () => {
		assert.deepStrictEqual(parseAgentProfileMaxTurns(''), { ok: true });
		assert.deepStrictEqual(parseAgentProfileMaxTurns('  '), { ok: true });
		assert.deepStrictEqual(parseAgentProfileMaxTurns('12'), { ok: true, maxTurns: 12 });
		assert.strictEqual(parseAgentProfileMaxTurns('0').ok, false);
		assert.strictEqual(parseAgentProfileMaxTurns('-3').ok, false);
		assert.strictEqual(parseAgentProfileMaxTurns('1.5').ok, false);
		assert.strictEqual(parseAgentProfileMaxTurns('2147483648').ok, false);
		assert.strictEqual(formatAgentProfileMaxTurns(undefined), '');
		assert.strictEqual(formatAgentProfileMaxTurns(0), '');
		assert.strictEqual(formatAgentProfileMaxTurns(8), '8');
	});

	test('input fields omit blanks and compare by the three proto values', () => {
		const parsed = agentProfileModelFieldsFromInput({ model: ' gpt ', modelType: '', maxTurns: '' });
		assert.strictEqual(parsed.ok, true);
		if (parsed.ok) {
			assert.deepStrictEqual(parsed.fields, { model: 'gpt' });
			assert.strictEqual(agentProfileModelFieldsEqual(parsed.fields, { model: 'gpt' }), true);
			assert.strictEqual(agentProfileModelFieldsEqual(parsed.fields, { model: 'gpt', maxTurns: 1 }), false);
		}
		assert.strictEqual(agentProfileModelFieldsFromInput({ model: '', modelType: '', maxTurns: '0' }).ok, false);
	});

	test('model save patch clears omitted fields and does not rewrite a prompt that starts with ---', () => {
		const profile = {
			id: 'demo',
			name: 'Demo',
			systemPrompt: '---\nsummary: inside\n---\nactual body',
			summary: 'line\n2',
			model: 'old',
			modelType: 'chat',
			maxTurns: 4,
		};
		const parsed = agentProfileModelFieldsFromInput({ model: ' new ', modelType: ' ', maxTurns: '' });
		assert.strictEqual(parsed.ok, true);
		if (!parsed.ok) {
			return;
		}
		const updates = agentProfileModelSaveUpdates(parsed.fields);
		const saved = { ...profile, ...updates };
		assert.strictEqual(saved.systemPrompt, profile.systemPrompt);
		assert.strictEqual(saved.summary, 'line\n2');
		assert.strictEqual(saved.model, 'new');
		assert.strictEqual(saved.modelType, undefined);
		assert.strictEqual(Object.prototype.hasOwnProperty.call(saved, 'modelType'), true);
		assert.strictEqual(saved.maxTurns, undefined);
		assert.strictEqual(Object.prototype.hasOwnProperty.call(saved, 'maxTurns'), true);
		assert.strictEqual('systemPrompt' in updates, false);
		assert.strictEqual('summary' in updates, false);
	});
});
