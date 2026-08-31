/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { registerAction2 } from '../../../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../../../platform/commands/common/commands.js';
import { IConversationPartService } from '../../../../../../browser/parts/conversation/conversationPart.js';
import { ConversationPart } from '../../../../../../browser/parts/conversation/conversationPart.js';
import { EditorInput } from '../../../../../../common/editor/editorInput.js';
import { IEditorService } from '../../../../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../../../../services/environment/common/environmentService.js';
import { workbenchInstantiationService, TestEditorService } from '../../../../../../test/browser/workbenchTestServices.js';
import { registerMoveActions } from '../../../../browser/actions/chatMoveActions.js';
import { OpenAgentSessionInEditorGroupAction, OpenAgentSessionInNewEditorGroupAction } from '../../../../browser/agentSessions/agentSessionsActions.js';
import { IAgentSession } from '../../../../browser/agentSessions/agentSessionsModel.js';
import { IChatWidgetService } from '../../../../browser/chat.js';
import { ChatEditor } from '../../../../browser/widgetHosts/editor/chatEditor.js';
import { ChatEditorInput, ChatEditorInputWorkbenchSerializer } from '../../../../browser/widgetHosts/editor/chatEditorInput.js';
import { LocalChatSessionUri } from '../../../../common/model/chatUri.js';
import { MockChatWidgetService } from '../../widget/mockChatWidget.js';

suite('default-window ChatEditor shell paths', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	let moveActionsRegistered = false;
	let agentSessionActionsRegistered = false;

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

		if (!moveActionsRegistered) {
			registerMoveActions();
			moveActionsRegistered = true;
		}
		if (!agentSessionActionsRegistered) {
			registerAction2(OpenAgentSessionInEditorGroupAction);
			registerAction2(OpenAgentSessionInNewEditorGroupAction);
			agentSessionActionsRegistered = true;
		}

		return { instantiationService, editorService, openSessionTracker };
	}

	async function runCommand(instantiationService: ReturnType<typeof workbenchInstantiationService>, commandId: string, ...args: unknown[]): Promise<void> {
		const command = CommandsRegistry.getCommand(commandId);
		assert.ok(command, `Command ${commandId} should be registered`);
		await instantiationService.invokeFunction(command.handler, ...args);
	}

	const mockSession = { resource: LocalChatSessionUri.forSession('shell-path-test') } as IAgentSession;

	test('ChatEditor and ChatEditorInput types remain registered donor sources', () => {
		assert.strictEqual(ChatEditorInput.TypeID, 'workbench.input.chatSession');
		assert.strictEqual(ChatEditorInput.EditorID, 'workbench.editor.chatSession');
		assert.ok(ChatEditor);
	});

	test('ChatEditorInputWorkbenchSerializer canSerialize is false in default Code window', () => {
		const { instantiationService } = setup();
		const serializer = store.add(instantiationService.createInstance(ChatEditorInputWorkbenchSerializer));
		const sessionResource = LocalChatSessionUri.forSession('serialize-test');
		const input = { sessionResource } as ChatEditorInput;

		assert.strictEqual(serializer.canSerialize(input), false);
	});

	test('workbench.action.chat.openInEditor does not open ChatEditorInput as active editor', async () => {
		const { instantiationService, editorService, openSessionTracker } = setup();
		await runCommand(instantiationService, 'workbench.action.chat.openInEditor');

		assert.strictEqual(editorService.activeEditor instanceof ChatEditorInput, false);
		assert.strictEqual(openSessionTracker.called, false);
	});

	test('workbench.action.chat.openSessionInEditorGroup does not open ChatEditorInput as active editor', async () => {
		const { instantiationService, editorService, openSessionTracker } = setup();
		await runCommand(instantiationService, OpenAgentSessionInEditorGroupAction.id, mockSession);

		assert.strictEqual(editorService.activeEditor instanceof ChatEditorInput, false);
		assert.strictEqual(openSessionTracker.called, false);
	});

	test('workbench.action.chat.openSessionInNewEditorGroup does not open ChatEditorInput as active editor', async () => {
		const { instantiationService, editorService, openSessionTracker } = setup();
		await runCommand(instantiationService, OpenAgentSessionInNewEditorGroupAction.id, mockSession);

		assert.strictEqual(editorService.activeEditor instanceof ChatEditorInput, false);
		assert.strictEqual(openSessionTracker.called, false);
	});
});
