/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Delayer } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { AGENTS_WINDOW_SETTING_TAG, FEATURE_SETTING_TAG } from '../../common/preferences.js';
import { planSettingsEditFlush } from '../../browser/settingsEditFlush.js';
import { getSettingsSearchSuggestions, isSettingsSearchUpToDate } from '../../browser/settingsEditor2.js';

suite('SettingsEditor2', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	suite('getSettingsSearchSuggestions', () => {
		const chatSuggestion = `@${FEATURE_SETTING_TAG}chat`;
		const searchSuggestion = `@${FEATURE_SETTING_TAG}search`;
		const agentsWindowSuggestion = `@${AGENTS_WINDOW_SETTING_TAG}`;

		test('default Code window omits @feature:chat and keeps @feature:search', () => {
			const suggestions = getSettingsSearchSuggestions(false);
			assert.ok(!suggestions.includes(chatSuggestion), 'default Code window must not suggest @feature:chat');
			assert.ok(suggestions.includes(searchSuggestion), 'default Code window must keep @feature:search');
			assert.ok(!suggestions.includes(agentsWindowSuggestion));
		});

		test('Agents window keeps @feature:chat and @feature:search', () => {
			const suggestions = getSettingsSearchSuggestions(true);
			assert.ok(suggestions.includes(chatSuggestion), 'Agents window must keep @feature:chat');
			assert.ok(suggestions.includes(searchSuggestion), 'Agents window must keep @feature:search');
			assert.ok(suggestions.includes(agentsWindowSuggestion));
		});
	});

	suite('isSettingsSearchUpToDate', () => {
		test('allows focus when search is idle and query matches rendered results', () => {
			assert.strictEqual(isSettingsSearchUpToDate(false, 'font', 'font'), true);
			assert.strictEqual(isSettingsSearchUpToDate(false, '', ''), true);
		});

		test('trims the current search value before comparing', () => {
			assert.strictEqual(isSettingsSearchUpToDate(false, 'font', '  font  '), true);
			assert.strictEqual(isSettingsSearchUpToDate(false, 'font', ' font size '), false);
		});

		test('blocks focus while a debounced search is pending', () => {
			assert.strictEqual(isSettingsSearchUpToDate(true, 'font', 'font'), false);
			assert.strictEqual(isSettingsSearchUpToDate(true, '', ''), false);
		});

		test('blocks focus when rendered results are stale', () => {
			assert.strictEqual(isSettingsSearchUpToDate(false, 'font', 'theme'), false);
			assert.strictEqual(isSettingsSearchUpToDate(false, 'font', ''), false);
			assert.strictEqual(isSettingsSearchUpToDate(false, undefined, ''), false);
		});

		test('uses Delayer.isTriggered() return value (regression #327360)', async () => {
			const delayer = store.add(new Delayer<void>(1000));

			assert.strictEqual(delayer.isTriggered(), false);
			assert.strictEqual(isSettingsSearchUpToDate(delayer.isTriggered(), 'font', 'font'), true);

			const pending = assert.rejects(delayer.trigger(() => { }));
			assert.strictEqual(delayer.isTriggered(), true);
			assert.strictEqual(isSettingsSearchUpToDate(delayer.isTriggered(), 'font', 'font'), false);

			delayer.cancel();
			await pending;
			assert.strictEqual(delayer.isTriggered(), false);
			assert.strictEqual(isSettingsSearchUpToDate(delayer.isTriggered(), 'font', 'font'), true);
		});
	});

	suite('planSettingsEditFlush', () => {
		const fontSize = { key: 'editor.fontSize', value: 16, languageFilter: undefined, scope: undefined };

		test('switching settings flushes the pending edit instead of dropping it', () => {
			const plan = planSettingsEditFlush(fontSize, 'editor.tabSize', false);
			assert.strictEqual(plan.flushPrevious, fontSize);
			assert.strictEqual(plan.flushPrevious?.key, 'editor.fontSize');
			assert.strictEqual(plan.flushPrevious?.value, 16);
			assert.strictEqual(plan.writeIncomingNow, true);
		});

		test('another edit of the same setting stays on the delayer', () => {
			const plan = planSettingsEditFlush(fontSize, 'editor.fontSize', false);
			assert.strictEqual(plan.flushPrevious, null);
			assert.strictEqual(plan.writeIncomingNow, false);
		});

		test('manual reset writes immediately even when nothing is pending', () => {
			const plan = planSettingsEditFlush(null, 'editor.fontSize', true);
			assert.strictEqual(plan.flushPrevious, null);
			assert.strictEqual(plan.writeIncomingNow, true);
		});

		test('manual reset of a different setting still flushes the previous edit', () => {
			const plan = planSettingsEditFlush(
				{ key: 'editor.fontSize', value: 18, languageFilter: 'markdown', scope: undefined },
				'editor.tabSize',
				true,
			);
			assert.strictEqual(plan.flushPrevious?.key, 'editor.fontSize');
			assert.strictEqual(plan.flushPrevious?.value, 18);
			assert.strictEqual(plan.flushPrevious?.languageFilter, 'markdown');
			assert.strictEqual(plan.writeIncomingNow, true);
		});
	});
});
