/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type SideBySideEditorLayoutOrientation = 'horizontal' | 'vertical';

export interface SideBySideEditorPaneSizeConstraints {
	minimumWidth: number;
	maximumWidth: number;
	minimumHeight: number;
	maximumHeight: number;
}

export function combineSideBySideEditorSizeConstraints(
	orientation: SideBySideEditorLayoutOrientation,
	primary: SideBySideEditorPaneSizeConstraints,
	secondary: SideBySideEditorPaneSizeConstraints,
): SideBySideEditorPaneSizeConstraints {
	if (orientation === 'horizontal') {
		return {
			minimumWidth: primary.minimumWidth + secondary.minimumWidth,
			maximumWidth: primary.maximumWidth + secondary.maximumWidth,
			minimumHeight: Math.max(primary.minimumHeight, secondary.minimumHeight),
			maximumHeight: Math.min(primary.maximumHeight, secondary.maximumHeight),
		};
	}

	return {
		minimumWidth: Math.max(primary.minimumWidth, secondary.minimumWidth),
		maximumWidth: Math.min(primary.maximumWidth, secondary.maximumWidth),
		minimumHeight: primary.minimumHeight + secondary.minimumHeight,
		maximumHeight: primary.maximumHeight + secondary.maximumHeight,
	};
}
