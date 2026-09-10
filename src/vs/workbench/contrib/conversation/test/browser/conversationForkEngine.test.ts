/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { tryConnectedEngineFork } from '../../browser/conversationForkEngine.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';

suite('conversationForkEngine', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('forkSubAgent false is handled but not a successful fork', () => {
		const errors: string[] = [];
		const forkCalls: string[] = [];
		const roster = {
			isEngineConnected: () => true,
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

		const outcome = tryConnectedEngineFork(roster, notificationService);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.forked, false);
		assert.notStrictEqual(outcome.handled, outcome.forked);
		assert.deepStrictEqual(forkCalls, ['s1']);
		assert.deepStrictEqual(errors, ['Could not fork conversation.']);
	});

	test('forkSubAgent true is handled and a successful fork', () => {
		const errors: string[] = [];
		const roster = {
			isEngineConnected: () => true,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => true,
		} as unknown as IConversationRosterService;
		const notificationService = {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService;

		const outcome = tryConnectedEngineFork(roster, notificationService);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.forked, true);
		assert.deepStrictEqual(errors, []);
	});

	test('disconnected engine fork is neither handled nor forked', () => {
		const roster = {
			isEngineConnected: () => false,
			getActiveSessionId: () => 's1',
			forkSubAgent: () => {
				throw new Error('must not fork while disconnected');
			},
		} as unknown as IConversationRosterService;

		const outcome = tryConnectedEngineFork(roster, { error() { } } as unknown as INotificationService);

		assert.deepStrictEqual(outcome, { handled: false, forked: false });
	});
});
