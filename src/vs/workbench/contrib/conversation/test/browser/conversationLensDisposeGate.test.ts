/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applySessionViewTimeline, refreshTrajectoryRecords, updateSyncChrome, type IConversationLensProjectionHost } from '../../browser/conversationLensProjection.js';
import { conversationLensStaleSnapshotClass, refreshStaleSnapshotBanner, requestReadingColumnDetail, shouldShowReadingColumnLiveChrome, type IReadingColumnDetailHost } from '../../browser/conversationLensReadingColumn.js';
import type { ConnectionPhase } from '../../../../../platform/universeAgent/common/connectionHubTypes.js';
import { formatSyncChromeLabel } from '../../browser/conversationSessionView.js';
import type { SyncChrome } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { postBound, saveQueueEdit, saveTurnEdit, submitDraft, type IConversationLensComposerHost } from '../../browser/conversationLensComposer.js';
import {
	applySessionModelIndex,
	applySessionPermissionIndex,
	beginQueueEdit,
	beginTurnEdit,
	isSessionPermissionModeAvailable,
	isSessionSwitchModelAvailable,
	showPostFailure,
	toggleMoreContextView,
	toggleTuneContextView,
	updateComposerSessionSelectsEnabled,
	updateSendEnabled,
	type IConversationLensComposerChromeHost,
} from '../../browser/conversationLensComposerChrome.js';
import { updateSessionBarWriteChrome, type IConversationLensSessionBarHost } from '../../browser/conversationLensSessionBar.js';
import {
	conversationLensDockNoEngineTools,
	conversationLensDockNoTools,
	conversationLensPostFailed,
	conversationLensPostFailedDisconnected,
	conversationLensPostFailedNoSession,
	type ConversationComposerPostFailureReason,
} from '../../browser/conversationLensDockStrings.js';
import { bindSessionView, cancelToolCall, copyTurn, deleteTurn, resolveConfirmation, resolveQuestion, retryError, type IConversationLensSessionBindingHost } from '../../browser/conversationLensSessionBinding.js';
import type { ConversationWriteMessage, PostOutcome } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';

