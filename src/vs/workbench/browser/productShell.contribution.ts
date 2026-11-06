/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Product shell module loaded by both window entries (`workbench.common.main.ts` and
// `sessions.common.main.ts`), after the theme service. Both windows load `style.ts`, the
// theme service and the settings contributions, but only the default window loads the
// conversation contribution, so anything both windows need cannot hang off that one.

import './productShell/media/productAccessibility.css';
import './parts/conversation/media/ua-common.css';
import { combinedDisposable, IDisposable, markAsSingleton } from '../../base/common/lifecycle.js';
import { Registry } from '../../platform/registry/common/platform.js';
import { Extensions as ConfigurationExtensions, IConfigurationDefaults, IConfigurationRegistry } from '../../platform/configuration/common/configurationRegistry.js';
import { ThemeSettings } from '../services/themes/common/workbenchThemeService.js';
import { registerInitialColorTheme } from '../services/themes/common/initialColorThemes.js';
import { PRODUCT_DARK_COLOR_THEME_ID, PRODUCT_DARK_INITIAL_COLORS, PRODUCT_LIGHT_COLOR_THEME_ID, PRODUCT_LIGHT_INITIAL_COLORS } from './productShell/productColorThemes.js';

/**
 * Product color themes. The theme service keeps the upstream `Dark 2026` / `Light 2026`
 * defaults; the product overrides the effective defaults of the three settings below.
 * The schema of these settings is registered by `workbenchThemeService.ts`, which both
 * entries import before this module, so the override applies to the existing properties.
 *
 * @internal Exported for unit tests, which deregister it again.
 */
export const productColorThemeDefaults: IConfigurationDefaults = {
	overrides: {
		[ThemeSettings.COLOR_THEME]: PRODUCT_LIGHT_COLOR_THEME_ID,
		[ThemeSettings.PREFERRED_DARK_THEME]: PRODUCT_DARK_COLOR_THEME_ID,
		[ThemeSettings.PREFERRED_LIGHT_THEME]: PRODUCT_LIGHT_COLOR_THEME_ID,
	},
	source: 'productShell',
};

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerDefaultConfigurations([productColorThemeDefaults]);

/**
 * First-frame placeholder colors of the product themes. The theme service reads them when
 * it is constructed, which is after every module of the window entry has been evaluated.
 *
 * @internal Exported for unit tests, which dispose it again.
 */
export const productInitialColorThemes: IDisposable = markAsSingleton(combinedDisposable(
	registerInitialColorTheme(PRODUCT_DARK_COLOR_THEME_ID, PRODUCT_DARK_INITIAL_COLORS),
	registerInitialColorTheme(PRODUCT_LIGHT_COLOR_THEME_ID, PRODUCT_LIGHT_INITIAL_COLORS),
));
