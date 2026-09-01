/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { CONVERSATION_GROUP, IEditorService } from '../../../../services/editor/common/editorService.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import {
	ConversationChatInput,
	getConversationChatResource,
	parseConversationChatResource,
} from '../../browser/conversationChatInput.js';
import '../../browser/conversationEditor.contribution.js';
import { ConversationSessionChatService, IConversationSessionChatService } from '../../browser/conversationSessionChatService.js';
import { conversationSubAgentOverlayClass } from '../../browser/conversationSubAgentOverlay.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { ForkConversationAction } from '../../../chat/browser/actions/chatForkActions.js';
import { IChatSessionsService } from '../../../chat/common/chatSessionsService.js';

class TestConversationForkAction extends ForkConversationAction {
	tryForkAsChat(instantiationService: TestInstantiationService, sourceSessionResource: URI): Promise<boolean> {
		return this._tryForkAsChat(instantiationService, sourceSessionResource, undefined);
	}
}

suite('Conversation session chat (S3)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationSessionChat';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationSessionChat';
	const SESSION_KEY = 'untitled';

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	async function createHarness() {
		const rosterService = new ConversationStubService();
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));

		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);

		const host = document.createElement('div');
		const sessionBar = document.createElement('div');
		const sessionWindow = document.createElement('div');
		const editorHost = document.createElement('div');
		sessionWindow.appendChild(editorHost);
		document.body.appendChild(host);
		document.body.appendChild(sessionBar);
		document.body.appendChild(sessionWindow);
		store.add({ dispose: () => { host.remove(); sessionBar.remove(); sessionWindow.remove(); } });

		const conversationPart = parts.createConversationEditorPart(editorHost, SESSION_KEY);
		await conversationPart.whenReady;

		const sessionChatService = disposables.add(instantiationService.createInstance(ConversationSessionChatService));
		sessionChatService.mountSubAgentOverlay(sessionWindow, sessionBar);
		store.add(sessionChatService.registerPartListeners(conversationPart));

		for (const editor of conversationPart.activeGroup.editors) {
			store.add(editor);
		}

		return { instantiationService, parts, conversationPart, sessionChatService, rosterService, sessionWindow, sessionBar };
	}

	test('parseConversationChatResource round-trips session and chat ids', () => {
		const resource = getConversationChatResource('session a', 'fork-1');
		assert.deepStrictEqual(parseConversationChatResource(resource), {
			sessionKey: 'session a',
			chatId: 'fork-1',
			isDefaultRoot: false,
		});
	});

	test('fork opens an extension tab in CONVERSATION_GROUP, not main editor part', async () => {
		const { parts, conversationPart, sessionChatService, rosterService } = await createHarness();
		const rosterCountBefore = rosterService.getSessions().length;

		await sessionChatService.openForkTab(URI.parse('agent-host-copilot:/demo#peer-fork'), 'Forked peer');

		assert.strictEqual(rosterService.getSessions().length, rosterCountBefore);
		assert.strictEqual(conversationPart.activeGroup.count, 2);
		assert.strictEqual(conversationPart.groups.length, 1);
		assert.ok(conversationPart.activeGroup.activeEditor instanceof ConversationChatInput);
		assert.strictEqual((conversationPart.activeGroup.activeEditor as ConversationChatInput).isDefaultRoot, false);

		const mainFile = store.add(new TestFileEditorInput(URI.file('/tmp/preview-only.txt'), TEST_EDITOR_INPUT_ID));
		await parts.mainPart.activeGroup.openEditor(mainFile);
		assert.strictEqual(parts.mainPart.activeGroup.count, 1);
		assert.ok(!parts.mainPart.activeGroup.editors.some(editor => editor instanceof ConversationChatInput));

		const catalog = sessionChatService.getCatalog(SESSION_KEY);
		assert.strictEqual(catalog.length, 1);
		assert.strictEqual(catalog[0]?.originKind, 'fork');
	});

	test('default-window fork action routes through conversation tabs without sessions imports', async () => {
		const { instantiationService, conversationPart, sessionChatService } = await createHarness();
		instantiationService.stub(IWorkbenchEnvironmentService, upcastPartial<IWorkbenchEnvironmentService>({ isSessionsWindow: false }));
		instantiationService.stub(IConversationSessionChatService, sessionChatService);

		const sourceSessionResource = URI.parse('agent-host-copilot:/fork-source');
		const forkedResource = URI.parse('agent-host-copilot:/fork-source#peer-1');
		let forkCalls = 0;
		instantiationService.stub(IChatSessionsService, upcastPartial<IChatSessionsService>({
			getContentProviderSchemes: () => ['agent-host-copilot'],
			forkChatSession: async () => {
				forkCalls++;
				return {
					resource: forkedResource,
					label: 'Forked peer',
					iconPath: undefined,
					timing: { created: 0, lastRequestStarted: 0, lastRequestEnded: 0 },
				};
			},
		}));

		const handled = await new TestConversationForkAction().tryForkAsChat(instantiationService, sourceSessionResource);
		assert.strictEqual(handled, true);
		assert.strictEqual(forkCalls, 1);
		assert.strictEqual(conversationPart.activeGroup.count, 2);
		assert.ok(sessionChatService.findOpenTabForChat(SESSION_KEY, 'peer-1'));
	});

	test('sub-agent spawn registers catalog entry without opening a tab or dialog', async () => {
		const { conversationPart, sessionChatService, sessionWindow } = await createHarness();

		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Research sub-agent');

		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), false);
		assert.strictEqual(sessionWindow.querySelector(`.${conversationSubAgentOverlayClass}`)?.hasAttribute('hidden'), true);
	});

	test('sub-agent click opens session-leaf dialog while root tab stays mounted', async () => {
		const { conversationPart, sessionChatService, sessionWindow } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Research sub-agent');

		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-1');

		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), true);
		assert.ok(sessionWindow.querySelector(`.${conversationSubAgentOverlayClass}:not([hidden])`));
		assert.ok(conversationPart.activeGroup.getEditorByIndex(0) instanceof ConversationChatInput);
	});

	test('clicking a sub-agent with an existing tab activates the tab instead of opening a dialog', async () => {
		const { conversationPart, sessionChatService } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Research sub-agent');
		await sessionChatService.openExtensionTab(SESSION_KEY, 'sub-1', { title: 'Research sub-agent' });

		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-1');

		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), false);
		assert.strictEqual(conversationPart.activeGroup.count, 2);
		assert.strictEqual((conversationPart.activeGroup.activeEditor as ConversationChatInput).resource.toString(), getConversationChatResource(SESSION_KEY, 'sub-1').toString());
	});

	test('maximize promotes sub-agent dialog to an extension tab', async () => {
		const { conversationPart, sessionChatService } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Research sub-agent');
		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-1');

		await sessionChatService.maximizeSubAgentDialog();

		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), false);
		assert.strictEqual(conversationPart.activeGroup.count, 2);
		assert.ok(sessionChatService.findOpenTabForChat(SESSION_KEY, 'sub-1'));
	});

	test('CONVERSATION_GROUP open targets the conversation editor part active group', async () => {
		const { parts, conversationPart } = await createHarness();
		const resource = getConversationChatResource(SESSION_KEY, 'explicit-target');
		const input = store.add(new ConversationChatInput(resource));

		const editorService = parts.getScopedInstantiationService(conversationPart).invokeFunction(accessor => accessor.get(IEditorService));
		const result = await editorService.openEditor(input, CONVERSATION_GROUP);
		assert.ok(result);
		assert.strictEqual(conversationPart.activeGroup.count, 2);
		assert.strictEqual(parts.activePart, parts.mainPart);
	});

	test('sub-agent extension tab breadcrumb follows origin.chat chain', async () => {
		const { sessionChatService } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Parent agent', 'default');
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-2', 'Child agent', 'sub-1');
		await sessionChatService.openExtensionTab(SESSION_KEY, 'sub-2', { title: 'Child agent' });

		const breadcrumb = sessionChatService.getAgentHierarchyBreadcrumb(SESSION_KEY, 'sub-2');
		assert.deepStrictEqual(breadcrumb.map(item => item.chatId), ['default', 'sub-1', 'sub-2']);
		assert.strictEqual(breadcrumb.at(-1)?.isCurrent, true);
	});

	test('breadcrumb ancestor click replaces current extension tab without stacking tabs', async () => {
		const { conversationPart, sessionChatService } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Parent agent', 'default');
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-2', 'Child agent', 'sub-1');
		await sessionChatService.openExtensionTab(SESSION_KEY, 'sub-2', { title: 'Child agent' });

		await sessionChatService.navigateAgentBreadcrumb(SESSION_KEY, 'sub-1');

		assert.strictEqual(conversationPart.activeGroup.count, 2);
		assert.strictEqual(conversationPart.groups.length, 1);
		assert.strictEqual(
			(conversationPart.activeGroup.activeEditor as ConversationChatInput).resource.toString(),
			getConversationChatResource(SESSION_KEY, 'sub-1').toString(),
		);
		assert.ok(!sessionChatService.findOpenTabForChat(SESSION_KEY, 'sub-2'));
	});

	test('breadcrumb root click closes extension tab and activates root tab', async () => {
		const { conversationPart, sessionChatService } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Parent agent', 'default');
		await sessionChatService.openExtensionTab(SESSION_KEY, 'sub-1', { title: 'Parent agent' });

		await sessionChatService.navigateAgentBreadcrumb(SESSION_KEY, 'default');

		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.strictEqual(conversationPart.groups.length, 1);
		assert.ok((conversationPart.activeGroup.activeEditor as ConversationChatInput).isDefaultRoot);
	});

	test('close non-root closes extension tabs but keeps root group', async () => {
		const { conversationPart, sessionChatService } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Sub agent one', 'default');
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-2', 'Sub agent two', 'default');
		await sessionChatService.openExtensionTab(SESSION_KEY, 'sub-1', { title: 'Sub agent one' });
		await sessionChatService.openExtensionTab(SESSION_KEY, 'sub-2', { title: 'Sub agent two' });

		assert.strictEqual(conversationPart.activeGroup.count, 3);
		assert.strictEqual(sessionChatService.canCloseNonRoot(), true);

		await sessionChatService.closeNonRootTabs();

		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.strictEqual(conversationPart.groups.length, 1);
		assert.ok((conversationPart.activeGroup.activeEditor as ConversationChatInput).isDefaultRoot);
		assert.strictEqual(sessionChatService.canCloseNonRoot(), false);
	});

	test('close non-root closes dialog and leaves only root tab', async () => {
		const { conversationPart, sessionChatService } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Sub agent', 'default');
		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-1');

		assert.strictEqual(sessionChatService.canCloseNonRoot(), true);
		await sessionChatService.closeNonRootTabs();

		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), false);
		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.ok((conversationPart.activeGroup.activeEditor as ConversationChatInput).isDefaultRoot);
	});
});
