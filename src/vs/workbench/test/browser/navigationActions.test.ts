/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Direction } from '../../../base/browser/ui/grid/grid.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../platform/instantiation/common/instantiation.js';
import '../../browser/actions/navigationActions.js';
import { IEditorGroupsService } from '../../services/editor/common/editorGroupsService.js';
import { IWorkbenchLayoutService, Parts } from '../../services/layout/browser/layoutService.js';
import { IPaneCompositePartService } from '../../services/panecomposite/browser/panecomposite.js';

suite('Navigate to the view on the left / right', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function navigate(commandId: string, focused: Parts, neighbours: ReadonlyMap<string, Parts>): string[] {
		const calls: string[] = [];
		const layoutService = {
			hasFocus: (part: Parts) => part === focused,
			getVisibleNeighborPart: (part: Parts, direction: Direction) => neighbours.get(`${part}:${direction}`),
			focusPart: (part: Parts) => calls.push(`focus:${part}`),
		} as unknown as IWorkbenchLayoutService;
		const services = new Map<unknown, unknown>([
			[IWorkbenchLayoutService, layoutService],
			[IEditorGroupsService, {}],
			[IPaneCompositePartService, {}],
		]);
		const accessor = { get: (id: unknown) => services.get(id) } as unknown as ServicesAccessor;
		CommandsRegistry.getCommand(commandId)!.handler(accessor);
		return calls;
	}

	test('moves focus between Conversation and Sources instead of doing nothing', () => {
		const neighbours = new Map<string, Parts>([
			[`${Parts.CONVERSATION_PART}:${Direction.Right}`, Parts.SOURCES_PART],
			[`${Parts.SOURCES_PART}:${Direction.Left}`, Parts.CONVERSATION_PART],
		]);

		assert.deepStrictEqual([
			...navigate('workbench.action.navigateRight', Parts.CONVERSATION_PART, neighbours),
			...navigate('workbench.action.navigateLeft', Parts.SOURCES_PART, neighbours),
		], [`focus:${Parts.SOURCES_PART}`, `focus:${Parts.CONVERSATION_PART}`]);
	});
});
