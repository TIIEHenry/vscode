/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type { IMouseWheelEvent } from '../../../../../base/browser/mouseEvent.js';
import { timeout } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IWebviewService } from '../../../webview/browser/webview.js';
import { createMermaidHostContext, mountConversationMermaidHost } from '../../browser/conversationMermaidHost.js';
import { ConversationTimelineHost } from '../../browser/conversationTimelineHost.js';
import {
	buildTimelineReconcileRoots,
	buildTimelineRootIdentities,
	computeTimelineReconcile,
} from '../../browser/conversationTimelineReconcile.js';
import {
	ConversationTimelineFrameScheduler,
	type ConversationTimelineFlush,
	mergeSessionViewFrames,
	normalizeSessionViewChangedIds,
	normalizeSessionViewFrameApplied,
} from '../../browser/conversationTimelineScheduler.js';
import type { ViewEffect } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import {
	entriesToRenderableTurns,
	projectSnapshotToEntries,
	stubTurnsToSnapshot,
} from '../../browser/conversationSessionView.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import {
	computeConversationScrollDownState,
	ConversationAutoScrollHolds,
	isConversationTimelineScrolledToBottom,
} from '../../browser/conversationTimelineScroll.js';

suite('ConversationTimelineScroll', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('isScrolledToBottom uses 2px tolerance', () => {
		assert.strictEqual(isConversationTimelineScrolledToBottom(100, 200, 302), true);
		assert.strictEqual(isConversationTimelineScrolledToBottom(100, 200, 303), false);
	});

	// Mirrors chatListWidget.test.ts scroll-down / at-bottom decoupling without importing chatListWidget.
	test('scroll-down button is decoupled from the at-bottom padding state', () => {
		assert.deepStrictEqual([
			computeConversationScrollDownState(/*isScrolledToBottom*/ true, /*scrollLock*/ true).showButton,
			computeConversationScrollDownState(/*isScrolledToBottom*/ true, /*scrollLock*/ false).showButton,
			computeConversationScrollDownState(/*isScrolledToBottom*/ false, /*scrollLock*/ true).showButton,
			computeConversationScrollDownState(/*isScrolledToBottom*/ false, /*scrollLock*/ false).showButton,
		], [
			false,
			false,
			true,
			true,
		]);
	});

	test('auto-scroll holds compose and release idempotently', () => {
		const holds = new ConversationAutoScrollHolds();
		assert.strictEqual(holds.isHeld, false);

		const first = holds.acquire();
		assert.strictEqual(holds.isHeld, true);

		const second = holds.acquire();
		assert.strictEqual(holds.isHeld, true);

		first.dispose();
		assert.strictEqual(holds.isHeld, true);

		second.dispose();
		assert.strictEqual(holds.isHeld, false);

		first.dispose();
		assert.strictEqual(holds.isHeld, false);
	});
});

