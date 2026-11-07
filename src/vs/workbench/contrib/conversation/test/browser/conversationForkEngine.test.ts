/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { LocalChatSessionUri } from '../../../chat/common/model/chatUri.js';
import { getConversationChatResource } from '../../common/conversationChatInput.js';
import { conversationForkEngineDisconnectedCopy, resolveConversationEngineForkSessionId, tryConnectedEngineFork, tryConnectedEngineForkForSource } from '../../browser/conversationForkEngine.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { isConversationPairingHold, type IConversationPairingHoldSource } from '../../browser/conversationSessionStatus.js';

suite('conversationForkEngine', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('forkSubAgent false is handled but not a successful fork', async () => {
		const errors: string[] = [];
		const forkCalls: string[] = [];
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent(sessionId: string) {
				forkCalls.push(sessionId);
				return false;
			},
		} as unknown as IConversationRosterService;
		const notificationService = {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService;

		const outcome = await tryConnectedEngineFork(roster, 's1', notificationService);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.forked, false);
		assert.notStrictEqual(outcome.handled, outcome.forked);
		assert.deepStrictEqual(forkCalls, ['s1']);
		assert.deepStrictEqual(errors, ['Could not fork conversation.']);
	});

	test('forkSubAgent true is handled and a successful fork', async () => {
		const errors: string[] = [];
		const forkCalls: string[] = [];
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent(sessionId: string) {
				forkCalls.push(sessionId);
				return true;
			},
		} as unknown as IConversationRosterService;
		const notificationService = {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService;
		const ua: IConversationPairingHoldSource = {
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		};

		const outcome = await tryConnectedEngineFork(roster, 's1', notificationService, ua);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.forked, true);
		assert.deepStrictEqual(forkCalls, ['s1']);
		assert.deepStrictEqual(errors, []);
	});

	test('connected fork waits for unary before reporting forked', async () => {
		const errors: string[] = [];
		let resolveSettle!: (ok: boolean) => void;
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => true,
			whenDispatchedEngineActionSettles: () => new Promise<boolean>(resolve => {
				resolveSettle = resolve;
			}),
		} as unknown as IConversationRosterService;
		const notificationService = {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService;

		let outcome: Awaited<ReturnType<typeof tryConnectedEngineFork>> | undefined;
		const pending = tryConnectedEngineFork(roster, 's1', notificationService).then(next => {
			outcome = next;
			return next;
		});
		await Promise.resolve();
		assert.strictEqual(outcome, undefined);

		resolveSettle(false);
		assert.deepStrictEqual(await pending, { handled: true, forked: false });
		assert.deepStrictEqual(errors, ['Could not fork conversation.']);
	});

	test('connected fork unary ok:false is handled, not forked, and does not use sync sent', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => true,
			whenDispatchedEngineActionSettles: async () => false,
		} as unknown as IConversationRosterService;

		const outcome = await tryConnectedEngineFork(roster, 's1', {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService);

		assert.deepStrictEqual(outcome, { handled: true, forked: false });
		assert.deepStrictEqual(errors, ['Could not fork conversation.']);
	});

	test('connected fork unary throw is handled and not a successful fork', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => true,
			whenDispatchedEngineActionSettles: async () => {
				throw new Error('boom');
			},
		} as unknown as IConversationRosterService;

		const outcome = await tryConnectedEngineFork(roster, 's1', {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService);

		assert.deepStrictEqual(outcome, { handled: true, forked: false });
		assert.deepStrictEqual(errors, ['Could not fork conversation.']);
	});

	test('leftover-looks-live pairing-hold skips fork unary and shows disconnected copy', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => {
				throw new Error('must not fork while leftover-looks-live');
			},
		} as unknown as IConversationRosterService;
		const ua: IConversationPairingHoldSource = {
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
		};

		const outcome = await tryConnectedEngineFork(roster, 's1', {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService, ua);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.forked, false);
		assert.deepStrictEqual(errors, [conversationForkEngineDisconnectedCopy]);
	});

	test('KEEP leftover list-fail skips fork unary and shows disconnected copy', async () => {
		const errors: string[] = [];
		const forkCalls: string[] = [];
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => false,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => {
				forkCalls.push('s1');
				throw new Error('must not fork while KEEP leftover list-fail');
			},
		} as unknown as IConversationRosterService;
		const ua: IConversationPairingHoldSource = {
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		};

		assert.strictEqual(roster.isEngineConnected(), true);
		assert.strictEqual(roster.isEngineSessionReady(), false);
		assert.strictEqual(ua.getConnectionSnapshot().pairingPending, false);
		assert.strictEqual(isConversationPairingHold(ua), false);

		const outcome = await tryConnectedEngineFork(roster, 's1', {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService, ua);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.forked, false);
		assert.deepStrictEqual(forkCalls, []);
		assert.deepStrictEqual(errors, [conversationForkEngineDisconnectedCopy]);
	});

	test('disconnected engine fork is neither handled nor forked', async () => {
		const roster = {
			isEngineConnected: () => false,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => {
				throw new Error('must not fork while disconnected');
			},
		} as unknown as IConversationRosterService;

		const outcome = await tryConnectedEngineFork(roster, 's1', { error() { } } as unknown as INotificationService);

		assert.deepStrictEqual(outcome, { handled: false, forked: false });
	});

	test('true disconnect with history still falls through', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => false,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => {
				throw new Error('must not fork while disconnected');
			},
		} as unknown as IConversationRosterService;
		const ua: IConversationPairingHoldSource = {
			getConnectionPhase: () => ({ kind: 'disconnected' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		};

		const outcome = await tryConnectedEngineFork(roster, 's1', {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService, ua);

		assert.deepStrictEqual(outcome, { handled: false, forked: false });
		assert.deepStrictEqual(errors, []);
	});

	test('pairing-hold leftover fork is handled, not forked, and shows disconnected notice', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => false,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => {
				throw new Error('must not fork while pairing-hold');
			},
		} as unknown as IConversationRosterService;
		const ua: IConversationPairingHoldSource = {
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
		};

		const outcome = await tryConnectedEngineFork(roster, 's1', {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService, ua);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.forked, false);
		assert.deepStrictEqual(errors, [conversationForkEngineDisconnectedCopy]);
	});

	test('pairing-hold without history still falls through to stub fork', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => false,
			hasEngineConnectionHistory: () => false,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => {
				throw new Error('must not engine-fork while never-connected pairing');
			},
		} as unknown as IConversationRosterService;
		const ua: IConversationPairingHoldSource = {
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
		};

		const outcome = await tryConnectedEngineFork(roster, 's1', {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService, ua);

		assert.deepStrictEqual(outcome, { handled: false, forked: false });
		assert.deepStrictEqual(errors, []);
	});

	test('connected fork forwards trimmed anchorTurnId to forkSubAgent', async () => {
		const forkCalls: { sessionId: string; options: unknown }[] = [];
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent(sessionId: string, options?: unknown) {
				forkCalls.push({ sessionId, options });
				return true;
			},
		} as unknown as IConversationRosterService;

		const outcome = await tryConnectedEngineFork(roster, 's1', { error() { } } as unknown as INotificationService, undefined, { anchorTurnId: '  turn-7  ' });

		assert.deepStrictEqual(outcome, { handled: true, forked: true });
		assert.deepStrictEqual(forkCalls, [{ sessionId: 's1', options: { anchorTurnId: 'turn-7' } }]);
	});

	test('connected fork without anchor passes no fork options', async () => {
		const forkCalls: { sessionId: string; argCount: number }[] = [];
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent(sessionId: string, ...rest: unknown[]) {
				forkCalls.push({ sessionId, argCount: rest.length });
				return true;
			},
		} as unknown as IConversationRosterService;
		const notificationService = { error() { } } as unknown as INotificationService;

		await tryConnectedEngineFork(roster, 's1', notificationService);
		await tryConnectedEngineFork(roster, 's1', notificationService, undefined, { anchorTurnId: '   ' });

		assert.deepStrictEqual(forkCalls, [
			{ sessionId: 's1', argCount: 0 },
			{ sessionId: 's1', argCount: 0 },
		]);
	});

	function connectedForkRoster(forkCalls: string[]): IConversationRosterService {
		return {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			getActiveSessionId: () => 'active',
			getSessions: () => [{ id: 'active', title: 'Active', turns: [] }, { id: 'other', title: 'Other', turns: [] }],
			forkSubAgent(sessionId: string) {
				forkCalls.push(sessionId);
				return true;
			},
		} as unknown as IConversationRosterService;
	}

	test('engine fork forks the given session, not the active one', async () => {
		const forkCalls: string[] = [];
		const outcome = await tryConnectedEngineFork(connectedForkRoster(forkCalls), 'other', { error() { } } as unknown as INotificationService);

		assert.deepStrictEqual(outcome, { handled: true, forked: true });
		assert.deepStrictEqual(forkCalls, ['other']);
	});

	test('only a conversation chat resource of a roster session resolves to an engine fork target', () => {
		const roster = connectedForkRoster([]);

		assert.strictEqual(resolveConversationEngineForkSessionId(roster, getConversationChatResource('other', 'default')), 'other');
		assert.strictEqual(resolveConversationEngineForkSessionId(roster, getConversationChatResource('other', 'fork-1')), 'other');
		assert.strictEqual(resolveConversationEngineForkSessionId(roster, getConversationChatResource('missing', 'default')), undefined);
		assert.strictEqual(resolveConversationEngineForkSessionId(roster, URI.parse('agent-host-copilot:/active')), undefined);
		assert.strictEqual(resolveConversationEngineForkSessionId(roster, LocalChatSessionUri.forSession('active')), undefined);
	});

	test('connected fork from a Chat contributed session leaves the roster alone', async () => {
		const forkCalls: string[] = [];
		const errors: unknown[] = [];
		const outcome = await tryConnectedEngineForkForSource(
			connectedForkRoster(forkCalls),
			{ error(message: unknown) { errors.push(message); } } as unknown as INotificationService,
			undefined,
			URI.parse('agent-host-copilot:/fork-source'),
		);

		assert.deepStrictEqual(outcome, { handled: false, forked: false });
		assert.deepStrictEqual(forkCalls, []);
		assert.deepStrictEqual(errors, []);
	});

	test('connected fork from a roster conversation resource forks that session', async () => {
		const forkCalls: string[] = [];
		const outcome = await tryConnectedEngineForkForSource(
			connectedForkRoster(forkCalls),
			{ error() { } } as unknown as INotificationService,
			undefined,
			getConversationChatResource('other', 'default'),
		);

		assert.deepStrictEqual(outcome, { handled: true, forked: true });
		assert.deepStrictEqual(forkCalls, ['other']);
	});
});
