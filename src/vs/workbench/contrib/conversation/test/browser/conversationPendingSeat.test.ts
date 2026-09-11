/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { getErrorMessage } from '../../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import type { PendingActionView } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import type { ConversationLens } from '../../browser/conversationLens.js';
import {
	collectPendingAttentionRequestIds,
	findFirstPendingConfirmationTurnId,
	hasNewPendingAttention,
	isConversationSessionInactive,
	scrollToFirstPendingConfirmation,
	shouldAutoRevealPendingConfirmation,
} from '../../browser/conversationPendingSeat.js';
import type { IConversationPairingHoldSource } from '../../browser/conversationSessionStatus.js';
import type { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { ConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';

suite('conversationPendingSeat', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('shouldAutoRevealPendingConfirmation skips pairing-hold leftover seats', () => {
		const pairingHold: IConversationPairingHoldSource = {
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
		};
		const connected: IConversationPairingHoldSource = {
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		};
		const disconnected: IConversationPairingHoldSource = {
			getConnectionPhase: () => ({ kind: 'disconnected' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		};
		assert.strictEqual(shouldAutoRevealPendingConfirmation(pairingHold), false);
		assert.strictEqual(shouldAutoRevealPendingConfirmation(connected), true);
		assert.strictEqual(shouldAutoRevealPendingConfirmation(disconnected), true);
		assert.strictEqual(shouldAutoRevealPendingConfirmation(undefined), true);
	});

	test('inactive when session is not active or Conversation part is hidden', () => {
		assert.strictEqual(isConversationSessionInactive('a', 'a', true), false);
		assert.strictEqual(isConversationSessionInactive('a', 'b', true), true);
		assert.strictEqual(isConversationSessionInactive('a', 'a', false), true);
		assert.strictEqual(isConversationSessionInactive('a', 'b', false), true);
	});

	test('collects permission and question pending actions', () => {
		const actions = [
			{ requestId: 'p1', summary: { kind: 'permission', title: 'Allow write', permissionKind: 'write' } },
			{ requestId: 'q1', summary: { kind: 'question', title: 'Which one?' } },
			{ requestId: 'other', summary: { kind: 'text', title: 'no' } },
		] as unknown as PendingActionView[];
		assert.deepStrictEqual(collectPendingAttentionRequestIds(actions), ['p1', 'q1']);
	});

	test('hasNewPendingAttention only when a new request id appears', () => {
		assert.strictEqual(hasNewPendingAttention(new Set(['p1']), ['p1']), false);
		assert.strictEqual(hasNewPendingAttention(new Set(['p1']), ['p1', 'q1']), true);
		assert.strictEqual(hasNewPendingAttention(new Set(), ['q1']), true);
	});

	test('findFirstPendingConfirmationTurnId prefers first pending confirmation or question', () => {
		const turns: ConversationStubTurn[] = [
			{ id: 'u1', kind: 'user', text: 'hi' },
			{ id: 'c1', kind: 'confirmation', text: 'Allow?', status: 'allowed' },
			{ id: 'q1', kind: 'question', text: 'Pick', status: 'pending' },
		];
		assert.strictEqual(findFirstPendingConfirmationTurnId(turns), 'q1');
		assert.strictEqual(findFirstPendingConfirmationTurnId([
			{ id: 'c2', kind: 'confirmation', text: 'Allow?', status: 'pending' },
			...turns,
		]), 'c2');
	});

	test('scroll helper leaves trajectory, unmaximizes, then scrolls the seat', () => {
		const calls: string[] = [];
		const seat = { scrollIntoView: () => calls.push('scroll') } as unknown as HTMLElement;
		scrollToFirstPendingConfirmation({
			lensId: 'trajectory',
			showConversationLens: () => calls.push('show-lens'),
			inputMaximized: true,
			setInputMaximized: maximized => calls.push(`max:${maximized}`),
			findFirstPendingConfirmationTurnId: () => 'c1',
			getConfirmationElement: turnId => {
				calls.push(`el:${turnId}`);
				return seat;
			},
		});
		assert.deepStrictEqual(calls, ['show-lens', 'max:false', 'el:c1', 'scroll']);
	});

	test('scroll helper locates a question seat via the same host element lookup', () => {
		const calls: string[] = [];
		const seat = { scrollIntoView: () => calls.push('scroll') } as unknown as HTMLElement;
		const turns: ConversationStubTurn[] = [
			{ id: 'q1', kind: 'question', text: 'Pick', status: 'pending' },
		];
		scrollToFirstPendingConfirmation({
			lensId: 'conversation',
			showConversationLens: () => calls.push('show-lens'),
			inputMaximized: false,
			setInputMaximized: () => calls.push('max'),
			findFirstPendingConfirmationTurnId: () => findFirstPendingConfirmationTurnId(turns),
			getConfirmationElement: turnId => {
				calls.push(`el:${turnId}`);
				return turnId === 'q1' ? seat : undefined;
			},
		});
		assert.deepStrictEqual(calls, ['el:q1', 'scroll']);
	});
});

suite('ConversationTimelineRevealService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createThrowingLens(calls: string[]): ConversationLens {
		return {
			revealTimelineItem: (itemId: string) => {
				calls.push(`reveal:${itemId}`);
				throw new Error('boom');
			},
			focusAccessibleTurn: () => {
				calls.push('focus');
				throw new Error('boom');
			},
			scrollToFirstPendingConfirmation: () => {
				calls.push('scroll');
				throw new Error('boom');
			},
			getAccessibleTurnContent: () => {
				calls.push('accessible');
				throw new Error('boom');
			},
		} as unknown as ConversationLens;
	}

	function createService(): { service: ConversationTimelineRevealService; errors: string[] } {
		const errors: string[] = [];
		const service = store.add(new ConversationTimelineRevealService({
			error: (message: string | Error) => {
				errors.push(typeof message === 'string' ? message : getErrorMessage(message));
			},
		} as INotificationService));
		return { service, errors };
	}

	test('revealItem lens throw notifies error and second call still runs', () => {
		const { service, errors } = createService();
		const calls: string[] = [];
		store.add(service.registerLens(createThrowingLens(calls)));
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			service.revealItem('item-1');
			service.revealItem('item-2');
			assert.deepStrictEqual(calls, ['reveal:item-1', 'reveal:item-2']);
			assert.deepStrictEqual(errors, ['boom', 'boom']);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('focusAccessibleTurn lens throw notifies error and does not block later scroll', async () => {
		const { service, errors } = createService();
		const calls: string[] = [];
		store.add(service.registerLens(createThrowingLens(calls)));
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			service.focusAccessibleTurn();
			assert.deepStrictEqual(calls, ['focus']);
			assert.deepStrictEqual(errors, ['boom']);
			service.scrollToFirstPendingConfirmation();
			await timeout(0);
			assert.deepStrictEqual(calls, ['focus', 'scroll']);
			assert.deepStrictEqual(errors, ['boom', 'boom']);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('getAccessibleTurnContent lens throw notifies error, returns undefined, and second call still runs', () => {
		const { service, errors } = createService();
		const calls: string[] = [];
		store.add(service.registerLens(createThrowingLens(calls)));
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			assert.strictEqual(service.getAccessibleTurnContent(), undefined);
			assert.strictEqual(service.getAccessibleTurnContent(), undefined);
			assert.deepStrictEqual(calls, ['accessible', 'accessible']);
			assert.deepStrictEqual(errors, ['boom', 'boom']);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('scrollToFirstPendingConfirmation lens throw notifies error without unhandled rejection and second call still runs', async () => {
		const { service, errors } = createService();
		const calls: string[] = [];
		store.add(service.registerLens(createThrowingLens(calls)));
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			service.scrollToFirstPendingConfirmation();
			await timeout(0);
			assert.deepStrictEqual(calls, ['scroll']);
			assert.deepStrictEqual(errors, ['boom']);
			assert.deepStrictEqual(unhandledRejections, []);
			service.scrollToFirstPendingConfirmation();
			await timeout(0);
			assert.deepStrictEqual(calls, ['scroll', 'scroll']);
			assert.deepStrictEqual(errors, ['boom', 'boom']);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
