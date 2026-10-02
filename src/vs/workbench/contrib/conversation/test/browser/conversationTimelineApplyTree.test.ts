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
import { ConversationTimelineHost } from '../../browser/conversationTimelineHost.js';
import { provideTurnEditComposer } from '../../browser/conversationTimelineRenderer.js';

/**
 * Acceptance matrix for the three frame classes of
 * dev/plans/conversation-stream-timeline.md §3.4, measured on ConversationTimelineHost.
 */
suite('ConversationTimelineHost applyEntries (plan §3.4)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const TREE_HEIGHT = 600;
	const TREE_WIDTH = 400;

	const user = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'user', text });
	const assistant = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'assistant', text, stubEcho: true });
	const thinking = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'thinking', text });
	const tool = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'tool', text, toolName: 'read' });
	const confirmation = (id: string, status: 'pending' | 'allowed'): ConversationStubTurn => ({ id, kind: 'confirmation', text: 'run tests', status });

	function expandedState(host: ConversationTimelineHost): {
		readonly userBubbleExpanded: Map<string, boolean>;
		readonly processFoldOuterExpanded: Map<string, boolean>;
	} {
		return host.getTestExpandedState();
	}

	function createTree(): ConversationTimelineHost {
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

		const host = store.add(instantiationService.createInstance(ConversationTimelineHost, parent, {
			onResolveConfirmation: () => { },
			contentAdapter: {
				renderTurnBody: (turn: ConversationStubTurn, container: HTMLElement) => {
					container.textContent = turn.text;
					return Disposable.None;
				},
			},
		}));
		const contentHost = parent.querySelector<HTMLElement>('.conversation-lens-timeline-content');
		if (contentHost) {
			contentHost.style.display = '';
			contentHost.style.minHeight = `${TREE_HEIGHT}px`;
		}
		host.layout(TREE_HEIGHT, TREE_WIDTH);
		return host;
	}

	function seed(turns: readonly ConversationStubTurn[]): ConversationTimelineHost {
		const tree = createTree();
		tree.applyEntries(stubTurnsToEntries(turns), { kind: 'baseline' });
		tree.resetTestApplyMetrics();
		return tree;
	}

	function hostEditComposer(): HTMLElement {
		const composer = document.createElement('div');
		composer.className = 'conversation-lens-composer';
		composer.style.minHeight = '48px';
		composer.textContent = 'edit';
		provideTurnEditComposer(composer);
		store.add(toDisposable(() => provideTurnEditComposer(undefined)));
		return composer;
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
		const beforeU1 = tree.getTimelineRowElement('u1');
		const beforeA1 = tree.getTimelineRowElement('a1');
		assert.ok(beforeU1 && beforeA1);

		tree.applyEntries(
			stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one'), assistant('a2', 'two')]),
			{ kind: 'patches', changedIds: new Set(['a2']) },
		);

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 1, rerenderCount: 0 });
		assert.strictEqual(tree.getTimelineRowElement('u1'), beforeU1);
		assert.strictEqual(tree.getTimelineRowElement('a1'), beforeA1);
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

	test('clearProcessFoldExpanded collapses a reused overlay span instead of keeping the previous session open', () => {
		const turns = [user('u1', 'hi'), thinking('overlay:block-1', 'from A'), tool('overlay:block-2', 'grep')];
		const tree = seed(turns);
		const header = tree.domNode.querySelector<HTMLButtonElement>('button.conversation-process-fold-header');
		assert.ok(header);
		assert.strictEqual(header.getAttribute('aria-expanded'), 'false');
		header.click();
		assert.strictEqual(header.getAttribute('aria-expanded'), 'true');
		const thinkingHeader = tree.domNode.querySelector<HTMLButtonElement>('button.conversation-process-fold-thinking-header');
		assert.ok(thinkingHeader);
		thinkingHeader.click();
		assert.strictEqual(thinkingHeader.getAttribute('aria-expanded'), 'true');

		tree.clearProcessFoldExpanded();
		const cleared = tree.domNode.querySelector<HTMLButtonElement>('button.conversation-process-fold-header');
		assert.ok(cleared);
		assert.strictEqual(cleared.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(tree.domNode.querySelector<HTMLElement>('.conversation-process-fold-children')?.hidden, true);
		assert.deepStrictEqual([...expandedState(tree).processFoldOuterExpanded], []);

		tree.setTurns(turns);
		const again = tree.domNode.querySelector<HTMLButtonElement>('button.conversation-process-fold-header');
		assert.strictEqual(again?.getAttribute('aria-expanded'), 'false');
		again?.click();
		assert.strictEqual(tree.domNode.querySelector('button.conversation-process-fold-thinking-header')?.getAttribute('aria-expanded'), 'false');
	});

	test('clearProcessFoldExpanded collapses a hidden timeline when the next frame reuses the same span ids', () => {
		const turns = [
			user('u1', 'hi'),
			thinking('overlay:block-1', 'from A'),
			{ id: 'overlay:block-2', kind: 'tool' as const, text: 'grep', toolName: 'read', payload: 'hits' },
		];
		const tree = seed(turns);
		const header = tree.domNode.querySelector<HTMLButtonElement>('button.conversation-process-fold-header');
		assert.ok(header);
		header.click();
		const thinkingHeader = tree.domNode.querySelector<HTMLButtonElement>('button.conversation-process-fold-thinking-header');
		const toolHeader = tree.domNode.querySelector<HTMLButtonElement>('button.conversation-process-fold-tool-header');
		assert.ok(thinkingHeader);
		assert.ok(toolHeader);
		thinkingHeader.click();
		toolHeader.click();
		assert.strictEqual(thinkingHeader.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(toolHeader.getAttribute('aria-expanded'), 'true');

		tree.hide();
		tree.clearProcessFoldExpanded();
		tree.setTurns(turns);
		tree.show();

		// Identical roots commit as `none` and would leave the previous session open.
		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 0 });
		const cleared = tree.domNode.querySelector<HTMLButtonElement>('button.conversation-process-fold-header');
		assert.ok(cleared);
		assert.strictEqual(cleared.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(tree.domNode.querySelector<HTMLElement>('.conversation-process-fold-children')?.hidden, true);
		cleared.click();
		assert.strictEqual(tree.domNode.querySelector('button.conversation-process-fold-thinking-header')?.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(tree.domNode.querySelector('button.conversation-process-fold-tool-header')?.getAttribute('aria-expanded'), 'false');
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
		const beforeU1 = tree.getTimelineRowElement('u1');
		const beforeA1 = tree.getTimelineRowElement('a1');
		assert.ok(beforeU1 && beforeA1);

		hostEditComposer();
		tree.setEditingTurnId('u1');

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 1 });
		assert.strictEqual(tree.getTimelineRowElement('u1'), beforeU1);
		assert.strictEqual(tree.getTimelineRowElement('a1'), beforeA1);
	});

	test('type A — switching and clearing edit only rerenders the affected rows', () => {
		const tree = seed([user('u1', 'hello'), user('u2', 'there'), assistant('a1', 'one')]);
		hostEditComposer();
		tree.setEditingTurnId('u1');
		tree.resetTestApplyMetrics();

		tree.setEditingTurnId('u2');
		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 2 });

		tree.resetTestApplyMetrics();
		provideTurnEditComposer(undefined);
		tree.setEditingTurnId(undefined);
		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 1 });
	});

	test('type A — refreshPresentation (tool-details) rerenders without resetting children', () => {
		const tree = seed([user('u1', 'hello'), assistant('a1', 'one')]);
		const beforeU1 = tree.getTimelineRowElement('u1');
		const beforeA1 = tree.getTimelineRowElement('a1');
		assert.ok(beforeU1 && beforeA1);

		tree.refreshPresentation();

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 1 });
		assert.strictEqual(tree.getTimelineRowElement('u1'), beforeU1);
		assert.strictEqual(tree.getTimelineRowElement('a1'), beforeA1);
	});

	test('type A — same-structure setTurns baseline rerenders without resetting children', () => {
		const tree = seed([user('u1', 'hello'), assistant('a1', 'one')]);
		const beforeU1 = tree.getTimelineRowElement('u1');
		const beforeA1 = tree.getTimelineRowElement('a1');
		assert.ok(beforeU1 && beforeA1);

		tree.setTurns([user('u1', 'hello'), assistant('a1', 'one edited')]);

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 1 });
		assert.strictEqual(tree.getTimelineRowElement('u1'), beforeU1);
		assert.strictEqual(tree.getTimelineRowElement('a1'), beforeA1);
	});

	test('type A — same-structure engine/mermaid baseline 不更新任何根', () => {
		const tree = seed([user('u1', 'hello'), assistant('a1', 'one')]);
		expandedState(tree).userBubbleExpanded.set('u1', true);
		const beforeU1 = tree.getTimelineRowElement('u1');
		const beforeA1 = tree.getTimelineRowElement('a1');
		assert.ok(beforeU1 && beforeA1);

		tree.applyEntries(
			stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one')]),
			{ kind: 'baseline' },
		);

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 0 });
		assert.strictEqual(tree.getTimelineRowElement('u1'), beforeU1);
		assert.strictEqual(tree.getTimelineRowElement('a1'), beforeA1);
		assert.deepStrictEqual([...expandedState(tree).userBubbleExpanded], [['u1', true]]);
	});

	test('same-structure baseline that extends a process fold stays class A', () => {
		const tree = seed([user('u1', 'hi'), thinking('t1', 'think'), tool('tool1', 'grep')]);
		expandedState(tree).processFoldOuterExpanded.set('fold:t1', true);

		tree.applyEntries(
			stubTurnsToEntries([user('u1', 'hi'), thinking('t1', 'think'), tool('tool1', 'grep'), tool('tool2', 'read')]),
			{ kind: 'baseline' },
		);

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 1 });
		assert.deepStrictEqual([...expandedState(tree).processFoldOuterExpanded], [['fold:t1', true]]);
	});

	test('structure-changing baseline uses keyed reconciliation', () => {
		const tree = seed([user('u1', 'hello'), assistant('a1', 'one')]);
		const beforeU1 = tree.getTimelineRowElement('u1');
		const beforeA1 = tree.getTimelineRowElement('a1');
		assert.ok(beforeU1 && beforeA1);

		tree.applyEntries(
			stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one'), assistant('a2', 'two')]),
			{ kind: 'baseline' },
		);

		assert.deepStrictEqual(tree.getTestApplyMetrics(), { setChildrenCount: 1, rerenderCount: 0 });
		assert.strictEqual(tree.getTimelineRowElement('u1'), beforeU1);
		assert.strictEqual(tree.getTimelineRowElement('a1'), beforeA1);
		assert.ok(tree.getTimelineRowElement('a2'));
	});

	test('empty and zero-height tree does not throw when reading visible indices (D34)', () => {
		const empty = createTree();
		assert.doesNotThrow(() => empty.layout(0, TREE_WIDTH));
		assert.doesNotThrow(() => empty.refreshScrollChrome());

		const seeded = seed([user('u1', 'hello'), assistant('a1', 'one')]);
		assert.doesNotThrow(() => seeded.layout(0, TREE_WIDTH));
		assert.doesNotThrow(() => seeded.refreshScrollChrome());
		assert.doesNotThrow(() => seeded.layout(TREE_HEIGHT, TREE_WIDTH));
	});
});
