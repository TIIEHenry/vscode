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

suite('conversationKillEngine', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function notificationSink(errors: string[]): Pick<INotificationService, 'error'> {
		return {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		};
	}

	test('connected killSubAgent true is killed with no notice', () => {
		const errors: string[] = [];
		const killCalls: Array<{ sessionId: string; args?: ConversationKillSubAgentArgs }> = [];
		const args: ConversationKillSubAgentArgs = { agentId: 'sub:reviewer', force: true };
		const roster = {
			isEngineConnected: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			killSubAgent(sessionId: string, next?: ConversationKillSubAgentArgs) {
				killCalls.push({ sessionId, args: next });
				return true;
			},
		} as unknown as IConversationRosterService;

		const outcome = tryKillSubAgent(roster, notificationSink(errors), args);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.killed, true);
		assert.deepStrictEqual(killCalls, [{ sessionId: 's1', args }]);
		assert.deepStrictEqual(errors, []);
	});

	test('connected killSubAgent false is handled, not killed, and shows failed copy', () => {
		const errors: string[] = [];
		const killCalls: Array<{ sessionId: string; args?: ConversationKillSubAgentArgs }> = [];
		const args: ConversationKillSubAgentArgs = { agentId: 'sub:a' };
		const roster = {
			isEngineConnected: () => true,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			killSubAgent(sessionId: string, next?: ConversationKillSubAgentArgs) {
				killCalls.push({ sessionId, args: next });
				return false;
			},
		} as unknown as IConversationRosterService;

		const outcome = tryKillSubAgent(roster, notificationSink(errors), args);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.killed, false);
		assert.deepStrictEqual(killCalls, [{ sessionId: 's1', args }]);
		assert.deepStrictEqual(errors, [conversationKillEngineFailedCopy]);
	});

	test('disconnected with history shows disconnected copy and does not call killSubAgent', () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => false,
			hasEngineConnectionHistory: () => true,
			getActiveSessionId: () => 's1',
			killSubAgent: () => {
				throw new Error('must not kill while disconnected leftover');
			},
		} as unknown as IConversationRosterService;

		const outcome = tryKillSubAgent(roster, notificationSink(errors), { agentId: 'sub:a' });

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.killed, false);
		assert.deepStrictEqual(errors, [conversationKillEngineDisconnectedCopy]);
	});

	test('never-connected stays silent and does not call killSubAgent', () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => false,
			hasEngineConnectionHistory: () => false,
			getActiveSessionId: () => 's1',
			killSubAgent: () => {
				throw new Error('must not kill while never-connected');
			},
		} as unknown as IConversationRosterService;

		const outcome = tryKillSubAgent(roster, notificationSink(errors));

		assert.deepStrictEqual(outcome, { handled: false, killed: false });
		assert.deepStrictEqual(errors, []);
	});
});
