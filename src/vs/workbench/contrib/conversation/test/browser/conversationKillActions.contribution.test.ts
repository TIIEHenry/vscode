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
	resolveConversationKillSubAgentInvokeArgs,
	shouldDeliverConversationKillNotice,
} from '../../browser/conversationKillActions.contribution.js';
import {
	conversationKillEngineFailedCopy,
	conversationKillEngineFocusMissCopy,
} from '../../browser/conversationKillEngine.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';

suite('ConversationKillActionsContribution', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('resolveConversationKillSubAgentInvokeArgs binds to the invoke-time element, not caller sessionId', () => {
		const leaf = document.createElement('div');
		leaf.className = 'conversation-session-leaf';
		leaf.dataset.sessionKey = 'leaf-at-invoke';
		const focus = document.createElement('button');
		leaf.appendChild(focus);

		assert.deepStrictEqual(
			resolveConversationKillSubAgentInvokeArgs(focus, {
				agentId: 'sub:a',
				force: true,
				sessionId: 'from-caller',
			}),
			{
				agentId: 'sub:a',
				force: true,
				sessionId: 'leaf-at-invoke',
			},
		);
	});

	test('shouldDeliverConversationKillNotice keeps focus-miss copy and drops stale-session failures', () => {
		const leafA = document.createElement('div');
		leafA.className = 'conversation-session-leaf';
		leafA.dataset.sessionKey = 'leaf-a';
		const focusA = document.createElement('button');
		leafA.appendChild(focusA);

		const leafB = document.createElement('div');
		leafB.className = 'conversation-session-leaf';
		leafB.dataset.sessionKey = 'leaf-b';
		const focusB = document.createElement('button');
		leafB.appendChild(focusB);

		assert.strictEqual(shouldDeliverConversationKillNotice(undefined, focusB), true);
		assert.strictEqual(shouldDeliverConversationKillNotice('   ', focusB), true);
		assert.strictEqual(shouldDeliverConversationKillNotice('leaf-a', focusA), true);
		assert.strictEqual(shouldDeliverConversationKillNotice('leaf-a', focusB), false);
	});

	test('kill action suppresses unary failure notice after focus moves to another session leaf', async () => {
		const errors: string[] = [];
		let resolveSettle!: (ok: boolean) => void;
		const killCalls: string[] = [];

		const leafA = document.createElement('div');
		leafA.className = 'conversation-session-leaf';
		leafA.dataset.sessionKey = 'leaf-a';
		const focusA = document.createElement('button');
		leafA.tabIndex = 0;
		leafA.appendChild(focusA);

		const leafB = document.createElement('div');
		leafB.className = 'conversation-session-leaf';
		leafB.dataset.sessionKey = 'leaf-b';
		const focusB = document.createElement('button');
		leafB.tabIndex = 0;
		leafB.appendChild(focusB);

		document.body.appendChild(leafA);
		document.body.appendChild(leafB);
		store.add({ dispose: () => { leafA.remove(); leafB.remove(); } });

		focusA.focus();
		assert.strictEqual(getActiveElement(), focusA);

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => {
				throw new Error('kill must not read the roster active session');
			},
			killSubAgent(sessionId: string) {
				killCalls.push(sessionId);
				return true;
			},
			whenDispatchedEngineActionSettles: () => new Promise<boolean>(resolve => {
				resolveSettle = resolve;
			}),
		} as unknown as IConversationRosterService);
		instantiationService.stub(INotificationService, {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as INotificationService);
		instantiationService.stub(IUniverseAgentConnection, {
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		} as unknown as IUniverseAgentConnection);

		const command = CommandsRegistry.getCommand(CONVERSATION_KILL_SUB_AGENT_COMMAND_ID);
		assert.ok(command);
		const pending = instantiationService.invokeFunction(accessor => command.handler(accessor, { agentId: 'sub:a' }));

		await Promise.resolve();
		assert.deepStrictEqual(killCalls, ['leaf-a']);

		focusB.focus();
		assert.strictEqual(getActiveElement(), focusB);

		resolveSettle(false);
		await pending;

		assert.deepStrictEqual(errors, []);
	});

	test('kill action still shows unary failure notice when focus stays on the same session leaf', async () => {
		const errors: string[] = [];
		let resolveSettle!: (ok: boolean) => void;

		const leaf = document.createElement('div');
		leaf.className = 'conversation-session-leaf';
		leaf.dataset.sessionKey = 'leaf-stays';
		const focus = document.createElement('button');
		leaf.tabIndex = 0;
		leaf.appendChild(focus);
		document.body.appendChild(leaf);
		store.add({ dispose: () => leaf.remove() });
		focus.focus();

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, {
			isEngineConnected: () => true,
			isEngineSessionReady: () => true,
			hasEngineConnectionHistory: () => true,
			killSubAgent: () => true,
			whenDispatchedEngineActionSettles: () => new Promise<boolean>(resolve => {
				resolveSettle = resolve;
			}),
		} as unknown as IConversationRosterService);
		instantiationService.stub(INotificationService, {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as INotificationService);
		instantiationService.stub(IUniverseAgentConnection, {
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		} as unknown as IUniverseAgentConnection);

		const command = CommandsRegistry.getCommand(CONVERSATION_KILL_SUB_AGENT_COMMAND_ID);
		assert.ok(command);
		const pending = instantiationService.invokeFunction(accessor => command.handler(accessor, { agentId: 'sub:a' }));
		await Promise.resolve();
		resolveSettle(false);
		await pending;

		assert.deepStrictEqual(errors, [conversationKillEngineFailedCopy]);
	});

	test('kill action still shows focus miss when invoke had no session leaf', async () => {
		const errors: string[] = [];
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, {
			isEngineConnected: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => {
				throw new Error('kill must not read the roster active session');
			},
			killSubAgent: () => {
				throw new Error('must not kill on a focus miss');
			},
		} as unknown as IConversationRosterService);
		instantiationService.stub(INotificationService, {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as INotificationService);
		instantiationService.stub(IUniverseAgentConnection, {
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		} as unknown as IUniverseAgentConnection);

		const command = CommandsRegistry.getCommand(CONVERSATION_KILL_SUB_AGENT_COMMAND_ID);
		assert.ok(command);
		await instantiationService.invokeFunction(accessor => command.handler(accessor, { agentId: 'sub:a' }));

		assert.deepStrictEqual(errors, [conversationKillEngineFocusMissCopy]);
	});
});
