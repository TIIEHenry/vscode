/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function computeBreakpointInputWidth(widthInPixel: number, modeContainerWidth: number | undefined): number {
	if (modeContainerWidth === undefined) {
		return widthInPixel - 113;
	}
	return Math.max(0, widthInPixel - 113 - modeContainerWidth);
}
