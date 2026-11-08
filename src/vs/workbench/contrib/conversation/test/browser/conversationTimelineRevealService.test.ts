/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INotification, INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import type { ConversationLens } from '../../browser/conversationLens.js';
import { ConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';

suite('ConversationTimelineRevealService (scroll scheduling)', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): ConversationTimelineRevealService {
		return store.add(new ConversationTimelineRevealService({
			error: () => { },
		} as unknown as INotificationService));
	}

	function recordingLens(name: string, calls: string[]): ConversationLens {
		return {
			revealTimelineItem: () => { },
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => calls.push(`${name}:scroll`),
		} as unknown as ConversationLens;
	}

	test('scrollToFirstPendingConfirmation does not scroll a restored lens after the scheduling lens was disposed', async () => {
		const service = createService();
		const calls: string[] = [];
		const lensA1 = recordingLens('a1', calls);
		const lensA2 = recordingLens('a2', calls);
		service.registerLens('session-a', lensA1);
		const regA2 = service.registerLens('session-a', lensA2);

		service.scrollToFirstPendingConfirmation('session-a');
		regA2.dispose();
		await timeout(0);

		assert.deepStrictEqual(calls, [], 'must not scroll when the lens that was active at schedule time is gone');
	});

	test('a lens failure toasts one line of explanation and keeps the raw error as the source', () => {
		const notifications: Array<{ severity: Severity; message: unknown; source: unknown }> = [];
		const service = store.add(new ConversationTimelineRevealService({
			notify: (notification: INotification) => {
				notifications.push({ severity: notification.severity, message: notification.message, source: notification.source });
			},
		} as unknown as INotificationService));
		service.registerLens('session-a', {
			revealTimelineItem: () => { throw new Error('lens detached: item-1'); },
		} as unknown as ConversationLens);

		service.revealItem('item-1', 'session-a');

		assert.deepStrictEqual(notifications, [{
			severity: Severity.Error,
			message: 'Could not show this item in the conversation.',
			source: 'lens detached: item-1',
		}]);
	});
});
