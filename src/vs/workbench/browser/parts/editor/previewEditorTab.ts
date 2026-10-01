/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorCommandsContext } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';

/** Add-tab menu for the main Preview editor groups. One action, so the `+` runs it directly. */
export const PreviewEditorTabsBarAddTab = new MenuId('PreviewEditorTabsBarAddTab');

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.preview.newEditorTab',
			title: localize2('preview.newEditorTab', "New Untitled File"),
			tooltip: localize2('preview.newEditorTabTooltip', "New Untitled File"),
			icon: Codicon.add,
			f1: false,
			menu: {
				id: PreviewEditorTabsBarAddTab,
				group: 'navigation',
				order: 1,
			},
		});
	}

	override async run(accessor: ServicesAccessor, context?: IEditorCommandsContext): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const editorGroupsService = accessor.get(IEditorGroupsService);
		const group = typeof context?.groupId === 'number'
			? (editorGroupsService.getGroup(context.groupId) ?? editorGroupsService.activeGroup)
			: editorGroupsService.activeGroup;
		await editorService.openEditor({
			resource: undefined,
			options: { pinned: true },
		}, group);
	}
});
