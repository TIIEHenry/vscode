/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IEditorOptions } from '../../../../../../platform/editor/common/editor.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IConversationPartService } from '../../../../../browser/parts/conversation/conversationPart.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { ConversationPart } from '../../../../../browser/parts/conversation/conversationPart.js';
import { IEditorPane } from '../../../../../common/editor.js';
import { PreferredGroup } from '../../../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService, Parts } from '../../../../../services/layout/browser/layoutService.js';
import { workbenchInstantiationService, TestEditorService, TestEnvironmentService, TestLayoutService } from '../../../../../test/browser/workbenchTestServices.js';
import { ACTION_ID_OPEN_CHAT, CHAT_OPEN_ACTION_ID } from '../../../browser/actions/chatActions.js';
import { IChatWidgetService } from '../../../browser/chat.js';
import { ChatEditorInput } from '../../../browser/widgetHosts/editor/chatEditorInput.js';
import { LocalChatSessionUri } from '../../../common/model/chatUri.js';
import { MockChatWidgetService } from '../widget/mockChatWidget.js';

import '../../../browser/chat.shared.contribution.js';

class TrackingLayoutService extends TestLayoutService {

	conversationPartHidden = false;
	showConversationPartCalls = 0;

	override isVisible(part: Parts): boolean {
		if (part === Parts.CONVERSATION_PART) {
			return !this.conversationPartHidden;
		}
		return super.isVisible(part);
	}

	override async setPartHidden(hidden: boolean, part: Parts): Promise<void> {
		if (part === Parts.CONVERSATION_PART) {
			if (!hidden) {
				this.showConversationPartCalls++;
				this.conversationPartHidden = false;
			} else {
				this.conversationPartHidden = true;
			}
		}
	}
}

suite('default-window chat open redirects to ConversationPart', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function setup(options?: { prefillChatEditor?: boolean }): {
		instantiationService: ReturnType<typeof workbenchInstantiationService>;
		editorService: TestEditorService;
		openSessionTracker: { called: boolean };
		focusTracker: { called: boolean };
		layoutService: TrackingLayoutService;
	} {
		const openSessionTracker = { called: false };
		const focusTracker = { called: false };
		const layoutService = new TrackingLayoutService();
		layoutService.conversationPartHidden = true;

		const editorService = store.add(new TestEditorService());
		const originalOpenEditor = editorService.openEditor.bind(editorService);
		(editorService as { openEditor: (...args: unknown[]) => Promise<IEditorPane | undefined> }).openEditor = async (editor, optionsOrGroup?, group?) => {
			if (editor instanceof EditorInput) {
				editorService.activeEditor = editor;
			}
			return originalOpenEditor(editor as EditorInput, optionsOrGroup as IEditorOptions, group as PreferredGroup);
		};

		if (options?.prefillChatEditor) {
			const sessionResource = LocalChatSessionUri.forSession('prefilled-chat-editor');
			editorService.activeEditor = { sessionResource } as ChatEditorInput;
		}

		const widgetService = new class extends MockChatWidgetService {
			override openSession(sessionResource: URI): Promise<undefined> {
				openSessionTracker.called = true;
				return Promise.resolve(undefined);
			}
		}();

		const instantiationService = workbenchInstantiationService({
			editorService: () => editorService,
			environmentService: () => TestEnvironmentService,
		}, store);

		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		conversationPart.create(parent);
		const originalFocus = conversationPart.focus.bind(conversationPart);
		conversationPart.focus = () => {
			focusTracker.called = true;
			originalFocus();
		};
		instantiationService.stub(IConversationPartService, conversationPart);
		instantiationService.stub(IChatWidgetService, widgetService);
		instantiationService.stub(IWorkbenchLayoutService, layoutService);

		return { instantiationService, editorService, openSessionTracker, focusTracker, layoutService };
	}

	async function assertCommandRoutesToConversation(
		commandId: string,
		options?: { prefillChatEditor?: boolean },
	): Promise<void> {
		const { instantiationService, editorService, openSessionTracker, focusTracker, layoutService } = setup(options);
		const commandService = instantiationService.get(ICommandService);

		await commandService.executeCommand(commandId);

		assert.strictEqual(layoutService.showConversationPartCalls, 1, 'CONVERSATION_PART should be shown');
		assert.strictEqual(focusTracker.called, true, 'ConversationPart.focus should be called');
		assert.strictEqual(editorService.activeEditor instanceof ChatEditorInput, false);
		assert.strictEqual(openSessionTracker.called, false);
	}

	test('workbench.action.chat.open routes to ConversationPart via registered command', async () => {
		await assertCommandRoutesToConversation(CHAT_OPEN_ACTION_ID);
	});

	test('workbench.action.openChat routes to ConversationPart via registered command', async () => {
		await assertCommandRoutesToConversation(ACTION_ID_OPEN_CHAT);
	});

	test('workbench.action.openChat still routes to ConversationPart when active editor is ChatEditorInput (H3)', async () => {
		await assertCommandRoutesToConversation(ACTION_ID_OPEN_CHAT, { prefillChatEditor: true });
	});
});
