/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Delayer } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationTarget } from '../../../../../platform/configuration/common/configuration.js';
import { AGENTS_WINDOW_SETTING_TAG, FEATURE_SETTING_TAG } from '../../common/preferences.js';
import { planSettingsEditContextChange, planSettingsEditFlush, planSettingsEditLeave, SettingsEditContext, shouldClearPendingSettingsEdit } from '../../browser/settingsEditFlush.js';
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
		const userContext: SettingsEditContext = {
			languageFilter: undefined,
			configurationTarget: ConfigurationTarget.USER_LOCAL,
			resource: undefined,
		};
		const fontSize = { key: 'editor.fontSize', value: 16, scope: undefined, ...userContext };

		test('switching settings flushes the pending edit instead of dropping it', () => {
			const plan = planSettingsEditFlush(fontSize, 'editor.tabSize', false, userContext);
			assert.strictEqual(plan.flushPrevious, fontSize);
			assert.strictEqual(plan.flushPrevious?.key, 'editor.fontSize');
			assert.strictEqual(plan.flushPrevious?.value, 16);
			assert.strictEqual(plan.writeIncomingNow, true);
		});

		test('another edit of the same setting stays on the delayer', () => {
			const plan = planSettingsEditFlush(fontSize, 'editor.fontSize', false, userContext);
			assert.strictEqual(plan.flushPrevious, null);
			assert.strictEqual(plan.writeIncomingNow, false);
		});

		test('manual reset writes immediately even when nothing is pending', () => {
			const plan = planSettingsEditFlush(null, 'editor.fontSize', true, userContext);
			assert.strictEqual(plan.flushPrevious, null);
			assert.strictEqual(plan.writeIncomingNow, true);
		});

		test('manual reset of a different setting still flushes the previous edit', () => {
			const plan = planSettingsEditFlush(
				{ key: 'editor.fontSize', value: 18, scope: undefined, ...userContext, languageFilter: 'markdown' },
				'editor.tabSize',
				true,
				userContext,
			);
			assert.strictEqual(plan.flushPrevious?.key, 'editor.fontSize');
			assert.strictEqual(plan.flushPrevious?.value, 18);
			assert.strictEqual(plan.flushPrevious?.languageFilter, 'markdown');
			assert.strictEqual(plan.writeIncomingNow, true);
		});

		test('same setting under another language filter flushes the pending edit', () => {
			const pending = { ...fontSize, languageFilter: 'markdown' };
			const plan = planSettingsEditFlush(pending, 'editor.fontSize', false, {
				...userContext,
				languageFilter: 'typescript',
			});
			assert.strictEqual(plan.flushPrevious, pending);
			assert.strictEqual(plan.flushPrevious?.languageFilter, 'markdown');
			assert.strictEqual(plan.writeIncomingNow, true);
		});

		test('same setting on another settings target flushes the pending edit', () => {
			const plan = planSettingsEditFlush(fontSize, 'editor.fontSize', false, {
				...userContext,
				configurationTarget: ConfigurationTarget.WORKSPACE,
			});
			assert.strictEqual(plan.flushPrevious, fontSize);
			assert.strictEqual(plan.flushPrevious?.configurationTarget, ConfigurationTarget.USER_LOCAL);
			assert.strictEqual(plan.writeIncomingNow, true);
		});

		test('same setting under another folder flushes the pending edit', () => {
			const pending = {
				...fontSize,
				configurationTarget: ConfigurationTarget.WORKSPACE_FOLDER,
				resource: 'file:///workspace/a',
			};
			const plan = planSettingsEditFlush(pending, 'editor.fontSize', false, {
				languageFilter: undefined,
				configurationTarget: ConfigurationTarget.WORKSPACE_FOLDER,
				resource: 'file:///workspace/b',
			});
			assert.strictEqual(plan.flushPrevious, pending);
			assert.strictEqual(plan.writeIncomingNow, true);
		});

		test('changing the language filter flushes the edit made under the previous filter', () => {
			const pending = { ...fontSize, languageFilter: 'markdown' };
			const flushed = planSettingsEditContextChange(pending, {
				...userContext,
				languageFilter: 'typescript',
			});
			assert.strictEqual(flushed, pending);
			assert.strictEqual(planSettingsEditContextChange(null, userContext), null);
		});

		test('a search that keeps the language filter and target does not flush', () => {
			assert.strictEqual(planSettingsEditContextChange(fontSize, userContext), null);
		});

		test('switching the settings target flushes the edit made on the previous target', () => {
			const flushed = planSettingsEditContextChange(fontSize, {
				...userContext,
				configurationTarget: ConfigurationTarget.WORKSPACE,
			});
			assert.strictEqual(flushed?.configurationTarget, ConfigurationTarget.USER_LOCAL);
		});

		test('leaving the editor writes the pending edit before delayers are cancelled', () => {
			const pending = { ...fontSize, languageFilter: 'markdown', configurationTarget: ConfigurationTarget.WORKSPACE };
			const plan = planSettingsEditLeave(pending);
			assert.strictEqual(plan.write, pending);
			assert.strictEqual(plan.write?.languageFilter, 'markdown');
			assert.strictEqual(plan.write?.configurationTarget, ConfigurationTarget.WORKSPACE);
			assert.strictEqual(plan.cancelDelayers, true);
		});

		test('leaving with nothing pending still cancels delayers', () => {
			const plan = planSettingsEditLeave(null);
			assert.strictEqual(plan.write, null);
			assert.strictEqual(plan.cancelDelayers, true);
		});

		test('a finished write does not clear a newer edit of the same value under another language or target', () => {
			const pending = { ...fontSize, languageFilter: 'markdown' };
			assert.strictEqual(shouldClearPendingSettingsEdit(pending, {
				key: 'editor.fontSize',
				value: 16,
				languageFilter: 'typescript',
				configurationTarget: ConfigurationTarget.USER_LOCAL,
				resource: undefined,
			}), false);
			assert.strictEqual(shouldClearPendingSettingsEdit(fontSize, {
				key: fontSize.key,
				value: fontSize.value,
				languageFilter: undefined,
				configurationTarget: ConfigurationTarget.WORKSPACE,
				resource: undefined,
			}), false);
		});

		test('a finished write clears the pending edit only when key, value, language, and target match', () => {
			assert.strictEqual(shouldClearPendingSettingsEdit(fontSize, {
				key: fontSize.key,
				value: fontSize.value,
				languageFilter: fontSize.languageFilter,
				configurationTarget: fontSize.configurationTarget,
				resource: fontSize.resource,
			}), true);
			assert.strictEqual(shouldClearPendingSettingsEdit(null, {
				key: fontSize.key,
				value: fontSize.value,
				languageFilter: undefined,
				configurationTarget: ConfigurationTarget.USER_LOCAL,
				resource: undefined,
			}), false);
		});
	});
});
