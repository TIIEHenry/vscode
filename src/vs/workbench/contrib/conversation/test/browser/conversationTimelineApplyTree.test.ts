/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IWebviewService } from '../../../webview/browser/webview.js';
import { stubTurnsToEntries } from '../../browser/conversationSessionView.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { ConversationTimelineTree } from '../../browser/conversationTimelineTree.js';

/**
 * Acceptance matrix for the three frame classes of
 * dev/plans/conversation-stream-timeline.md §3.4, measured on a live tree.
 */
suite('ConversationTimelineTree applyEntries (plan §3.4)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const TREE_HEIGHT = 600;
	const TREE_WIDTH = 400;

	const user = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'user', text });
	const assistant = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'assistant', text, stubEcho: true });
	const thinking = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'thinking', text });
	const tool = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'tool', text, toolName: 'read' });
	const confirmation = (id: string, status: 'pending' | 'allowed'): ConversationStubTurn => ({ id, kind: 'confirmation', text: 'run tests', status });

	interface TimelineTreeInternals {
		readonly renderer: {
			readonly userBubbleExpanded: Map<string, boolean>;
			readonly processFoldOuterExpanded: Map<string, boolean>;
		};
	}

	function expandedState(tree: ConversationTimelineTree): TimelineTreeInternals['renderer'] {
		return (tree as unknown as TimelineTreeInternals).renderer;
	}

	function createTree(): ConversationTimelineTree {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IWebviewService, {
			_serviceBrand: undefined,
			activeWebview: undefined,
			webviews: [],
			onDidChangeActiveWebview: Event.None,
			createWebviewOverlay: () => { throw new Error('not used'); },
			createWebviewElement: () => ({
				mountTo() { },
				setHtml() { },
				postMessage: () => Promise.resolve(true),
				onDidWheel: Event.None,
				onFatalError: Event.None,
				intrinsicContentSize: observableValue('intrinsicContentSize', undefined),
				dispose() { },
			}),
		} as unknown as IWebviewService);

		const parent = document.createElement('div');
		parent.style.width = `${TREE_WIDTH}px`;
		parent.style.height = `${TREE_HEIGHT}px`;
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));

		const tree = store.add(instantiationService.createInstance(ConversationTimelineTree, parent, {
			onResolveConfirmation: () => { },
			contentAdapter: {
				renderTurnBody: (turn: ConversationStubTurn, container: HTMLElement) => {
					container.textContent = turn.text;
					return Disposable.None;
				},
			},
		}));
		// The content host starts hidden (empty state); rows measure 0px while it is display:none.
		const contentHost = parent.querySelector<HTMLElement>('.conversation-lens-timeline-content');
		if (contentHost) {
			contentHost.style.display = '';
			contentHost.style.minHeight = `${TREE_HEIGHT}px`;
		}
		tree.layout(TREE_HEIGHT, TREE_WIDTH);
		return tree;
	}

	function seed(turns: readonly ConversationStubTurn[]): ConversationTimelineTree {
		const tree = createTree();
		tree.applyEntries(stubTurnsToEntries(turns), { kind: 'baseline' });
		tree.resetTestApplyMetrics();
		return tree;
	}

	test('type A — content patch rerenders only the changed rows and never resets children', () => {
		const tree = seed([user('u1', 'hello'), assistant('a1', 'one'), assistant('a2', 'two')]);
		expandedState(tree).userBubbleExpanded.set('u1', true);

		tree.applyEntries(
			stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one edited'), assistant('a2', 'two edited')]),
			{ kind: 'patches', changedIds: new Set(['a1', 'a2', 'sync']) },
		);

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 2 });
		assert.deepStrictEqual([...expandedState(tree).userBubbleExpanded], [['u1', true]]);
	});

	test('type A — a decided seat repaints from `pending:` alone (PRD-004)', () => {
		const tree = seed([user('u1', 'run it'), confirmation('c1', 'pending')]);
		assert.ok(tree.getTimelineRowElement('c1')?.querySelector('.conversation-lens-confirmation-actions'));

		// Allow / deny only removes the pending action: the seat row itself is untouched.
		tree.applyEntries(
			stubTurnsToEntries([user('u1', 'run it'), confirmation('c1', 'allowed')]),
			{ kind: 'patches', changedIds: new Set(['pending:c1']) },
		);

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 1 });
		assert.strictEqual(tree.getTimelineRowElement('c1')?.querySelector('.conversation-lens-confirmation-actions'), null);
	});

	test('type B — appended row keeps the DOM nodes of unchanged ids', () => {
		const tree = seed([user('u1', 'hello'), assistant('a1', 'one')]);
		const before = [tree.getTimelineRowElement('u1'), tree.getTimelineRowElement('a1')];
		assert.ok(before[0] && before[1]);

		tree.applyEntries(
			stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one'), assistant('a2', 'two')]),
			{ kind: 'patches', changedIds: new Set(['a2']) },
		);

		// One diffing setChildren: a full reset would hand back fresh DOM nodes for u1 / a1.
		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 1, rerenderCount: 0 });
		assert.deepStrictEqual(
			[tree.getTimelineRowElement('u1'), tree.getTimelineRowElement('a1')],
			before,
		);
		assert.ok(tree.getTimelineRowElement('a2'));
	});

	test('type B — removed id drops out of the expanded state', () => {
		const tree = seed([user('u1', 'first'), user('u2', 'second')]);
		expandedState(tree).userBubbleExpanded.set('u1', true);
		expandedState(tree).userBubbleExpanded.set('u2', true);

		tree.applyEntries(stubTurnsToEntries([user('u1', 'first')]), { kind: 'patches', changedIds: new Set(['u2']) });

		assert.deepStrictEqual([...expandedState(tree).userBubbleExpanded], [['u1', true]]);
	});

	test('type C — extending a process fold keeps the span id and its expanded state', () => {
		const tree = seed([user('u1', 'hi'), thinking('t1', 'think'), tool('tool1', 'grep')]);
		expandedState(tree).processFoldOuterExpanded.set('fold:t1', true);

		tree.applyEntries(
			stubTurnsToEntries([user('u1', 'hi'), thinking('t1', 'think'), tool('tool1', 'grep'), tool('tool2', 'read')]),
			{ kind: 'patches', changedIds: new Set(['tool2']) },
		);

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 1 });
		assert.deepStrictEqual([...expandedState(tree).processFoldOuterExpanded], [['fold:t1', true]]);
	});

	test('type C — span id change (overlay row replaced by L2) resets to the default state', () => {
		const tree = seed([user('u1', 'hi'), thinking('overlay:b1', 'live')]);
		expandedState(tree).processFoldOuterExpanded.set('fold:overlay:b1', true);

		tree.applyEntries(
			stubTurnsToEntries([user('u1', 'hi'), thinking('i1', 'settled')]),
			{ kind: 'patches', changedIds: new Set(['overlay:b1', 'i1']) },
		);

		assert.deepStrictEqual([...expandedState(tree).processFoldOuterExpanded], []);
	});

	test('type A — setEditingTurnId rerenders the target row and never resets children', () => {
		const tree = seed([user('u1', 'hello'), assistant('a1', 'one')]);
		const before = [tree.getTimelineRowElement('u1'), tree.getTimelineRowElement('a1')];
		assert.ok(before[0] && before[1]);

		tree.setEditingTurnId('u1');

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 1 });
		assert.deepStrictEqual(
			[tree.getTimelineRowElement('u1'), tree.getTimelineRowElement('a1')],
			before,
		);
	});

	test('type A — switching and clearing edit only rerenders the affected rows', () => {
		const tree = seed([user('u1', 'hello'), user('u2', 'there'), assistant('a1', 'one')]);
		tree.setEditingTurnId('u1');
		tree.resetTestApplyMetrics();

		tree.setEditingTurnId('u2');
		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 2 });

		tree.resetTestApplyMetrics();
		tree.setEditingTurnId(undefined);
		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 1 });
	});

	test('type A — refreshPresentation (tool-details) rerenders without resetting children', () => {
		const tree = seed([user('u1', 'hello'), assistant('a1', 'one')]);
		const before = [tree.getTimelineRowElement('u1'), tree.getTimelineRowElement('a1')];
		assert.ok(before[0] && before[1]);

		tree.refreshPresentation();

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 2 });
		assert.deepStrictEqual(
			[tree.getTimelineRowElement('u1'), tree.getTimelineRowElement('a1')],
			before,
		);
	});
});
