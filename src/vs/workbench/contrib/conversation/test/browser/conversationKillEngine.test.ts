/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import {
	conversationKillEngineDisconnectedCopy,
	conversationKillEngineFailedCopy,
	tryKillSubAgent,
	type ConversationKillSubAgentArgs,
} from '../../browser/conversationKillEngine.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { isConversationPairingHold, type IConversationPairingHoldSource } from '../../browser/conversationSessionStatus.js';

suite('conversationKillEngine', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function notificationSink(errors: string[]): Pick<INotificationService, 'error'> {
		return {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		};
	}

	const liveUa: IConversationPairingHoldSource = {
		getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
		getConnectionSnapshot: () => ({ pairingPending: false }),
	};

	const leftoverLooksLiveUa: IConversationPairingHoldSource = {
		getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
		getConnectionSnapshot: () => ({ pairingPending: true }),
	};

	test('connected killSubAgent true is killed with no notice', async () => {
		const errors: string[] = [];
		const killCalls: Array<{ sessionId: string; args?: ConversationKillSubAgentArgs }> = [];
		const args: ConversationKillSubAgentArgs = { agentId: 'sub:reviewer', force: true };
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			killSubAgent(sessionId: string, next?: ConversationKillSubAgentArgs) {
				killCalls.push({ sessionId, args: next });
				return true;
			},
		} as unknown as IConversationRosterService;

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), args, liveUa);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.killed, true);
		assert.deepStrictEqual(killCalls, [{ sessionId: 's1', args }]);
		assert.deepStrictEqual(errors, []);
	});

	test('connected killSubAgent false is handled, not killed, and shows failed copy', async () => {
		const errors: string[] = [];
		const killCalls: Array<{ sessionId: string; args?: ConversationKillSubAgentArgs }> = [];
		const args: ConversationKillSubAgentArgs = { agentId: 'sub:a' };
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			killSubAgent(sessionId: string, next?: ConversationKillSubAgentArgs) {
				killCalls.push({ sessionId, args: next });
				return false;
			},
		} as unknown as IConversationRosterService;

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), args, liveUa);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.killed, false);
		assert.deepStrictEqual(killCalls, [{ sessionId: 's1', args }]);
		assert.deepStrictEqual(errors, [conversationKillEngineFailedCopy]);
	});

	test('connected kill waits for unary before reporting killed', async () => {
		const errors: string[] = [];
		let resolveSettle!: (ok: boolean) => void;
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			killSubAgent: () => true,
			whenDispatchedEngineActionSettles: () => new Promise<boolean>(resolve => {
				resolveSettle = resolve;
			}),
		} as unknown as IConversationRosterService;

		let outcome: Awaited<ReturnType<typeof tryKillSubAgent>> | undefined;
		const pending = tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a' }, liveUa).then(next => {
			outcome = next;
			return next;
		});
		await Promise.resolve();
		assert.strictEqual(outcome, undefined);

		resolveSettle(false);
		assert.deepStrictEqual(await pending, { handled: true, killed: false });
		assert.deepStrictEqual(errors, [conversationKillEngineFailedCopy]);
	});

	test('connected kill unary throw is handled and not killed', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			killSubAgent: () => true,
			whenDispatchedEngineActionSettles: async () => {
				throw new Error('boom');
			},
		} as unknown as IConversationRosterService;

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a' }, liveUa);

		assert.deepStrictEqual(outcome, { handled: true, killed: false });
		assert.deepStrictEqual(errors, [conversationKillEngineFailedCopy]);
	});

	test('leftover-looks-live pairing-hold skips kill unary and shows disconnected copy', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			killSubAgent: () => {
				throw new Error('must not kill while leftover-looks-live');
			},
		} as unknown as IConversationRosterService;

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a' }, leftoverLooksLiveUa);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.killed, false);
		assert.deepStrictEqual(errors, [conversationKillEngineDisconnectedCopy]);
	});

	test('KEEP leftover list-fail skips kill unary and shows disconnected copy', async () => {
		const errors: string[] = [];
		const killCalls: ConversationKillSubAgentArgs[] = [];
		const roster = {
			isEngineConnected: () => true,
			isEngineSessionReady: () => false,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			killSubAgent: () => {
				killCalls.push({ agentId: 'sub:a' });
				throw new Error('must not kill while KEEP leftover list-fail');
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

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a' }, ua);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.killed, false);
		assert.deepStrictEqual(killCalls, []);
		assert.deepStrictEqual(errors, [conversationKillEngineDisconnectedCopy]);
	});

	test('disconnected with history shows disconnected copy and does not call killSubAgent', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => false,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			killSubAgent: () => {
				throw new Error('must not kill while disconnected leftover');
			},
		} as unknown as IConversationRosterService;

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a' });

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.killed, false);
		assert.deepStrictEqual(errors, [conversationKillEngineDisconnectedCopy]);
	});

	test('never-connected stays silent and does not call killSubAgent', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => false,
			hasEngineConnectionHistory: () => false,
			getActiveSessionId: () => 's1',
			killSubAgent: () => {
				throw new Error('must not kill while never-connected');
			},
		} as unknown as IConversationRosterService;

		const outcome = await tryKillSubAgent(roster, notificationSink(errors));

		assert.deepStrictEqual(outcome, { handled: false, killed: false });
		assert.deepStrictEqual(errors, []);
	});
});
