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
import { ConversationTimelineHost, conversationTimelineEmptyTitle, conversationTimelineMessagesNotLoaded, type IConversationLensTimelineHostOptions } from '../../browser/conversationTimelineHost.js';

suite('ConversationTimelineHost', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const user = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'user', text });
	const assistant = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'assistant', text, stubEcho: true });

	function createHost(extra: Partial<IConversationLensTimelineHostOptions> = {}): ConversationTimelineHost {
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
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));

		return store.add(instantiationService.createInstance(ConversationTimelineHost, parent, {
			onResolveConfirmation: () => { },
			contentAdapter: {
				renderTurnBody: (turn: ConversationStubTurn, container: HTMLElement) => {
					container.textContent = turn.text;
					return Disposable.None;
				},
			},
			...extra,
		}));
	}

	test('Scroll to Bottom hands focus to the caller once it hides itself', () => {
		let handedOff = 0;
		const host = createHost({ onScrolledToEndByUser: () => handedOff++ });
		host.applyEntries(stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one')]), { kind: 'baseline' });
		const scrollDown = host.domNode.querySelector('.conversation-timeline-scroll-down') as HTMLElement;
		scrollDown.hidden = false;
		scrollDown.click();
		assert.strictEqual(handedOff, 1);
	});

	test('Inbox reveal of a pending permission focuses its Allow button', () => {
		const host = createHost();
		host.applyEntries(stubTurnsToEntries([
			user('u1', 'hello'),
			{ id: 'c1', kind: 'confirmation', text: 'Run tool?', status: 'pending' },
		]), { kind: 'baseline' });
		host.revealPendingTurn('c1', { focusSeat: true });
		const active = document.activeElement as HTMLElement | null;
		assert.deepStrictEqual([active?.getAttribute('aria-label'), !!active?.closest('.conversation-lens-confirmation-actions')], ['Allow', true]);
	});

	test('a flipped streaming hold repaints the timeline write buttons', () => {
		let hold: string | undefined;
		const host = createHost({ onRegenerateTurn: () => { }, turnWriteHoldReason: () => hold });
		host.applyEntries(stubTurnsToEntries([user('u1', 'hello'), { id: 'a1', kind: 'assistant', text: 'one' }]), { kind: 'baseline' });
		const regenerate = () => host.domNode.querySelector('.conversation-lens-turn-action-regenerate .monaco-button')?.getAttribute('aria-disabled');
		const before = regenerate();
		hold = 'busy';
		host.refreshTurnWriteHolds();
		assert.deepStrictEqual([before, regenerate()], ['false', 'true']);
	});

	function articleCount(host: ConversationTimelineHost): number {
		return host.domNode.querySelectorAll('article.conversation-timeline-item').length;
	}

	test('same entries twice do not rerender and keep the article', () => {
		const host = createHost();
		const entries = stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one')]);
		host.applyEntries(entries, { kind: 'baseline' });
		const article = host.getTimelineRowElement('u1');
		assert.ok(article);
		host.resetTestApplyMetrics();

		host.applyEntries(entries, { kind: 'baseline' });

		assert.deepStrictEqual(host.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 0 });
		assert.strictEqual(host.getTimelineRowElement('u1'), article);
	});

	test('replacing one assistant turn rerenders that root and keeps the article', () => {
		const host = createHost();
		const entries = stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one'), assistant('a2', 'two')]);
		host.applyEntries(entries, { kind: 'baseline' });
		const article = host.getTimelineRowElement('a1');
		assert.ok(article);
		host.resetTestApplyMetrics();

		const [replaced] = stubTurnsToEntries([assistant('a1', 'one edited')]);
		assert.ok(replaced);
		const next = entries.slice();
		next[1] = replaced;
		host.applyEntries(next, { kind: 'patches', changedIds: new Set(['a1']) });

		assert.deepStrictEqual(host.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 1 });
		assert.strictEqual(host.getTimelineRowElement('a1'), article);
	});

	test('inserting a root bumps setChildrenCount by 1', () => {
		const host = createHost();
		const entries = stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one')]);
		host.applyEntries(entries, { kind: 'baseline' });
		host.resetTestApplyMetrics();

		const [added] = stubTurnsToEntries([assistant('a2', 'two')]);
		assert.ok(added);
		host.applyEntries([...entries, added], { kind: 'patches', changedIds: new Set(['a2']) });

		assert.strictEqual(host.getTestApplyMetrics().setChildrenCount, 1);
		assert.strictEqual(articleCount(host), 3);
	});

	test('setVisible(false) skips DOM work and setVisible(true) applies it', () => {
		const host = createHost();
		host.applyEntries(stubTurnsToEntries([user('u1', 'hello')]), { kind: 'baseline' });
		assert.strictEqual(articleCount(host), 1);

		host.setVisible(false);
		host.applyEntries(
			stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one'), assistant('a2', 'two')]),
			{ kind: 'baseline' },
		);
		assert.strictEqual(articleCount(host), 1);

		host.setVisible(true);
		assert.strictEqual(articleCount(host), 3);
	});

	test('articles expose data-root-id, the stream is a feed, and the last root is content-visibility visible', () => {
		const host = createHost();
		host.applyEntries(stubTurnsToEntries([user('u1', 'hello'), assistant('a1', 'one')]), { kind: 'baseline' });

		const article = host.getTimelineRowElement('a1');
		assert.ok(article);
		assert.strictEqual(article.getAttribute('data-root-id'), 'a1');
		assert.ok(article.classList.contains('conversation-timeline-item--cv-visible'));

		const stream = host.domNode.querySelector('.conversation-timeline-stream');
		assert.strictEqual(stream?.getAttribute('role'), 'feed');
	});

	test('content-visibility is not inline so focus-within can unclamp an older row', () => {
		const host = createHost();
		host.applyEntries(stubTurnsToEntries([
			user('u1', 'hello'),
			assistant('a1', 'one'),
			assistant('a2', 'two'),
			assistant('a3', 'three'),
		]), { kind: 'baseline' });

		const early = host.getTimelineRowElement('u1');
		const tail = host.getTimelineRowElement('a3');
		assert.ok(early);
		assert.ok(tail);
		assert.ok(!early.classList.contains('conversation-timeline-item--cv-visible'));
		assert.ok(tail.classList.contains('conversation-timeline-item--cv-visible'));
		for (const article of [early, tail]) {
			assert.strictEqual(article.style.contentVisibility, '');
			assert.strictEqual(article.style.containIntrinsicBlockSize, '');
		}
	});

	test('a non-retryable question failure is not named Input needed on the feed', () => {
		const host = createHost();
		const [entry] = stubTurnsToEntries([{
			id: 'q1',
			kind: 'question',
			text: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'a', title: 'Choice', options: ['alpha'] }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
		}]);
		assert.ok(entry);
		host.applyEntries([{
			...entry,
			respondFailure: { retryable: false, error: 'gone' },
		}], { kind: 'baseline' });

		const reason = "Can't answer — this response can't be sent again.";
		const article = host.getTimelineRowElement('q1');
		assert.ok(article);
		assert.strictEqual(article.getAttribute('aria-label'), `Question, ${reason}, Pick one`);
		assert.strictEqual(article.querySelector('.conversation-lens-turn-honest-status')?.textContent, reason);
		assert.strictEqual(article.querySelector('.monaco-button'), null);
		assert.ok(article.textContent?.includes("Couldn't send this response: gone"));
		assert.ok(!article.textContent?.includes('Input needed'));
	});

	test('empty timeline copy follows loading and unavailable', () => {
		const host = createHost();
		const empty = host.domNode.querySelector('.conversation-lens-timeline-empty') as HTMLElement;
		const title = empty.querySelector('.conversation-lens-timeline-empty-title') as HTMLElement;
		assert.strictEqual(title.textContent, conversationTimelineEmptyTitle);
		assert.ok(!empty.classList.contains('is-loading'));
		assert.ok(!empty.classList.contains('is-unavailable'));

		host.setEmptyStateKind('loading');
		assert.strictEqual(title.textContent, '');
		assert.ok(empty.classList.contains('is-loading'));
		assert.ok(!empty.classList.contains('is-unavailable'));

		host.setEmptyStateKind('unavailable');
		assert.strictEqual(title.textContent, conversationTimelineMessagesNotLoaded);
		assert.ok(!empty.classList.contains('is-loading'));
		assert.ok(empty.classList.contains('is-unavailable'));

		host.applyEntries(stubTurnsToEntries([user('u1', 'hello')]), { kind: 'baseline' });
		assert.strictEqual(empty.style.display, 'none');
	});

	test('resetTestApplyMetrics zeroes the counters', () => {
		const host = createHost();
		host.applyEntries(stubTurnsToEntries([user('u1', 'hello')]), { kind: 'baseline' });
		assert.ok(host.getTestApplyMetrics().setChildrenCount > 0);

		host.resetTestApplyMetrics();

		assert.deepStrictEqual(host.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 0 });
	});

	test('streaming assistant card renders initial text, rendered-markdown class, and sub-agent source header on mount and full re-render', () => {
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
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));

		const host = store.add(instantiationService.createInstance(ConversationTimelineHost, parent, {
			onResolveConfirmation: () => { },
			contentAdapter: {
				renderTurnBody: (turn: ConversationStubTurn, container: HTMLElement) => {
					container.textContent = turn.text;
					return Disposable.None;
				},
				renderStreamingBody: (_turn: ConversationStubTurn, container: HTMLElement) => {
					return {
						update(text: string) {
							container.textContent = text;
						},
						dispose() { },
					};
				},
			},
		}));

		const [baseEntry] = stubTurnsToEntries([assistant('overlay:t1', 'initial stream text')]);
		assert.ok(baseEntry);
		const streamingEntry = { ...baseEntry, streaming: true as const, agentId: 'sub-agent-alpha' };
		host.applyEntries([streamingEntry], { kind: 'baseline' });

		const article = host.getTimelineRowElement('overlay:t1');
		assert.ok(article);
		const body = article.querySelector('.conversation-lens-turn-body');
		assert.ok(body);
		assert.strictEqual(body.textContent, 'initial stream text');
		assert.ok(body.classList.contains('rendered-markdown'));
		assert.strictEqual(article.querySelector('.conversation-lens-turn-source')?.textContent, 'sub-agent-alpha');

		host.refreshPresentation();
		assert.strictEqual(article.querySelector('.conversation-lens-turn-body')?.textContent, 'initial stream text');
	});

	test('turns inserted before an initial overlay anchor stay mounted within the window', () => {
		const host = createHost();
		const [overlayEntry] = stubTurnsToEntries([assistant('overlay:t1', 'streaming...')]);
		assert.ok(overlayEntry);
		host.applyEntries([{ ...overlayEntry, streaming: true }], { kind: 'baseline' });
		assert.strictEqual(articleCount(host), 1);

		const [u1, a1] = stubTurnsToEntries([user('u1', 'question'), assistant('a1', 'preamble')]);
		assert.ok(u1 && a1);
		host.applyEntries([u1, a1, { ...overlayEntry, streaming: true }], { kind: 'patches', changedIds: new Set(['u1', 'a1']) });

		assert.strictEqual(articleCount(host), 3);
		assert.ok(host.getTimelineRowElement('u1'));
		assert.ok(host.getTimelineRowElement('a1'));
		assert.ok(host.getTimelineRowElement('overlay:t1'));
	});

	test('non-tail error card keeps content-visibility visible so negative inline margins are not paint-clipped', () => {
		const host = createHost();
		const turns: ConversationStubTurn[] = [
			user('u1', 'hello'),
			{ id: 'err1', kind: 'error', text: 'Something failed', retryable: true },
			assistant('a1', 'one'),
			assistant('a2', 'two'),
			assistant('a3', 'three'),
			assistant('a4', 'four'),
		];
		host.applyEntries(stubTurnsToEntries(turns), { kind: 'baseline' });

		const errArticle = host.getTimelineRowElement('err1');
		assert.ok(errArticle);
		assert.ok(errArticle.classList.contains('conversation-timeline-item--cv-visible'));
	});
});
