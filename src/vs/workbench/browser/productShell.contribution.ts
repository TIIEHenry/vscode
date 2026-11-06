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
import { Registry } from '../../platform/registry/common/platform.js';
import { Extensions as ConfigurationExtensions, IConfigurationDefaults, IConfigurationRegistry } from '../../platform/configuration/common/configurationRegistry.js';
import { ThemeSettings } from '../services/themes/common/workbenchThemeService.js';

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
		[ThemeSettings.COLOR_THEME]: 'UniverseAgentStudio Light',
		[ThemeSettings.PREFERRED_DARK_THEME]: 'UniverseAgentStudio Dark',
		[ThemeSettings.PREFERRED_LIGHT_THEME]: 'UniverseAgentStudio Light',
	},
	source: 'productShell',
};

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerDefaultConfigurations([productColorThemeDefaults]);
