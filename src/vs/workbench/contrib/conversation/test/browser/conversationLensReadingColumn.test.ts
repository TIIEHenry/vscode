/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { conversationLensStaleSnapshotClass, isReadingColumnWritesEnabled, refreshStaleSnapshotBanner, shouldShowReadingColumnLiveChrome } from '../../browser/conversationLensReadingColumn.js';
import type { SyncChrome } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import type { ConversationSessionSource } from '../../browser/conversationRosterStorage.js';

suite('conversationLensReadingColumn', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('the bound cached session and connection history both close writes without disabling never-connected local fixtures', () => {
		let connected = false;
		let history = false;
		let source: ConversationSessionSource = 'local';
		const queried: string[] = [];
		const host = {
			getBoundSessionId: () => 'bound-cache',
			stubService: {
				isEngineConnected: () => connected,
				isEngineSessionReady: () => true,
				hasEngineConnectionHistory: () => history,
				getSessionSource: (id: string) => { queried.push(id); return source; },
			},
			uaConnection: {
				getConnectionSnapshot: () => ({ pairingPending: false }),
				getConnectionPhase: () => ({ kind: 'disconnected' as const }),
			},
		};
		assert.strictEqual(isReadingColumnWritesEnabled(host), true);
		source = 'engine-cache';
		assert.strictEqual(isReadingColumnWritesEnabled(host), false);
		assert.deepStrictEqual(queried, ['bound-cache', 'bound-cache'], 'session source must follow the bound pane rather than an unrelated active session');
		source = 'local';
		history = true;
		assert.strictEqual(isReadingColumnWritesEnabled(host), false, 'the existing engine history gate also covers transitional local source metadata');
		connected = true;
		assert.strictEqual(isReadingColumnWritesEnabled(host), true);
	});

	test('stale snapshot banner follows bound session sync when lease sessionId is stale', () => {
		const boundClosed: SyncChrome = { kind: 'closed', reason: 'Bound leaf disconnect' };
		const banner = document.createElement('div');
		banner.className = conversationLensStaleSnapshotClass;
		banner.hidden = true;
		const readingColumn = document.createElement('div');
		readingColumn.appendChild(banner);
		const getSessionSyncCalls: string[] = [];
		const host = {
			getBoundSessionId: () => 'sess-B',
			sessionViewLease: {
				sessionId: 'sess-A',
				snapshot: {
					sessionId: 'sess-A',
					sync: { kind: 'live' as const },
					timeline: [{ id: 't-stale', kind: 'user', text: 'stale lease row' }],
					localPendingSends: [],
				},
			},
			readingColumn,
			stubService: {
				getTurns: (sessionId: string) => sessionId === 'sess-B'
					? [{ id: 't-bound', kind: 'user', text: 'bound roster turn' }]
					: [],
				getSessionSync: (sessionId: string) => {
					getSessionSyncCalls.push(sessionId);
					return sessionId === 'sess-B' ? boundClosed : { kind: 'live' as const };
				},
			},
		};

		refreshStaleSnapshotBanner(host as unknown as Parameters<typeof refreshStaleSnapshotBanner>[0]);

		assert.deepStrictEqual(getSessionSyncCalls, ['sess-B']);
		assert.strictEqual(banner.hidden, false);
		assert.ok(banner.textContent?.includes('Bound leaf disconnect'));
	});

	test('shouldShowReadingColumnLiveChrome ignores stale lease without bound roster turns', () => {
		const host = {
			getBoundSessionId: () => 'sess-B',
			sessionViewLease: {
				sessionId: 'sess-A',
				snapshot: {
					sessionId: 'sess-A',
					sync: { kind: 'live' as const },
					timeline: [{ id: 't-stale', kind: 'thinking' as const, text: 'stale', streaming: true }],
					localPendingSends: [],
				},
			},
			stubService: {
				isEngineConnected: () => false,
				getActiveSessionId: () => 'sess-A',
				getTurns: () => [],
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected' as const, path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: true }),
			},
		};

		assert.strictEqual(shouldShowReadingColumnLiveChrome(host as unknown as Parameters<typeof shouldShowReadingColumnLiveChrome>[0]), false);
	});

});
