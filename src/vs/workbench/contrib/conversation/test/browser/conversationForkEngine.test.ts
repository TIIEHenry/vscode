/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { conversationForkEngineDisconnectedCopy, tryConnectedEngineFork } from '../../browser/conversationForkEngine.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import type { IConversationPairingHoldSource } from '../../browser/conversationSessionStatus.js';

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
		const forkCalls: string[] = [];
		const roster = {
			isEngineConnected: () => true,
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

		const outcome = tryConnectedEngineFork(roster, notificationService, ua);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.forked, true);
		assert.deepStrictEqual(forkCalls, ['s1']);
		assert.deepStrictEqual(errors, []);
	});

	test('leftover-looks-live pairing-hold skips fork unary and shows disconnected copy', () => {
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

		const outcome = tryConnectedEngineFork(roster, {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService, ua);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.forked, false);
		assert.deepStrictEqual(errors, [conversationForkEngineDisconnectedCopy]);
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

	test('true disconnect with history still falls through', () => {
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

		const outcome = tryConnectedEngineFork(roster, {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService, ua);

		assert.deepStrictEqual(outcome, { handled: false, forked: false });
		assert.deepStrictEqual(errors, []);
	});

	test('pairing-hold leftover fork is handled, not forked, and shows disconnected notice', () => {
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

		const outcome = tryConnectedEngineFork(roster, {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService, ua);

		assert.strictEqual(outcome.handled, true);
		assert.strictEqual(outcome.forked, false);
		assert.deepStrictEqual(errors, [conversationForkEngineDisconnectedCopy]);
	});

	test('pairing-hold without history still falls through to stub fork', () => {
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

		const outcome = tryConnectedEngineFork(roster, {
			error(message: string | Error) {
				errors.push(typeof message === 'string' ? message : message.message);
			},
		} as unknown as INotificationService, ua);

		assert.deepStrictEqual(outcome, { handled: false, forked: false });
		assert.deepStrictEqual(errors, []);
	});
});
