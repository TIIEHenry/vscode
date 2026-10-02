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

suite('ConversationTimelineHost', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const user = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'user', text });
	const assistant = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'assistant', text, stubEcho: true });

	function createHost(): ConversationTimelineHost {
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
		}));
	}

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

	test('resetTestApplyMetrics zeroes the counters', () => {
		const host = createHost();
		host.applyEntries(stubTurnsToEntries([user('u1', 'hello')]), { kind: 'baseline' });
		assert.ok(host.getTestApplyMetrics().setChildrenCount > 0);

		host.resetTestApplyMetrics();

		assert.deepStrictEqual(host.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 0 });
	});
});
