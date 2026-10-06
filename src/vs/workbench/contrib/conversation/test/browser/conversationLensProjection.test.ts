/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applySessionViewTimeline, isPreFirst, type IConversationLensProjectionHost } from '../../browser/conversationLensProjection.js';
import { conversationLensStaleSnapshotClass } from '../../browser/conversationLensReadingColumn.js';

suite('ConversationLensProjection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('applySessionViewTimeline skips projection when sessionViewLease sessionId differs from bound session', () => {
		let applyEntries = 0;
		let lastEntryCount = -1;
		const banner = document.createElement('div');
		banner.className = conversationLensStaleSnapshotClass;
		const readingColumn = document.createElement('div');
		readingColumn.appendChild(banner);
		const host = {
			isDisposed: false,
			lensId: 'conversation' as const,
			filterAgentId: undefined,
			composerPolicy: 'compose' as const,
			conversationPhase: 'active' as const,
			lastAttachedEntries: [],
			getBoundSessionId: () => 'sess-B',
			sessionViewLease: {
				sessionId: 'sess-A',
				snapshot: {
					sessionId: 'sess-A',
					sync: { kind: 'live' as const },
					timeline: [{ id: 'turn-stale', summary: { kind: 'user' as const } }],
					overlay: { blocks: [] },
					pendingActions: [],
					localPendingSends: [],
				},
				attribution: new Map(),
				details: new Map(),
				respondFailures: undefined,
			},
			stubService: {
				stubTurnSessionLinkCatalog: undefined,
				getSessionSync: () => ({ kind: 'live' as const }),
				getTurns: () => [],
				getActiveSessionId: () => 'sess-B',
			},
			reviewNavService: { getReviewNavForSession: () => [] },
			timelineTree: {
				applyEntries: (entries: readonly unknown[]) => {
					applyEntries++;
					lastEntryCount = entries.length;
				},
			},
			trajectoryView: {},
			sessionSyncBadge: document.createElement('span'),
			readingColumn,
			renderInboxStatus: () => { },
			syncComposerPlacement: () => { },
			applyConversationDensity: () => { },
			updateSessionConfigVisibility: () => { },
			exitComposerEdit: () => { },
			updateGateRow: () => { },
			relayoutReadingSurfaces: () => { },
			slotHosts: { dock: { classList: { toggle: () => { } } } },
			prefirstHero: { hidden: true, appendChild: () => { } },
			dockRoot: { insertBefore: () => { } },
			gateRow: {},
			identityStrip: { element: document.createElement('div') },
			inboxOverlay: { element: { hidden: true } },
		} as unknown as IConversationLensProjectionHost;

		applySessionViewTimeline(host, { kind: 'baseline' });

		assert.strictEqual(applyEntries, 0);
		assert.strictEqual(lastEntryCount, -1);
		assert.strictEqual(host.lastAttachedEntries.length, 0);
	});

	test('isPreFirst stays active when lease sessionId differs from bound but painted entries remain', () => {
		const host = {
			getBoundSessionId: () => 'sess-B',
			sessionViewLease: {
				sessionId: 'sess-A',
				snapshot: {
					timeline: [{ id: 'turn-stale', summary: { kind: 'user' as const } }],
					localPendingSends: [],
				},
			},
			stubService: { getTurns: () => [] },
			lastAttachedEntries: [{ id: 'turn-painted', kind: 'user' as const, text: 'hello' }],
		} as unknown as IConversationLensProjectionHost;

		assert.strictEqual(isPreFirst(host), false);
	});

});
