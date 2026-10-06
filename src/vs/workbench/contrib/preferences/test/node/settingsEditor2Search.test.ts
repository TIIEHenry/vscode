/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EXTENSION_SETTING_TAG, FEATURE_SETTING_TAG, ID_SETTING_TAG, LANGUAGE_SETTING_TAG } from '../../common/preferences.js';
import {
	AiSearchToggleOutcomeKind,
	AiSearchToggleVisibilityUpdate,
	planAiSearchToggle,
	planAiSearchToggleVisibilityUpdate,
	shouldShowSettingsClearFiltersLink,
	stripSettingsSearchFilterTokens,
} from '../../browser/settingsEditor2Search.js';

suite('settingsEditor2Search', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	suite('planAiSearchToggleVisibilityUpdate', () => {
		test('inserts when not visible and allowed', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(false, true), AiSearchToggleVisibilityUpdate.Insert);
		});

		test('removes when visible but no longer allowed', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(true, false), AiSearchToggleVisibilityUpdate.Remove);
		});

		test('keeps when visible and still allowed', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(true, true), AiSearchToggleVisibilityUpdate.None);
		});

		test('keeps when not visible and not allowed', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(false, false), AiSearchToggleVisibilityUpdate.None);
		});
	});

	suite('planAiSearchToggle', () => {
		test('noop when action is not in the bar', () => {
			const outcome = planAiSearchToggle(false, true, false);
			assert.strictEqual(outcome.kind, AiSearchToggleOutcomeKind.Noop);
		});

		test('announces and does not toggle when disabled', () => {
			const outcome = planAiSearchToggle(true, false, false);
			assert.strictEqual(outcome.kind, AiSearchToggleOutcomeKind.AnnounceNoAiResults);
			assert.strictEqual(outcome.nextChecked, undefined);
		});

		test('toggles checked when enabled and in the bar', () => {
			assert.deepStrictEqual(planAiSearchToggle(true, true, false), {
				kind: AiSearchToggleOutcomeKind.Toggle,
				nextChecked: true,
			});
			assert.deepStrictEqual(planAiSearchToggle(true, true, true), {
				kind: AiSearchToggleOutcomeKind.Toggle,
				nextChecked: false,
			});
		});
	});

	suite('shouldShowSettingsClearFiltersLink', () => {
		test('hidden when all filter dimensions are empty', () => {
			assert.strictEqual(shouldShowSettingsClearFiltersLink({}), false);
			assert.strictEqual(shouldShowSettingsClearFiltersLink({
				tagFilters: new Set(),
				extensionFilters: new Set(),
				featureFilters: new Set(),
				idFilters: new Set(),
				languageFilter: undefined,
			}), false);
		});

		test('shown when tagFilters is non-empty', () => {
			assert.strictEqual(shouldShowSettingsClearFiltersLink({ tagFilters: new Set(['modified']) }), true);
		});

		test('shown when extensionFilters is non-empty', () => {
			assert.strictEqual(shouldShowSettingsClearFiltersLink({ extensionFilters: new Set(['pub.ext']) }), true);
		});

		test('shown when featureFilters is non-empty', () => {
			assert.strictEqual(shouldShowSettingsClearFiltersLink({ featureFilters: new Set(['scm']) }), true);
		});

		test('shown when idFilters is non-empty', () => {
			assert.strictEqual(shouldShowSettingsClearFiltersLink({ idFilters: new Set(['editor.fontSize']) }), true);
		});

		test('shown when languageFilter is set', () => {
			assert.strictEqual(shouldShowSettingsClearFiltersLink({ languageFilter: 'cpp' }), true);
		});
	});

	suite('stripSettingsSearchFilterTokens', () => {
		const defaultSuggestions = [
			`@${EXTENSION_SETTING_TAG}`,
			`@${ID_SETTING_TAG}`,
			`@${LANGUAGE_SETTING_TAG}`,
			`@${FEATURE_SETTING_TAG}scm`,
		];

		test('leaves plain queries unchanged', () => {
			assert.strictEqual(stripSettingsSearchFilterTokens('font size', defaultSuggestions), 'font size');
		});

		test('strips @ext, @id, and @lang tokens and keeps search words', () => {
			assert.strictEqual(
				stripSettingsSearchFilterTokens('theme @ext:publisher.name bold', defaultSuggestions),
				'theme bold',
			);
			assert.strictEqual(
				stripSettingsSearchFilterTokens('save @id:files.autoSave', defaultSuggestions),
				'save',
			);
			assert.strictEqual(
				stripSettingsSearchFilterTokens('indent @lang:cpp tabs', defaultSuggestions),
				'indent tabs',
			);
		});

		test('strips @feature tokens including values outside suggestions', () => {
			assert.strictEqual(
				stripSettingsSearchFilterTokens('wrap @feature:scm', defaultSuggestions),
				'wrap',
			);
			assert.strictEqual(
				stripSettingsSearchFilterTokens('wrap @feature:not-in-suggestions', defaultSuggestions),
				'wrap',
			);
		});
	});
});
