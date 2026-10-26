/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as DOM from '../../../../../base/browser/dom.js';
import { Delayer, timeout } from '../../../../../base/common/async.js';
import { HistoryNavigator } from '../../../../../base/common/history.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationTarget } from '../../../../../platform/configuration/common/configuration.js';
import { AGENTS_WINDOW_SETTING_TAG, FEATURE_SETTING_TAG } from '../../common/preferences.js';
import { planSettingsEditContextChange, planSettingsEditFlush, planSettingsEditLeave, SettingsEditContext, shouldClearPendingSettingsEdit } from '../../browser/settingsEditFlush.js';
import { getSettingsSearchSuggestions, isSettingsSearchUpToDate, isUaClientSettingsView, readNextSettingsSearchHistory } from '../../browser/settingsEditor2.js';
import { AiSearchToggleOutcomeKind, AiSearchToggleVisibilityUpdate, planAiSearchToggle, planAiSearchToggleVisibilityUpdate, shouldShowSettingsClearFiltersLink, stripSettingsSearchFilterTokens } from '../../browser/settingsEditor2Search.js';

suite('SettingsEditor2', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	suite('UA Client responsive scope', () => {
		test('narrow Client chrome fits its controls and restores upstream styles when the scope changes', async () => {
			for (const path of ['../../browser/media/settingsEditor2.css', '../../../conversation/browser/media/uaClientSettingsChrome.css']) {
				const stylesheet = document.createElement('link');
				stylesheet.rel = 'stylesheet';
				stylesheet.href = new URL(path, import.meta.url).href;
				store.add(toDisposable(() => stylesheet.remove()));
				await new Promise<void>((resolve, reject) => {
					stylesheet.onload = () => resolve();
					stylesheet.onerror = () => reject(new Error('Settings stylesheet failed to load'));
					document.head.appendChild(stylesheet);
				});
			}
			const workbench = DOM.append(document.body, DOM.$('.monaco-workbench'));
			store.add(toDisposable(() => workbench.remove()));
			workbench.style.width = '300px';
			workbench.style.height = '400px';
			const root = DOM.append(workbench, DOM.$('.settings-editor.narrow-width'));
			const header = DOM.append(root, DOM.$('.settings-header'));
			const search = DOM.append(DOM.append(header, DOM.$('.search-container')), DOM.$('.suggest-input-container'));
			search.style.height = '22px';
			const tree = DOM.append(DOM.append(root, DOM.$('.settings-body')), DOM.$('.settings-tree-container'));
			const groupRow = DOM.append(tree, DOM.$('div'));
			groupRow.style.height = '42px';
			const title = DOM.append(groupRow, DOM.$('.settings-group-title-label.settings-group-level-1'));
			title.textContent = 'Client Settings With A Long Translated Group Title';
			const item = DOM.append(tree, DOM.$('.setting-item.setting-item-enum'));
			const contents = DOM.append(item, DOM.$('.setting-item-contents'));
			const control = DOM.append(DOM.append(contents, DOM.$('.setting-item-value')), DOM.$('.setting-item-control'));
			const select = DOM.append(control, DOM.$('select'));
			DOM.append(select, DOM.$('option')).textContent = 'Comfortable';
			for (const client of [true, false, true]) {
				root.classList.toggle('ua-client-settings', client);
				await timeout(0);
				const rootBounds = root.getBoundingClientRect();
				const selectBounds = select.getBoundingClientRect();
				assert.deepStrictEqual({
					searchVisible: search.getBoundingClientRect().width > 0,
					titleVisible: title.getBoundingClientRect().height > 0,
					selectFits: selectBounds.left >= rootBounds.left && selectBounds.right <= rootBounds.right,
					upstreamSelectWidth: !client && DOM.getWindow(select).getComputedStyle(select).width === '320px',
				}, { searchVisible: true, titleVisible: true, selectFits: client, upstreamSelectWidth: !client });
			}
		});

		test('exact Client queries can leave and reenter the compact layout', () => {
			const queries = [
				'@id:ua.client.display.conversationDensity',
				'@id:editor.fontSize',
				'@id:ua.client.chatInput.autoFocus',
				'@id:ua.client.chatInput.autoFocus,editor.fontSize',
				'@id:ua.client.chatInput.autoFocus @id:editor.fontSize',
				'ua.client',
				'',
			];
			assert.deepStrictEqual(queries.map(query => isUaClientSettingsView(false, query, undefined)), [true, false, true, false, false, false, false]);
		});

		test('only Client categories opt in, and mixed ID filters override a Client category', () => {
			const categories = ['ua', 'ua/display', 'editor', undefined, 'ua/keyboardEnter', 'application'];
			assert.deepStrictEqual(categories.map(category => isUaClientSettingsView(false, '', category)), [true, true, false, false, true, false]);
			assert.strictEqual(isUaClientSettingsView(false, '@id:ua.client.display.conversationDensity,editor.fontSize', 'ua/display'), false);
			assert.strictEqual(isUaClientSettingsView(false, 'font size', 'ua'), false, 'ordinary searches restore their width before asynchronous results arrive');
		});

		test('Agents window and ordinary queries retain the upstream layout', () => {
			assert.deepStrictEqual([
				isUaClientSettingsView(true, '@id:ua.client.display.conversationDensity', 'ua'),
				isUaClientSettingsView(false, 'font size', undefined),
				isUaClientSettingsView(false, '@modified', undefined),
				isUaClientSettingsView(false, '@id:ua.client.display.conversationDensity,ua.client.keyboardEnter.behavior', undefined),
			], [false, false, false, true]);
		});
	});

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

	suite('readNextSettingsSearchHistory', () => {
		function positioned(entries: string[], stepsBack: number): HistoryNavigator<string> {
			const history = new HistoryNavigator(new Set(entries), 100);
			for (let i = 0; i < stepsBack; i++) {
				history.previous();
			}
			return history;
		}

		test('down on the newest search keeps that query instead of clearing it', () => {
			const history = positioned(['theme', 'font'], 1);
			assert.strictEqual(history.current(), 'font');

			const next = readNextSettingsSearchHistory(history, 'font');

			assert.strictEqual(next, null, 'no newer entry; Down must focus results without writing a query');
			assert.strictEqual(history.current(), 'font', 'clearing used to leave the cursor past the last entry');
		});

		test('down from an older search shows the next newer query', () => {
			const history = positioned(['theme', 'font'], 2);
			assert.strictEqual(history.current(), 'theme');

			const next = readNextSettingsSearchHistory(history, 'theme');

			assert.strictEqual(next, 'font');
			assert.strictEqual(history.current(), 'font');
		});

		test('down after editing a recalled search does not clear the typed query', () => {
			const history = positioned(['theme', 'font'], 1);
			assert.strictEqual(history.current(), 'font');

			const next = readNextSettingsSearchHistory(history, 'font size');

			assert.strictEqual(next, null);
			assert.ok(history.getHistory().includes('font size'));
			assert.ok(!history.getHistory().includes(''));
		});

		test('down after clearing a recalled older search keeps the empty query', () => {
			const history = positioned(['theme', 'font'], 2);
			assert.strictEqual(history.current(), 'theme');

			const next = readNextSettingsSearchHistory(history, '');

			assert.strictEqual(next, null, 'cleared query must stay empty so Down can focus the unfiltered results');
			assert.deepStrictEqual(history.getHistory(), ['theme', 'font']);
			assert.strictEqual(readNextSettingsSearchHistory(history, ''), null, 'a second Down must not refill the cleared query');
		});

		test('down after retyping another existing query keeps that query', () => {
			const history = positioned(['theme', 'font', 'editor'], 3);
			assert.strictEqual(history.current(), 'theme');

			const next = readNextSettingsSearchHistory(history, 'editor');

			assert.strictEqual(next, null, 'typed query must not be replaced by the neighboring history entry');
			assert.strictEqual(history.getHistory().at(-1), 'editor');
			assert.ok(!history.getHistory().includes(''));
		});

		test('down after retyping the next history query does not skip past it', () => {
			const history = positioned(['theme', 'font', 'editor'], 3);
			assert.strictEqual(history.current(), 'theme');

			const next = readNextSettingsSearchHistory(history, 'font');

			assert.strictEqual(next, null, 'the typed query is already what the box shows; Down must not advance to a newer one');
			assert.deepStrictEqual(history.getHistory(), ['theme', 'editor', 'font']);
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

	suite('planAiSearchToggleVisibilityUpdate', () => {
		test('keeps the toggle when it is already visible and still allowed', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(true, true), AiSearchToggleVisibilityUpdate.None);
		});

		test('removes the toggle when it is visible but no longer allowed', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(true, false), AiSearchToggleVisibilityUpdate.Remove);
		});

		test('inserts the toggle when it is hidden and allowed', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(false, true), AiSearchToggleVisibilityUpdate.Insert);
		});

		test('leaves the toggle hidden when it is not visible and not allowed', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(false, false), AiSearchToggleVisibilityUpdate.None);
		});
	});

	suite('planAiSearchToggle', () => {
		function apply(checked: boolean, showAiResults: boolean, actionInBar: boolean, enabled: boolean): { checked: boolean; showAiResults: boolean } {
			const outcome = planAiSearchToggle(actionInBar, enabled, checked);
			switch (outcome.kind) {
				case AiSearchToggleOutcomeKind.AnnounceNoAiResults:
					return { checked, showAiResults };
				case AiSearchToggleOutcomeKind.Toggle:
					return { checked: outcome.nextChecked!, showAiResults: outcome.nextChecked! };
				default:
					return { checked, showAiResults };
			}
		}

		test('disabled action in the bar leaves checked false and does not show AI results', () => {
			const applied = apply(false, false, true, false);
			assert.strictEqual(planAiSearchToggle(true, false, false).kind, AiSearchToggleOutcomeKind.AnnounceNoAiResults);
			assert.strictEqual(applied.checked, false);
			assert.strictEqual(applied.showAiResults, false);
		});

		test('enabled action in the bar flips checked from false to true', () => {
			const applied = apply(false, false, true, true);
			assert.strictEqual(applied.checked, true);
			assert.strictEqual(applied.showAiResults, true);
		});

		test('action outside the bar leaves checked unchanged', () => {
			const applied = apply(false, false, false, true);
			assert.strictEqual(planAiSearchToggle(false, true, false).kind, AiSearchToggleOutcomeKind.Noop);
			assert.strictEqual(applied.checked, false);
			assert.strictEqual(applied.showAiResults, false);
		});
	});

	suite('shouldShowSettingsClearFiltersLink', () => {
		test('hides the link when every filter dimension is empty', () => {
			assert.strictEqual(shouldShowSettingsClearFiltersLink({}), false);
			assert.strictEqual(shouldShowSettingsClearFiltersLink({
				tagFilters: new Set(),
				extensionFilters: new Set(),
				featureFilters: new Set(),
				idFilters: new Set(),
				languageFilter: undefined,
			}), false);
		});

		test('shows the link for each filter dimension on its own', () => {
			assert.strictEqual(shouldShowSettingsClearFiltersLink({ extensionFilters: new Set(['publisher.name']) }), true);
			assert.strictEqual(shouldShowSettingsClearFiltersLink({ featureFilters: new Set(['scm']) }), true);
			assert.strictEqual(shouldShowSettingsClearFiltersLink({ idFilters: new Set(['files.autoSave']) }), true);
			assert.strictEqual(shouldShowSettingsClearFiltersLink({ languageFilter: 'cpp' }), true);
			assert.strictEqual(shouldShowSettingsClearFiltersLink({ tagFilters: new Set(['modified']) }), true);
		});
	});

	suite('stripSettingsSearchFilterTokens', () => {
		const suggestions = getSettingsSearchSuggestions(false);

		test('leaves a query without filter tokens unchanged', () => {
			assert.strictEqual(stripSettingsSearchFilterTokens('font size', suggestions), 'font size');
		});

		test('strips filter tokens and keeps the search words', () => {
			assert.strictEqual(stripSettingsSearchFilterTokens('theme @ext:publisher.name bold', suggestions), 'theme bold');
			assert.strictEqual(stripSettingsSearchFilterTokens('save @id:files.autoSave', suggestions), 'save');
			assert.strictEqual(stripSettingsSearchFilterTokens('indent @lang:cpp tabs', suggestions), 'indent tabs');
			assert.strictEqual(stripSettingsSearchFilterTokens('wrap @feature:scm', suggestions), 'wrap');
			assert.strictEqual(stripSettingsSearchFilterTokens('wrap @feature:not-in-suggestions', suggestions), 'wrap');
		});
	});
});
