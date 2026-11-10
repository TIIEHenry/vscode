/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IDiffEditorConstructionOptions } from '../../../../editor/browser/editorBrowser.js';
import { diffEditorDefaultOptions } from '../../../../editor/common/config/diffEditor.js';
import type { IConfigurationChangeEvent, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

const SOURCES_DIFF_LAYOUT_SETTINGS = [
	'diffEditor.renderSideBySide',
	'diffEditor.useInlineViewWhenSpaceIsLimited',
	'diffEditor.renderSideBySideInlineBreakpoint',
] as const;

/**
 * Side-by-side versus inline, and when a narrow host switches to inline, follow the user's
 * diff editor settings so the Sources diff and the review pane match the regular diff editor.
 */
export function sourcesDiffEditorLayoutOptions(configurationService: IConfigurationService): Pick<IDiffEditorConstructionOptions, 'renderSideBySide' | 'useInlineViewWhenSpaceIsLimited' | 'renderSideBySideInlineBreakpoint'> {
	return {
		renderSideBySide: configurationService.getValue<boolean>('diffEditor.renderSideBySide') ?? diffEditorDefaultOptions.renderSideBySide,
		useInlineViewWhenSpaceIsLimited: configurationService.getValue<boolean>('diffEditor.useInlineViewWhenSpaceIsLimited') ?? diffEditorDefaultOptions.useInlineViewWhenSpaceIsLimited,
		renderSideBySideInlineBreakpoint: configurationService.getValue<number>('diffEditor.renderSideBySideInlineBreakpoint') ?? diffEditorDefaultOptions.renderSideBySideInlineBreakpoint,
	};
}

export function affectsSourcesDiffEditorLayout(e: IConfigurationChangeEvent): boolean {
	return SOURCES_DIFF_LAYOUT_SETTINGS.some(key => e.affectsConfiguration(key));
}
