/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type PanelPartLayoutPosition = 'left' | 'right' | 'top' | 'bottom';

export interface IPanelPartContentDimension {
	readonly width: number;
	readonly height: number;
}

/**
 * Content dimensions passed to {@link AbstractPaneCompositePart.layout} for the panel part,
 * accounting for classic single-border insets on some edges.
 */
export function computePanelPartContentDimension(
	position: PanelPartLayoutPosition,
	width: number,
	height: number,
	floating: boolean,
	editorVisible: boolean,
): IPanelPartContentDimension {
	const classicLeftBorder = !floating && editorVisible;

	switch (position) {
		case 'right':
			return { width: width - 1, height };
		case 'top':
			return { width, height: height - 1 };
		case 'left':
			return {
				width: classicLeftBorder ? width - 1 : width,
				height,
			};
		case 'bottom':
			return { width, height };
	}
}
