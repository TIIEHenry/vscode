/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../base/common/event.js';
import { Color } from '../../../../base/common/color.js';
import { IColorTheme, IThemeService, IFileIconTheme, IProductIconTheme } from '../../../../platform/theme/common/themeService.js';
import { ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { isBoolean, isString } from '../../../../base/common/types.js';
import { IconContribution, IconDefinition } from '../../../../platform/theme/common/iconRegistry.js';
import { ColorScheme, ThemeTypeSelector } from '../../../../platform/theme/common/theme.js';

export const IWorkbenchThemeService = refineServiceDecorator<IThemeService, IWorkbenchThemeService>(IThemeService);

export const THEME_SCOPE_OPEN_PAREN = '[';
export const THEME_SCOPE_CLOSE_PAREN = ']';
export const THEME_SCOPE_WILDCARD = '*';

export const themeScopeRegex = /\[(.+?)\]/g;

export enum ThemeSettings {
	COLOR_THEME = 'workbench.colorTheme',
	FILE_ICON_THEME = 'workbench.iconTheme',
	PRODUCT_ICON_THEME = 'workbench.productIconTheme',
	COLOR_CUSTOMIZATIONS = 'workbench.colorCustomizations',
	TOKEN_COLOR_CUSTOMIZATIONS = 'editor.tokenColorCustomizations',
	SEMANTIC_TOKEN_COLOR_CUSTOMIZATIONS = 'editor.semanticTokenColorCustomizations',

	PREFERRED_DARK_THEME = 'workbench.preferredDarkColorTheme',
	PREFERRED_LIGHT_THEME = 'workbench.preferredLightColorTheme',
	PREFERRED_HC_DARK_THEME = 'workbench.preferredHighContrastColorTheme', /* id kept for compatibility reasons */
	PREFERRED_HC_LIGHT_THEME = 'workbench.preferredHighContrastLightColorTheme',
	DETECT_COLOR_SCHEME = 'window.autoDetectColorScheme',
	DETECT_HC = 'window.autoDetectHighContrast',

	SYSTEM_COLOR_THEME = 'window.systemColorTheme'
}

export namespace ThemeSettingDefaults {
	export const COLOR_THEME_DARK = 'UniverseAgentStudio Dark';
	export const COLOR_THEME_LIGHT = 'UniverseAgentStudio Light';
	export const COLOR_THEME_HC_DARK = 'Default High Contrast';
	export const COLOR_THEME_HC_LIGHT = 'Default High Contrast Light';

	export const FILE_ICON_THEME = 'vs-seti';
	export const PRODUCT_ICON_THEME = 'Default';
}

/**
 * Migrates legacy theme settings IDs to their current equivalents.
 * Theme IDs were simplified: "Default" prefix was removed from built-in themes,
 * and "Experimental" prefix was replaced when VS Code themes became GA.
 */
export function migrateThemeSettingsId(settingsId: string): string {
	switch (settingsId) {
		case 'Default Dark Modern': return 'Dark Modern';
		case 'Default Light Modern': return 'Light Modern';
		case 'Default Dark+': return 'Dark+';
		case 'Default Light+': return 'Light+';
		case 'Experimental Dark':
		case 'VS Code Dark':
			return ThemeSettingDefaults.COLOR_THEME_DARK;
		case 'Experimental Light':
		case 'VS Code Light':
			return ThemeSettingDefaults.COLOR_THEME_LIGHT;
	}
	return settingsId;
}

export const NEW_DEFAULT_THEME_NOTIFICATION_PENDING_SETTINGS_ID_KEY = 'workbench.newDefaultThemeNotification.pendingSettingsId';

const MODERN_THEME_SETTINGS_IDS = ['Dark Modern', 'Light Modern'] as const;

function isModernThemeSettingsId(settingsId: string | undefined): settingsId is typeof MODERN_THEME_SETTINGS_IDS[number] {
	return settingsId === 'Dark Modern' || settingsId === 'Light Modern';
}

/**
 * Resolves the Modern previous settings id used for the new-default-theme notification.
 * When the call parameter migrates to Dark/Light Modern, that wins; otherwise the pending storage value is used.
 */
export function resolveEffectiveModernPreviousSettingsId(
	previousSettingsIdParam: string | undefined,
	pendingSettingsId: string | undefined
): string | undefined {
	if (previousSettingsIdParam !== undefined) {
		const migrated = migrateThemeSettingsId(previousSettingsIdParam);
		if (isModernThemeSettingsId(migrated)) {
			return migrated;
		}
	}
	if (isModernThemeSettingsId(pendingSettingsId)) {
		return pendingSettingsId;
	}
	return undefined;
}

export function isNewDefaultThemeNotificationEligible(input: {
	effectiveModernPreviousSettingsId: string | undefined;
	isDefaultColorTheme: boolean;
	colorTheme: string;
}): boolean {
	if (!isModernThemeSettingsId(input.effectiveModernPreviousSettingsId)) {
		return false;
	}
	if (!input.isDefaultColorTheme) {
		return false;
	}
	return input.colorTheme === ThemeSettingDefaults.COLOR_THEME_DARK || input.colorTheme === ThemeSettingDefaults.COLOR_THEME_LIGHT;
}

export const enum NewDefaultThemeNotificationDecisionKind {
	NoOp = 0,
	Show = 1,
	WaitForFocus = 2,
}

export interface NewDefaultThemeNotificationDecision {
	readonly kind: NewDefaultThemeNotificationDecisionKind;
	readonly markNotificationShown: boolean;
	readonly clearPendingSettingsId: boolean;
	readonly pendingSettingsIdToStore: string | undefined;
}

export function decideNewDefaultThemeNotification(input: {
	notificationAlreadyShown: boolean;
	previousSettingsIdParam: string | undefined;
	pendingSettingsId: string | undefined;
	hadLastFocus: boolean;
	isSessionsWindow: boolean;
	isDefaultColorTheme: boolean;
	colorTheme: string;
}): NewDefaultThemeNotificationDecision {
	const noStorageChange: NewDefaultThemeNotificationDecision = {
		kind: NewDefaultThemeNotificationDecisionKind.NoOp,
		markNotificationShown: false,
		clearPendingSettingsId: false,
		pendingSettingsIdToStore: undefined,
	};

	if (input.notificationAlreadyShown) {
		return noStorageChange;
	}

	const effectiveModernPreviousSettingsId = resolveEffectiveModernPreviousSettingsId(input.previousSettingsIdParam, input.pendingSettingsId);
	const eligible = isNewDefaultThemeNotificationEligible({
		effectiveModernPreviousSettingsId,
		isDefaultColorTheme: input.isDefaultColorTheme,
		colorTheme: input.colorTheme,
	});

	if (input.isSessionsWindow) {
		if (eligible && effectiveModernPreviousSettingsId) {
			return {
				kind: NewDefaultThemeNotificationDecisionKind.NoOp,
				markNotificationShown: false,
				clearPendingSettingsId: false,
				pendingSettingsIdToStore: effectiveModernPreviousSettingsId,
			};
		}
		return noStorageChange;
	}

	if (eligible) {
		if (input.hadLastFocus) {
			return {
				kind: NewDefaultThemeNotificationDecisionKind.Show,
				markNotificationShown: true,
				clearPendingSettingsId: true,
				pendingSettingsIdToStore: undefined,
			};
		}
		return {
			kind: NewDefaultThemeNotificationDecisionKind.WaitForFocus,
			markNotificationShown: false,
			clearPendingSettingsId: false,
			pendingSettingsIdToStore: effectiveModernPreviousSettingsId,
		};
	}

	if (input.hadLastFocus) {
		return {
			kind: NewDefaultThemeNotificationDecisionKind.NoOp,
			markNotificationShown: true,
			clearPendingSettingsId: true,
			pendingSettingsIdToStore: undefined,
		};
	}

	return noStorageChange;
}

/**
 * Built-in default color theme settings id for each {@link ColorScheme} tier.
 */
export function getDefaultColorThemeSettingsIdForColorScheme(colorScheme: ColorScheme): string {
	switch (colorScheme) {
		case ColorScheme.LIGHT:
			return ThemeSettingDefaults.COLOR_THEME_LIGHT;
		case ColorScheme.DARK:
			return ThemeSettingDefaults.COLOR_THEME_DARK;
		case ColorScheme.HIGH_CONTRAST_DARK:
			return ThemeSettingDefaults.COLOR_THEME_HC_DARK;
		case ColorScheme.HIGH_CONTRAST_LIGHT:
			return ThemeSettingDefaults.COLOR_THEME_HC_LIGHT;
	}
}

export const COLOR_THEME_DARK_INITIAL_COLORS = {
	'actionBar.toggledBackground': '#383a49',
	'activityBar.activeBorder': '#bfbfbf',
	'activityBar.activeBackground': '#242526',
	'activityBar.background': '#191A1B',
	'activityBar.border': '#00000000',
	'activityBar.foreground': '#bfbfbf',
	'activityBar.inactiveForeground': '#707070',
	'activityBarBadge.background': '#767676',
	'activityBarBadge.foreground': '#FFFFFF',
	'badge.background': '#767676',
	'badge.foreground': '#FFFFFF',
	'button.background': '#F3F3F3',
	'button.border': '#F3F3F3',
	'button.foreground': '#1F1F1F',
	'button.hoverBackground': '#FFFFFF',
	'button.secondaryBackground': '#00000000',
	'button.secondaryForeground': '#CCCCCC',
	'button.secondaryHoverBackground': '#FFFFFF10',
	'chat.slashCommandBackground': '#26477866',
	'chat.slashCommandForeground': '#85B6FF',
	'chat.editedFileForeground': '#E2C08D',
	'checkbox.background': '#242526',
	'checkbox.border': '#707070',
	'debugToolBar.background': '#181818',
	'descriptionForeground': '#8C8C8C',
	'dropdown.background': '#191A1B',
	'dropdown.border': '#333536',
	'dropdown.foreground': '#bfbfbf',
	'dropdown.listBackground': '#191A1B',
	'editor.background': '#121314',
	'editor.findMatchBackground': '#27678290',
	'editor.foreground': '#BBBEBF',
	'editor.inactiveSelectionBackground': '#27678260',
	'editor.selectionHighlightBackground': '#27678260',
	'editorGroup.border': '#FFFFFF17',
	'editorGroupHeader.tabsBackground': '#191A1B',
	'editorGroupHeader.tabsBorder': '#00000000',
	'editorGutter.addedBackground': '#72C892',
	'editorGutter.deletedBackground': '#F28772',
	'editorGutter.modifiedBackground': '#0078D4',
	'editorIndentGuide.activeBackground1': '#707070',
	'editorIndentGuide.background1': '#404040',
	'editorLineNumber.activeForeground': '#BBBEBF',
	'editorLineNumber.foreground': '#858889',
	'editorOverviewRuler.border': '#2A2B2CFF',
	'editorWidget.background': '#202122',
	'errorForeground': '#f48771',
	'focusBorder': '#3994BCB3',
	'foreground': '#bfbfbf',
	'icon.foreground': '#8C8C8C',
	'input.background': '#191A1B',
	'input.border': '#FFFFFF14',
	'input.foreground': '#bfbfbf',
	'input.placeholderForeground': '#8C8C8C',
	'inputOption.activeBackground': '#313233',
	'inputOption.activeBorder': '#2A2B2CFF',
	'keybindingLabel.foreground': '#CCCCCC',
	'list.activeSelectionIconForeground': '#FFF',
	'list.dropBackground': '#3994BC1A',
	'menu.background': '#202122',
	'menu.border': '#2A2B2CFF',
	'menu.foreground': '#bfbfbf',
	'menu.selectionBackground': '#FFFFFF14',
	'menu.separatorBackground': '#2A2B2C',
	'notificationCenterHeader.background': '#242526',
	'notificationCenterHeader.foreground': '#bfbfbf',
	'notifications.background': '#202122',
	'notifications.border': '#2A2B2CFF',
	'notifications.foreground': '#bfbfbf',
	'panel.background': '#191A1B',
	'panel.border': '#00000000',
	'panelInput.border': '#2B2B2B',
	'panelTitle.activeBorder': '#3994BC',
	'panelTitle.activeForeground': '#bfbfbf',
	'panelTitle.inactiveForeground': '#8C8C8C',
	'peekViewEditor.background': '#191A1B',
	'peekViewEditor.matchHighlightBackground': '#3994BC33',
	'peekViewResult.background': '#191A1B',
	'peekViewResult.matchHighlightBackground': '#3994BC33',
	'pickerGroup.border': '#2A2B2CFF',
	'ports.iconRunningProcessForeground': '#369432',
	'progressBar.background': '#878889',
	'quickInput.background': '#202122',
	'quickInput.foreground': '#bfbfbf',
	'settings.dropdownBackground': '#313131',
	'settings.dropdownBorder': '#3C3C3C',
	'settings.headerForeground': '#FFFFFF',
	'settings.modifiedItemIndicator': '#BB800966',
	'sideBar.background': '#191A1B',
	'sideBar.border': '#00000000',
	'sideBar.foreground': '#bfbfbf',
	'sideBarSectionHeader.background': '#191A1B',
	'sideBarSectionHeader.border': '#00000000',
	'sideBarSectionHeader.foreground': '#bfbfbf',
	'sideBarTitle.foreground': '#bfbfbf',
	'statusBar.background': '#191A1B',
	'statusBar.border': '#00000000',
	'statusBar.debuggingBackground': '#3994BC',
	'statusBar.debuggingForeground': '#FFFFFF',
	'statusBar.focusBorder': '#3994BCB3',
	'statusBar.foreground': '#8C8C8C',
	'statusBar.noFolderBackground': '#191A1B',
	'statusBarItem.focusBorder': '#3994BCB3',
	'statusBarItem.prominentBackground': '#3994BC',
	'statusBarItem.remoteBackground': '#0078D4',
	'statusBarItem.remoteForeground': '#FFFFFF',
	'tab.activeBackground': '#121314',
	'tab.activeBorder': '#121314',
	'tab.activeBorderTop': '#3994BC',
	'tab.activeForeground': '#bfbfbf',
	'tab.border': '#2A2B2CFF',
	'tab.hoverBackground': '#121314',
	'tab.inactiveBackground': '#191A1B',
	'tab.inactiveForeground': '#8C8C8C',
	'tab.lastPinnedBorder': '#2A2B2CFF',
	'tab.selectedBackground': '#37373D',
	'tab.selectedBorderTop': '#6caddf',
	'tab.selectedForeground': '#FFFFFF',
	'tab.unfocusedActiveBorder': '#1F1F1F',
	'tab.unfocusedActiveBorderTop': '#2B2B2B',
	'tab.unfocusedHoverBackground': '#1F1F1F',
	'terminal.foreground': '#CCCCCC',
	'terminal.inactiveSelectionBackground': '#3A3D41',
	'terminal.tab.activeBorder': '#3994BC00',
	'textBlockQuote.background': '#242526',
	'textBlockQuote.border': '#2A2B2CFF',
	'textCodeBlock.background': '#242526',
	'textLink.activeForeground': '#53A5CA',
	'textLink.foreground': '#48A0C7',
	'textPreformat.background': '#262626',
	'textPreformat.foreground': '#8C8C8C',
	'textSeparator.foreground': '#2a2a2aFF',
	'titleBar.activeBackground': '#191A1B',
	'titleBar.activeForeground': '#8C8C8C',
	'titleBar.border': '#00000000',
	'titleBar.inactiveBackground': '#191A1B',
	'titleBar.inactiveForeground': '#8C8C8C',
	'welcomePage.progress.foreground': '#0078D4',
	'welcomePage.tileBackground': '#2B2B2B',
	'widget.border': '#2A2B2CFF',
	'widget.shadow': '#00000059',
	'commandCenter.border': '#00000000',
	'conversation.background': '#191A1B',
	'agentsGradient.tintColor': '#3994BC',
	'agentsUpdateButton.downloadingBackground': '#3994BC66',
	'agentsUpdateButton.downloadedBackground': '#3994BCB3',
	'chat.inputWorkingBorderColor1': '#3994BC',
	'chat.inputWorkingBorderColor2': '#2A708F',
	'chat.inputWorkingBorderColor3': '#6BB8D4',
	'inlineEdit.gutterIndicator.primaryBorder': '#3994BC',
	'inlineEdit.gutterIndicator.successfulBorder': '#3994BC',
	'quickInputList.focusBackground': '#FFFFFF14',
	'quickInputList.focusForeground': '#bfbfbf',
	'quickInputList.focusIconForeground': '#bfbfbf',
	'quickInputList.focusHighlightForeground': '#bfbfbf'
};

export const COLOR_THEME_LIGHT_INITIAL_COLORS = {
	'actionBar.toggledBackground': '#dddddd',
	'activityBar.activeBorder': '#000000',
	'activityBar.activeBackground': '#E6E6E6',
	'activityBar.background': '#F6F6F6',
	'activityBar.border': '#00000000',
	'activityBar.foreground': '#202020',
	'activityBar.inactiveForeground': '#7A7A7A',
	'activityBarBadge.background': '#6A6A6A',
	'activityBarBadge.foreground': '#FFFFFF',
	'badge.background': '#6A6A6A',
	'badge.foreground': '#FFFFFF',
	'button.background': '#1F1F1F',
	'button.border': '#1F1F1F',
	'button.foreground': '#FFFFFF',
	'button.hoverBackground': '#2E2E2E',
	'button.secondaryBackground': '#EAEAEA',
	'button.secondaryForeground': '#202020',
	'button.secondaryHoverBackground': '#F2F3F4',
	'commandCenter.background': '#F6F6F6',
	'commandCenter.border': '#00000000',
	'conversation.background': '#FFFFFF',
	'agentsGradient.tintColor': '#0069CC',
	'agentsUpdateButton.downloadingBackground': '#0069CC66',
	'agentsUpdateButton.downloadedBackground': '#0069CCB3',
	'chat.inputWorkingBorderColor1': '#0069CC',
	'chat.inputWorkingBorderColor2': '#0058A8',
	'chat.inputWorkingBorderColor3': '#3D8AD4',
	'inlineEdit.gutterIndicator.primaryBorder': '#0069CC',
	'inlineEdit.gutterIndicator.successfulBorder': '#0069CC',
	'chat.slashCommandBackground': '#ADCEFF7A',
	'chat.slashCommandForeground': '#26569E',
	'chat.editedFileForeground': '#895503',
	'checkbox.background': '#EAEAEA',
	'checkbox.border': '#868686',
	'descriptionForeground': '#606060',
	'diffEditor.unchangedRegionBackground': '#f8f8f8',
	'dropdown.background': '#FFFFFF',
	'dropdown.border': '#D8D8D8',
	'dropdown.foreground': '#202020',
	'dropdown.listBackground': '#FFFFFF',
	'editor.background': '#FFFFFF',
	'editor.foreground': '#202020',
	'editor.inactiveSelectionBackground': '#0069CC1A',
	'editor.selectionHighlightBackground': '#0069CC15',
	'editorGroup.border': '#E5E5E5',
	'editorGroupHeader.tabsBackground': '#F6F6F6',
	'editorGroupHeader.tabsBorder': '#00000000',
	'editorGutter.addedBackground': '#587c0c',
	'editorGutter.deletedBackground': '#ad0707',
	'editorGutter.modifiedBackground': '#005FB8',
	'editorIndentGuide.activeBackground1': '#939393',
	'editorIndentGuide.background1': '#D3D3D3',
	'editorLineNumber.activeForeground': '#202020',
	'editorLineNumber.foreground': '#606060',
	'editorOverviewRuler.border': '#F0F1F2FF',
	'editorSuggestWidget.background': '#FFFFFF',
	'editorWidget.background': '#FFFFFF',
	'errorForeground': '#ad0707',
	'focusBorder': '#0069CCFF',
	'foreground': '#202020',
	'icon.foreground': '#606060',
	'input.background': '#FFFFFF',
	'input.border': '#20202014',
	'input.foreground': '#202020',
	'input.placeholderForeground': '#999999',
	'inputOption.activeBackground': '#D6D6D6',
	'inputOption.activeBorder': '#F0F1F2FF',
	'inputOption.activeForeground': '#202020',
	'keybindingLabel.foreground': '#3B3B3B',
	'list.activeSelectionBackground': '#00000025',
	'list.activeSelectionForeground': '#202020',
	'list.activeSelectionIconForeground': '#000000',
	'list.focusAndSelectionOutline': '#005FB8',
	'list.hoverBackground': '#00000014',
	'menu.border': '#E4E5E6FF',
	'menu.selectionBackground': '#00000014',
	'menu.selectionForeground': '#202020',
	'notebook.cellBorderColor': '#E5E5E5',
	'notebook.selectedCellBackground': '#C8DDF150',
	'notificationCenterHeader.background': '#FFFFFF',
	'notificationCenterHeader.foreground': '#202020',
	'notifications.background': '#FFFFFF',
	'notifications.border': '#F0F1F2FF',
	'notifications.foreground': '#202020',
	'panel.background': '#F6F6F6',
	'panel.border': '#00000000',
	'panelInput.border': '#E5E5E5',
	'panelTitle.activeBorder': '#000000',
	'panelTitle.activeForeground': '#202020',
	'panelTitle.inactiveForeground': '#606060',
	'peekViewEditor.matchHighlightBackground': '#0069CC33',
	'peekViewResult.background': '#FAFAFA',
	'peekViewResult.matchHighlightBackground': '#0069CC33',
	'pickerGroup.border': '#EEEEEE',
	'pickerGroup.foreground': '#202020',
	'ports.iconRunningProcessForeground': '#369432',
	'progressBar.background': '#0069CC',
	'quickInputList.focusBackground': '#00000014',
	'quickInputList.focusForeground': '#202020',
	'quickInputList.focusIconForeground': '#202020',
	'quickInputList.focusHighlightForeground': '#202020',
	'quickInput.background': '#FFFFFF',
	'quickInput.foreground': '#202020',
	'searchEditor.textInputBorder': '#CECECE',
	'settings.dropdownBackground': '#FFFFFF',
	'settings.dropdownBorder': '#CECECE',
	'settings.headerForeground': '#1F1F1F',
	'settings.modifiedItemIndicator': '#BB800966',
	'settings.numberInputBorder': '#CECECE',
	'settings.textInputBorder': '#20202014',
	'sideBar.background': '#F6F6F6',
	'sideBar.border': '#00000000',
	'sideBar.foreground': '#202020',
	'sideBarSectionHeader.background': '#F6F6F6',
	'sideBarSectionHeader.border': '#00000000',
	'sideBarSectionHeader.foreground': '#202020',
	'sideBarTitle.foreground': '#202020',
	'statusBar.background': '#F6F6F6',
	'statusBar.border': '#00000000',
	'statusBar.debuggingBackground': '#0069CC',
	'statusBar.debuggingForeground': '#FFFFFF',
	'statusBar.focusBorder': '#0069CCFF',
	'statusBar.foreground': '#606060',
	'statusBar.noFolderBackground': '#F6F6F6',
	'statusBarItem.compactHoverBackground': '#CCCCCC',
	'statusBarItem.errorBackground': '#C72E0F',
	'statusBarItem.focusBorder': '#0069CCFF',
	'statusBarItem.hoverBackground': '#E3E3E5',
	'statusBarItem.prominentBackground': '#0069CCDD',
	'statusBarItem.remoteBackground': '#005FB8',
	'statusBarItem.remoteForeground': '#FFFFFF',
	'tab.activeBackground': '#FFFFFF',
	'tab.activeBorder': '#FFFFFF',
	'tab.activeBorderTop': '#000000',
	'tab.activeForeground': '#202020',
	'tab.border': '#F0F1F2FF',
	'tab.hoverBackground': '#FFFFFF',
	'tab.inactiveBackground': '#F6F6F6',
	'tab.unfocusedActiveBackground': '#F6F6F6',
	'tab.unfocusedInactiveBackground': '#F6F6F6',
	'tab.inactiveForeground': '#606060',
	'tab.lastPinnedBorder': '#F0F1F2FF',
	'tab.selectedBackground': '#E4E6F1',
	'tab.selectedBorderTop': '#68a3da',
	'tab.selectedForeground': '#333333',
	'tab.unfocusedActiveBorder': '#F8F8F8',
	'tab.unfocusedActiveBorderTop': '#E5E5E5',
	'tab.unfocusedHoverBackground': '#F8F8F8',
	'terminal.foreground': '#3B3B3B',
	'terminal.inactiveSelectionBackground': '#E5EBF1',
	'terminal.tab.activeBorder': '#005FB8',
	'terminalCursor.foreground': '#202020',
	'textBlockQuote.background': '#EAEAEA',
	'textBlockQuote.border': '#F0F1F2FF',
	'textCodeBlock.background': '#EAEAEA',
	'textLink.activeForeground': '#0069CC',
	'textLink.foreground': '#0069CC',
	'textPreformat.background': '#ECECEC',
	'textPreformat.foreground': '#606060',
	'textSeparator.foreground': '#EEEEEEFF',
	'titleBar.activeBackground': '#F6F6F6',
	'titleBar.activeForeground': '#606060',
	'titleBar.border': '#00000000',
	'titleBar.inactiveBackground': '#F6F6F6',
	'titleBar.inactiveForeground': '#606060',
	'welcomePage.tileBackground': '#F3F3F3',
	'widget.border': '#E2E2E2',
	'widget.shadow': '#0000001A'
};

export interface IWorkbenchTheme {
	readonly id: string;
	readonly label: string;
	readonly extensionData?: ExtensionData;
	readonly description?: string;
	readonly settingsId: string | null;
}

export interface IWorkbenchColorTheme extends IWorkbenchTheme, IColorTheme {
	readonly settingsId: string;
	readonly tokenColors: ITextMateThemingRule[];
}

export interface IColorMap {
	[id: string]: Color;
}

export interface IWorkbenchFileIconTheme extends IWorkbenchTheme, IFileIconTheme {
}

export interface IWorkbenchProductIconTheme extends IWorkbenchTheme, IProductIconTheme {
	readonly settingsId: string;

	getIcon(icon: IconContribution): IconDefinition | undefined;
}

export type ThemeSettingTarget = ConfigurationTarget | undefined | 'auto' | 'preview';


export interface IWorkbenchThemeService extends IThemeService {
	readonly _serviceBrand: undefined;
	setColorTheme(themeId: string | undefined | IWorkbenchColorTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchColorTheme | null>;
	getColorTheme(): IWorkbenchColorTheme;
	getColorThemes(): Promise<IWorkbenchColorTheme[]>;
	getMarketplaceColorThemes(publisher: string, name: string, version: string): Promise<IWorkbenchColorTheme[]>;
	readonly onDidColorThemeChange: Event<IWorkbenchColorTheme>;

	getPreferredColorScheme(): ColorScheme | undefined;

	setFileIconTheme(iconThemeId: string | undefined | IWorkbenchFileIconTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchFileIconTheme>;
	getFileIconTheme(): IWorkbenchFileIconTheme;
	getFileIconThemes(): Promise<IWorkbenchFileIconTheme[]>;
	getMarketplaceFileIconThemes(publisher: string, name: string, version: string): Promise<IWorkbenchFileIconTheme[]>;
	readonly onDidFileIconThemeChange: Event<IWorkbenchFileIconTheme>;

	setProductIconTheme(iconThemeId: string | undefined | IWorkbenchProductIconTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchProductIconTheme>;
	getProductIconTheme(): IWorkbenchProductIconTheme;
	getProductIconThemes(): Promise<IWorkbenchProductIconTheme[]>;
	getMarketplaceProductIconThemes(publisher: string, name: string, version: string): Promise<IWorkbenchProductIconTheme[]>;
	readonly onDidProductIconThemeChange: Event<IWorkbenchProductIconTheme>;
}

export interface IThemeScopedColorCustomizations {
	[colorId: string]: string;
}

export interface IColorCustomizations {
	[colorIdOrThemeScope: string]: IThemeScopedColorCustomizations | string;
}

export interface IThemeScopedTokenColorCustomizations {
	[groupId: string]: ITextMateThemingRule[] | ITokenColorizationSetting | boolean | string | undefined;
	comments?: string | ITokenColorizationSetting;
	strings?: string | ITokenColorizationSetting;
	numbers?: string | ITokenColorizationSetting;
	keywords?: string | ITokenColorizationSetting;
	types?: string | ITokenColorizationSetting;
	functions?: string | ITokenColorizationSetting;
	variables?: string | ITokenColorizationSetting;
	textMateRules?: ITextMateThemingRule[];
	semanticHighlighting?: boolean; // deprecated, use ISemanticTokenColorCustomizations.enabled instead
}

export interface ITokenColorCustomizations {
	[groupIdOrThemeScope: string]: IThemeScopedTokenColorCustomizations | ITextMateThemingRule[] | ITokenColorizationSetting | boolean | string | undefined;
	comments?: string | ITokenColorizationSetting;
	strings?: string | ITokenColorizationSetting;
	numbers?: string | ITokenColorizationSetting;
	keywords?: string | ITokenColorizationSetting;
	types?: string | ITokenColorizationSetting;
	functions?: string | ITokenColorizationSetting;
	variables?: string | ITokenColorizationSetting;
	textMateRules?: ITextMateThemingRule[];
	semanticHighlighting?: boolean; // deprecated, use ISemanticTokenColorCustomizations.enabled instead
}

export interface IThemeScopedSemanticTokenColorCustomizations {
	[styleRule: string]: ISemanticTokenRules | boolean | undefined;
	enabled?: boolean;
	rules?: ISemanticTokenRules;
}

export interface ISemanticTokenColorCustomizations {
	[styleRuleOrThemeScope: string]: IThemeScopedSemanticTokenColorCustomizations | ISemanticTokenRules | boolean | undefined;
	enabled?: boolean;
	rules?: ISemanticTokenRules;
}

export interface IThemeScopedExperimentalSemanticTokenColorCustomizations {
	[themeScope: string]: ISemanticTokenRules | undefined;
}

export interface IExperimentalSemanticTokenColorCustomizations {
	[styleRuleOrThemeScope: string]: IThemeScopedExperimentalSemanticTokenColorCustomizations | ISemanticTokenRules | undefined;
}

export type IThemeScopedCustomizations =
	IThemeScopedColorCustomizations
	| IThemeScopedTokenColorCustomizations
	| IThemeScopedExperimentalSemanticTokenColorCustomizations
	| IThemeScopedSemanticTokenColorCustomizations;

export type IThemeScopableCustomizations =
	IColorCustomizations
	| ITokenColorCustomizations
	| IExperimentalSemanticTokenColorCustomizations
	| ISemanticTokenColorCustomizations;

export interface ISemanticTokenRules {
	[selector: string]: string | ISemanticTokenColorizationSetting | undefined;
}

export interface ITextMateThemingRule {
	name?: string;
	scope?: string | string[];
	settings: ITokenColorizationSetting;
}

export interface ITokenColorizationSetting {
	foreground?: string;
	background?: string;
	fontStyle?: string; /* [italic|bold|underline|strikethrough] */
	fontFamily?: string;
	fontSize?: number;
	lineHeight?: number;
}

export interface ISemanticTokenColorizationSetting {
	foreground?: string;
	fontStyle?: string; /* [italic|bold|underline|strikethrough] */
	bold?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	italic?: boolean;
}

export interface ExtensionData {
	extensionId: string;
	extensionPublisher: string;
	extensionName: string;
	extensionIsBuiltin: boolean;
}

export namespace ExtensionData {
	export function toJSONObject(d: ExtensionData | undefined): any {
		return d && { _extensionId: d.extensionId, _extensionIsBuiltin: d.extensionIsBuiltin, _extensionName: d.extensionName, _extensionPublisher: d.extensionPublisher };
	}
	export function fromJSONObject(o: any): ExtensionData | undefined {
		if (o && isString(o._extensionId) && isBoolean(o._extensionIsBuiltin) && isString(o._extensionName) && isString(o._extensionPublisher)) {
			return { extensionId: o._extensionId, extensionIsBuiltin: o._extensionIsBuiltin, extensionName: o._extensionName, extensionPublisher: o._extensionPublisher };
		}
		return undefined;
	}
	export function fromName(publisher: string, name: string, isBuiltin = false): ExtensionData {
		return { extensionPublisher: publisher, extensionId: `${publisher}.${name}`, extensionName: name, extensionIsBuiltin: isBuiltin };
	}
}

export interface IThemeExtensionPoint {
	id: string;
	label?: string;
	description?: string;
	path: string;
	uiTheme?: ThemeTypeSelector;
	_watch: boolean; // unsupported options to watch location
}
