/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { IEditorOptions } from '../../../../../../../platform/editor/common/editor.js';
import { IConversationPartService } from '../../../../../../browser/parts/conversation/conversationPart.js';
import { ConversationPart } from '../../../../../../browser/parts/conversation/conversationPart.js';
import { EditorInput } from '../../../../../../common/editor/editorInput.js';
import { IEditorPane } from '../../../../../../common/editor.js';
import { PreferredGroup } from '../../../../../../services/editor/common/editorService.js';
import { workbenchInstantiationService, TestEditorService, TestEnvironmentService } from '../../../../../../test/browser/workbenchTestServices.js';
import { focusConversationPart } from '../../../../browser/actions/chatActions.js';
import { OpenAgentSessionInEditorGroupAction, OpenAgentSessionInNewEditorGroupAction, OpenAgentSessionInNewWindowAction } from '../../../../browser/agentSessions/agentSessionsActions.js';
import { IAgentSession } from '../../../../browser/agentSessions/agentSessionsModel.js';
import { IChatWidgetService } from '../../../../browser/chat.js';
import { ChatEditor } from '../../../../browser/widgetHosts/editor/chatEditor.js';
import { ChatEditorInput, ChatEditorInputWorkbenchSerializer } from '../../../../browser/widgetHosts/editor/chatEditorInput.js';
import { LocalChatSessionUri } from '../../../../common/model/chatUri.js';
import { MockChatWidgetService } from '../../widget/mockChatWidget.js';

suite('default-window ChatEditor shell paths', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function setup(): {
		instantiationService: ReturnType<typeof workbenchInstantiationService>;
		editorService: TestEditorService;
		openSessionTracker: { called: boolean };
	} {
		const openSessionTracker = { called: false };
		const editorService = store.add(new TestEditorService());
		const originalOpenEditor = editorService.openEditor.bind(editorService);
		(editorService as { openEditor: (...args: unknown[]) => Promise<IEditorPane | undefined> }).openEditor = async (editor, optionsOrGroup?, group?) => {
			if (editor instanceof EditorInput) {
				editorService.activeEditor = editor;
			}
			return originalOpenEditor(editor as EditorInput, optionsOrGroup as IEditorOptions, group as PreferredGroup);
		};

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
		instantiationService.stub(IConversationPartService, conversationPart);
		instantiationService.stub(IChatWidgetService, widgetService);

		return { instantiationService, editorService, openSessionTracker };
	}

	const mockSession = { resource: LocalChatSessionUri.forSession('shell-path-test') } as IAgentSession;

	test('ChatEditor and ChatEditorInput types remain registered donor sources', () => {
		assert.strictEqual(ChatEditorInput.TypeID, 'workbench.input.chatSession');
		assert.strictEqual(ChatEditorInput.EditorID, 'workbench.editor.chatSession');
		assert.ok(ChatEditor);
	});

	test('ChatEditorInputWorkbenchSerializer canSerialize is false in default Code window', () => {
		const { instantiationService } = setup();
		const serializer = instantiationService.createInstance(ChatEditorInputWorkbenchSerializer);
		const sessionResource = LocalChatSessionUri.forSession('serialize-test');
		const input = { sessionResource } as ChatEditorInput;

		assert.strictEqual(serializer.canSerialize(input), false);
	});

	test('workbench.action.chat.openInEditor does not open ChatEditorInput as active editor', async () => {
		const { instantiationService, editorService, openSessionTracker } = setup();
		await instantiationService.invokeFunction(accessor => focusConversationPart(accessor));

		assert.strictEqual(editorService.activeEditor instanceof ChatEditorInput, false);
		assert.strictEqual(openSessionTracker.called, false);
	});

	test('workbench.action.chat.openSessionInEditorGroup does not open ChatEditorInput as active editor', async () => {
		const { instantiationService, editorService, openSessionTracker } = setup();
		const action = instantiationService.createInstance(OpenAgentSessionInEditorGroupAction);
		await instantiationService.invokeFunction(accessor => action.runWithSessions([mockSession], accessor));

		assert.strictEqual(editorService.activeEditor instanceof ChatEditorInput, false);
		assert.strictEqual(openSessionTracker.called, false);
	});

	test('workbench.action.chat.openSessionInNewEditorGroup does not open ChatEditorInput as active editor', async () => {
		const { instantiationService, editorService, openSessionTracker } = setup();
		const action = instantiationService.createInstance(OpenAgentSessionInNewEditorGroupAction);
		await instantiationService.invokeFunction(accessor => action.runWithSessions([mockSession], accessor));

		assert.strictEqual(editorService.activeEditor instanceof ChatEditorInput, false);
		assert.strictEqual(openSessionTracker.called, false);
	});

	test('workbench.action.chat.openSessionInNewWindow does not open ChatEditorInput as active editor', async () => {
		const { instantiationService, editorService, openSessionTracker } = setup();
		const action = instantiationService.createInstance(OpenAgentSessionInNewWindowAction);
		await instantiationService.invokeFunction(accessor => action.runWithSessions([mockSession], accessor));

		assert.strictEqual(editorService.activeEditor instanceof ChatEditorInput, false);
		assert.strictEqual(openSessionTracker.called, false);
	});
});
