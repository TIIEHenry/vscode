/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createRequire } from 'module';
import { migrateThemeSettingsId, ThemeSettingDefaults, ThemeSettings, getDefaultColorThemeSettingsIdForColorScheme, IThemeExtensionPoint, decideNewDefaultThemeNotification, NewDefaultThemeNotificationDecisionKind, resolveEffectiveModernPreviousSettingsId, COLOR_THEME_LIGHT_INITIAL_COLORS, COLOR_THEME_DARK_INITIAL_COLORS } from '../../common/workbenchThemeService.js';
import * as json from '../../../../../base/common/json.js';
import { ColorScheme } from '../../../../../platform/theme/common/theme.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ThemeConfiguration } from '../../common/themeConfiguration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IHostColorSchemeService } from '../../common/hostColorSchemeService.js';
import { Event } from '../../../../../base/common/event.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../../platform/configuration/common/configurationRegistry.js';

const require = createRequire(import.meta.url);
const fs = require('fs');
const readJson = (relPath: string) => json.parse(fs.readFileSync(require.resolve(relPath), 'utf8'));
const themeDefaultsManifest = readJson('../../../../../../../extensions/theme-defaults/package.json');
const productLightTheme = readJson('../../../../../../../extensions/theme-defaults/themes/universe-agent-studio-light.json');
const productDarkTheme = readJson('../../../../../../../extensions/theme-defaults/themes/universe-agent-studio-dark.json');
const lightModern = readJson('../../../../../../../extensions/theme-defaults/themes/light_modern.json');
const darkModern = readJson('../../../../../../../extensions/theme-defaults/themes/dark_modern.json');
const light2026 = readJson('../../../../../../../extensions/theme-defaults/themes/2026-light.json');
const dark2026 = readJson('../../../../../../../extensions/theme-defaults/themes/2026-dark.json');

class TestHostColorSchemeService implements IHostColorSchemeService {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeColorScheme = Event.None;
	dark = false;
	highContrast = false;
}

