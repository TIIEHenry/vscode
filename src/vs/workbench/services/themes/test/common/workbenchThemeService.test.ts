/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { migrateThemeSettingsId, ThemeSettingDefaults, ThemeSettings } from '../../common/workbenchThemeService.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ThemeConfiguration } from '../../common/themeConfiguration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IHostColorSchemeService } from '../../common/hostColorSchemeService.js';
import { Event } from '../../../../../base/common/event.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../../platform/configuration/common/configurationRegistry.js';
import themeDefaultsManifest from '../../../../../../../extensions/theme-defaults/package.json' with { type: 'json' };
import productLightTheme from '../../../../../../../extensions/theme-defaults/themes/universe-agent-studio-light.json' with { type: 'json' };
import productDarkTheme from '../../../../../../../extensions/theme-defaults/themes/universe-agent-studio-dark.json' with { type: 'json' };

class TestHostColorSchemeService implements IHostColorSchemeService {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeColorScheme = Event.None;
	dark = false;
	highContrast = false;
}

suite('WorkbenchThemeService', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

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
		const light = themes.find(theme => theme.id === ThemeSettingDefaults.COLOR_THEME_LIGHT);
		const dark = themes.find(theme => theme.id === ThemeSettingDefaults.COLOR_THEME_DARK);
		assert.ok(light);
		assert.strictEqual(light.uiTheme, 'vs');
		assert.strictEqual(light.path, './themes/universe-agent-studio-light.json');
		assert.ok(dark);
		assert.strictEqual(dark.uiTheme, 'vs-dark');
		assert.strictEqual(dark.path, './themes/universe-agent-studio-dark.json');
		assert.ok(themes.some(theme => theme.id === 'Light 2026' && theme.path === './themes/2026-light.json'));
		assert.ok(themes.some(theme => theme.id === 'Dark 2026' && theme.path === './themes/2026-dark.json'));
		assert.ok(themes.some(theme => theme.id === 'Default High Contrast' && theme.path === './themes/hc_black.json'));
		assert.ok(themes.some(theme => theme.id === 'Default High Contrast Light' && theme.path === './themes/hc_light.json'));

		assert.strictEqual(productLightTheme.include, './2026-light.json');
		assert.strictEqual(productLightTheme.colors['sideBar.background'], '#F3F3F3');
		assert.strictEqual(productLightTheme.colors['panel.background'], '#FAFAFA');
		assert.strictEqual(productLightTheme.colors['widget.border'], '#E2E2E2');
		assert.strictEqual(productLightTheme.colors['chat.requestBubbleBackground'], '#F4F4F4');
		assert.strictEqual(productLightTheme.colors['badge.background'], '#6A6A6A');
		assert.strictEqual(productDarkTheme.include, './2026-dark.json');
		assert.strictEqual(productDarkTheme.colors['badge.background'], '#767676');
		assert.deepStrictEqual(Object.keys(productDarkTheme.colors).sort(), [
			'activityBarBadge.background',
			'agentsBadge.background',
			'agentsUnreadBadge.background',
			'badge.background',
		]);
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
