/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { timeout } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable, toDisposable, type DisposableStore } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import type { ConversationViewFrameApplied, IConversationSessionViewLease } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IWebviewService } from '../../../webview/browser/webview.js';
import { ConversationEngineFrameSource } from '../../browser/conversationEngineFrameSource.js';
import { createConversationProjectionCache, projectSnapshotToEntries, type ConversationTimelineEntry } from '../../browser/conversationSessionView.js';
import { ConversationTimelineHost } from '../../browser/conversationTimelineHost.js';
import { ScriptedSessionView } from './scriptedSessionView.js';

/**
 * The subscription → UI chain with only the engine faked:
 *
 *   ScriptedSessionView (host frames)
 *     → ConversationEngineFrameSource lease (applyViewFrame replica, ack, resync)
 *     → projectSnapshotToEntries (the call ConversationLens makes per applied frame)
 *     → ConversationTimelineHost (real DOM)
 *
 * Both the imperative tests and the declarative scripts (`streamScript.ts`) run on this.
 * If the production wiring in `conversationLensSessionBinding.ts` changes shape, this is the
 * single place to follow it.
 */
export interface StreamHarness {
	readonly view: ScriptedSessionView;
	readonly lease: IConversationSessionViewLease;
	readonly host: ConversationTimelineHost;
	/** Every frame the lease applied, in order (one entry == one paint). */
	readonly applied: readonly ConversationViewFrameApplied[];
	/** Entries from the most recent paint. */
	entries(): readonly ConversationTimelineEntry[];
	/** Root ids of the rows currently in the DOM, in DOM order. */
	rowIds(): string[];
	/** `textContent` of a row, or `undefined` when the row is not in the DOM. */
	rowText(id: string): string | undefined;
	/** Turn kind (`data-kind` of the inner turn element: `user`, `assistant`, …), or `undefined` if absent. */
	rowKind(id: string): string | undefined;
	/**
	 * Wait until the pipeline is quiescent: buffered burst flushed, acquire chain resolved, and the
	 * host's own deferred work done. The host renders a window of rows and prepends older rows when
	 * its top sentinel becomes visible; this harness models "the user is parked at the top of the
	 * list", so the sentinel is reported visible on every round. Asserting before `settle()` is flaky.
	 */
	settle(): Promise<void>;
}

export function createStreamHarness(store: Pick<DisposableStore, 'add'>, sessionId = 's1'): StreamHarness {
	const view = store.add(new ScriptedSessionView());
	const source = store.add(new ConversationEngineFrameSource(view));
	const lease = store.add(source.acquire(sessionId));

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

	// The unit-test window does not render frames, so real IntersectionObserver callbacks never run.
	// Inject a controllable one: only the host's top sentinel is ever reported (as visible).
	const sentinelCallbacks: Array<{ readonly fire: () => void }> = [];
	const host = store.add(instantiationService.createInstance(ConversationTimelineHost, parent, {
		onResolveConfirmation: () => { },
		onQuestionRespond: () => { },
		createIntersectionObserver: onIntersect => ({
			observe: target => {
				if (target.classList.contains('conversation-timeline-sentinel')) {
					sentinelCallbacks.push({ fire: () => onIntersect({ target, isIntersecting: true }) });
				}
			},
			disconnect: () => { },
		}),
		contentAdapter: {
			renderTurnBody: (turn, container) => {
				container.textContent = turn.text;
				return Disposable.None;
			},
		},
	}));

	const cache = createConversationProjectionCache();
	const applied: ConversationViewFrameApplied[] = [];
	let latest: readonly ConversationTimelineEntry[] = [];
	store.add(lease.onDidApplyFrame(frame => {
		applied.push(frame);
		latest = projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details, undefined, cache, lease.respondFailures);
		host.applyEntries(latest, frame);
	}));

	return {
		view,
		lease,
		host,
		applied,
		entries: () => latest,
		rowIds: () => [...host.domNode.querySelectorAll<HTMLElement>('article.conversation-timeline-item')]
			.map(article => article.dataset.rootId ?? ''),
		rowText: id => host.getTimelineRowElement(id)?.textContent ?? undefined,
		rowKind: id => host.getTimelineRowElement(id)?.querySelector(`[data-turn-id="${id}"]`)?.getAttribute('data-kind') ?? undefined,
		settle: async () => {
			const signature = () => `${applied.length}|${[...host.domNode.querySelectorAll<HTMLElement>('article.conversation-timeline-item')].map(a => a.dataset.rootId).join(',')}`;
			let last = '';
			let stable = 0;
			for (let i = 0; i < 20 && stable < 2; i++) {
				await timeout(0);
				for (const sentinel of sentinelCallbacks) {
					sentinel.fire();
				}
				const now = signature();
				stable = now === last ? stable + 1 : 0;
				last = now;
			}
		},
	};
}
