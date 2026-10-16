/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { InMemoryStorageService } from '../../../../../platform/storage/common/storage.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ENGINE_BIND_FAILED_SESSION_ID } from '../../browser/conversationEngineRosterService.js';
import type { ConversationWriteMessage, IConversationSessionViewLease, PostOutcome } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { ConversationComposerPostFailureReason } from '../../browser/conversationLensDockStrings.js';
import { postBound, pruneOrphanComposerDrafts, submitDraft, type IConversationLensComposerHost } from '../../browser/conversationLensComposer.js';
import { isComposerSingleLine, updateComposerSingleLineLayout, type IConversationLensComposerSingleLineHost } from '../../browser/conversationLensComposerChrome.js';
import { loadUaClientComposerDraft, storeUaClientComposerDraft, uaClientComposerDraftEntryKey } from '../../browser/uaClientComposerDrafts.js';

suite('conversationLensComposer', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('pruneOrphanComposerDrafts keeps drafts when the visible roster narrows to bind-fail only', () => {
		const storageService = disposables.add(new InMemoryStorageService());
		storeUaClientComposerDraft(storageService, 'sess-A', 'default', 'draft on A');
		const draftKey = uaClientComposerDraftEntryKey('sess-A', 'default');
		const drafts = new Map<string, string>([[draftKey, 'draft on A']]);
		const host = {
			drafts,
			storageService,
			stubService: {
				getSessions: () => [{ id: ENGINE_BIND_FAILED_SESSION_ID, title: '' }],
			},
		} as unknown as IConversationLensComposerHost;

		pruneOrphanComposerDrafts(host);

		assert.strictEqual(drafts.get(draftKey), 'draft on A');
		assert.strictEqual(loadUaClientComposerDraft(storageService, 'sess-A', 'default'), 'draft on A');
	});

	test('submitDraft in-flight session switch posts the captured lease not the rebound lease', async () => {
		let release!: () => void;
		const held = new Promise<void>(resolve => {
			release = resolve;
		});
		const posted: { sessionId: string; msg: ConversationWriteMessage }[] = [];
		const leaseA: IConversationSessionViewLease = {
			sessionId: 'sess-A',
			snapshot: {} as IConversationSessionViewLease['snapshot'],
			attribution: new Map(),
			details: new Map(),
			onDidApplyFrame: { dispose: () => { } } as never,
			dispose: () => { },
			post: async (msg: ConversationWriteMessage): Promise<PostOutcome> => {
				await held;
				posted.push({ sessionId: 'sess-A', msg });
				return { accepted: true, correlation: { id: 'c1' } };
			},
			requestResync: () => { },
		};
		const leaseB: IConversationSessionViewLease = {
			sessionId: 'sess-B',
			snapshot: {} as IConversationSessionViewLease['snapshot'],
			attribution: new Map(),
			details: new Map(),
			onDidApplyFrame: { dispose: () => { } } as never,
			dispose: () => { },
			post: async (msg: ConversationWriteMessage): Promise<PostOutcome> => {
				posted.push({ sessionId: 'sess-B', msg });
				return { accepted: true, correlation: { id: 'c2' } };
			},
			requestResync: () => { },
		};
		const boundSessionId = { current: 'sess-A' };
		const failures: ConversationComposerPostFailureReason[] = [];
		const host = {
			composerPolicy: 'compose' as const,
			submitInFlight: false,
			filterAgentId: undefined,
			catalogModelIds: [''],
			modelSelectedIndex: 0,
			drafts: new Map<string, string>(),
			dockTextarea: { value: 'hello from A' },
			configurationService: { getValue: () => false },
			getBoundSessionId: () => boundSessionId.current,
			sessionViewLease: leaseA,
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				hasEngineConnectionHistory: () => true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
			resetInputHistoryBrowse() { },
			updateSendEnabled() { },
			updateConversationPhase() { },
			showPostFailure(reason: ConversationComposerPostFailureReason) {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		const pending = submitDraft(host);
		boundSessionId.current = 'sess-B';
		host.sessionViewLease = leaseB;
		release();
		await pending;

		assert.deepStrictEqual(posted, [{ sessionId: 'sess-A', msg: { kind: 'submitInput', text: 'hello from A' } }]);
		assert.deepStrictEqual(failures, []);
	});

	test('postBound optional lease pins submitInput to the lease captured at send time', async () => {
		const posted: string[] = [];
		const leaseA = {
			sessionId: 'sess-A',
			post: async () => {
				posted.push('sess-A');
				return { accepted: true, correlation: { id: 'c1' } };
			},
		};
		const host = {
			sessionViewLease: { sessionId: 'sess-B', post: async () => { posted.push('sess-B'); return { accepted: true, correlation: { id: 'c2' } }; } },
			stubService: { isEngineConnected: () => true, isEngineSessionReady: () => true },
			uaConnection: {
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
		} as unknown as IConversationLensComposerHost;

		await postBound(host, { kind: 'submitInput', text: 'hello' }, leaseA as unknown as IConversationSessionViewLease);

		assert.deepStrictEqual(posted, ['sess-A']);
	});

	function createSingleLineTestHost(overrides?: Partial<IConversationLensComposerSingleLineHost>) {
		const composer = document.createElement('div');
		composer.className = 'conversation-lens-composer';
		const composerCluster = document.createElement('div');
		composerCluster.className = 'conversation-lens-composer-cluster';
		const dockRoot = document.createElement('div');
		dockRoot.className = 'conversation-lens-dock-root';
		const prefirstHero = document.createElement('div');
		prefirstHero.className = 'conversation-lens-prefirst-hero';
		const textarea = document.createElement('textarea');
		textarea.className = 'conversation-lens-dock-input';
		textarea.value = '';

		dockRoot.appendChild(composerCluster);
		composerCluster.appendChild(composer);

		let scrolledToEndCount = 0;
		let atBottom = true;

		const host: IConversationLensComposerSingleLineHost = {
			composer,
			composerCluster,
			dockRoot,
			prefirstHero,
			dockTextarea: textarea,
			composerPolicy: 'compose',
			inputMaximized: false,
			lastReadingWidth: 500,
			composerRefResources: [],
			slotHosts: {
				dock: document.createElement('div'),
			} as any,
			timelineTree: {
				isScrolledToBottom: () => atBottom,
				scrollToEnd: () => { scrolledToEndCount++; },
			},
			isPreFirst: () => false,
			...overrides,
		};

		return {
			host,
			getScrolledToEndCount: () => scrolledToEndCount,
			setAtBottom: (value: boolean) => { atBottom = value; },
		};
	}

	test('S5: isComposerSingleLine returns true when docked in active session with empty draft, no chips, width >= 450', () => {
		const { host } = createSingleLineTestHost();
		assert.strictEqual(isComposerSingleLine(host), true);
	});

	test('S5: isComposerSingleLine returns false in PreFirst', () => {
		const { host } = createSingleLineTestHost({
			isPreFirst: () => true,
		});
		assert.strictEqual(isComposerSingleLine(host), false);
	});

	test('S5: isComposerSingleLine returns false when textarea has draft text', () => {
		const { host } = createSingleLineTestHost();
		host.dockTextarea.value = 'hello';
		assert.strictEqual(isComposerSingleLine(host), false);
	});

	test('S5: isComposerSingleLine returns false when mention chips are present', () => {
		const { host } = createSingleLineTestHost({
			composerRefResources: [{ id: 'ref-1' }],
		});
		assert.strictEqual(isComposerSingleLine(host), false);
	});

	test('S5: isComposerSingleLine returns false when leaf width is under 450px or marked is-narrow', () => {
		const { host: hostNarrowWidth } = createSingleLineTestHost({
			lastReadingWidth: 400,
		});
		assert.strictEqual(isComposerSingleLine(hostNarrowWidth), false);

		const { host: hostNarrowClass } = createSingleLineTestHost({
			lastReadingWidth: 0,
		});
		hostNarrowClass.slotHosts!.dock.classList.add('is-narrow');
		assert.strictEqual(isComposerSingleLine(hostNarrowClass), false);
	});

	test('S5: isComposerSingleLine returns false when input is maximized or policy is not compose', () => {
		const { host: hostMaximized } = createSingleLineTestHost({
			inputMaximized: true,
		});
		assert.strictEqual(isComposerSingleLine(hostMaximized), false);

		const { host: hostTurnEdit } = createSingleLineTestHost({
			composerPolicy: 'turnEdit',
		});
		assert.strictEqual(isComposerSingleLine(hostTurnEdit), false);

		const { host: hostQueueEdit } = createSingleLineTestHost({
			composerPolicy: 'queueEdit',
		});
		assert.strictEqual(isComposerSingleLine(hostQueueEdit), false);
	});

	test('S5: isComposerSingleLine returns false when composer is not in dock', () => {
		const { host } = createSingleLineTestHost();
		host.prefirstHero.appendChild(host.composerCluster);
		assert.strictEqual(isComposerSingleLine(host), false);
	});

	test('S5: updateComposerSingleLineLayout toggles classes and maintains bottom scroll when at bottom', () => {
		const { host, getScrolledToEndCount } = createSingleLineTestHost();
		assert.strictEqual(host.composer.classList.contains('is-single-line'), false);
		assert.strictEqual(host.composer.classList.contains('composer-single-line'), false);

		// 1. Initial transition to single-line
		updateComposerSingleLineLayout(host);
		assert.strictEqual(host.composer.classList.contains('is-single-line'), true);
		assert.strictEqual(host.composer.classList.contains('composer-single-line'), true);
		assert.strictEqual(getScrolledToEndCount(), 1, 'must scrollToEnd when transitioning while at bottom');

		// Idempotent when no change
		updateComposerSingleLineLayout(host);
		assert.strictEqual(getScrolledToEndCount(), 1);

		// 2. Typing text transitions to double-line
		host.dockTextarea.value = 'typed message';
		updateComposerSingleLineLayout(host);
		assert.strictEqual(host.composer.classList.contains('is-single-line'), false);
		assert.strictEqual(host.composer.classList.contains('composer-single-line'), false);
		assert.strictEqual(getScrolledToEndCount(), 2, 'must scrollToEnd when expanding while at bottom');

		// 3. Clearing text transitions back to single-line
		host.dockTextarea.value = '';
		updateComposerSingleLineLayout(host);
		assert.strictEqual(host.composer.classList.contains('is-single-line'), true);
		assert.strictEqual(host.composer.classList.contains('composer-single-line'), true);
		assert.strictEqual(getScrolledToEndCount(), 3, 'must scrollToEnd when collapsing back while at bottom');
	});

	test('S5: updateComposerSingleLineLayout does not scrollToEnd when reading column is not at bottom', () => {
		const { host, getScrolledToEndCount, setAtBottom } = createSingleLineTestHost();
		setAtBottom(false);

		updateComposerSingleLineLayout(host);
		assert.strictEqual(host.composer.classList.contains('is-single-line'), true);
		assert.strictEqual(host.composer.classList.contains('composer-single-line'), true);
		assert.strictEqual(getScrolledToEndCount(), 0, 'must not scrollToEnd when not at bottom');

		// Type text to revert to double-line
		host.dockTextarea.value = 'hello';
		updateComposerSingleLineLayout(host);
		assert.strictEqual(host.composer.classList.contains('is-single-line'), false);
		assert.strictEqual(host.composer.classList.contains('composer-single-line'), false);
		assert.strictEqual(getScrolledToEndCount(), 0, 'must not scrollToEnd when not at bottom');
	});

});
