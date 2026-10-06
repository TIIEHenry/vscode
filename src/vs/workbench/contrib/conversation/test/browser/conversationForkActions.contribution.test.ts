/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { ChatViewPaneTarget, IChatWidgetService } from '../../../chat/browser/chat.js';
import { IChatEditorOptions } from '../../../chat/browser/widgetHosts/editor/chatEditor.js';
import { IChatSessionsService } from '../../../chat/common/chatSessionsService.js';
import { ConversationForkConversationAction } from '../../browser/conversationForkActions.contribution.js';
import { IConversationSessionChatService } from '../../common/conversationSessionChat.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';

class TestConversationForkConversationAction extends ConversationForkConversationAction {
	openForkedSession(
		instantiationService: TestInstantiationService,
		parentSessionResource: URI,
		forkedSessionResource: URI,
	): Promise<void> {
		return this._openForkedSession(instantiationService, parentSessionResource, forkedSessionResource);
	}
}

suite('ConversationForkConversationAction', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('engine-connected local chat fork still opens the forked chat session', async () => {
		const instantiationService = disposables.add(new TestInstantiationService());
		instantiationService.stub(IWorkbenchEnvironmentService, upcastPartial<IWorkbenchEnvironmentService>({ isSessionsWindow: false }));
		instantiationService.stub(IConversationRosterService, upcastPartial<IConversationRosterService>({
			isEngineConnected: () => true,
		}));
		instantiationService.stub(IChatSessionsService, upcastPartial<IChatSessionsService>({
			getContentProviderSchemes: () => ['agent-host-copilot'],
		}));

		let openForkTabCalls = 0;
		instantiationService.stub(IConversationSessionChatService, upcastPartial<IConversationSessionChatService>({
			openForkTab: async () => {
				openForkTabCalls++;
			},
		}));

		const parentSessionResource = URI.parse('vscode-chat-session://parent');
		const forkedSessionResource = URI.parse('vscode-chat-session://fork');
		let openCall: { resource: URI; usesViewTarget: boolean; options: IChatEditorOptions | undefined } | undefined;
		instantiationService.stub(IChatWidgetService, upcastPartial<IChatWidgetService>({
			openSession: async (resource, target, options) => {
				openCall = { resource, usesViewTarget: target === ChatViewPaneTarget, options };
				return undefined;
			},
		}));

		await new TestConversationForkConversationAction().openForkedSession(instantiationService, parentSessionResource, forkedSessionResource);

		assert.strictEqual(openForkTabCalls, 0);
		assert.deepStrictEqual(openCall, {
			resource: forkedSessionResource,
			usesViewTarget: true,
			options: { sessionTypeSelectionReason: 'currentSession' },
		});
	});
});
