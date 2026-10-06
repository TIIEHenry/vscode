/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IEditorPartGridLayoutMetrics {
	readonly top: number;
	readonly height: number;
}

/**
 * Computes grid origin and height when vertical space above the editor grid is
 * reserved either as a content header or as a layout inset (e.g. Preview category bar).
 * The larger of the two is applied once — they must not stack.
 */
export function computeEditorPartGridLayout(
	contentTop: number,
	contentHeight: number,
	header: number,
	insetHeight: number,
): IEditorPartGridLayoutMetrics {
	const reserved = Math.max(header, insetHeight);
	return {
		top: contentTop + reserved,
		height: Math.max(0, contentHeight - reserved),
	};
}
