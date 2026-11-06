/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createRequire } from 'module';
import * as json from '../../../base/common/json.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { ColorScheme } from '../../../platform/theme/common/theme.js';
import {
	COLOR_THEME_DARK_INITIAL_COLORS,
	COLOR_THEME_LIGHT_INITIAL_COLORS,
	getDefaultColorThemeSettingsIdForColorScheme,
	isNewDefaultThemeNotificationEligible,
	migrateThemeSettingsId,
	ThemeSettingDefaults,
	ThemeSettings,
} from '../../services/themes/common/workbenchThemeService.js';
import { getInitialColorTheme, IInitialColorMap } from '../../services/themes/common/initialColorThemes.js';
import '../../services/themes/common/themeConfiguration.js'; // registers the theme settings, as the theme service does in both entries
import { PRODUCT_DARK_INITIAL_COLORS, PRODUCT_LIGHT_INITIAL_COLORS } from '../../browser/productShell/productColorThemes.js';
// The module under test registers default configuration and initial color themes when it is
// evaluated. It is imported in `suiteSetup` so that no other suite in this process sees them.
import type * as ProductShell from '../../browser/productShell.contribution.js';

const require = createRequire(import.meta.url);
const fs = require('fs');
const readTheme = (name: string) => json.parse(fs.readFileSync(require.resolve(`../../../../../extensions/theme-defaults/themes/${name}`), 'utf8'));

function readDefaults(): Record<string, unknown> {
	const properties = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).getConfigurationProperties();
	return {
		colorTheme: properties[ThemeSettings.COLOR_THEME].default,
		preferredDark: properties[ThemeSettings.PREFERRED_DARK_THEME].default,
		preferredLight: properties[ThemeSettings.PREFERRED_LIGHT_THEME].default,
		preferredHighContrastDark: properties[ThemeSettings.PREFERRED_HC_DARK_THEME].default,
		preferredHighContrastLight: properties[ThemeSettings.PREFERRED_HC_LIGHT_THEME].default,
	};
}

/** The placeholder table the theme service picks for the effective default of a color scheme. */
function firstFrameColors(colorScheme: ColorScheme): IInitialColorMap | undefined {
	return getInitialColorTheme(getDefaultColorThemeSettingsIdForColorScheme(colorScheme));
}

/** URLs of the CSS modules loaded so far; the unit test runners load each one as an `@import` rule. */
function loadedCssModules(): string[] {
	const hrefs: string[] = [];
	for (const sheet of Array.from(document.styleSheets)) {
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		for (const rule of Array.from(rules)) {
			if (rule instanceof CSSImportRule) {
				hrefs.push(rule.href);
			}
		}
	}
	return hrefs;
}

const builtInDefaults = {
	colorTheme: 'Light 2026',
	preferredDark: 'Dark 2026',
	preferredLight: 'Light 2026',
	preferredHighContrastDark: ThemeSettingDefaults.COLOR_THEME_HC_DARK,
	preferredHighContrastLight: ThemeSettingDefaults.COLOR_THEME_HC_LIGHT,
};

