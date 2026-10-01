/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { EditorInputCapabilities, IUntypedEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';

const planningTodoEditorIcon = registerIcon('planning-todo-editor-label-icon', Codicon.checklist, localize('planningTodoEditorLabelIcon', 'Icon of the planning todo editor.'));

/**
 * Preview Planning editor. `isPlanningInput` is what the existing preview
 * classifier reads. The resource scheme is intentionally not `planning` /
 * `todo` / `project-context`, so the flag is the classification, not the URI.
 */
export class PlanningTodoEditorInput extends EditorInput {

	static readonly ID = 'workbench.editor.planningTodo';

	/**
	 * Not a classifier scheme. `planning`, `todo`, and `project-context` already
	 * map to Planning; this scheme must stay outside that list.
	 */
	static readonly RESOURCE = URI.from({
		scheme: 'planning-todo',
		path: '/todos'
	});

	/**
	 * Read by `readBooleanFlag(..., "isPlanningInput")` in the preview classifier.
	 * Must stay `true` on the instance (`key in input`).
	 */
	readonly isPlanningInput = true;

	private static _instance: PlanningTodoEditorInput | undefined;

	static getInstance(): PlanningTodoEditorInput {
		if (!PlanningTodoEditorInput._instance || PlanningTodoEditorInput._instance.isDisposed()) {
			PlanningTodoEditorInput._instance = new PlanningTodoEditorInput();
		}
		return PlanningTodoEditorInput._instance;
	}

	override get typeId(): string {
		return PlanningTodoEditorInput.ID;
	}

	override get editorId(): string | undefined {
		return PlanningTodoEditorInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override get resource(): URI {
		return PlanningTodoEditorInput.RESOURCE;
	}

	override getName(): string {
		return localize('planningTodoInputName', "Planning");
	}

	override getIcon(): ThemeIcon {
		return planningTodoEditorIcon;
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof PlanningTodoEditorInput;
	}
}
