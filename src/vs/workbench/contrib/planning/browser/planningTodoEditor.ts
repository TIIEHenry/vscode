/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/planningTodoEditor.css';
import { $, append, clearNode, Dimension } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { loadPlanningTodos, planningTodoDeps } from './planningTodoModel.js';
import { PlanningTodoEditorInput } from './planningTodoEditorInput.js';
import { renderPlanningTodos } from './planningTodoRenderer.js';

export class PlanningTodoEditor extends EditorPane {

	static readonly ID = PlanningTodoEditorInput.ID;

	private container: HTMLElement | undefined;
	private loadGeneration = 0;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IAgentSessionContext private readonly session: IAgentSessionContext,
	) {
		super(PlanningTodoEditor.ID, group, telemetryService, themeService, storageService);

		this._register(this.connection.onDidChangeConnection(() => this.requestReload()));
		this._register(this.session.onDidChangeActiveSession(() => this.requestReload()));
		this._register(this.session.onDidChangeSession(() => this.requestReload()));
	}

	protected override createEditor(parent: HTMLElement): void {
		this.container = append(parent, $('div.planning-todo-editor'));
		this.container.tabIndex = 0;
		this.container.setAttribute('role', 'region');
		this.container.setAttribute('aria-label', localize('planningTodo.region', "Planning"));
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		if (token.isCancellationRequested || this.input !== input || !this.container) {
			return;
		}
		await this.reload();
	}

	override clearInput(): void {
		this.loadGeneration++;
		if (this.container) {
			clearNode(this.container);
			this.container.removeAttribute('data-planning-state');
			this.container.classList.remove('planning-todo-empty', 'planning-todo-failed', 'planning-todo-items');
		}
		super.clearInput();
	}

	protected override setEditorVisible(visible: boolean): void {
		super.setEditorVisible(visible);
		if (visible) {
			this.requestReload();
		}
	}

	override focus(): void {
		super.focus();
		this.container?.focus();
	}

	override layout(_dimension: Dimension): void {
		// CSS sizes the scroller to the editor body.
	}

	private requestReload(): void {
		if (!this.container || !this.input || this._store.isDisposed) {
			return;
		}
		void this.reload().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private async reload(): Promise<void> {
		const container = this.container;
		if (!container || !this.input || this._store.isDisposed) {
			return;
		}
		const generation = ++this.loadGeneration;
		try {
			const state = await loadPlanningTodos(planningTodoDeps(this.connection, this.session));
			if (generation !== this.loadGeneration || this.container !== container || this._store.isDisposed) {
				return;
			}
			renderPlanningTodos(container, state);
		} catch (error) {
			if (generation !== this.loadGeneration || this.container !== container || this._store.isDisposed) {
				return;
			}
			renderPlanningTodos(container, { kind: 'failed', message: getErrorMessage(error) });
		}
	}
}
