/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { COLOR_THEME_DARK_INITIAL_COLORS, COLOR_THEME_LIGHT_INITIAL_COLORS, ThemeSettingDefaults } from './workbenchThemeService.js';

export interface IInitialColorMap {
	[colorId: string]: string;
}

const registeredInitialColorThemes = new Map<string, IInitialColorMap>();

/**
 * Registers the placeholder colors the theme service paints for a color theme settings id
 * until that theme has loaded. The theme service reads them once, when it is constructed,
 * so register from a module that the window entry imports.
 */
export function registerInitialColorTheme(settingsId: string, colors: IInitialColorMap): IDisposable {
	registeredInitialColorThemes.set(settingsId, colors);
	return toDisposable(() => {
		if (registeredInitialColorThemes.get(settingsId) === colors) {
			registeredInitialColorThemes.delete(settingsId);
		}
	});
}

/**
 * Placeholder colors for a color theme settings id: a registered table, else the built-in
 * table when the id is one of the built-in light / dark defaults, else `undefined`.
 */
export function getInitialColorTheme(settingsId: string): IInitialColorMap | undefined {
	const registered = registeredInitialColorThemes.get(settingsId);
	if (registered) {
		return registered;
	}
	switch (settingsId) {
		case ThemeSettingDefaults.COLOR_THEME_LIGHT: return COLOR_THEME_LIGHT_INITIAL_COLORS;
		case ThemeSettingDefaults.COLOR_THEME_DARK: return COLOR_THEME_DARK_INITIAL_COLORS;
	}
	return undefined;
}
