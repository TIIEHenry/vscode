/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { PlanningTodoViewState } from './planningTodoModel.js';

/** Paint a {@link PlanningTodoViewState}. Empty list is an empty state, not a failure. */
export function renderPlanningTodos(container: HTMLElement, state: PlanningTodoViewState): void {
	clearNode(container);
	container.classList.remove('planning-todo-empty', 'planning-todo-failed', 'planning-todo-items');
	container.setAttribute('data-planning-state', state.kind);

	if (state.kind === 'items') {
		container.classList.add('planning-todo-items');
		const list = append(container, $('ul.planning-todo-list'));
		list.setAttribute('role', 'list');
		list.setAttribute('aria-label', localize('planningTodo.list', "Planning items"));
		for (const item of state.items) {
			const row = append(list, $('li.planning-todo-item'));
			row.setAttribute('role', 'listitem');
			row.setAttribute('data-todo-id', item.id);
			row.setAttribute('data-todo-status', item.status);
			row.setAttribute('data-todo-blocked', item.blocked);

			const id = append(row, $('span.planning-todo-id'));
			id.textContent = item.id;
			const content = append(row, $('span.planning-todo-content'));
			content.textContent = item.content;
			const status = append(row, $('span.planning-todo-status'));
			status.textContent = item.status;
			const blocked = append(row, $('span.planning-todo-blocked'));
			blocked.textContent = item.blocked;
		}
		return;
	}

	const failed = state.kind === 'failed';
	container.classList.add(failed ? 'planning-todo-failed' : 'planning-todo-empty');
	const message = append(container, $('p.planning-todo-message'));
	message.setAttribute('role', failed ? 'alert' : 'status');
	message.textContent = messageFor(state);
}

function messageFor(state: Exclude<PlanningTodoViewState, { kind: 'items' }>): string {
	switch (state.kind) {
		case 'no-session':
			return localize('planningTodo.noSession', "No active session.");
		case 'disconnected':
			return localize('planningTodo.disconnected', "Not connected. Planning todos are unavailable.");
		case 'no-getTodo':
			return localize('planningTodo.noGetTodo', "This connection does not provide planning todos.");
		case 'no-root-agent':
			return localize('planningTodo.noRootAgent', "The session view has no root agent yet.");
		case 'session-view-unavailable':
			return localize('planningTodo.sessionViewUnavailable', "The session view is not available.");
		case 'empty':
			return localize('planningTodo.empty', "No planning items.");
		case 'failed':
			return state.message || localize('planningTodo.failed', "Could not load planning todos.");
	}
}
