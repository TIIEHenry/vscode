/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { Emitter } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { GroupDirection, IConversationEditorPart, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { HistoryService } from '../../../../services/history/browser/historyService.js';
import { IHistoryService } from '../../../../services/history/common/history.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { TestFileEditorInput, createEditorParts, registerTestEditor, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationChatInput, getConversationChatResource } from '../../common/conversationChatInput.js';
import { ConversationNavigationService } from '../../browser/conversationNavigationService.js';
import { IConversationSessionChatService, IConversationSubAgentDialogChange } from '../../common/conversationSessionChat.js';
import { CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING } from '../../common/conversationNavigation.js';
import { ConversationDiffReviewInputTypeId } from '../../../../common/editor/conversationDiffReviewInput.js';
import { registerTestConversationDiffReviewEditor } from './conversationDiffReviewTestEditor.js';
import '../../browser/conversationEditor.contribution.js';
import { ConversationEditorPane } from '../../browser/conversationEditorPane.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { installConversationLensResizeObserverHarness } from './conversationLensLayoutHarness.js';
import { createEmptyConversationSessionChatService, stubConversationLensRuntimeServices, stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';

installConversationLensResizeObserverHarness();

suite('Conversation navigation stack', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationNavigationStack';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationNavigationStack';

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
		const editorFactory = Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory);
		if (!editorFactory.getEditorSerializer(ConversationDiffReviewInputTypeId)) {
			store.add(registerTestConversationDiffReviewEditor(store));
		}
	});

	teardown(async () => {
		await new Promise<void>(resolve => mainWindow.requestAnimationFrame(() => mainWindow.requestAnimationFrame(() => resolve())));
	});

	async function waitForConversationPane(part: IConversationEditorPart): Promise<ConversationEditorPane> {
		await part.whenReady;
		const deadline = Date.now() + 3000;
		while (Date.now() < deadline) {
			const pane = part.activeGroup.activeEditorPane;
			if (pane instanceof ConversationEditorPane && pane.activeConversationLens) {
				return pane;
			}
			await new Promise(resolve => setTimeout(resolve, 20));
		}
		throw new Error(`ConversationEditorPane not ready for ${part.sessionKey}`);
	}

	async function createHarness(sessionChat: IConversationSessionChatService) {
		const configurationService = new TestConfigurationService({
			[CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING]: true,
		});
		const instantiationService = workbenchInstantiationService(undefined, store);
		const rosterService = store.add(new ConversationStubService());
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		stubConversationTimelineLinkServices(instantiationService);
		stubConversationLensRuntimeServices(instantiationService);
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(IConversationSessionChatService, sessionChat);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));

		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);

		const editorService = disposables.add(instantiationService.createInstance(EditorService, undefined));
		instantiationService.stub(IEditorService, editorService);
		const historyService = disposables.add(instantiationService.createInstance(HistoryService));
		instantiationService.stub(IHistoryService, historyService);

		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const part = parts.createConversationEditorPart(host, 'session-a');
		await waitForConversationPane(part);
		store.add({ dispose: () => parts.disposeConversationEditorPart('session-a') });

		const navigationService = disposables.add(instantiationService.createInstance(ConversationNavigationService));
		disposables.add(navigationService.registerPart(part));
		const root = part.activeGroup.activeEditor;
		assert.ok(root instanceof ConversationChatInput && root.isDefaultRoot);
		store.add(root);

		return { navigationService, part, root };
	}

	function createExtensionTab(suffix: string): ConversationChatInput {
		return store.add(new ConversationChatInput(getConversationChatResource('session-a', suffix)));
	}

	function stackShape(service: ConversationNavigationService, part: IConversationEditorPart): Array<{ groupId: number; subAgentChatId?: string }> {
		const stacks = (service as unknown as {
			stacks: Map<IConversationEditorPart, { stack: Array<{ groupId: number; subAgentChatId?: string }>; index: number }>;
		}).stacks;
		const nav = stacks.get(part);
		assert.ok(nav);
		return nav.stack.map(entry => ({ groupId: entry.groupId, subAgentChatId: entry.subAgentChatId }));
	}

	test('back after leaving a dialog on an open parent still forwards to that dialog', async () => {
		const dialogEvents = store.add(new Emitter<IConversationSubAgentDialogChange>());
		const opened: Array<{ sessionKey: string; chatId: string }> = [];
		const sessionChat: IConversationSessionChatService = {
			...createEmptyConversationSessionChatService(),
			onDidChangeSubAgentDialog: dialogEvents.event,
			openSubAgent: async (sessionKey: string, chatId: string) => { opened.push({ sessionKey, chatId }); },
		};
		const { navigationService, part, root } = await createHarness(sessionChat);
		const group = part.activeGroup;
		const parent = createExtensionTab('parent');
		await group.openEditor(parent, { pinned: true });
		await group.openEditor(root, { pinned: true });
		dialogEvents.fire({ sessionKey: 'session-a', kind: 'show', chatId: 'child' });
		await group.openEditor(parent, { pinned: true });
		dialogEvents.fire({ sessionKey: 'session-a', kind: 'leave' });

		await navigationService.goBack(part);
		const afterBack = {
			activeIsRoot: group.activeEditor === root,
			parentOpen: group.editors.includes(parent),
			canGoBack: navigationService.canGoBack(part),
			canGoForward: navigationService.canGoForward(part),
		};
		await navigationService.goForward(part);

		assert.deepStrictEqual({ afterBack, opened }, {
			afterBack: { activeIsRoot: true, parentOpen: false, canGoBack: false, canGoForward: true },
			opened: [{ sessionKey: 'session-a', chatId: 'child' }],
		});
	});

	test('back off the tab under a left dialog still forwards to that dialog', async () => {
		const dialogEvents = store.add(new Emitter<IConversationSubAgentDialogChange>());
		const opened: Array<{ sessionKey: string; chatId: string }> = [];
		const sessionChat: IConversationSessionChatService = {
			...createEmptyConversationSessionChatService(),
			onDidChangeSubAgentDialog: dialogEvents.event,
			openSubAgent: async (sessionKey: string, chatId: string) => { opened.push({ sessionKey, chatId }); },
		};
		const { navigationService, part, root } = await createHarness(sessionChat);
		const group = part.activeGroup;
		const parent = createExtensionTab('under-dialog');
		await group.openEditor(parent, { pinned: true });
		dialogEvents.fire({ sessionKey: 'session-a', kind: 'show', chatId: 'child' });
		dialogEvents.fire({ sessionKey: 'session-a', kind: 'leave' });

		await navigationService.goBack(part);
		const afterBack = {
			activeIsRoot: group.activeEditor === root,
			parentOpen: group.editors.includes(parent),
			canGoForward: navigationService.canGoForward(part),
		};
		await navigationService.goForward(part);

		assert.deepStrictEqual({ afterBack, opened }, {
			afterBack: { activeIsRoot: true, parentOpen: false, canGoForward: true },
			opened: [{ sessionKey: 'session-a', chatId: 'child' }],
		});
	});

	test('forward after leaving nested dialogs reopens the dialog just left', async () => {
		const dialogEvents = store.add(new Emitter<IConversationSubAgentDialogChange>());
		const opened: Array<{ sessionKey: string; chatId: string }> = [];
		const sessionChat: IConversationSessionChatService = {
			...createEmptyConversationSessionChatService(),
			onDidChangeSubAgentDialog: dialogEvents.event,
			openSubAgent: async (sessionKey: string, chatId: string) => { opened.push({ sessionKey, chatId }); },
		};
		const { navigationService, part } = await createHarness(sessionChat);
		const parent = createExtensionTab('nested-parent');
		dialogEvents.fire({ sessionKey: 'session-a', kind: 'show', chatId: 'outer' });
		dialogEvents.fire({ sessionKey: 'session-a', kind: 'show', chatId: 'inner' });
		await part.activeGroup.openEditor(parent, { pinned: true });
		dialogEvents.fire({ sessionKey: 'session-a', kind: 'leave' });

		await navigationService.goForward(part);

		assert.deepStrictEqual(opened, [{ sessionKey: 'session-a', chatId: 'inner' }]);
	});

	test('back onto the same extension tab does not close it', async () => {
		const sessionChat: IConversationSessionChatService = createEmptyConversationSessionChatService();
		const { navigationService, part } = await createHarness(sessionChat);
		const group = part.activeGroup;
		const parent = createExtensionTab('same-tab');
		await group.openEditor(parent, { pinned: true });
		const stacks = (navigationService as unknown as {
			stacks: Map<IConversationEditorPart, { stack: Array<{ groupId: number; editor: unknown }>; index: number }>;
		}).stacks;
		const nav = stacks.get(part);
		assert.ok(nav);
		nav.stack.splice(0, nav.stack.length,
			{ groupId: group.id, editor: parent },
			{ groupId: group.id, editor: parent },
		);
		nav.index = 1;

		await navigationService.goBack(part);

		assert.deepStrictEqual({
			parentOpen: group.editors.includes(parent),
			activeIsParent: group.activeEditor === parent,
		}, {
			parentOpen: true,
			activeIsParent: true,
		});
	});

	test('push at max capacity still makes the new step current', async () => {
		const sessionChat: IConversationSessionChatService = createEmptyConversationSessionChatService();
		const { navigationService, part, root } = await createHarness(sessionChat);
		const group = part.activeGroup;
		const stacks = (navigationService as unknown as {
			stacks: Map<IConversationEditorPart, { stack: Array<{ groupId: number; editor: ConversationChatInput }>; index: number; push(entry: { groupId: number; editor: ConversationChatInput }): void; current?: { editor: ConversationChatInput } }>;
		}).stacks;
		const nav = stacks.get(part);
		assert.ok(nav);
		for (let i = 0; i < 50; i++) {
			nav.stack.push({ groupId: group.id, editor: root });
		}
		nav.index = 30;
		const latest = createExtensionTab('max-stack');
		nav.push({ groupId: group.id, editor: latest });

		assert.strictEqual(nav.index, 49);
		assert.strictEqual(nav.current?.editor, latest);
	});

	test('a dialog opened while another column is active keeps the editor column', async () => {
		const dialogEvents = store.add(new Emitter<IConversationSubAgentDialogChange>());
		const sessionChat: IConversationSessionChatService = {
			...createEmptyConversationSessionChatService(),
			onDidChangeSubAgentDialog: dialogEvents.event,
		};
		const { navigationService, part } = await createHarness(sessionChat);
		const rootGroup = part.activeGroup;
		const parent = createExtensionTab('column-parent');
		await rootGroup.openEditor(parent, { pinned: true });
		const side = part.addGroup(rootGroup, GroupDirection.RIGHT);
		part.activateGroup(side);
		dialogEvents.fire({ sessionKey: 'session-a', kind: 'show', chatId: 'child' });

		assert.deepStrictEqual(stackShape(navigationService, part).at(-1), {
			groupId: rootGroup.id,
			subAgentChatId: 'child',
		});
	});
});
