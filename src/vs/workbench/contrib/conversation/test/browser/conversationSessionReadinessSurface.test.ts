/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IWebviewService } from '../../../webview/browser/webview.js';
import { updateGateRow, type IConversationLensComposerChromeHost } from '../../browser/conversationLensComposerChrome.js';
import { conversationLensDockSessionUnavailable, conversationLensDockSessionUnavailableReason, conversationLensPhasePreFirstClass } from '../../browser/conversationLensDockStrings.js';
import { bindSessionView } from '../../browser/conversationLensSessionBinding.js';
import { updateConversationPhase, type IConversationLensProjectionHost } from '../../browser/conversationLensProjection.js';
import { stubTurnsToEntries } from '../../browser/conversationSessionView.js';
import type { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { ConversationTimelineHost, conversationTimelineMessagesNotLoaded } from '../../browser/conversationTimelineHost.js';

suite('ConversationSessionReadinessSurface', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createTimeline(): ConversationTimelineHost {
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

	function surface(readiness: 'loading' | 'unavailable' | 'ready', turns: ConversationStubTurn[]): {
		host: IConversationLensProjectionHost & IConversationLensComposerChromeHost;
		timeline: ConversationTimelineHost;
		readingColumn: HTMLElement;
		prefirstHero: HTMLElement;
		gateRow: HTMLElement;
		dockRoot: HTMLElement;
	} {
		const timeline = createTimeline();
		const readingColumn = document.createElement('div');
		const prefirstHero = document.createElement('div');
		const gateRow = document.createElement('div');
		const gateLabel = document.createElement('span');
		gateRow.append(gateLabel);
		const dock = document.createElement('div');
		const dockRoot = document.createElement('div');
		const identity = document.createElement('div');
		const inbox = document.createElement('div');
		readingColumn.append(timeline.domNode);
		dockRoot.append(gateRow, inbox);
		document.body.append(readingColumn, prefirstHero, dockRoot);
		store.add(toDisposable(() => {
			readingColumn.remove();
			prefirstHero.remove();
			dockRoot.remove();
		}));
		const host = {
			isDisposed: false,
			composerPolicy: 'compose',
			conversationPhase: 'active',
			filterAgentId: undefined,
			lastAttachedEntries: [],
			postFailureVisible: false,
			readingColumn,
			prefirstHero,
			gateRow,
			gateLabel,
			dockRoot,
			slotHosts: { dock },
			identityStrip: { element: identity },
			inboxOverlay: { element: inbox },
			timelineTree: timeline,
			sessionViewLifetime: store.add(new DisposableStore()),
			getBoundSessionId: () => 'sess-1',
			exitComposerEdit() { },
			updateSessionConfigVisibility() { },
			syncComposerPlacement() { },
			relayoutReadingSurfaces() { },
			updateGateRow() { updateGateRow(host as unknown as IConversationLensComposerChromeHost); },
			stubService: {
				isEngineConnected: () => true,
				getEngineSessionReadiness: () => readiness,
				getTurns: () => turns,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected' as const, path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
		};
		return { host: host as unknown as IConversationLensProjectionHost & IConversationLensComposerChromeHost, timeline, readingColumn, prefirstHero, gateRow, dockRoot };
	}

	test('PreFirst keeps the gate in the hero while the empty timeline is under the phase class', () => {
		const { host, timeline, readingColumn, prefirstHero, gateRow } = surface('unavailable', []);
		updateConversationPhase(host);

		assert.ok(readingColumn.classList.contains(conversationLensPhasePreFirstClass));
		assert.strictEqual(gateRow.parentElement, prefirstHero);
		assert.ok(readingColumn.contains(timeline.domNode));
		assert.strictEqual(
			timeline.domNode.querySelector('.conversation-lens-timeline-empty-title')?.textContent,
			conversationTimelineMessagesNotLoaded,
		);
		assert.strictEqual(gateRow.textContent, `${conversationLensDockSessionUnavailable} — ${conversationLensDockSessionUnavailableReason}`);
		assert.ok(gateRow.classList.contains('is-warning'));
	});

	test('switching to an unready session clears painted turns and stays Active', () => {
		const turn: ConversationStubTurn = { id: 'u1', kind: 'user', text: 'kept in the roster' };
		const { host, timeline, readingColumn, gateRow, dockRoot } = surface('unavailable', [turn]);
		const painted = stubTurnsToEntries([turn]);
		timeline.applyEntries(painted, { kind: 'baseline' });
		assert.ok(timeline.getTimelineRowElement('u1'));
		const binding = host as unknown as {
			lastAttachedEntries: unknown[];
			sessionViewLease: { sessionId: string };
			getBoundSessionId(): string;
		};
		binding.lastAttachedEntries = painted;
		binding.sessionViewLease = { sessionId: 'old' };
		binding.getBoundSessionId = () => 'sess-new';
		(host as unknown as { conversationPhase: string }).conversationPhase = 'prefirst';

		bindSessionView(host as never, 'sess-new');
		updateConversationPhase(host);

		assert.strictEqual(timeline.getTimelineRowElement('u1'), undefined);
		assert.ok(!readingColumn.classList.contains(conversationLensPhasePreFirstClass));
		assert.strictEqual(gateRow.parentElement, dockRoot);
		assert.strictEqual(
			timeline.domNode.querySelector('.conversation-lens-timeline-empty-title')?.textContent,
			conversationTimelineMessagesNotLoaded,
		);
	});
});
