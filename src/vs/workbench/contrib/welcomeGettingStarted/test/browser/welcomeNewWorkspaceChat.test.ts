/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { TestLayoutService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import '../../browser/gettingStarted.contribution.js';

suite('welcome.newWorkspaceChat', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('focuses Conversation Part instead of opening Copilot agent chat', async () => {
		const focusTracker = { called: false };
		const showConversationTracker = { called: false };

		class ConversationHiddenLayoutService extends TestLayoutService {
			override isVisible(part: Parts): boolean {
				return part !== Parts.CONVERSATION_PART;
			}

			override async setPartHidden(hidden: boolean, part: Parts): Promise<void> {
				if (part === Parts.CONVERSATION_PART && !hidden) {
					showConversationTracker.called = true;
				}
			}
		}

		const conversationPartService: IConversationPartService = {
			_serviceBrand: undefined,
			onDidCreateSlots: Event.None,
			onDidFocus: Event.None,
			getSlots: () => undefined,
			focus: () => { focusTracker.called = true; },
		};

		const layoutService = new ConversationHiddenLayoutService();
		const instantiationService = workbenchInstantiationService({}, store);
		instantiationService.stub(IWorkbenchLayoutService, layoutService);
		instantiationService.stub(IConversationPartService, conversationPartService);

		const command = CommandsRegistry.getCommand('welcome.newWorkspaceChat');
		assert.ok(command);

		await instantiationService.invokeFunction(accessor => command!.handler(accessor));

		assert.strictEqual(showConversationTracker.called, true);
		assert.strictEqual(focusTracker.called, true);
	});
});
