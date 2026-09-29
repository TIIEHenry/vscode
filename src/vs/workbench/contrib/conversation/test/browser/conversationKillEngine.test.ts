/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getActiveElement } from '../../../../../base/browser/dom.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	CONVERSATION_KILL_SUB_AGENT_COMMAND_ID,
} from '../../browser/conversationKillActions.contribution.js';
import {
	conversationKillEngineDisconnectedCopy,
	conversationKillEngineFailedCopy,
	conversationKillEngineFocusMissCopy,
	resolveConversationKillSessionKey,
	tryKillSubAgent,
	type ConversationKillSubAgentArgs,
} from '../../browser/conversationKillEngine.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { isConversationPairingHold, type IConversationPairingHoldSource } from '../../browser/conversationSessionStatus.js';

suite('conversationKillEngine', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

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
			getActiveSessionId: () => {
				throw new Error('kill must not read the roster active session');
			},
			killSubAgent(sessionId: string, next?: ConversationKillSubAgentArgs) {
				killCalls.push({ sessionId, args: next });
				return true;
			},
		} as unknown as IConversationRosterService;

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { ...args, sessionId: 's1' }, liveUa);

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

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { ...args, sessionId: 's1' }, liveUa);

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
		const pending = tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a', sessionId: 's1' }, liveUa).then(next => {
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

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a', sessionId: 's1' }, liveUa);

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

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a', sessionId: 's1' }, leftoverLooksLiveUa);

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

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a', sessionId: 's1' }, ua);

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

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a', sessionId: 's1' });

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

		const outcome = await tryKillSubAgent(roster, notificationSink(errors), { sessionId: 's1' });

		assert.deepStrictEqual(outcome, { handled: false, killed: false });
		assert.deepStrictEqual(errors, []);
	});

	test('blank session id notices focus miss and does not kill', async () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => {
				throw new Error('kill must not read the roster active session');
			},
			killSubAgent: () => {
				throw new Error('must not kill on a focus miss');
			},
		} as unknown as IConversationRosterService;

		const blank = await tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a', sessionId: '   ' }, leftoverLooksLiveUa);
		const omitted = await tryKillSubAgent(roster, notificationSink(errors), undefined, liveUa);

		assert.deepStrictEqual(blank, { handled: true, killed: false });
		assert.deepStrictEqual(omitted, { handled: true, killed: false });
		assert.deepStrictEqual(errors, [conversationKillEngineFocusMissCopy, conversationKillEngineFocusMissCopy]);
	});

	test('resolveConversationKillSessionKey reads the leaf and does not fall through', () => {
		const leaf = document.createElement('div');
		leaf.className = 'conversation-session-leaf';
		leaf.dataset.sessionKey = 'leaf-a';
		const overlay = document.createElement('div');
		overlay.className = 'conversation-subagent-overlay';
		overlay.dataset.sessionKey = 'overlay-b';
		const focus = document.createElement('button');
		leaf.appendChild(overlay);
		overlay.appendChild(focus);
		assert.strictEqual(resolveConversationKillSessionKey(focus), 'leaf-a');

		leaf.dataset.sessionKey = '   ';
		assert.strictEqual(resolveConversationKillSessionKey(focus), undefined);

		const detached = document.createElement('div');
		detached.className = 'conversation-subagent-overlay';
		detached.dataset.sessionKey = 'overlay-only';
		const detachedFocus = document.createElement('button');
		detached.appendChild(detachedFocus);
		assert.strictEqual(resolveConversationKillSessionKey(detachedFocus), 'overlay-only');
		assert.strictEqual(resolveConversationKillSessionKey(document.createElement('button')), undefined);
	});

	test('kill action uses the focused leaf and ignores args.sessionId', async () => {
		const errors: string[] = [];
		const killCalls: Array<{ sessionId: string; args?: ConversationKillSubAgentArgs }> = [];
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => {
				throw new Error('kill must not read the roster active session');
			},
			killSubAgent(sessionId: string, next?: ConversationKillSubAgentArgs) {
				killCalls.push({ sessionId, args: next });
				return true;
			},
		} as unknown as IConversationRosterService);
		instantiationService.stub(INotificationService, notificationSink(errors) as INotificationService);
		instantiationService.stub(IUniverseAgentConnection, {
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		} as unknown as IUniverseAgentConnection);
		const leaf = document.createElement('div');
		leaf.className = 'conversation-session-leaf';
		leaf.tabIndex = 0;
		leaf.dataset.sessionKey = 'leaf-focus';
		document.body.appendChild(leaf);
		store.add({ dispose: () => leaf.remove() });
		leaf.focus();
		assert.strictEqual(getActiveElement(), leaf);

		const command = CommandsRegistry.getCommand(CONVERSATION_KILL_SUB_AGENT_COMMAND_ID);
		assert.ok(command);
		await instantiationService.invokeFunction(accessor => command.handler(accessor, {
			agentId: 'sub:z',
			force: true,
			sessionId: 'from-caller',
		}));

		assert.deepStrictEqual(killCalls, [{ sessionId: 'leaf-focus', args: { agentId: 'sub:z', force: true } }]);
		assert.deepStrictEqual(errors, []);
	});
});
