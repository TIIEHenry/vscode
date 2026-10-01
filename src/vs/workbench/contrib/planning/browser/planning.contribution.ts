/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { PlanningTodoEditor } from './planningTodoEditor.js';
import { PlanningTodoEditorInput } from './planningTodoEditorInput.js';

/** Command palette entry. Watermark actions are owned by another slice. */
export const PLANNING_OPEN_TODOS_COMMAND_ID = 'workbench.action.planning.openTodos';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		PlanningTodoEditor,
		PlanningTodoEditor.ID,
		localize('planningTodoEditor', "Planning"),
	),
	[new SyncDescriptor(PlanningTodoEditorInput)],
);

registerAction2(class OpenPlanningTodosAction extends Action2 {
	constructor() {
		super({
			id: PLANNING_OPEN_TODOS_COMMAND_ID,
			title: localize2('planningOpenTodos', "Open Planning Todos"),
			category: localize2('planning', "Planning"),
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IEditorService).openEditor(PlanningTodoEditorInput.getInstance(), { pinned: true });
	}
});
