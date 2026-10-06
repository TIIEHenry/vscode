/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ConversationAccessibleView } from '../../browser/conversationAccessibleView.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';

suite('ConversationAccessibleView', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('refreshed content follows the active session instead of the open snapshot', () => {
		let activeSessionId = 'session-a';
		const contentBySession: Record<string, string | undefined> = {
			'session-a': 'turn-a',
			'session-b': 'turn-b',
		};

		const instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(IConversationRosterService, {
			_serviceBrand: undefined,
			getActiveSessionId: () => activeSessionId,
		} as IConversationRosterService);
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			getAccessibleTurnContent: (sessionId: string) => contentBySession[sessionId],
			focusAccessibleTurn: () => { },
		} as IConversationTimelineRevealService);

		const accessibleView = new ConversationAccessibleView();
		const provider = instantiationService.invokeFunction(accessor => accessibleView.getProvider(accessor));
		assert.ok(provider);
		store.add(provider);

		assert.strictEqual(provider.provideContent(), 'turn-a');

		activeSessionId = 'session-b';
		assert.strictEqual(provider.provideContent(), 'turn-b');
	});
});