suite('WorkbenchThemeService', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('getDefaultColorThemeSettingsIdForColorScheme', () => {

		test('maps each ColorScheme tier to the product default theme settings id', () => {
			assert.strictEqual(getDefaultColorThemeSettingsIdForColorScheme(ColorScheme.LIGHT), ThemeSettingDefaults.COLOR_THEME_LIGHT);
			assert.strictEqual(getDefaultColorThemeSettingsIdForColorScheme(ColorScheme.DARK), ThemeSettingDefaults.COLOR_THEME_DARK);
			assert.strictEqual(getDefaultColorThemeSettingsIdForColorScheme(ColorScheme.HIGH_CONTRAST_DARK), ThemeSettingDefaults.COLOR_THEME_HC_DARK);
			assert.strictEqual(getDefaultColorThemeSettingsIdForColorScheme(ColorScheme.HIGH_CONTRAST_LIGHT), ThemeSettingDefaults.COLOR_THEME_HC_LIGHT);
		});
	});

	suite('decideNewDefaultThemeNotification', () => {

		const eligibleDark = {
			isDefaultColorTheme: true,
			colorTheme: ThemeSettingDefaults.COLOR_THEME_DARK,
		};
		const eligibleLight = {
			isDefaultColorTheme: true,
			colorTheme: ThemeSettingDefaults.COLOR_THEME_LIGHT,
		};

		for (const modernPrevious of ['Dark Modern', 'Light Modern'] as const) {
			const productTheme = modernPrevious === 'Dark Modern' ? ThemeSettingDefaults.COLOR_THEME_DARK : ThemeSettingDefaults.COLOR_THEME_LIGHT;
			const eligible = modernPrevious === 'Dark Modern' ? eligibleDark : eligibleLight;

			test(`${modernPrevious}: already shown is a no-op`, () => {
				const decision = decideNewDefaultThemeNotification({
					notificationAlreadyShown: true,
					previousSettingsIdParam: modernPrevious,
					pendingSettingsId: undefined,
					hadLastFocus: true,
					isSessionsWindow: false,
					isDefaultColorTheme: eligible.isDefaultColorTheme,
					colorTheme: eligible.colorTheme,
				});
				assert.strictEqual(decision.kind, NewDefaultThemeNotificationDecisionKind.NoOp);
				assert.strictEqual(decision.markNotificationShown, false);
				assert.strictEqual(decision.clearPendingSettingsId, false);
				assert.strictEqual(decision.pendingSettingsIdToStore, undefined);
			});

			test(`${modernPrevious}: no focus writes pending and waits for focus (decision 1)`, () => {
				const decision = decideNewDefaultThemeNotification({
					notificationAlreadyShown: false,
					previousSettingsIdParam: modernPrevious,
					pendingSettingsId: undefined,
					hadLastFocus: false,
					isSessionsWindow: false,
					...eligible,
				});
				assert.strictEqual(decision.kind, NewDefaultThemeNotificationDecisionKind.WaitForFocus);
				assert.strictEqual(decision.markNotificationShown, false);
				assert.strictEqual(decision.clearPendingSettingsId, false);
				assert.strictEqual(decision.pendingSettingsIdToStore, modernPrevious);
			});

			test(`${modernPrevious}: with focus shows and clears pending (decision 2)`, () => {
				const decision = decideNewDefaultThemeNotification({
					notificationAlreadyShown: false,
					previousSettingsIdParam: modernPrevious,
					pendingSettingsId: undefined,
					hadLastFocus: true,
					isSessionsWindow: false,
					...eligible,
				});
				assert.strictEqual(decision.kind, NewDefaultThemeNotificationDecisionKind.Show);
				assert.strictEqual(decision.markNotificationShown, true);
				assert.strictEqual(decision.clearPendingSettingsId, true);
				assert.strictEqual(decision.pendingSettingsIdToStore, undefined);
			});

			test(`${modernPrevious}: product default in storage with pending still shows when focused (decision 2)`, () => {
				const decision = decideNewDefaultThemeNotification({
					notificationAlreadyShown: false,
					previousSettingsIdParam: productTheme,
					pendingSettingsId: modernPrevious,
					hadLastFocus: true,
					isSessionsWindow: false,
					...eligible,
				});
				assert.strictEqual(decision.kind, NewDefaultThemeNotificationDecisionKind.Show);
				assert.strictEqual(decision.markNotificationShown, true);
				assert.strictEqual(decision.clearPendingSettingsId, true);
				assert.strictEqual(resolveEffectiveModernPreviousSettingsId(productTheme, modernPrevious), modernPrevious);
			});

			test(`${modernPrevious}: Sessions window writes pending only (decision 3)`, () => {
				const decision = decideNewDefaultThemeNotification({
					notificationAlreadyShown: false,
					previousSettingsIdParam: modernPrevious,
					pendingSettingsId: undefined,
					hadLastFocus: true,
					isSessionsWindow: true,
					...eligible,
				});
				assert.strictEqual(decision.kind, NewDefaultThemeNotificationDecisionKind.NoOp);
				assert.strictEqual(decision.markNotificationShown, false);
				assert.strictEqual(decision.clearPendingSettingsId, false);
				assert.strictEqual(decision.pendingSettingsIdToStore, modernPrevious);
			});

			test(`${modernPrevious}: Sessions ineligible leaves pending untouched (decision 4)`, () => {
				const decision = decideNewDefaultThemeNotification({
					notificationAlreadyShown: false,
					previousSettingsIdParam: 'Dark+',
					pendingSettingsId: modernPrevious,
					hadLastFocus: true,
					isSessionsWindow: true,
					isDefaultColorTheme: false,
					colorTheme: productTheme,
				});
				assert.strictEqual(decision.kind, NewDefaultThemeNotificationDecisionKind.NoOp);
				assert.strictEqual(decision.markNotificationShown, false);
				assert.strictEqual(decision.clearPendingSettingsId, false);
				assert.strictEqual(decision.pendingSettingsIdToStore, undefined);
			});

			test(`${modernPrevious}: ineligible with focus marks shown and clears pending (decision 5)`, () => {
				const decision = decideNewDefaultThemeNotification({
					notificationAlreadyShown: false,
					previousSettingsIdParam: 'Dark+',
					pendingSettingsId: modernPrevious,
					hadLastFocus: true,
					isSessionsWindow: false,
					isDefaultColorTheme: false,
					colorTheme: productTheme,
				});
				assert.strictEqual(decision.kind, NewDefaultThemeNotificationDecisionKind.NoOp);
				assert.strictEqual(decision.markNotificationShown, true);
				assert.strictEqual(decision.clearPendingSettingsId, true);
				assert.strictEqual(decision.pendingSettingsIdToStore, undefined);
			});

			test(`${modernPrevious}: ineligible without focus is a no-op (decision 6)`, () => {
				const decision = decideNewDefaultThemeNotification({
					notificationAlreadyShown: false,
					previousSettingsIdParam: 'Dark+',
					pendingSettingsId: undefined,
					hadLastFocus: false,
					isSessionsWindow: false,
					isDefaultColorTheme: false,
					colorTheme: productTheme,
				});
				assert.strictEqual(decision.kind, NewDefaultThemeNotificationDecisionKind.NoOp);
				assert.strictEqual(decision.markNotificationShown, false);
				assert.strictEqual(decision.clearPendingSettingsId, false);
				assert.strictEqual(decision.pendingSettingsIdToStore, undefined);
			});
		}
	});

	suite('migrateThemeSettingsId', () => {

		test('migrates Default-prefixed theme IDs', () => {
			assert.deepStrictEqual(
				['Default Dark Modern', 'Default Light Modern', 'Default Dark+', 'Default Light+'].map(migrateThemeSettingsId),
				['Dark Modern', 'Light Modern', 'Dark+', 'Light+']
			);
		});

		test('migrates Experimental theme IDs to the current default themes', () => {
			assert.deepStrictEqual(
				['Experimental Dark', 'Experimental Light', 'VS Code Dark', 'VS Code Light'].map(migrateThemeSettingsId),
				[ThemeSettingDefaults.COLOR_THEME_DARK, ThemeSettingDefaults.COLOR_THEME_LIGHT, ThemeSettingDefaults.COLOR_THEME_DARK, ThemeSettingDefaults.COLOR_THEME_LIGHT]
			);
		});

		test('returns unknown IDs unchanged', () => {
			assert.deepStrictEqual(
				['Dark Modern', 'Dark 2026', 'Light 2026', 'UniverseAgentStudio Light', 'UniverseAgentStudio Dark', 'Some Custom Theme', ''].map(migrateThemeSettingsId),
				['Dark Modern', 'Dark 2026', 'Light 2026', 'UniverseAgentStudio Light', 'UniverseAgentStudio Dark', 'Some Custom Theme', '']
			);
		});
	});

	test('product default themes are registered and are not Light 2026', () => {
		assert.strictEqual(ThemeSettingDefaults.COLOR_THEME_LIGHT, 'UniverseAgentStudio Light');
		assert.notStrictEqual(ThemeSettingDefaults.COLOR_THEME_LIGHT, 'Light 2026');
		assert.strictEqual(ThemeSettingDefaults.COLOR_THEME_DARK, 'UniverseAgentStudio Dark');
		assert.notStrictEqual(ThemeSettingDefaults.COLOR_THEME_DARK, 'Dark 2026');
		assert.strictEqual(ThemeSettingDefaults.COLOR_THEME_HC_DARK, 'Default High Contrast');
		assert.strictEqual(ThemeSettingDefaults.COLOR_THEME_HC_LIGHT, 'Default High Contrast Light');

		const properties = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).getConfigurationProperties();
		assert.strictEqual(properties[ThemeSettings.COLOR_THEME].default, ThemeSettingDefaults.COLOR_THEME_LIGHT);
		assert.strictEqual(properties[ThemeSettings.PREFERRED_LIGHT_THEME].default, ThemeSettingDefaults.COLOR_THEME_LIGHT);
		assert.strictEqual(properties[ThemeSettings.PREFERRED_DARK_THEME].default, ThemeSettingDefaults.COLOR_THEME_DARK);
		assert.strictEqual(properties[ThemeSettings.PREFERRED_HC_DARK_THEME].default, ThemeSettingDefaults.COLOR_THEME_HC_DARK);
		assert.strictEqual(properties[ThemeSettings.PREFERRED_HC_LIGHT_THEME].default, ThemeSettingDefaults.COLOR_THEME_HC_LIGHT);

		const themes = themeDefaultsManifest.contributes.themes;
		const light = themes.find((theme: IThemeExtensionPoint) => theme.id === ThemeSettingDefaults.COLOR_THEME_LIGHT);
		const dark = themes.find((theme: IThemeExtensionPoint) => theme.id === ThemeSettingDefaults.COLOR_THEME_DARK);
		assert.ok(light);
		assert.strictEqual(light.uiTheme, 'vs');
		assert.strictEqual(light.path, './themes/universe-agent-studio-light.json');
		assert.ok(dark);
		assert.strictEqual(dark.uiTheme, 'vs-dark');
		assert.strictEqual(dark.path, './themes/universe-agent-studio-dark.json');
		assert.ok(themes.some((theme: IThemeExtensionPoint) => theme.id === 'Light 2026' && theme.path === './themes/2026-light.json'));
		assert.ok(themes.some((theme: IThemeExtensionPoint) => theme.id === 'Dark 2026' && theme.path === './themes/2026-dark.json'));
		assert.ok(themes.some((theme: IThemeExtensionPoint) => theme.id === 'Default High Contrast' && theme.path === './themes/hc_black.json'));
		assert.ok(themes.some((theme: IThemeExtensionPoint) => theme.id === 'Default High Contrast Light' && theme.path === './themes/hc_light.json'));

		assert.strictEqual(productLightTheme.include, './2026-light.json');
		assert.strictEqual(productLightTheme.colors['sideBar.background'], '#F6F6F6');
		assert.strictEqual(productLightTheme.colors['panel.background'], '#F6F6F6');
		assert.strictEqual(productLightTheme.colors['widget.border'], '#E2E2E2');
		assert.strictEqual(productLightTheme.colors['chat.requestBubbleBackground'], '#F4F4F4');
		assert.strictEqual(productLightTheme.colors['badge.background'], '#6A6A6A');
		assert.strictEqual(productDarkTheme.include, './2026-dark.json');
		assert.strictEqual(productDarkTheme.colors['badge.background'], '#767676');
		assert.deepStrictEqual(Object.keys(productDarkTheme.colors).sort(), [
			'activityBar.activeBackground',
			'activityBar.inactiveForeground',
			'activityBarBadge.background',
			'agentsBadge.background',
			'agentsGradient.tintColor',
			'agentsUnreadBadge.background',
			'agentsUpdateButton.downloadedBackground',
			'agentsUpdateButton.downloadingBackground',
			'badge.background',
			'button.background',
			'button.border',
			'button.foreground',
			'button.hoverBackground',
			'chat.inputWorkingBorderColor1',
			'chat.inputWorkingBorderColor2',
			'chat.inputWorkingBorderColor3',
			'commandCenter.border',
			'conversation.background',
			'inlineEdit.gutterIndicator.primaryBorder',
			'inlineEdit.gutterIndicator.successfulBorder',
			'menu.selectionBackground',
			'quickInputList.focusBackground',
			'quickInputList.focusForeground',
			'quickInputList.focusHighlightForeground',
			'quickInputList.focusIconForeground',
			'widget.shadow',
		]);
	});

	test('initial placeholder colors match merged product default themes and depart from old Modern values', () => {
		const mergedLight: Record<string, string> = Object.assign({}, lightModern.colors, light2026.colors, productLightTheme.colors);
		const mergedDark: Record<string, string> = Object.assign({}, darkModern.colors, dark2026.colors, productDarkTheme.colors);

		for (const [key, value] of Object.entries(COLOR_THEME_LIGHT_INITIAL_COLORS)) {
			if (key in mergedLight) {
				assert.strictEqual(value, mergedLight[key], `Light initial color for ${key} should match merged default`);
			}
		}

		for (const [key, value] of Object.entries(COLOR_THEME_DARK_INITIAL_COLORS)) {
			if (key in mergedDark) {
				assert.strictEqual(value, mergedDark[key], `Dark initial color for ${key} should match merged default`);
			}
		}

		// Verify key colors align with Universe defaults and depart from old Modern values
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['activityBar.background'], '#F6F6F6');
		assert.notStrictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['activityBar.background'], '#F8F8F8');
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['activityBar.activeBorder'], '#000000');
		assert.notStrictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['activityBar.activeBorder'], '#005FB8');
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['sideBar.background'], '#F6F6F6');
		assert.notStrictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['sideBar.background'], '#F8F8F8');
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['statusBar.background'], '#F6F6F6');
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['button.background'], '#1F1F1F');
		assert.notStrictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['button.background'], '#0069CC');
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['panel.background'], '#F6F6F6');
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['quickInputList.focusBackground'], '#00000014');
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['quickInputList.focusForeground'], '#202020');
		assert.notStrictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['quickInputList.focusForeground'], '#FFFFFF');
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['menu.selectionBackground'], '#00000014');
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['list.hoverBackground'], '#00000014');
		assert.strictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['widget.shadow'], '#0000001A');
		assert.notStrictEqual(COLOR_THEME_LIGHT_INITIAL_COLORS['widget.shadow'], '#00000000');

		assert.strictEqual(COLOR_THEME_DARK_INITIAL_COLORS['activityBar.background'], '#191A1B');
		assert.notStrictEqual(COLOR_THEME_DARK_INITIAL_COLORS['activityBar.background'], '#181818');
		assert.strictEqual(COLOR_THEME_DARK_INITIAL_COLORS['activityBar.activeBorder'], '#bfbfbf');
		assert.notStrictEqual(COLOR_THEME_DARK_INITIAL_COLORS['activityBar.activeBorder'], '#0078D4');
		assert.strictEqual(COLOR_THEME_DARK_INITIAL_COLORS['sideBar.background'], '#191A1B');
		assert.notStrictEqual(COLOR_THEME_DARK_INITIAL_COLORS['sideBar.background'], '#181818');
		assert.strictEqual(COLOR_THEME_DARK_INITIAL_COLORS['button.background'], '#F3F3F3');
		assert.strictEqual(COLOR_THEME_DARK_INITIAL_COLORS['button.foreground'], '#1F1F1F');
		assert.notStrictEqual(COLOR_THEME_DARK_INITIAL_COLORS['button.background'], '#297AA0');
		assert.strictEqual(COLOR_THEME_DARK_INITIAL_COLORS['quickInputList.focusForeground'], '#bfbfbf');
		assert.strictEqual(COLOR_THEME_DARK_INITIAL_COLORS['menu.selectionBackground'], '#FFFFFF14');
		assert.notStrictEqual(COLOR_THEME_DARK_INITIAL_COLORS['widget.shadow'], '#00000000');
	});

	test('2026-dark.json disabled, placeholder, and invalid item foreground contrast and are not overridden by product dark theme', () => {
		assert.strictEqual(dark2026.colors['disabledForeground'], '#8C8C8C');
		assert.strictEqual(dark2026.colors['input.placeholderForeground'], '#8C8C8C');
		assert.strictEqual(dark2026.colors['list.invalidItemForeground'], '#B89500');

		assert.strictEqual('disabledForeground' in productDarkTheme.colors, false);
		assert.strictEqual('input.placeholderForeground' in productDarkTheme.colors, false);
		assert.strictEqual('list.invalidItemForeground' in productDarkTheme.colors, false);
	});

	test('restores only for preferred color scheme changes', async () => {
		const configurationService = new TestConfigurationService({
			[ThemeSettings.DETECT_COLOR_SCHEME]: false,
			[ThemeSettings.DETECT_HC]: true,
		});
		const hostColorSchemeService = new TestHostColorSchemeService();
		const themeConfiguration = new ThemeConfiguration(configurationService, hostColorSchemeService);

		const results: boolean[] = [];
		hostColorSchemeService.dark = true;
		results.push(themeConfiguration.isPreferredColorSchemeChange({ dark: false, highContrast: false }));
		hostColorSchemeService.highContrast = true;
		results.push(themeConfiguration.isPreferredColorSchemeChange({ dark: true, highContrast: false }));
		hostColorSchemeService.dark = false;
		results.push(themeConfiguration.isPreferredColorSchemeChange({ dark: true, highContrast: true }));
		hostColorSchemeService.highContrast = false;
		results.push(themeConfiguration.isPreferredColorSchemeChange({ dark: false, highContrast: true }));

		await configurationService.setUserConfiguration(ThemeSettings.DETECT_COLOR_SCHEME, true);
		hostColorSchemeService.dark = true;
		results.push(themeConfiguration.isPreferredColorSchemeChange({ dark: false, highContrast: false }));

		assert.deepStrictEqual(results, [false, true, true, true, true]);
	});
});