suite('ConversationTimelineReconcile (S2 three-frame matrix)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const user = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'user', text });
	const assistant = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'assistant', text, stubEcho: true });
	const thinking = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'thinking', text });
	const tool = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'tool', text, toolName: 'read' });

	test('type A — same root ids, text patch → content mode only', () => {
		const prev = [user('u1', 'hello'), assistant('a1', 'one')];
		const next = [prev[0]!, assistant('a1', 'two')];
		const plan = computeTimelineReconcile(buildTimelineReconcileRoots(prev), buildTimelineReconcileRoots(next));
		assert.strictEqual(plan.mode, 'content');
		assert.deepStrictEqual([...plan.changed], ['a1']);
		assert.strictEqual(buildTimelineRootIdentities(prev).join(','), buildTimelineRootIdentities(next).join(','));
	});

	test('type B — append row → structure mode', () => {
		const prev = [user('u1', 'hello')];
		const next = [user('u1', 'hello'), assistant('a1', 'reply')];
		const plan = computeTimelineReconcile(buildTimelineReconcileRoots(prev), buildTimelineReconcileRoots(next));
		assert.strictEqual(plan.mode, 'structure');
	});

	test('type C — extend process fold keeps span id → content rerender fold root', () => {
		const prev = [user('u1', 'hi'), thinking('t1', 'think'), tool('tool1', 'grep')];
		const next = [user('u1', 'hi'), thinking('t1', 'think'), tool('tool1', 'grep'), tool('tool2', 'read')];
		const prevRoots = buildTimelineRootIdentities(prev);
		const nextRoots = buildTimelineRootIdentities(next);
		assert.strictEqual(prevRoots.length, 2);
		assert.deepStrictEqual(prevRoots, nextRoots);
		assert.strictEqual(prevRoots[1], 'fold:t1');
		const plan = computeTimelineReconcile(buildTimelineReconcileRoots(prev), buildTimelineReconcileRoots(next));
		assert.strictEqual(plan.mode, 'content');
		assert.deepStrictEqual([...plan.changed], ['fold:t1']);
	});

	test('type C — user turn splits process fold → structure mode with new span id', () => {
		const prev = [thinking('t1', 'a'), tool('tool1', 'x')];
		const next = [thinking('t1', 'a'), tool('tool1', 'x'), user('u1', 'stop'), thinking('t2', 'b')];
		const plan = computeTimelineReconcile(buildTimelineReconcileRoots(prev), buildTimelineReconcileRoots(next));
		assert.strictEqual(plan.mode, 'structure');
		assert.notDeepStrictEqual(buildTimelineRootIdentities(prev), buildTimelineRootIdentities(next));
	});

	test('same-structure baseline → class A content (engine/mermaid/setTurns)', () => {
		const prev = [user('u1', 'hello'), assistant('a1', 'one')];
		const next = [prev[0]!, assistant('a1', 'two')];
		const plan = computeTimelineReconcile(buildTimelineReconcileRoots(prev), buildTimelineReconcileRoots(next));
		assert.strictEqual(plan.mode, 'content');
		assert.deepStrictEqual([...plan.changed], ['a1']);
	});

	test('structure-changing baseline stays structure mode', () => {
		const prev = [user('u1', 'hello')];
		const next = [user('u1', 'hello'), assistant('a1', 'reply')];
		const plan = computeTimelineReconcile(buildTimelineReconcileRoots(prev), buildTimelineReconcileRoots(next));
		assert.strictEqual(plan.mode, 'structure');
	});

	const sendFailed = (id: string): ViewEffect => ({ effectId: id as ViewEffect['effectId'], kind: 'send_failed', message: 'send failed' });

	test('mergeSessionViewFrames flushes patches and effects instead of dropping the effects', () => {
		const effect = sendFailed('e1');
		const merged = mergeSessionViewFrames([
			{ kind: 'patches', changedIds: new Set(['a1']) },
			{ kind: 'effects', effects: [effect] },
		]);
		assert.deepStrictEqual(merged, [
			{ kind: 'patches', changedIds: new Set(['a1']) },
			{ kind: 'effects', effects: [effect] },
		]);
	});

	test('scheduler delivers both applies of a mixed window to the timeline', async () => {
		const flushed: ConversationTimelineFlush[] = [];
		const scheduler = new ConversationTimelineFrameScheduler(flush => flushed.push(flush));
		scheduler.push({ kind: 'patches', changedIds: new Set(['a1']) });
		scheduler.push({ kind: 'effects', effects: [sendFailed('e1')] });
		scheduler.push({ kind: 'patches', changedIds: new Set(['a2']) });
		await timeout(64);
		scheduler.dispose();

		assert.deepStrictEqual(flushed, [
			{
				applied: { kind: 'patches', changedIds: new Set(['a1', 'a2']) },
				sidecar: false,
				effects: [sendFailed('e1')],
			},
		]);
	});

	test('mergeSessionViewFrames unions patch changedIds within one coalesce window', () => {
		const merged = mergeSessionViewFrames([
			{ kind: 'patches', changedIds: new Set(['a1']) },
			{ kind: 'patches', changedIds: new Set(['a2']) },
		]);
		assert.deepStrictEqual(merged, [{ kind: 'patches', changedIds: new Set(['a1', 'a2']) }]);
	});

	test('normalizeSessionViewChangedIds accepts Set, array, plain object, and undefined', () => {
		assert.deepStrictEqual([...normalizeSessionViewChangedIds(new Set(['a1']))], ['a1']);
		assert.deepStrictEqual([...normalizeSessionViewChangedIds(['a1', 'a2'])].sort(), ['a1', 'a2']);
		assert.deepStrictEqual([...normalizeSessionViewChangedIds({ a1: true, a2: true })].sort(), ['a1', 'a2']);
		assert.deepStrictEqual([...normalizeSessionViewChangedIds({ '0': 'a1', '1': 'a2' })].sort(), ['a1', 'a2']);
		assert.deepStrictEqual([...normalizeSessionViewChangedIds(undefined)], []);
		assert.deepStrictEqual([...normalizeSessionViewChangedIds({})], []);
	});

	test('mergeSessionViewFrames tolerates IPC-deserialized changedIds shapes', () => {
		const merged = mergeSessionViewFrames([
			{ kind: 'patches', changedIds: ['a1'] as unknown as ReadonlySet<string> },
			{ kind: 'patches', changedIds: { a2: true } as unknown as ReadonlySet<string> },
		]);
		assert.deepStrictEqual(merged, [{ kind: 'patches', changedIds: new Set(['a1', 'a2']) }]);
	});

	test('normalizeSessionViewFrameApplied preserves baseline and effects', () => {
		assert.deepStrictEqual(normalizeSessionViewFrameApplied({ kind: 'baseline' }), { kind: 'baseline' });
		assert.deepStrictEqual(
			normalizeSessionViewFrameApplied({ kind: 'effects', effects: [] }),
			{ kind: 'effects', effects: [] },
		);
	});

	test('lease projection round-trip keeps applyEntries baseline aligned with roster', () => {
		const turns = [user('u1', 'a'), thinking('t1', 'think'), assistant('a1', 'done')];
		const projection = stubTurnsToSnapshot('s', turns);
		const entries = projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details);
		assert.deepStrictEqual(entriesToRenderableTurns(entries).map(t => t.id), turns.map(t => t.id));
	});
});

