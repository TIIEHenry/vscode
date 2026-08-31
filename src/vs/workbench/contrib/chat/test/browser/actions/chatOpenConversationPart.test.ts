/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { ConversationPart } from '../../../../browser/parts/conversation/conversationPart.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { workbenchInstantiationService, TestEditorService } from '../../../../test/browser/workbenchTestServices.js';
import { ACTION_ID_OPEN_CHAT, CHAT_OPEN_ACTION_ID, registerChatActions } from '../../../browser/actions/chatActions.js';
import { IChatWidgetService } from '../../../browser/chat.js';
import { ChatEditorInput } from '../../../browser/widgetHosts/editor/chatEditorInput.js';
import { MockChatWidgetService } from '../widget/mockChatWidget.js';

suite('default-window chat open redirects to ConversationPart', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	let registered = false;

	function setup(): {
		instantiationService: ReturnType<typeof workbenchInstantiationService>;
		editorService: TestEditorService;
		openSessionTracker: { called: boolean };
	} {
		const openSessionTracker = { called: false };
		const editorService = new class extends TestEditorService {
			override async openEditor(editor: EditorInput | { resource?: URI }): Promise<undefined> {
				if (editor instanceof EditorInput) {
					this.activeEditor = editor;
				}
				return undefined;
			}
		}();

		const widgetService = new class extends MockChatWidgetService {
			override openSession(sessionResource: URI): Promise<undefined> {
				openSessionTracker.called = true;
				return Promise.resolve(undefined);
			}
		}();

		const instantiationService = workbenchInstantiationService({
			editorService: () => editorService,
			environmentService: () => ({ isSessionsWindow: false } as IWorkbenchEnvironmentService),
		}, store);

		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		conversationPart.create(parent);
		instantiationService.stub(IConversationPartService, conversationPart);
		instantiationService.stub(IChatWidgetService, widgetService);

		if (!registered) {
			registerChatActions();
			registered = true;
		}

		return { instantiationService, editorService, openSessionTracker };
	}

	async function runCommand(instantiationService: ReturnType<typeof workbenchInstantiationService>, commandId: string): Promise<void> {
		const command = CommandsRegistry.getCommand(commandId);
		assert.ok(command, `Command ${commandId} should be registered`);
		await instantiationService.invokeFunction(command.handler);
	}

	test('workbench.action.chat.open does not open ChatEditorInput as active editor', async () => {
		const { instantiationService, editorService, openSessionTracker } = setup();
		await runCommand(instantiationService, CHAT_OPEN_ACTION_ID);

		assert.strictEqual(editorService.activeEditor instanceof ChatEditorInput, false);
		assert.strictEqual(openSessionTracker.called, false);
	});

	test('workbench.action.openChat does not open ChatEditorInput as active editor', async () => {
		const { instantiationService, editorService, openSessionTracker } = setup();
		await runCommand(instantiationService, ACTION_ID_OPEN_CHAT);

		assert.strictEqual(editorService.activeEditor instanceof ChatEditorInput, false);
		assert.strictEqual(openSessionTracker.called, false);
	});
});
