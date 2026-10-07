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

});
