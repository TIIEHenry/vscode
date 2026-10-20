/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorCommandsContext } from '../../../common/editor.js';
import { IEditorService, ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { editorGroupToColumn } from '../../../services/editor/common/editorGroupColumn.js';
import { PreviewActiveCategoryContext } from '../../../services/editor/common/previewCategoryRouting.js';
import { PreviewCategory } from '../../../services/editor/common/previewCategoryService.js';
import { executePreviewTerminalEmptyState } from './editorGroupWatermark.js';

/** Add-tab menu for the main Preview editor groups. One visible action, so the control runs it directly. */
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
				when: PreviewActiveCategoryContext.notEqualsTo(PreviewCategory.Terminal),
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

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.preview.newTerminalTab',
			title: localize2('preview.newTerminalTab', "New Terminal"),
			tooltip: localize2('preview.newTerminalTabTooltip', "New Terminal"),
			icon: Codicon.terminal,
			f1: false,
			menu: {
				id: PreviewEditorTabsBarAddTab,
				group: 'navigation',
				order: 1,
				when: PreviewActiveCategoryContext.isEqualTo(PreviewCategory.Terminal),
			},
		});
	}

	override async run(accessor: ServicesAccessor, context?: IEditorCommandsContext): Promise<void> {
		const editorGroupsService = accessor.get(IEditorGroupsService);
		const group = typeof context?.groupId === 'number'
			? (editorGroupsService.getGroup(context.groupId) ?? editorGroupsService.activeGroup)
			: editorGroupsService.activeGroup;
		const column = editorGroupToColumn(editorGroupsService, group);
		await executePreviewTerminalEmptyState(accessor, column < 0 ? ACTIVE_GROUP : column);
	}
});
