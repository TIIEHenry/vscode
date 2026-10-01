/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $ } from '../../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { emptySessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/empty-snapshot.js';
import type { LiveAgentTreeNodeView, SessionId, SessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/types.js';
import type { UniverseAgentTodoItem, UniverseAgentTodoRequest } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { PreviewCategoryService } from '../../../../services/editor/browser/previewCategoryService.js';
import { PreviewCategory } from '../../../../services/editor/common/previewCategoryService.js';
import { PlanningTodoEditorInput } from '../../browser/planningTodoEditorInput.js';
import { loadPlanningTodos, planningTodoDeps, readSessionViewRootAgentId, type IPlanningTodoLoadDeps, type PlanningTodoViewState } from '../../browser/planningTodoModel.js';
import { renderPlanningTodos } from '../../browser/planningTodoRenderer.js';

suite('Planning todos', () => {

	const disposables = new DisposableStore();

	teardown(() => {
		disposables.clear();
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	test('isPlanningInput is classified as Planning by the existing classifier', () => {
		const input = disposables.add(new PlanningTodoEditorInput());
		const service = disposables.add(new PreviewCategoryService(disposables.add(new TestStorageService())));

		assert.strictEqual(input.isPlanningInput, true);
		// Scheme alone is not a Planning scheme. The flag is what the classifier reads.
		assert.strictEqual(service.getCategoryForInput({ resource: input.resource } as never), PreviewCategory.Code);
		assert.strictEqual(service.getCategoryForInput(input), PreviewCategory.Planning);
	});

	test('root agent id is the live tree root, not a child and not a hardcoded id', () => {
		const snapshot = viewSnapshot('sess-from-context', tree('agent-from-view', [
			tree('root'),
			tree('default'),
		]));
		assert.strictEqual(readSessionViewRootAgentId(snapshot), 'agent-from-view');
		assert.strictEqual(readSessionViewRootAgentId(viewSnapshot('sess-from-context')), undefined);
	});

	test('getTodo uses the active session id and the session-view root agent, then renders id content status blocked', async () => {
		const calls: UniverseAgentTodoRequest[] = [];
		let acquires = 0;
		const items: UniverseAgentTodoItem[] = [
			{ id: 'todo-1', content: 'Write the plan', status: 'in_progress', priority: 1, requireConfirm: false, blocked: 'need-spec' },
			{ id: 'todo-2', content: 'Review the plan', status: 'pending', priority: 2, requireConfirm: true, blocked: '' },
		];
		const loaded = connectedDeps({
			sessionId: 'sess-from-context',
			agentId: 'agent-from-view',
			onAcquire: () => { acquires++; },
			getTodo: async request => {
				calls.push(request);
				return { items };
			},
		});
		const state = await loadPlanningTodos(loaded);

		assert.deepStrictEqual(calls, [{ sessionId: 'sess-from-context', agentId: 'agent-from-view' }]);
		assert.strictEqual(acquires, 1);
		assert.strictEqual(loaded.disposed(), 1);
		assert.strictEqual(state.kind, 'items');
		if (state.kind !== 'items') {
			return;
		}
		assert.deepStrictEqual(state.items, [
			{ id: 'todo-1', content: 'Write the plan', status: 'in_progress', blocked: 'need-spec' },
			{ id: 'todo-2', content: 'Review the plan', status: 'pending', blocked: '' },
		]);

		const container = paint(state);
		const rows = [...container.querySelectorAll('.planning-todo-item')];
		assert.strictEqual(rows.length, 2);
		assert.strictEqual(container.getAttribute('data-planning-state'), 'items');
		assert.strictEqual(rows[0].getAttribute('data-todo-id'), 'todo-1');
		assert.strictEqual(rows[0].querySelector('.planning-todo-content')?.textContent, 'Write the plan');
		assert.strictEqual(rows[0].querySelector('.planning-todo-status')?.textContent, 'in_progress');
		assert.strictEqual(rows[0].querySelector('.planning-todo-blocked')?.textContent, 'need-spec');
		assert.strictEqual(rows[1].getAttribute('data-todo-id'), 'todo-2');
		assert.strictEqual(rows[1].querySelector('.planning-todo-content')?.textContent, 'Review the plan');
		assert.strictEqual(rows[1].querySelector('.planning-todo-status')?.textContent, 'pending');
		assert.strictEqual(rows[1].querySelector('.planning-todo-blocked')?.textContent, '');
	});

	test('disconnected or missing getTodo makes zero calls', async () => {
		const disconnectedCalls: UniverseAgentTodoRequest[] = [];
		let disconnectedAcquires = 0;
		const disconnected = await loadPlanningTodos(connectedDeps({
			connected: false,
			sessionId: 'sess-from-context',
			agentId: 'agent-from-view',
			onAcquire: () => { disconnectedAcquires++; },
			getTodo: async request => {
				disconnectedCalls.push(request);
				return { items: [] };
			},
		}));
		assert.strictEqual(disconnected.kind, 'disconnected');
		assert.deepStrictEqual(disconnectedCalls, []);
		assert.strictEqual(disconnectedAcquires, 0);
		assertEmptyNotFailed(paint(disconnected), 'disconnected');

		const missingHookCalls: UniverseAgentTodoRequest[] = [];
		let missingHookAcquires = 0;
		const missingHook = await loadPlanningTodos(connectedDeps({
			sessionId: 'sess-from-context',
			agentId: 'agent-from-view',
			omitGetTodo: true,
			onAcquire: () => { missingHookAcquires++; },
		}));
		assert.strictEqual(missingHook.kind, 'no-getTodo');
		assert.deepStrictEqual(missingHookCalls, []);
		assert.strictEqual(missingHookAcquires, 0);
		assertEmptyNotFailed(paint(missingHook), 'no-getTodo');
	});

	test('empty item list is an empty state, not a failure', async () => {
		const calls: UniverseAgentTodoRequest[] = [];
		const state = await loadPlanningTodos(connectedDeps({
			sessionId: 'sess-from-context',
			agentId: 'agent-from-view',
			getTodo: async request => {
				calls.push(request);
				return { items: [] };
			},
		}));

		assert.deepStrictEqual(calls, [{ sessionId: 'sess-from-context', agentId: 'agent-from-view' }]);
		assert.strictEqual(state.kind, 'empty');
		const container = paint(state);
		assertEmptyNotFailed(container, 'empty');
		assert.strictEqual(container.querySelector('.planning-todo-message')?.textContent, 'No planning items.');
		assert.strictEqual(container.querySelector('.planning-todo-item'), null);
	});

	test('blank session, missing root agent, and a view that cannot be acquired do not call getTodo', async () => {
		const calls: UniverseAgentTodoRequest[] = [];
		const blank = await loadPlanningTodos(connectedDeps({
			sessionId: '   ',
			agentId: 'agent-from-view',
			getTodo: async request => {
				calls.push(request);
				return { items: [] };
			},
		}));
		assert.strictEqual(blank.kind, 'no-session');
		assert.deepStrictEqual<UniverseAgentTodoRequest[]>(calls, []);
		assertEmptyNotFailed(paint(blank), 'no-session');

		let acquires = 0;
		const noRoot = await loadPlanningTodos(connectedDeps({
			sessionId: 'sess-from-context',
			onAcquire: () => { acquires++; },
			getTodo: async request => {
				calls.push(request);
				return { items: [] };
			},
		}));
		assert.strictEqual(noRoot.kind, 'no-root-agent');
		assert.strictEqual(acquires, 1);
		assert.deepStrictEqual<UniverseAgentTodoRequest[]>(calls, []);
		assertEmptyNotFailed(paint(noRoot), 'no-root-agent');

		const unavailable = await loadPlanningTodos(connectedDeps({
			sessionId: 'sess-from-context',
			agentId: 'agent-from-view',
			acquireThrows: true,
			getTodo: async request => {
				calls.push(request);
				return { items: [] };
			},
		}));
		assert.strictEqual(unavailable.kind, 'session-view-unavailable');
		assert.deepStrictEqual<UniverseAgentTodoRequest[]>(calls, []);
		assertEmptyNotFailed(paint(unavailable), 'session-view-unavailable');
	});

	test('getTodo rejection is a failure, distinct from an empty list', async () => {
		const calls: UniverseAgentTodoRequest[] = [];
		const state = await loadPlanningTodos(connectedDeps({
			sessionId: 'sess-from-context',
			agentId: 'agent-from-view',
			getTodo: async request => {
				calls.push(request);
				throw new Error('rpc down');
			},
		}));
		assert.deepStrictEqual(calls, [{ sessionId: 'sess-from-context', agentId: 'agent-from-view' }]);
		assert.strictEqual(state.kind, 'failed');
		if (state.kind === 'failed') {
			assert.ok(state.message.includes('rpc down'));
		}
		const container = paint(state);
		assert.strictEqual(container.getAttribute('data-planning-state'), 'failed');
		assert.ok(container.classList.contains('planning-todo-failed'));
		assert.strictEqual(container.classList.contains('planning-todo-empty'), false);
		assert.strictEqual(container.querySelector('.planning-todo-message')?.getAttribute('role'), 'alert');
		assert.strictEqual(container.querySelector('.planning-todo-message')?.textContent, 'rpc down');
	});
});

function assertEmptyNotFailed(container: HTMLElement, kind: string): void {
	assert.strictEqual(container.getAttribute('data-planning-state'), kind);
	assert.ok(container.classList.contains('planning-todo-empty'));
	assert.strictEqual(container.classList.contains('planning-todo-failed'), false);
	assert.strictEqual(container.querySelector('[role="alert"]'), null);
	assert.strictEqual(container.querySelector('.planning-todo-message')?.getAttribute('role'), 'status');
}

function paint(state: PlanningTodoViewState): HTMLElement {
	const container = $('div.planning-todo-editor');
	renderPlanningTodos(container, state);
	return container;
}

function tree(agentId: string, children: LiveAgentTreeNodeView[] = []): LiveAgentTreeNodeView {
	return {
		agentId,
		name: agentId,
		type: 'root',
		status: 'idle',
		model: '',
		turnCount: 0,
		createdAt: 0,
		children,
	};
}

function viewSnapshot(sessionId: string, liveAgentTree?: LiveAgentTreeNodeView): SessionViewSnapshot {
	const snapshot = emptySessionViewSnapshot(sessionId as SessionId);
	return liveAgentTree ? { ...snapshot, liveAgentTree } : snapshot;
}

function connectedDeps(options: {
	readonly connected?: boolean;
	readonly sessionId: string;
	readonly agentId?: string;
	readonly omitGetTodo?: boolean;
	readonly acquireThrows?: boolean;
	readonly onAcquire?: () => void;
	readonly getTodo?: IUniverseAgentConnection['getTodo'];
}): IPlanningTodoLoadDeps & { disposed(): number } {
	let disposed = 0;
	const connection = {
		isEngineConnected: () => options.connected !== false,
		...(options.omitGetTodo ? {} : { getTodo: options.getTodo }),
	} as IUniverseAgentConnection;
	const session = {
		getActiveSessionId: () => options.sessionId,
		acquireSessionView: (sessionId: string) => {
			options.onAcquire?.();
			if (options.acquireThrows) {
				throw new Error('acquireSessionView failed');
			}
			assert.strictEqual(sessionId, options.sessionId);
			return {
				snapshot: viewSnapshot(sessionId, options.agentId === undefined ? undefined : tree(options.agentId)),
				attribution: new Map(),
				dispose: () => { disposed++; },
			};
		},
	} as unknown as IAgentSessionContext;
	return Object.assign(planningTodoDeps(connection, session), { disposed: () => disposed });
}