suite('conversation lens dispose gate', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('applySessionViewTimeline skips applyEntries after dispose', () => {
		let applyEntries = 0;
		const host = {
			isDisposed: true,
			sessionViewLease: { sessionId: 's1' },
			timelineTree: { applyEntries: () => { applyEntries++; } },
		} as unknown as IConversationLensProjectionHost;
		applySessionViewTimeline(host, { kind: 'baseline' });
		assert.strictEqual(applyEntries, 0);
	});

	test('refreshTrajectoryRecords skips setRecords after dispose', () => {
		let setRecords = 0;
		let readRecords = 0;
		const host = {
			isDisposed: true,
			filterAgentId: undefined,
			sessionViewLease: undefined,
			stubService: {
				getTrajectoryRecords: () => {
					readRecords++;
					return [];
				},
			},
			trajectoryView: { setRecords: () => { setRecords++; } },
		} as unknown as IConversationLensProjectionHost;
		refreshTrajectoryRecords(host, 's1');
		assert.strictEqual(readRecords, 0);
		assert.strictEqual(setRecords, 0);
	});

	test('refreshTrajectoryRecords still setRecords while live', () => {
		let setRecords = 0;
		const host = {
			isDisposed: false,
			filterAgentId: undefined,
			sessionViewLease: undefined,
			stubService: {
				getTrajectoryRecords: () => [],
				isEngineConnected: () => false,
				getTurns: () => [],
			},
			trajectoryView: { setRecords: () => { setRecords++; } },
		} as unknown as IConversationLensProjectionHost;
		refreshTrajectoryRecords(host, 's1');
		assert.strictEqual(setRecords, 1);
	});

	test('refreshTrajectoryRecords keeps leftover lease turn ids while pairingPending then true disconnect uses stub ids', () => {
		let connected = true;
		let pairingPending = false;
		let setRecords = 0;
		let lastTurnIds: ReadonlySet<string> | undefined;
		const leftoverRecords = [{ id: 'rec-1' }];
		const host = {
			isDisposed: false,
			filterAgentId: undefined,
			sessionViewLease: {
				sessionId: 'sess-leftover',
				snapshot: {
					timeline: [
						{ id: 'turn-lease-1', summary: { kind: 'user' } },
						{ id: 'turn-lease-2', summary: { kind: 'assistant' } },
					],
				},
			},
			stubService: {
				getTrajectoryRecords: () => leftoverRecords,
				isEngineConnected: () => connected && !pairingPending,
				getTurns: () => [],
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending }),
			},
			trajectoryView: {
				getPaintedRecordCount: () => leftoverRecords.length,
				setRecords: (_records: readonly unknown[], turnIds?: ReadonlySet<string>) => {
					setRecords++;
					lastTurnIds = turnIds;
				},
			},
		} as unknown as IConversationLensProjectionHost;

		pairingPending = true;
		assert.strictEqual(host.stubService.isEngineConnected(), false);
		assert.strictEqual(host.uaConnection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);

		refreshTrajectoryRecords(host, 'sess-leftover');
		assert.strictEqual(setRecords, 1);
		assert.ok(lastTurnIds?.has('turn-lease-1'));
		assert.ok(lastTurnIds?.has('turn-lease-2'));

		pairingPending = false;
		connected = false;
		refreshTrajectoryRecords(host, 'sess-leftover');
		assert.strictEqual(setRecords, 2);
		assert.strictEqual(lastTurnIds?.size, 0);
	});

	test('refreshTrajectoryRecords keeps leftover painted records when pairingPending has no lease', () => {
		let setRecords = 0;
		const leftoverRecords = [{ id: 'rec-leftover' }];
		const host = {
			isDisposed: false,
			filterAgentId: undefined,
			sessionViewLease: undefined,
			stubService: {
				getTrajectoryRecords: () => [],
				isEngineConnected: () => false,
				getTurns: () => [],
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: true }),
			},
			trajectoryView: {
				getPaintedRecordCount: () => leftoverRecords.length,
				setRecords: () => { setRecords++; },
			},
		} as unknown as IConversationLensProjectionHost;
		refreshTrajectoryRecords(host, 'sess-leftover');
		assert.strictEqual(setRecords, 0);
	});

	test('refreshTrajectoryRecords first-pull pairingPending without leftover still setRecords', () => {
		let setRecords = 0;
		const host = {
			isDisposed: false,
			filterAgentId: undefined,
			sessionViewLease: undefined,
			stubService: {
				getTrajectoryRecords: () => [],
				isEngineConnected: () => false,
				getTurns: () => [],
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: true }),
			},
			trajectoryView: {
				getPaintedRecordCount: () => 0,
				setRecords: () => { setRecords++; },
			},
		} as unknown as IConversationLensProjectionHost;
		refreshTrajectoryRecords(host, 'sess-first');
		assert.strictEqual(setRecords, 1);
	});

	test('shouldShowReadingColumnLiveChrome keeps leftover lease while pairingPending then true disconnect hides', () => {
		let connected = true;
		let pairingPending = false;
		const host = {
			sessionViewLease: leftoverLeaseSnapshot({ kind: 'live' }),
			stubService: {
				isEngineConnected: () => connected && !pairingPending,
				getActiveSessionId: () => 'ua-cache',
				getTurns: () => [],
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending }),
			},
		};

		assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), true);

		pairingPending = true;
		assert.strictEqual(host.stubService.isEngineConnected(), false);
		assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), true);

		pairingPending = false;
		connected = false;
		assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), false);
	});

	test('shouldShowReadingColumnLiveChrome keeps leftover cached turns without lease while pairingPending', () => {
		const host = {
			sessionViewLease: undefined,
			stubService: {
				isEngineConnected: () => false,
				getActiveSessionId: () => 'ua-cache',
				getTurns: () => [{ id: 't-leftover', kind: 'thinking', text: 'leftover think', streaming: true }],
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected' as const, path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: true }),
			},
		};
		assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), true);
	});

	test('shouldShowReadingColumnLiveChrome first-pull pairingPending without leftover stays false', () => {
		const host = {
			sessionViewLease: undefined,
			stubService: {
				isEngineConnected: () => false,
				getActiveSessionId: () => 'sess-first',
				getTurns: () => [],
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected' as const, path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: true }),
			},
		};
		assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), false);
	});

	function leftoverLooksLiveChromeHost(options: {
		readonly pairingPending: boolean;
		readonly looksLive?: boolean;
		readonly connected?: boolean;
		readonly hasLease?: boolean;
		readonly turns?: readonly unknown[];
	}): Parameters<typeof shouldShowReadingColumnLiveChrome>[0] {
		const connected = options.connected ?? true;
		const pairingPending = options.pairingPending;
		const looksLive = options.looksLive ?? false;
		const hasLease = options.hasLease === true;
		return {
			sessionViewLease: hasLease ? leftoverLeaseSnapshot({ kind: 'live' }) : undefined,
			stubService: {
				isEngineConnected: () => connected && (looksLive || !pairingPending),
				getActiveSessionId: () => hasLease ? 'ua-cache' : 'sess-first',
				getTurns: () => options.turns ?? [],
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending }),
			},
		};
	}

	test('leftover-looks-live first-pull shouldShowReadingColumnLiveChrome stays false', () => {
		const host = leftoverLooksLiveChromeHost({ pairingPending: true, looksLive: true });
		assert.strictEqual(host.stubService.isEngineConnected(), true);
		assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(shouldShowReadingColumnLiveChrome(host), false);
	});

	test('leftover-looks-live keeps leftover lease shouldShowReadingColumnLiveChrome', () => {
		const host = leftoverLooksLiveChromeHost({ pairingPending: true, looksLive: true, hasLease: true });
		assert.strictEqual(host.stubService.isEngineConnected(), true);
		assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(shouldShowReadingColumnLiveChrome(host), true);
	});

	test('leftover-looks-live keeps leftover cached turns shouldShowReadingColumnLiveChrome', () => {
		const host = leftoverLooksLiveChromeHost({
			pairingPending: true,
			looksLive: true,
			turns: [{ id: 't-leftover', kind: 'thinking', text: 'leftover think', streaming: true }],
		});
		assert.strictEqual(host.stubService.isEngineConnected(), true);
		assert.strictEqual(shouldShowReadingColumnLiveChrome(host), true);
	});

	function leftoverLooksLiveDetailHost(options: {
		readonly pairingPending: boolean;
		readonly cachedBody?: string;
		readonly hasLease?: boolean;
	}): {
		host: IReadingColumnDetailHost & { readonly stubService: { isEngineConnected(): boolean } };
		requestDetailCalls: number;
	} {
		const state = { requestDetailCalls: 0 };
		const details = new Map<string, string>();
		if (options.cachedBody !== undefined) {
			details.set('detail:leftover', options.cachedBody);
		}
		const hasLease = options.hasLease !== false;
		const host: IReadingColumnDetailHost & { readonly stubService: { isEngineConnected(): boolean } } = {
			stubService: {
				isEngineConnected: () => true,
			},
			sessionViewLease: hasLease
				? {
					details,
					requestDetail: async (_ref: string) => {
						state.requestDetailCalls++;
						return { ok: true as const, truncated: false as const, content: 'live-fetched' };
					},
				}
				: undefined,
			uaConnection: {
				getConnectionPhase: (): ConnectionPhase => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: options.pairingPending }),
			},
		};
		return {
			host,
			get requestDetailCalls() { return state.requestDetailCalls; },
		};
	}

	test('leftover-looks-live leftover lease requestDetail stays 0 unary', async () => {
		const fixture = leftoverLooksLiveDetailHost({ pairingPending: true });
		assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
		assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, true);
		const outcome = await requestReadingColumnDetail(fixture.host, 'detail:leftover');
		assert.deepStrictEqual(outcome, { ok: false, reason: 'unavailable' });
		assert.strictEqual(fixture.requestDetailCalls, 0);
	});

	test('leftover-looks-live leftover lease serves cached leftover body without requestDetail', async () => {
		const fixture = leftoverLooksLiveDetailHost({ pairingPending: true, cachedBody: 'cached leftover' });
		assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
		const outcome = await requestReadingColumnDetail(fixture.host, 'detail:leftover');
		assert.deepStrictEqual(outcome, { ok: true, truncated: false, content: 'cached leftover' });
		assert.strictEqual(fixture.requestDetailCalls, 0);
	});

	test('connected leftover still requestDetail', async () => {
		const fixture = leftoverLooksLiveDetailHost({ pairingPending: false });
		assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
		assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
		const outcome = await requestReadingColumnDetail(fixture.host, 'detail:leftover');
		assert.deepStrictEqual(outcome, { ok: true, truncated: false, content: 'live-fetched' });
		assert.strictEqual(fixture.requestDetailCalls, 1);
	});

	test('first-pull pairing without lease requestDetail stays unavailable', async () => {
		const fixture = leftoverLooksLiveDetailHost({ pairingPending: true, hasLease: false });
		assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
		const outcome = await requestReadingColumnDetail(fixture.host, 'detail:leftover');
		assert.deepStrictEqual(outcome, { ok: false, reason: 'unavailable' });
		assert.strictEqual(fixture.requestDetailCalls, 0);
	});

	function asLiveChromeHost(host: object): Parameters<typeof shouldShowReadingColumnLiveChrome>[0] {
		return host as Parameters<typeof shouldShowReadingColumnLiveChrome>[0];
	}

	function leftoverLeaseSnapshot(sync: SyncChrome) {
		return {
			sessionId: 'ua-cache',
			snapshot: {
				sessionId: 'ua-cache',
				sync,
				timeline: [],
				overlay: { blocks: [] },
				pendingActions: [],
				localPendingSends: [],
			},
			attribution: new Map(),
			details: new Map(),
		};
	}

	function pairingSyncChromeHost(options: {
		readonly leftover: SyncChrome;
		readonly rosterSync: SyncChrome;
		readonly getSessionSync?: (sessionId: string) => SyncChrome;
	}): IConversationLensProjectionHost & { readonly sessionSyncBadge: HTMLSpanElement; readonly staleBanner: HTMLDivElement; getSessionSyncCalls: number } {
		const leftover = options.leftover;
		const rosterSync = options.rosterSync;
		const calls = { count: 0 };
		const badge = document.createElement('span');
		const banner = document.createElement('div');
		banner.className = conversationLensStaleSnapshotClass;
		banner.hidden = true;
		const readingColumn = document.createElement('div');
		readingColumn.appendChild(banner);
		const host = {
			isDisposed: false,
			lensId: 'conversation' as const,
			filterAgentId: undefined,
			composerPolicy: 'compose' as const,
			conversationPhase: 'prefirst' as const,
			lastAttachedEntries: [],
			sessionViewLease: leftoverLeaseSnapshot(leftover),
			sessionSyncBadge: badge,
			readingColumn,
			staleBanner: banner,
			get getSessionSyncCalls() { return calls.count; },
			stubService: {
				getSessionSync: (sessionId: string) => {
					calls.count++;
					assert.strictEqual(sessionId, 'ua-cache');
					return options.getSessionSync?.(sessionId) ?? rosterSync;
				},
				getTurns: () => [],
				getActiveSessionId: () => 'ua-cache',
			},
			getBoundSessionId: () => 'ua-cache',
			reviewNavService: { getReviewNavForSession: () => [] },
			timelineTree: { applyEntries: () => { } },
			trajectoryView: {},
			renderInboxStatus: () => { },
			syncComposerPlacement: () => { },
			applyConversationDensity: () => { },
			updateSessionConfigVisibility: () => { },
			exitComposerEdit: () => { },
			updateGateRow: () => { },
			relayoutReadingSurfaces: () => { },
			slotHosts: { dock: { classList: { toggle: () => { } } } },
			prefirstHero: { hidden: false, appendChild: () => { } },
			dockRoot: { insertBefore: () => { } },
			gateRow: {},
			identityStrip: { element: {} },
			inboxOverlay: { element: { hidden: true } },
		};
		return host as unknown as IConversationLensProjectionHost & { readonly sessionSyncBadge: HTMLSpanElement; readonly staleBanner: HTMLDivElement; getSessionSyncCalls: number };
	}

	test('applySessionViewTimeline pairing leftover live/syncing lease paints roster demoted sync not Session live', () => {
		const demoted: SyncChrome = { kind: 'closed', reason: 'Cached snapshot (read-only)' };
		for (const leftover of [{ kind: 'live' as const }, { kind: 'syncing' as const }]) {
			const host = pairingSyncChromeHost({ leftover, rosterSync: demoted });
			applySessionViewTimeline(host, { kind: 'baseline' });
			assert.ok(host.getSessionSyncCalls > 0);
			assert.deepStrictEqual(host.stubService.getSessionSync('ua-cache'), demoted);
			assert.notStrictEqual(host.sessionSyncBadge.textContent, 'Session live');
			assert.notStrictEqual(host.sessionSyncBadge.textContent, 'Session syncing');
			assert.strictEqual(host.sessionSyncBadge.textContent, formatSyncChromeLabel(demoted));
			assert.strictEqual(host.sessionSyncBadge.getAttribute('aria-label'), formatSyncChromeLabel(demoted));
			assert.strictEqual(host.staleBanner.hidden, false);
			assert.ok(host.staleBanner.textContent?.includes('Cached snapshot (read-only)'));
			assert.ok(!/Session live|Session syncing/i.test(host.staleBanner.textContent ?? ''));
		}
	});

	test('applySessionViewTimeline connected leftover live still paints Session live', () => {
		const live: SyncChrome = { kind: 'live' };
		const host = pairingSyncChromeHost({ leftover: live, rosterSync: live });
		applySessionViewTimeline(host, { kind: 'baseline' });
		assert.ok(host.getSessionSyncCalls > 0);
		assert.strictEqual(host.sessionSyncBadge.textContent, 'Session live');
		assert.strictEqual(host.staleBanner.hidden, true);
	});

	test('updateSyncChrome and stale banner ignore leftover live lease and follow getSessionSync', () => {
		const demoted: SyncChrome = { kind: 'closed', reason: 'Cached snapshot (read-only)' };
		const host = pairingSyncChromeHost({ leftover: { kind: 'live' }, rosterSync: demoted });
		updateSyncChrome(host, { kind: 'live' });
		assert.notStrictEqual(host.sessionSyncBadge.textContent, 'Session live');
		assert.strictEqual(host.sessionSyncBadge.textContent, formatSyncChromeLabel(demoted));
		refreshStaleSnapshotBanner(host, { kind: 'live' });
		assert.strictEqual(host.staleBanner.hidden, false);
		assert.ok(host.staleBanner.textContent?.includes('Cached snapshot (read-only)'));
	});

	test('bindSessionView skips applyEntries after dispose', () => {
		const lifetime = new DisposableStore();
		lifetime.dispose();
		let applyEntries = 0;
		let acquire = 0;
		const host = {
			isDisposed: true,
			sessionViewLifetime: lifetime,
			sessionViewLease: { sessionId: 's1' },
			lastAttachedEntries: [],
			stubService: {
				isEngineConnected: () => false,
				acquireSessionView: () => {
					acquire++;
					return { sessionId: 's1', snapshot: { sessionId: 's1' } };
				},
			},
			timelineTree: { applyEntries: () => { applyEntries++; } },
		} as unknown as IConversationLensSessionBindingHost;
		bindSessionView(host, '');
		assert.strictEqual(applyEntries, 0);
		assert.strictEqual(acquire, 0);
	});

	test('bindSessionView still applyEntries empty tree while live', () => {
		const lifetime = new DisposableStore();
		let applyEntries = 0;
		const host = {
			isDisposed: false,
			sessionViewLifetime: lifetime,
			sessionViewLease: { sessionId: 's1' },
			lastAttachedEntries: [{ id: 't1' }],
			stubService: {
				isEngineConnected: () => false,
			},
			timelineTree: { applyEntries: () => { applyEntries++; } },
		} as unknown as IConversationLensSessionBindingHost;
		bindSessionView(host, '');
		assert.strictEqual(applyEntries, 1);
		assert.strictEqual(host.sessionViewLease, undefined);
		assert.deepStrictEqual(host.lastAttachedEntries, []);
		lifetime.dispose();
	});

	test('bindSessionView empty sessionId still clears leftover while engine roster is in-flight', () => {
		const lifetime = new DisposableStore();
		let applyEntries = 0;
		let acquire = 0;
		let appliedEmpty = 0;
		const host = {
			isDisposed: false,
			sessionViewLifetime: lifetime,
			sessionViewLease: { sessionId: 'sess-leftover' },
			lastAttachedEntries: [{ id: 't1' }, { id: 't2' }],
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => false,
				acquireSessionView: () => {
					acquire++;
					return { sessionId: 'sess-leftover', snapshot: { sessionId: 'sess-leftover' } };
				},
			},
			timelineTree: {
				applyEntries: (entries: readonly unknown[]) => {
					applyEntries++;
					if (entries.length === 0) {
						appliedEmpty++;
					}
				},
			},
		} as unknown as IConversationLensSessionBindingHost;
		bindSessionView(host, '');
		assert.strictEqual(applyEntries, 1);
		assert.strictEqual(appliedEmpty, 1);
		assert.strictEqual(acquire, 0);
		assert.strictEqual(host.sessionViewLease, undefined);
		assert.strictEqual(host.lastAttachedEntries.length, 0);
		lifetime.dispose();
	});

	test('bindSessionView keeps leftover timeline while engine roster is in-flight', () => {
		const lifetime = new DisposableStore();
		const priorLease = { sessionId: 'sess-leftover' };
		const leftover = [{ id: 't1' }, { id: 't2' }];
		let applyEntries = 0;
		let acquire = 0;
		const lifetimeMarker = {
			disposed: false,
			dispose() { this.disposed = true; },
		};
		lifetime.add(lifetimeMarker);
		const host = {
			isDisposed: false,
			sessionViewLifetime: lifetime,
			sessionViewLease: priorLease,
			lastAttachedEntries: leftover,
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => false,
				acquireSessionView: () => {
					acquire++;
					return { sessionId: 'sess-leftover', snapshot: { sessionId: 'sess-leftover' } };
				},
			},
			timelineTree: { applyEntries: () => { applyEntries++; } },
		} as unknown as IConversationLensSessionBindingHost;
		bindSessionView(host, 'sess-leftover');
		assert.strictEqual(applyEntries, 0);
		assert.strictEqual(acquire, 0);
		assert.strictEqual(host.sessionViewLease, priorLease);
		assert.strictEqual(host.lastAttachedEntries.length, 2);
		assert.strictEqual(host.lastAttachedEntries, leftover);
		assert.strictEqual(lifetimeMarker.disposed, false);
		lifetime.dispose();
	});

	test('bindSessionView still clears empty timeline on first pull while engine roster is in-flight', () => {
		const lifetime = new DisposableStore();
		let applyEntries = 0;
		let acquire = 0;
		let appliedEmpty = 0;
		const host = {
			isDisposed: false,
			sessionViewLifetime: lifetime,
			sessionViewLease: { sessionId: 'sess-first' },
			lastAttachedEntries: [],
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => false,
				acquireSessionView: () => {
					acquire++;
					return { sessionId: 'sess-first', snapshot: { sessionId: 'sess-first' } };
				},
			},
			timelineTree: {
				applyEntries: (entries: readonly unknown[]) => {
					applyEntries++;
					if (entries.length === 0) {
						appliedEmpty++;
					}
				},
			},
		} as unknown as IConversationLensSessionBindingHost;
		bindSessionView(host, 'sess-first');
		assert.strictEqual(applyEntries, 1);
		assert.strictEqual(appliedEmpty, 1);
		assert.strictEqual(acquire, 0);
		assert.strictEqual(host.sessionViewLease, undefined);
		assert.strictEqual(host.lastAttachedEntries.length, 0);
		lifetime.dispose();
	});

	test('bindSessionView keeps leftover timeline while pairingPending then true disconnect rebinds', () => {
		const lifetime = new DisposableStore();
		const priorLease = { sessionId: 'sess-leftover' };
		const leftover = [{ id: 't1' }, { id: 't2' }];
		let connected = true;
		let pairingPending = false;
		let applyEntries = 0;
		let appliedEmpty = 0;
		let applyBaseline = 0;
		let acquire = 0;
		const lifetimeMarker = {
			disposed: false,
			dispose() { this.disposed = true; },
		};
		lifetime.add(lifetimeMarker);
		const host = {
			isDisposed: false,
			sessionViewLifetime: lifetime,
			sessionViewLease: priorLease,
			lastAttachedEntries: leftover,
			stubService: {
				isEngineConnected: () => connected && !pairingPending,
				isEngineSessionReady: () => connected && !pairingPending,
				acquireSessionView: () => {
					acquire++;
					return {
						sessionId: 'sess-leftover',
						snapshot: { sessionId: 'sess-leftover' },
						dispose() { },
						onDidApplyFrame: () => ({ dispose() { } }),
					};
				},
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending }),
			},
			timelineTree: {
				applyEntries: (entries: readonly unknown[]) => {
					applyEntries++;
					if (entries.length === 0) {
						appliedEmpty++;
					}
				},
			},
			applySessionViewTimeline: (applied: { kind: string }) => {
				if (applied.kind === 'baseline') {
					applyBaseline++;
				}
			},
		} as unknown as IConversationLensSessionBindingHost;

		pairingPending = true;
		assert.strictEqual(host.stubService.isEngineConnected(), false);
		assert.strictEqual(host.uaConnection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);

		bindSessionView(host, 'sess-leftover');
		assert.strictEqual(applyEntries, 0);
		assert.strictEqual(appliedEmpty, 0);
		assert.strictEqual(applyBaseline, 0);
		assert.strictEqual(acquire, 0);
		assert.strictEqual(host.sessionViewLease, priorLease);
		assert.strictEqual(host.lastAttachedEntries.length, 2);
		assert.strictEqual(host.lastAttachedEntries, leftover);
		assert.strictEqual(lifetimeMarker.disposed, false);

		pairingPending = false;
		connected = false;
		bindSessionView(host, 'sess-leftover');
		assert.ok(acquire > 0);
		assert.ok(applyBaseline > 0);
		assert.strictEqual(appliedEmpty, 0);
		assert.strictEqual(lifetimeMarker.disposed, true);
		lifetime.dispose();
	});

	test('bindSessionView acquireSessionView throw shows failed and does not leave an unhandled rejection', async () => {
		const lifetime = new DisposableStore();
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		let applyEntries = 0;
		const host = {
			_store: { isDisposed: false },
			sessionViewLifetime: lifetime,
			sessionViewLease: { sessionId: 'prior' },
			lastAttachedEntries: [],
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				acquireSessionView: () => {
					throw new Error('acquire boom');
				},
			},
			timelineTree: { applyEntries: () => { applyEntries++; } },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			applySessionViewTimeline: () => { },
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			bindSessionView(host, 'sess-leftover');
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.strictEqual(host.sessionViewLease, undefined);
			assert.strictEqual(applyEntries, 0);
			assert.deepStrictEqual(rejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandled);
			lifetime.dispose();
		}
	});

	test('retryError posts continueGeneration on the bound lease and does not call roster.retryError', async () => {
		const posted: ConversationWriteMessage[] = [];
		let rosterRetry = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (msg: ConversationWriteMessage): Promise<PostOutcome> => {
				posted.push(msg);
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				retryError: () => {
					rosterRetry++;
					return true;
				},
			},
			showPostFailure: () => { },
		} as unknown as IConversationLensSessionBindingHost;

		retryError(host, { id: '  msg-1  ', turnId: '  turn-1  ', agentId: '  sub:a  ' });
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.deepStrictEqual(posted, [{
			kind: 'continueGeneration',
			agentId: 'sub:a',
			turnId: 'turn-1',
			messageId: 'msg-1',
		}]);
		assert.strictEqual(rosterRetry, 0);
	});

	test('retryError omitted turnId and agentId fall back to messageId and root', async () => {
		const posted: ConversationWriteMessage[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (msg: ConversationWriteMessage): Promise<PostOutcome> => {
				posted.push(msg);
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: { retryError: () => true },
			showPostFailure: () => { },
		} as unknown as IConversationLensSessionBindingHost;

		retryError(host, { id: 'msg-only' });
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.deepStrictEqual(posted, [{
			kind: 'continueGeneration',
			agentId: 'root',
			turnId: 'msg-only',
			messageId: 'msg-only',
		}]);
	});

	test('retryError blank messageId posts nothing', async () => {
		let postBound = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				postBound++;
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: { retryError: () => true },
			showPostFailure: () => { },
		} as unknown as IConversationLensSessionBindingHost;

		retryError(host, { id: '   ' });
		assert.strictEqual(postBound, 0);
	});

	test('retryError postBound reject shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				throw new Error('postBound boom');
			},
			stubService: { retryError: () => true },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			retryError(host, { id: 'msg-1' });
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('resolveConfirmation postBound reject shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		let focused = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				throw new Error('postBound boom');
			},
			stubService: { isEngineConnected: () => false },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { focused++; },
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			void resolveConfirmation(host, 'turn-1', 'allowed');
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(focused, 0);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('resolveQuestion postBound reject shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		let focused = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				throw new Error('postBound boom');
			},
			stubService: { isEngineConnected: () => false },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { focused++; },
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			void resolveQuestion(host, 'turn-1', 'req-1', { q1: { selectedLabels: ['a'] } });
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(focused, 0);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('resolveConfirmation connected roster false shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		let focused = 0;
		let forwarded = 0;
		let postBound = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				postBound++;
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				isEngineConnected: () => true,
				hasEngineConnectionHistory: () => false,
				resolveConfirmation: () => {
					forwarded++;
					return false;
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { focused++; },
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			void resolveConfirmation(host, 'turn-1', 'allowed');
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.strictEqual(forwarded, 1);
			assert.strictEqual(postBound, 0);
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(focused, 0);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('resolveConfirmation connected roster false then disconnect shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let connected = true;
		let focused = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				isEngineConnected: () => connected,
				hasEngineConnectionHistory: () => true,
				resolveConfirmation: () => {
					connected = false;
					return false;
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { focused++; },
		} as unknown as IConversationLensSessionBindingHost;

		await resolveConfirmation(host, 'turn-1', 'skipped');

		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(focused, 0);
	});

	test('resolveQuestion connected roster false shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		let focused = 0;
		let forwarded = 0;
		let postBound = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				postBound++;
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				isEngineConnected: () => true,
				hasEngineConnectionHistory: () => false,
				respondQuestion: () => {
					forwarded++;
					return false;
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { focused++; },
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			void resolveQuestion(host, 'turn-1', 'req-1', { q1: { selectedLabels: ['a'] } });
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.strictEqual(forwarded, 1);
			assert.strictEqual(postBound, 0);
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(focused, 0);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('resolveQuestion connected roster false then disconnect shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let connected = true;
		let focused = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				isEngineConnected: () => connected,
				hasEngineConnectionHistory: () => true,
				respondQuestion: () => {
					connected = false;
					return false;
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { focused++; },
		} as unknown as IConversationLensSessionBindingHost;

		await resolveQuestion(host, 'turn-1', 'req-1', { q1: { selectedLabels: ['a'] } });

		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(focused, 0);
	});

	function pairingHoldLeftoverWriteHost(failures: ConversationComposerPostFailureReason[]): {
		host: IConversationLensSessionBindingHost;
		posted: number;
	} {
		const state = { posted: 0 };
		const host = {
			getBoundSessionId: () => 'sess-leftover',
			sessionViewLease: {
				post: async () => {
					state.posted++;
					return { accepted: true, correlation: { id: 'x' } };
				},
			},
			postBound: async (msg: ConversationWriteMessage): Promise<PostOutcome> => {
				return postBound(host as unknown as IConversationLensComposerHost, msg);
			},
			stubService: {
				isEngineConnected: () => false,
				isEngineSessionReady: () => false,
				hasEngineConnectionHistory: () => true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: true }),
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { },
		};
		return { host: host as unknown as IConversationLensSessionBindingHost, get posted() { return state.posted; } };
	}

	test('postBound pairing-hold leftover lease rejects without lease.post', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host, posted } = pairingHoldLeftoverWriteHost(failures);
		const outcome = await postBound(host as unknown as IConversationLensComposerHost, {
			kind: 'continueGeneration',
			agentId: 'root',
			turnId: 'turn-1',
			messageId: 'msg-1',
		});
		assert.strictEqual(posted, 0);
		assert.strictEqual(outcome.accepted, false);
		if (!outcome.accepted) {
			assert.strictEqual(outcome.reason, 'no_such_session');
		}
		assert.deepStrictEqual(failures, []);
	});

	test('resolveConfirmation pairing-hold leftover lease does not post and shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host, posted } = pairingHoldLeftoverWriteHost(failures);
		await resolveConfirmation(host, 'turn-1', 'allowed');
		assert.strictEqual(posted, 0);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('resolveQuestion pairing-hold leftover lease does not post and shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host, posted } = pairingHoldLeftoverWriteHost(failures);
		await resolveQuestion(host, 'turn-1', 'req-1', { q1: { selectedLabels: ['a'] } });
		assert.strictEqual(posted, 0);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	function leftoverLooksLiveConfirmQuestionHost(failures: ConversationComposerPostFailureReason[], pairingPending: boolean): {
		host: IConversationLensSessionBindingHost;
		resolveConfirmationCalls: number;
		respondQuestionCalls: number;
		posted: number;
		focused: number;
	} {
		const state = { resolveConfirmationCalls: 0, respondQuestionCalls: 0, posted: 0, focused: 0 };
		const host = {
			getBoundSessionId: () => 'sess-leftover',
			postBound: async (): Promise<PostOutcome> => {
				state.posted++;
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				hasEngineConnectionHistory: () => true,
				resolveConfirmation: () => {
					state.resolveConfirmationCalls++;
					return true;
				},
				respondQuestion: () => {
					state.respondQuestionCalls++;
					return true;
				},
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending }),
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { state.focused++; },
		};
		return {
			host: host as unknown as IConversationLensSessionBindingHost,
			get resolveConfirmationCalls() { return state.resolveConfirmationCalls; },
			get respondQuestionCalls() { return state.respondQuestionCalls; },
			get posted() { return state.posted; },
			get focused() { return state.focused; },
		};
	}

	test('leftover-looks-live resolveConfirmation skips unary and shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const fixture = leftoverLooksLiveConfirmQuestionHost(failures, true);
		await resolveConfirmation(fixture.host, 'turn-1', 'allowed');
		assert.strictEqual(fixture.resolveConfirmationCalls, 0);
		assert.strictEqual(fixture.posted, 0);
		assert.strictEqual(fixture.focused, 0);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('leftover-looks-live resolveQuestion skips unary and shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const fixture = leftoverLooksLiveConfirmQuestionHost(failures, true);
		await resolveQuestion(fixture.host, 'turn-1', 'req-1', { q1: { selectedLabels: ['a'] } });
		assert.strictEqual(fixture.respondQuestionCalls, 0);
		assert.strictEqual(fixture.posted, 0);
		assert.strictEqual(fixture.focused, 0);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('connected without pairing resolveConfirmation still forwards', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false);
		await resolveConfirmation(fixture.host, 'turn-1', 'allowed');
		assert.strictEqual(fixture.resolveConfirmationCalls, 1);
		assert.strictEqual(fixture.posted, 0);
		assert.strictEqual(fixture.focused, 1);
		assert.deepStrictEqual(failures, []);
	});

	test('connected without pairing resolveQuestion still forwards', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false);
		await resolveQuestion(fixture.host, 'turn-1', 'req-1', { q1: { selectedLabels: ['a'] } });
		assert.strictEqual(fixture.respondQuestionCalls, 1);
		assert.strictEqual(fixture.posted, 0);
		assert.strictEqual(fixture.focused, 1);
		assert.deepStrictEqual(failures, []);
	});

	test('retryError pairing-hold leftover lease does not post and shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host, posted } = pairingHoldLeftoverWriteHost(failures);
		retryError(host, { id: 'msg-1', turnId: 'turn-1', agentId: 'root' });
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		assert.strictEqual(posted, 0);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	function pairingHoldComposerWriteHost(failures: ConversationComposerPostFailureReason[]): {
		host: IConversationLensComposerHost;
		posted: number;
		enqueueCalls: number;
		turnWrites: number;
		queueWrites: number;
	} {
		const state = { posted: 0, enqueueCalls: 0, turnWrites: 0, queueWrites: 0 };
		const host = {
			composerPolicy: 'compose' as const,
			submitInFlight: false,
			editingTurnId: 'turn-1',
			editingQueueItemId: 'q1',
			dockTextarea: { value: 'leftover draft' },
			sendButton: { enabled: true },
			getBoundSessionId: () => 'sess-leftover',
			getEditingQueueItem: () => ({ id: 'q1', content: 'queued' }),
			sessionViewLease: {
				post: async () => {
					state.posted++;
					return { accepted: true, correlation: { id: 'x' } };
				},
			},
			stubService: {
				isEngineConnected: () => false,
				isEngineSessionReady: () => false,
				hasEngineConnectionHistory: () => true,
				enqueueMessageQueueItem: () => {
					state.enqueueCalls++;
					return true;
				},
				updateUserTurnText: () => {
					state.turnWrites++;
					return true;
				},
				updateMessageQueueItemContent: () => {
					state.queueWrites++;
					return true;
				},
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: true }),
			},
			exitComposerEdit: () => { },
			renderInboxStatus: () => { },
			updateSendEnabled: () => { },
			updateConversationPhase: () => { },
			resetInputHistoryBrowse: () => { },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		};
		return {
			host: host as unknown as IConversationLensComposerHost,
			get posted() { return state.posted; },
			get enqueueCalls() { return state.enqueueCalls; },
			get turnWrites() { return state.turnWrites; },
			get queueWrites() { return state.queueWrites; },
		};
	}

	test('updateSendEnabled pairing-hold leftover draft disables Send', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host } = pairingHoldComposerWriteHost(failures);
		const chromeHost = host as unknown as IConversationLensComposerChromeHost;
		updateSendEnabled(chromeHost);
		assert.strictEqual(chromeHost.sendButton.enabled, false);
		assert.deepStrictEqual(failures, []);
	});

	test('submitDraft pairing-hold leftover draft does not enqueue or post', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host, posted, enqueueCalls } = pairingHoldComposerWriteHost(failures);
		await submitDraft(host);
		assert.strictEqual(posted, 0);
		assert.strictEqual(enqueueCalls, 0);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(host.dockTextarea.value, 'leftover draft');
	});

	test('saveTurnEdit pairing-hold leftover does not write and stays in edit', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host, turnWrites } = pairingHoldComposerWriteHost(failures);
		host.composerPolicy = 'turnEdit';
		saveTurnEdit(host);
		assert.strictEqual(turnWrites, 0);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(host.editingTurnId, 'turn-1');
		assert.strictEqual(host.composerPolicy, 'turnEdit');
		assert.strictEqual(host.dockTextarea.value, 'leftover draft');
	});

	test('saveQueueEdit pairing-hold leftover does not write and stays in edit', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host, queueWrites } = pairingHoldComposerWriteHost(failures);
		host.composerPolicy = 'queueEdit';
		saveQueueEdit(host);
		assert.strictEqual(queueWrites, 0);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(host.editingQueueItemId, 'q1');
		assert.strictEqual(host.composerPolicy, 'queueEdit');
		assert.strictEqual(host.dockTextarea.value, 'leftover draft');
	});

	test('deleteTurn pairing-hold leftover does not write and shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host, posted } = pairingHoldLeftoverWriteHost(failures);
		let deleteCalls = 0;
		(host as unknown as { stubService: { deleteTurn: () => boolean } }).stubService.deleteTurn = () => {
			deleteCalls++;
			return true;
		};
		deleteTurn(host, 'turn-1');
		assert.strictEqual(deleteCalls, 0);
		assert.strictEqual(posted, 0);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('beginTurnEdit pairing-hold leftover does not enter edit', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host } = pairingHoldComposerWriteHost(failures);
		const chromeHost = host as unknown as IConversationLensComposerChromeHost;
		chromeHost.composerPolicy = 'compose';
		chromeHost.editingTurnId = undefined;
		beginTurnEdit(chromeHost, 'turn-1');
		assert.strictEqual(chromeHost.composerPolicy, 'compose');
		assert.strictEqual(chromeHost.editingTurnId, undefined);
		assert.deepStrictEqual(failures, []);
	});

	test('beginQueueEdit pairing-hold leftover does not enter edit', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host } = pairingHoldComposerWriteHost(failures);
		const chromeHost = host as unknown as IConversationLensComposerChromeHost;
		chromeHost.composerPolicy = 'compose';
		chromeHost.editingQueueItemId = undefined;
		beginQueueEdit(chromeHost, 'q1');
		assert.strictEqual(chromeHost.composerPolicy, 'compose');
		assert.strictEqual(chromeHost.editingQueueItemId, undefined);
		assert.deepStrictEqual(failures, []);
	});

	test('updateSessionBarWriteChrome pairing-hold disables title delete and new', () => {
		const title = document.createElement('button');
		const newButton = { enabled: true };
		const deleteButton = { enabled: true };
		const host = {
			sessionTitleButton: title,
			newSessionButton: newButton,
			deleteSessionButton: deleteButton,
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: true }),
			},
		} as unknown as IConversationLensSessionBarHost;
		updateSessionBarWriteChrome(host);
		assert.strictEqual(title.disabled, true);
		assert.strictEqual(title.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(newButton.enabled, false);
		assert.strictEqual(deleteButton.enabled, false);
	});

	function leftoverLooksLiveSessionSelectsHost(options?: {
		catalogToolNames?: readonly string[];
		catalogModelIds?: readonly string[];
		permissionIndex?: number;
		modelSelectedIndex?: number;
		lastReadingWidth?: number;
	}): {
		host: IConversationLensComposerChromeHost;
		permissionCalls: { sessionId: string; mode: string }[];
		modelCalls: { sessionId: string; modelId: string }[];
		permissionSelect: HTMLSelectElement;
		modelSelect: HTMLSelectElement;
		dispose(): void;
	} {
		const store = new DisposableStore();
		const permissionCalls: { sessionId: string; mode: string }[] = [];
		const modelCalls: { sessionId: string; modelId: string }[] = [];
		const dockRoot = document.createElement('div');
		document.body.appendChild(dockRoot);
		store.add({ dispose: () => dockRoot.remove() });
		const permissionContainer = document.createElement('div');
		permissionContainer.className = 'conversation-lens-dock-permission';
		const permissionSelect = document.createElement('select');
		permissionSelect.add(new Option('Ask', '0'));
		permissionSelect.add(new Option('Agent', '1'));
		permissionSelect.add(new Option('Permit', '2'));
		permissionContainer.appendChild(permissionSelect);
		dockRoot.appendChild(permissionContainer);
		const modelContainer = document.createElement('div');
		modelContainer.className = 'conversation-lens-dock-model';
		const modelSelect = document.createElement('select');
		modelSelect.add(new Option('No model', ''));
		modelSelect.add(new Option('gpt-test', 'gpt-test'));
		modelContainer.appendChild(modelSelect);
		dockRoot.appendChild(modelContainer);
		const moreButton = document.createElement('button');
		const sessionConfigBySessionId = new Map<string, { agentIndex: number; permissionIndex: number }>([
			['sess-leftover', { agentIndex: 0, permissionIndex: options?.permissionIndex ?? 0 }],
		]);
		permissionSelect.selectedIndex = options?.permissionIndex ?? 0;
		modelSelect.selectedIndex = options?.modelSelectedIndex ?? 0;
		const host = {
			catalogToolNames: options?.catalogToolNames ?? ['bash'],
			catalogModelIds: options?.catalogModelIds ?? ['', 'gpt-test'],
			modelSelectedIndex: options?.modelSelectedIndex ?? 0,
			sessionConfigBySessionId,
			lastReadingWidth: options?.lastReadingWidth ?? 300,
			tuneContextView: undefined as { close(): void } | undefined,
			moreContextView: undefined as { close(): void } | undefined,
			dockRoot,
			sendButton: { enabled: true },
			permissionSelectBox: {
				setEnabled(enabled: boolean) { permissionSelect.disabled = !enabled; },
				setAriaLabel() { },
				select(index: number) { permissionSelect.selectedIndex = index; },
			},
			agentSelectBox: {
				setEnabled() { },
				setAriaLabel() { },
				select() { },
			},
			modelSelectBox: {
				setEnabled(enabled: boolean) { modelSelect.disabled = !enabled; },
				setAriaLabel() { },
				select(index: number) {
					modelSelect.selectedIndex = index;
					host.modelSelectedIndex = index;
				},
			},
			agentContainer: document.createElement('div'),
			moreButton: { element: moreButton },
			tuneButton: { element: document.createElement('button') },
			stubService: {
				isEngineConnected: () => true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: true }),
				setPermissionMode: async (request: { sessionId: string; mode: string }) => {
					permissionCalls.push(request);
					return { ok: true };
				},
				switchModel: async (request: { sessionId: string; modelId: string }) => {
					modelCalls.push({ sessionId: request.sessionId, modelId: request.modelId });
					return { resolvedModelId: request.modelId, provider: '', level: 0, cost: '', speed: '' };
				},
			},
			contextViewService: {
				showContextView(delegate: { render: (container: HTMLElement) => { dispose(): void } }) {
					const container = document.createElement('div');
					document.body.appendChild(container);
					const rendered = delegate.render(container);
					store.add({ dispose: () => container.remove() });
					return {
						close() {
							rendered.dispose();
							container.remove();
						},
					};
				},
			},
			getBoundSessionId: () => 'sess-leftover',
		};
		return {
			host: host as unknown as IConversationLensComposerChromeHost,
			permissionCalls,
			modelCalls,
			permissionSelect,
			modelSelect,
			dispose: () => {
				host.tuneContextView?.close();
				host.moreContextView?.close();
				store.dispose();
			},
		};
	}

	test('leftover-looks-live pairing-hold session selects stay disabled and do not write', async () => {
		const fixture = leftoverLooksLiveSessionSelectsHost();
		try {
			assert.strictEqual(isSessionPermissionModeAvailable(fixture.host), false);
			assert.strictEqual(isSessionSwitchModelAvailable(fixture.host), false);
			updateComposerSessionSelectsEnabled(fixture.host);
			assert.strictEqual(fixture.permissionSelect.disabled, true);
			assert.strictEqual(fixture.permissionSelect.getAttribute('aria-disabled'), 'true');
			assert.strictEqual(fixture.modelSelect.disabled, true);
			assert.strictEqual(fixture.modelSelect.getAttribute('aria-disabled'), 'true');

			await applySessionPermissionIndex(fixture.host, 'sess-leftover', 2);
			await applySessionModelIndex(fixture.host, 'sess-leftover', 1);
			assert.deepStrictEqual(fixture.permissionCalls, []);
			assert.deepStrictEqual(fixture.modelCalls, []);
			assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
			assert.strictEqual(fixture.modelSelect.selectedIndex, 0);
			assert.strictEqual(fixture.host.sessionConfigBySessionId.get('sess-leftover')?.permissionIndex, 0);
			assert.strictEqual(fixture.host.modelSelectedIndex, 0);

			fixture.permissionSelect.disabled = false;
			fixture.permissionSelect.removeAttribute('disabled');
			fixture.permissionSelect.setAttribute('aria-disabled', 'false');
			fixture.modelSelect.disabled = false;
			fixture.modelSelect.removeAttribute('disabled');
			fixture.modelSelect.setAttribute('aria-disabled', 'false');
			fixture.permissionSelect.selectedIndex = 2;
			fixture.modelSelect.selectedIndex = 1;
			await applySessionPermissionIndex(fixture.host, 'sess-leftover', 2);
			await applySessionModelIndex(fixture.host, 'sess-leftover', 1);
			assert.deepStrictEqual(fixture.permissionCalls, []);
			assert.deepStrictEqual(fixture.modelCalls, []);
			assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
			assert.strictEqual(fixture.modelSelect.selectedIndex, 0);
			assert.strictEqual(fixture.host.sessionConfigBySessionId.get('sess-leftover')?.permissionIndex, 0);
			assert.strictEqual(fixture.host.modelSelectedIndex, 0);
		} finally {
			fixture.dispose();
		}
	});

	test('leftover-looks-live pairing-hold More radios stay disabled and forced click does not write', async () => {
		const fixture = leftoverLooksLiveSessionSelectsHost();
		try {
			toggleMoreContextView(fixture.host);
			const radios = [...document.querySelectorAll('.conversation-lens-dock-more-permission [role="menuitemradio"]')] as HTMLButtonElement[];
			assert.strictEqual(radios.length, 3);
			for (const radio of radios) {
				assert.strictEqual(radio.disabled, true);
				assert.strictEqual(radio.getAttribute('aria-disabled'), 'true');
			}
			const permit = radios[2];
			permit.disabled = false;
			permit.removeAttribute('disabled');
			permit.setAttribute('aria-disabled', 'false');
			permit.click();
			await Promise.resolve();
			assert.deepStrictEqual(fixture.permissionCalls, []);
			assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
			assert.strictEqual(fixture.host.sessionConfigBySessionId.get('sess-leftover')?.permissionIndex, 0);
		} finally {
			fixture.dispose();
		}
	});

	test('leftover-looks-live pairing-hold Tune overlay still paints leftover catalog', () => {
		const fixture = leftoverLooksLiveSessionSelectsHost({ catalogToolNames: ['bash', 'read'] });
		try {
			assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
			toggleTuneContextView(fixture.host);
			const popup = document.querySelector('.conversation-lens-dock-tune-popup');
			assert.ok(popup);
			assert.ok(popup.textContent?.includes('bash'));
			assert.ok(popup.textContent?.includes('read'));
			assert.ok(!popup.textContent?.includes(conversationLensDockNoTools));
			assert.ok(!popup.textContent?.includes(conversationLensDockNoEngineTools));
		} finally {
			fixture.dispose();
		}
	});

	test('cancelToolCall pairing-hold leftover does not write and shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const { host, posted } = pairingHoldLeftoverWriteHost(failures);
		let cancelCalls = 0;
		(host as unknown as { stubService: { cancelToolCall: () => boolean } }).stubService.cancelToolCall = () => {
			cancelCalls++;
			return true;
		};
		cancelToolCall(host, { id: 'tc-1', agentId: 'sub:a' });
		assert.strictEqual(cancelCalls, 0);
		assert.strictEqual(posted, 0);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('submitDraft postBound reject shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		const host = {
			composerPolicy: 'compose',
			submitInFlight: false,
			modelSelectedIndex: 0,
			dockTextarea: { value: 'hello' },
			getBoundSessionId: () => 'sess-1',
			stubService: {
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			sessionViewLease: {
				post: async () => {
					throw new Error('postBound boom');
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			void submitDraft(host);
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(host.submitInFlight, false);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('saveTurnEdit roster false after disconnect stays in edit and shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		const host = {
			composerPolicy: 'turnEdit',
			editingTurnId: 'turn-1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			stubService: {
				updateUserTurnText: () => false,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => true,
			},
			exitComposerEdit: () => { exited++; },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveTurnEdit(host);

		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(exited, 0);
		assert.strictEqual(host.editingTurnId, 'turn-1');
		assert.strictEqual(host.composerPolicy, 'turnEdit');
		assert.strictEqual(host.dockTextarea.value, 'revised later');
	});

	test('saveTurnEdit roster false without connection history stays in edit and shows failed', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		const host = {
			composerPolicy: 'turnEdit',
			editingTurnId: 'turn-1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			stubService: {
				updateUserTurnText: () => false,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			exitComposerEdit: () => { exited++; },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveTurnEdit(host);

		assert.deepStrictEqual(failures, ['failed']);
		assert.strictEqual(exited, 0);
		assert.strictEqual(host.editingTurnId, 'turn-1');
		assert.strictEqual(host.composerPolicy, 'turnEdit');
	});

	test('saveTurnEdit roster true exits edit and does not show post failure', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		const host = {
			composerPolicy: 'turnEdit',
			editingTurnId: 'turn-1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			stubService: {
				updateUserTurnText: () => true,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			exitComposerEdit: () => { exited++; },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveTurnEdit(host);

		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 1);
	});

	test('saveQueueEdit roster false after disconnect stays in edit and shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		let released = 0;
		let renderedInbox = 0;
		const host = {
			composerPolicy: 'queueEdit',
			editingQueueItemId: 'q1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			getEditingQueueItem: () => ({ id: 'q1', content: 'queued' }),
			stubService: {
				updateMessageQueueItemContent: () => false,
				releaseMessageQueueItemHold: () => { released++; },
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => true,
			},
			exitComposerEdit: () => { exited++; },
			renderInboxStatus: () => { renderedInbox++; },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveQueueEdit(host);

		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(exited, 0);
		assert.strictEqual(released, 0);
		assert.strictEqual(renderedInbox, 0);
		assert.strictEqual(host.editingQueueItemId, 'q1');
		assert.strictEqual(host.composerPolicy, 'queueEdit');
		assert.strictEqual(host.dockTextarea.value, 'revised later');
	});

	test('saveQueueEdit roster false without connection history stays in edit and shows failed', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		let released = 0;
		const host = {
			composerPolicy: 'queueEdit',
			editingQueueItemId: 'q1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			getEditingQueueItem: () => ({ id: 'q1', content: 'queued' }),
			stubService: {
				updateMessageQueueItemContent: () => false,
				releaseMessageQueueItemHold: () => { released++; },
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			exitComposerEdit: () => { exited++; },
			renderInboxStatus: () => { },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveQueueEdit(host);

		assert.deepStrictEqual(failures, ['failed']);
		assert.strictEqual(exited, 0);
		assert.strictEqual(released, 0);
		assert.strictEqual(host.editingQueueItemId, 'q1');
		assert.strictEqual(host.composerPolicy, 'queueEdit');
	});

	test('saveQueueEdit roster true exits edit and does not show post failure', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		let released = 0;
		let renderedInbox = 0;
		const host = {
			composerPolicy: 'queueEdit',
			editingQueueItemId: 'q1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			getEditingQueueItem: () => ({ id: 'q1', content: 'queued' }),
			stubService: {
				updateMessageQueueItemContent: () => true,
				releaseMessageQueueItemHold: () => { released++; },
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			exitComposerEdit: () => { exited++; },
			renderInboxStatus: () => { renderedInbox++; },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveQueueEdit(host);

		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 1);
		assert.strictEqual(released, 1);
		assert.strictEqual(renderedInbox, 1);
	});

	test('copyTurn writeText reject shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		const host = {
			clipboardService: {
				writeText: async () => {
					throw new Error('writeText boom');
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			copyTurn(host, 'copied');
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('copyTurn writeText resolve stays silent', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const written: string[] = [];
		const host = {
			clipboardService: {
				writeText: async (text: string) => {
					written.push(text);
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		copyTurn(host, 'copied');
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await new Promise<void>(resolve => setImmediate(() => resolve()));

		assert.deepStrictEqual(written, ['copied']);
		assert.deepStrictEqual(failures, []);
	});

	test('deleteTurn roster false after disconnect shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let deleteCalls = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				deleteTurn: () => {
					deleteCalls++;
					return false;
				},
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => true,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		deleteTurn(host, 'turn-1');

		assert.strictEqual(deleteCalls, 1);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('deleteTurn roster false without connection history shows failed', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				deleteTurn: () => false,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		deleteTurn(host, 'turn-1');

		assert.deepStrictEqual(failures, ['failed']);
	});

	test('deleteTurn roster true stays silent', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				deleteTurn: () => true,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		deleteTurn(host, 'turn-1');

		assert.deepStrictEqual(failures, []);
	});

	test('cancelToolCall roster false after disconnect shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let cancelCalls = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				cancelToolCall: () => {
					cancelCalls++;
					return false;
				},
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => true,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		cancelToolCall(host, { id: 'tc-1', agentId: 'sub:a' });

		assert.strictEqual(cancelCalls, 1);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('cancelToolCall roster false without connection history shows failed', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				cancelToolCall: () => false,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		cancelToolCall(host, { id: 'tc-1' });

		assert.deepStrictEqual(failures, ['failed']);
	});

	test('cancelToolCall roster true stays silent', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				cancelToolCall: () => true,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		cancelToolCall(host, { id: 'tc-1' });

		assert.deepStrictEqual(failures, []);
	});

	test('showPostFailure failed uses retry copy not disconnected', () => {
		const gateRow = {
			hidden: true,
			setAttribute: () => { },
			removeAttribute: () => { },
		};
		const gateLabel = { textContent: '' };
		const host = {
			postFailureVisible: false,
			sendFailureTimeout: undefined as ReturnType<typeof setTimeout> | undefined,
			gateRow,
			gateLabel,
		} as unknown as IConversationLensComposerChromeHost;

		showPostFailure(host, 'failed');

		assert.strictEqual(host.postFailureVisible, true);
		assert.strictEqual(gateRow.hidden, false);
		assert.strictEqual(gateLabel.textContent, conversationLensPostFailed);
		assert.notStrictEqual(gateLabel.textContent, conversationLensPostFailedDisconnected);
		assert.notStrictEqual(gateLabel.textContent, conversationLensPostFailedNoSession);
		assert.ok(!/disconnected/i.test(gateLabel.textContent ?? ''));
		if (host.sendFailureTimeout) {
			clearTimeout(host.sendFailureTimeout);
			host.sendFailureTimeout = undefined;
		}
	});
});