suite('Product shell module', () => {

	let productShell: typeof ProductShell;
	let before: { defaults: Record<string, unknown>; darkFrame: IInitialColorMap | undefined; lightFrame: IInitialColorMap | undefined; productDarkFrame: IInitialColorMap | undefined; productAccessibilityLoaded: boolean };

	suiteSetup(async () => {
		before = {
			defaults: readDefaults(),
			darkFrame: firstFrameColors(ColorScheme.DARK),
			lightFrame: firstFrameColors(ColorScheme.LIGHT),
			productDarkFrame: getInitialColorTheme('UniverseAgentStudio Dark'),
			productAccessibilityLoaded: loadedCssModules().some(href => href.endsWith('/vs/workbench/browser/productShell/media/productAccessibility.css')),
		};
		productShell = await import('../../browser/productShell.contribution.js');
	});

	suiteTeardown(() => {
		Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).deregisterDefaultConfigurations([productShell.productColorThemeDefaults]);
		productShell.productInitialColorThemes.dispose();

		assert.deepStrictEqual(readDefaults(), builtInDefaults, 'deregistering restores the built-in defaults');
		assert.strictEqual(firstFrameColors(ColorScheme.DARK), COLOR_THEME_DARK_INITIAL_COLORS, 'disposing restores the built-in first frame');
		assert.strictEqual(getInitialColorTheme('UniverseAgentStudio Dark'), undefined);
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	test('before the module is loaded the upstream defaults and placeholder colors apply', () => {
		assert.deepStrictEqual(before.defaults, builtInDefaults);
		assert.strictEqual(before.darkFrame, COLOR_THEME_DARK_INITIAL_COLORS);
		assert.strictEqual(before.darkFrame?.['activityBar.background'], '#181818');
		assert.strictEqual(before.lightFrame, COLOR_THEME_LIGHT_INITIAL_COLORS);
		assert.strictEqual(before.productDarkFrame, undefined, 'the product themes have no placeholder colors of their own');
		assert.strictEqual(before.productAccessibilityLoaded, false);
	});

	test('the module overrides the effective defaults and every consumer follows them', () => {
		assert.deepStrictEqual(readDefaults(), {
			colorTheme: 'UniverseAgentStudio Light',
			preferredDark: 'UniverseAgentStudio Dark',
			preferredLight: 'UniverseAgentStudio Light',
			preferredHighContrastDark: 'Default High Contrast',
			preferredHighContrastLight: 'Default High Contrast Light',
		});

		assert.deepStrictEqual(
			[ColorScheme.LIGHT, ColorScheme.DARK, ColorScheme.HIGH_CONTRAST_DARK, ColorScheme.HIGH_CONTRAST_LIGHT].map(getDefaultColorThemeSettingsIdForColorScheme),
			['UniverseAgentStudio Light', 'UniverseAgentStudio Dark', 'Default High Contrast', 'Default High Contrast Light']
		);

		// Legacy ids migrate to the product default, and staying on it counts as the default theme.
		assert.deepStrictEqual(
			['Experimental Dark', 'Experimental Light'].map(migrateThemeSettingsId),
			['UniverseAgentStudio Dark', 'UniverseAgentStudio Light']
		);
		const eligible = (colorTheme: string) => isNewDefaultThemeNotificationEligible({ effectiveModernPreviousSettingsId: 'Dark Modern', isDefaultColorTheme: true, colorTheme });
		assert.deepStrictEqual(
			['UniverseAgentStudio Dark', 'UniverseAgentStudio Light', 'Dark 2026', 'Light 2026'].map(eligible),
			[true, true, false, false]
		);
	});

	test('the first frame of the effective defaults paints the product tables', () => {
		assert.strictEqual(firstFrameColors(ColorScheme.DARK), PRODUCT_DARK_INITIAL_COLORS);
		assert.strictEqual(firstFrameColors(ColorScheme.DARK)?.['activityBar.background'], '#191A1B');
		assert.strictEqual(firstFrameColors(ColorScheme.LIGHT), PRODUCT_LIGHT_INITIAL_COLORS);
		assert.strictEqual(firstFrameColors(ColorScheme.LIGHT)?.['activityBar.background'], '#F6F6F6');
		assert.strictEqual(firstFrameColors(ColorScheme.HIGH_CONTRAST_DARK), undefined);

		// A user who picked the upstream theme still gets the upstream table.
		assert.strictEqual(getInitialColorTheme(ThemeSettingDefaults.COLOR_THEME_DARK), COLOR_THEME_DARK_INITIAL_COLORS);
		assert.strictEqual(getInitialColorTheme(ThemeSettingDefaults.COLOR_THEME_LIGHT), COLOR_THEME_LIGHT_INITIAL_COLORS);
	});

	test('the module loads the product style sheets', () => {
		const loaded = loadedCssModules();
		assert.ok(loaded.some(href => href.endsWith('/vs/workbench/browser/productShell/media/productAccessibility.css')), 'productAccessibility.css');
		assert.ok(loaded.some(href => href.endsWith('/vs/workbench/browser/parts/conversation/media/ua-common.css')), 'ua-common.css');
	});
});

suite('Product shell placeholder colors', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('match the merged product default themes and depart from old Modern values', () => {
		const lightModern = readTheme('light_modern.json');
		const darkModern = readTheme('dark_modern.json');
		const mergedLight: Record<string, string> = Object.assign({}, lightModern.colors, readTheme('2026-light.json').colors, readTheme('universe-agent-studio-light.json').colors);
		const mergedDark: Record<string, string> = Object.assign({}, darkModern.colors, readTheme('2026-dark.json').colors, readTheme('universe-agent-studio-dark.json').colors);

		for (const [key, value] of Object.entries(PRODUCT_LIGHT_INITIAL_COLORS)) {
			if (mergedLight[key] !== undefined) {
				assert.strictEqual(value, mergedLight[key], `Light initial color for ${key} should match merged default`);
			}
		}

		for (const [key, value] of Object.entries(PRODUCT_DARK_INITIAL_COLORS)) {
			if (mergedDark[key] !== undefined) {
				assert.strictEqual(value, mergedDark[key], `Dark initial color for ${key} should match merged default`);
			}
		}

		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['activityBar.background'], '#F6F6F6');
		assert.notStrictEqual(PRODUCT_LIGHT_INITIAL_COLORS['activityBar.background'], '#F8F8F8');
		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['activityBar.activeBorder'], '#000000');
		assert.notStrictEqual(PRODUCT_LIGHT_INITIAL_COLORS['activityBar.activeBorder'], '#005FB8');
		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['sideBar.background'], '#FAFAFA');
		assert.notStrictEqual(PRODUCT_LIGHT_INITIAL_COLORS['sideBar.background'], '#F8F8F8');
		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['statusBar.background'], '#F6F6F6');
		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['button.background'], '#1F1F1F');
		assert.notStrictEqual(PRODUCT_LIGHT_INITIAL_COLORS['button.background'], '#0069CC');
		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['panel.background'], '#F6F6F6');
		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['quickInputList.focusBackground'], '#00000014');
		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['quickInputList.focusForeground'], '#202020');
		assert.notStrictEqual(PRODUCT_LIGHT_INITIAL_COLORS['quickInputList.focusForeground'], '#FFFFFF');
		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['menu.selectionBackground'], '#00000014');
		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['list.hoverBackground'], '#00000014');
		assert.strictEqual(PRODUCT_LIGHT_INITIAL_COLORS['widget.shadow'], '#0000001A');
		assert.notStrictEqual(PRODUCT_LIGHT_INITIAL_COLORS['widget.shadow'], '#00000000');

		assert.strictEqual(PRODUCT_DARK_INITIAL_COLORS['activityBar.background'], '#191A1B');
		assert.notStrictEqual(PRODUCT_DARK_INITIAL_COLORS['activityBar.background'], '#181818');
		assert.strictEqual(PRODUCT_DARK_INITIAL_COLORS['activityBar.activeBorder'], '#bfbfbf');
		assert.notStrictEqual(PRODUCT_DARK_INITIAL_COLORS['activityBar.activeBorder'], '#0078D4');
		assert.strictEqual(PRODUCT_DARK_INITIAL_COLORS['sideBar.background'], '#191A1B');
		assert.notStrictEqual(PRODUCT_DARK_INITIAL_COLORS['sideBar.background'], '#181818');
		assert.strictEqual(PRODUCT_DARK_INITIAL_COLORS['button.background'], '#F3F3F3');
		assert.strictEqual(PRODUCT_DARK_INITIAL_COLORS['button.foreground'], '#1F1F1F');
		assert.deepStrictEqual({
			background: darkModern.colors['button.background'],
			foreground: darkModern.colors['button.foreground'],
			border: darkModern.colors['button.border'],
			hoverBackground: darkModern.colors['button.hoverBackground'],
		}, {
			background: '#F3F3F3',
			foreground: '#1F1F1F',
			border: '#F3F3F3',
			hoverBackground: '#FFFFFF',
		});
		assert.notStrictEqual(PRODUCT_DARK_INITIAL_COLORS['button.background'], '#297AA0');
		assert.strictEqual(PRODUCT_DARK_INITIAL_COLORS['quickInputList.focusForeground'], '#bfbfbf');
		assert.strictEqual(PRODUCT_DARK_INITIAL_COLORS['menu.selectionBackground'], '#FFFFFF14');
		assert.notStrictEqual(PRODUCT_DARK_INITIAL_COLORS['widget.shadow'], '#00000000');
	});
});
