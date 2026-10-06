/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type MoveViewsBetweenPanelsStep =
	| { readonly type: 'move'; readonly id: string }
	| { readonly type: 'showPart'; readonly part: 'panel' | 'auxiliaryBar' }
	| { readonly type: 'open'; readonly id: string; readonly preserveFocus: boolean };

export function planMoveViewsBetweenPanels(
	sourceIds: readonly string[],
	activeId: string | undefined,
	destinationIsPanel: boolean,
): readonly MoveViewsBetweenPanelsStep[] {
	if (sourceIds.length === 0) {
		return [];
	}

	const steps: MoveViewsBetweenPanelsStep[] = [];
	for (const id of sourceIds) {
		steps.push({ type: 'move', id });
	}
	steps.push({ type: 'showPart', part: destinationIsPanel ? 'panel' : 'auxiliaryBar' });
	if (activeId !== undefined) {
		steps.push({ type: 'open', id: activeId, preserveFocus: true });
	}
	return steps;
}