suite('ConversationTimeline inline diagram wheel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('inline wheel adds deltaY to the timeline scrollport and overlay does not subscribe', () => {
		let wheelSubscriptions = 0;
		const wheel = store.add(new Emitter<IMouseWheelEvent>());
		const webviewService = {
			_serviceBrand: undefined,
			activeWebview: undefined,
			webviews: [],
			onDidChangeActiveWebview: Event.None,
			createWebviewOverlay: () => { throw new Error('not used'); },
			createWebviewElement: () => ({
				mountTo() { },
				setHtml() { },
				postMessage: () => Promise.resolve(true),
				onDidWheel: (listener: (event: IMouseWheelEvent) => void) => {
					wheelSubscriptions++;
					return wheel.event(listener);
				},
				onFatalError: Event.None,
				intrinsicContentSize: observableValue('intrinsicContentSize', undefined),
				dispose() { },
			}),
		} as unknown as IWebviewService;

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IWebviewService, webviewService);

		const parent = document.createElement('div');
		parent.style.height = '400px';
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));

		const host = store.add(instantiationService.createInstance(ConversationTimelineHost, parent, {
			onResolveConfirmation: () => { },
			createResizeObserver: () => ({ observe() { }, disconnect() { } }),
			contentAdapter: {
				renderTurnBody: () => ({ dispose() { } }),
			},
		}));

		host.setTurns([{
			id: 'v1',
			kind: 'visualization',
			text: '',
			visualize: { type: 'diagram', title: 'Road', mermaid: 'flowchart TD\n  A-->B' },
		}]);
		assert.strictEqual(wheelSubscriptions, 0);

		const extensionInfo = {
			extensionLocation: URI.file('/tmp/mermaid'),
			extensionId: new ExtensionIdentifier('vscode.mermaid-markdown-features'),
		};
		host.setMermaidExtensionInfo(extensionInfo);
		assert.strictEqual(wheelSubscriptions, 1);

		const overlayParent = document.createElement('div');
		document.body.appendChild(overlayParent);
		store.add(toDisposable(() => overlayParent.remove()));
		mountConversationMermaidHost(
			overlayParent,
			createMermaidHostContext(overlayParent, extensionInfo, webviewService),
			{ mode: 'overlay', source: 'flowchart TD\n  A-->B', title: 'Overlay' },
			store.add(new DisposableStore()),
		);
		assert.strictEqual(wheelSubscriptions, 1);

		const viewport = host.domNode.querySelector('.conversation-timeline-viewport') as HTMLElement | null;
		const chrome = host.domNode.querySelector('.conversation-lens-timeline-scroll') as HTMLElement | null;
		assert.ok(viewport);
		assert.ok(chrome);
		assert.notStrictEqual(viewport, chrome);
		assert.ok(!viewport.classList.contains('conversation-lens-timeline-scroll'));
		assert.ok(!chrome.classList.contains('conversation-timeline-viewport'));

		host.layout(120, 320);
		host.setScrollLock(false);
		// Flex min-height:auto sizes the viewport to its content in this
		// harness, so Chromium never overflows. Pin the metrics the wheel
		// and refreshScrollChrome read; do not also add deltaY in the host.
		let scrollTop = 0;
		Object.defineProperty(viewport, 'scrollTop', {
			configurable: true,
			enumerable: true,
			get: () => scrollTop,
			set: (value: number) => { scrollTop = value; },
		});
		Object.defineProperty(viewport, 'clientHeight', { configurable: true, get: () => 100 });
		Object.defineProperty(viewport, 'scrollHeight', { configurable: true, get: () => 800 });

		wheel.fire({ deltaY: 40 } as IMouseWheelEvent);

		assert.strictEqual(viewport.scrollTop, 40);
		assert.strictEqual(chrome.scrollTop, 0);
		assert.ok(viewport.classList.contains('conversation-timeline-scroll-down-visible'));
		assert.ok(!chrome.classList.contains('conversation-timeline-scroll-down-visible'));
		const scrollDown = host.domNode.querySelector('.conversation-timeline-scroll-down') as HTMLElement | null;
		assert.ok(scrollDown);
		assert.strictEqual(scrollDown.style.display, 'flex');
	});
});

