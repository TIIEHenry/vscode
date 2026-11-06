/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
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
import '../../services/themes/common/themeConfiguration.js'; // registers the theme settings, as the theme service does in both entries
// The module under test registers default configuration when it is evaluated. It is
// imported inside the test so that no other suite in this process sees the override.
import type * as ProductShell from '../../browser/productShell.contribution.js';

suite('Product shell color theme defaults', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

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

	test('the module overrides the effective defaults and every consumer follows them', async () => {
		const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
		const builtIn = {
			colorTheme: 'Light 2026',
			preferredDark: 'Dark 2026',
			preferredLight: 'Light 2026',
			preferredHighContrastDark: ThemeSettingDefaults.COLOR_THEME_HC_DARK,
			preferredHighContrastLight: ThemeSettingDefaults.COLOR_THEME_HC_LIGHT,
		};
		assert.deepStrictEqual(readDefaults(), builtIn, 'before the module is loaded the built-in upstream defaults apply');

		const productShell: typeof ProductShell = await import('../../browser/productShell.contribution.js');
		try {
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

			// The first-frame placeholder table is keyed by the effective default id and stays the Universe table.
			assert.strictEqual(COLOR_THEME_DARK_INITIAL_COLORS['activityBar.background'], '#191A1B');
			assert.ok(COLOR_THEME_LIGHT_INITIAL_COLORS['activityBar.background']);

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
		} finally {
			registry.deregisterDefaultConfigurations([productShell.productColorThemeDefaults]);
		}

		assert.deepStrictEqual(readDefaults(), builtIn, 'deregistering restores the built-in defaults');
	});
});