suite('ConversationTimeline pending reveal', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('a seat above the window is mounted, and a non-tail seat unlocks follow', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));

		const host = store.add(instantiationService.createInstance(ConversationTimelineHost, parent, {
			onResolveConfirmation: () => { },
			contentAdapter: {
				renderTurnBody: () => ({ dispose() { } }),
			},
		}));

		const turns: ConversationStubTurn[] = [
			{ id: 'tool-old', kind: 'tool', text: 'client', respondable: true },
		];
		for (let index = 0; index < 70; index++) {
			turns.push({ id: `u${index}`, kind: 'user', text: `m${index}` });
		}
		host.setTurns(turns);
		assert.strictEqual(host.scrollLock, true);
		assert.strictEqual(host.getTimelineRowElement('tool-old'), undefined);

		host.revealPendingTurn('tool-old');

		assert.ok(host.getTimelineRowElement('tool-old'));
		assert.strictEqual(host.scrollLock, false, 'non-tail pending reveal must drop stick-to-bottom');

		host.setScrollLock(true);
		host.setTurns([
			{ id: 'u-tail', kind: 'user', text: 'hi' },
			{ id: 'c-tail', kind: 'confirmation', text: 'Allow?', status: 'pending' },
		]);
		assert.strictEqual(host.scrollLock, true);
		host.revealPendingTurn('c-tail');
		assert.strictEqual(host.scrollLock, true, 'a pending seat that is the tail root keeps follow');
	});
});
