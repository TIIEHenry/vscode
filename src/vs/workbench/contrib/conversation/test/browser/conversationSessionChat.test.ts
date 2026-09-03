/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { DisposableStore, IDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IEditorOptions } from '../../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullTelemetryService } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../../browser/editor.js';
import { IEditorOpenContext, IEditorSerializer, EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { EditorPane } from '../../../../browser/parts/editor/editorPane.js';
import { IEditorGroupsService, IEditorGroup } from '../../../../services/editor/common/editorGroupsService.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import {
	ConversationChatInput,
	ConversationChatInputTypeId,
	getConversationChatResource,
	parseConversationChatResource,
} from '../../browser/conversationChatInput.js';
import { ConversationSessionChatService, IConversationSessionChatService } from '../../browser/conversationSessionChatService.js';
import { isConversationExtensionTab } from '../../common/conversationEditorRouting.js';
import { conversationSubAgentOverlayClass, conversationSubAgentOverlayBackdropClass, conversationSubAgentOverlayCardClass, conversationSubAgentOverlayMaximizeClass, conversationSubAgentOverlayMaximizedAttribute, conversationSubAgentOverlayPopoutClass, conversationSubAgentOverlayTitleId } from '../../browser/conversationSubAgentOverlay.js';
import { ConversationStubService, IConversationRosterService, type ILiveAgentTreeChangeEvent } from '../../browser/conversationStubService.js';
import type { LiveAgentTreeNodeView } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { ConversationDiffReviewInput } from '../../../sources/browser/conversationDiffReviewInput.js';
import { ConversationDiffReviewInputTypeId } from '../../../sources/common/conversationDiffReviewInput.js';
import { ForkConversationAction } from '../../../chat/browser/actions/chatForkActions.js';
import { isDefaultCodeWindow } from '../../../chat/browser/chatShellRouting.js';
import { IChatSessionsService } from '../../../chat/common/chatSessionsService.js';
import { getChatSessionType } from '../../../chat/common/model/chatUri.js';

const TEST_CONVERSATION_CHAT_EDITOR_ID = 'workbench.editor.conversationChat.test';

function registerTestConversationChatEditor(disposables: Pick<DisposableStore, 'add'>): IDisposable {
	class TestConversationChatEditorPane extends EditorPane {
		constructor(group: IEditorGroup) {
			super(TEST_CONVERSATION_CHAT_EDITOR_ID, group, NullTelemetryService, new TestThemeService(), disposables.add(new TestStorageService()));
		}

		layout(): void { }

		protected createEditor(): void { }

		override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
			await super.setInput(input, options, context, token);
		}
	}

	class ConversationChatInputSerializer implements IEditorSerializer {
		canSerialize(input: EditorInput): input is ConversationChatInput {
			return input instanceof ConversationChatInput;
		}

		serialize(input: ConversationChatInput): string | undefined {
			return JSON.stringify({
				resource: input.resource.toString(),
				isDefaultRoot: input.isDefaultRoot,
			});
		}

		deserialize(instantiationService: IInstantiationService, serialized: string): ConversationChatInput | undefined {
			try {
				const parsed = JSON.parse(serialized) as { resource: string; isDefaultRoot?: boolean };
				return instantiationService.createInstance(ConversationChatInput, URI.parse(parsed.resource), { isDefaultRoot: parsed.isDefaultRoot });
			} catch {
				return undefined;
			}
		}
	}

	const paneRegistration = disposables.add(Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
		EditorPaneDescriptor.create(
			TestConversationChatEditorPane,
			TEST_CONVERSATION_CHAT_EDITOR_ID,
			'Conversation Chat Test',
		),
		[new SyncDescriptor(ConversationChatInput)],
	));

	const serializerRegistration = disposables.add(Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
		ConversationChatInputTypeId,
		ConversationChatInputSerializer,
	));

	return toDisposable(() => {
		paneRegistration.dispose();
		serializerRegistration.dispose();
	});
}

const TEST_CONVERSATION_DIFF_REVIEW_EDITOR_ID = 'workbench.editor.conversationDiffReview.test';

function registerTestConversationDiffReviewEditor(disposables: Pick<DisposableStore, 'add'>): IDisposable {
	class TestConversationDiffReviewEditorPane extends EditorPane {
		constructor(group: IEditorGroup) {
			super(TEST_CONVERSATION_DIFF_REVIEW_EDITOR_ID, group, NullTelemetryService, new TestThemeService(), disposables.add(new TestStorageService()));
		}

		layout(): void { }

		protected createEditor(): void { }

		override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
			await super.setInput(input, options, context, token);
		}
	}

	class ConversationDiffReviewInputSerializer implements IEditorSerializer {
		canSerialize(input: EditorInput): input is ConversationDiffReviewInput {
			return input instanceof ConversationDiffReviewInput;
		}

		serialize(input: ConversationDiffReviewInput): string | undefined {
			return JSON.stringify({
				modified: input.modified.toString(),
				original: input.original?.toString(),
			});
		}

		deserialize(instantiationService: IInstantiationService, serialized: string): ConversationDiffReviewInput | undefined {
			try {
				const parsed = JSON.parse(serialized) as { modified: string; original?: string };
				return instantiationService.createInstance(ConversationDiffReviewInput, URI.parse(parsed.modified), parsed.original ? URI.parse(parsed.original) : undefined);
			} catch {
				return undefined;
			}
		}
	}

	const paneRegistration = disposables.add(Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
		EditorPaneDescriptor.create(
			TestConversationDiffReviewEditorPane,
			TEST_CONVERSATION_DIFF_REVIEW_EDITOR_ID,
			'Conversation Diff Review Test',
		),
		[new SyncDescriptor(ConversationDiffReviewInput)],
	));

	const serializerRegistration = disposables.add(Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
		ConversationDiffReviewInputTypeId,
		ConversationDiffReviewInputSerializer,
	));

	return toDisposable(() => {
		paneRegistration.dispose();
		serializerRegistration.dispose();
	});
}

suite('Conversation session chat (S3)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationSessionChat';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationSessionChat';
	const SESSION_KEY = 'untitled';

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;
	let conversationChatEditorRegistered: IDisposable | undefined;
	let conversationDiffReviewEditorRegistered: IDisposable | undefined;

	class TestRosterWithLiveTree extends ConversationStubService {
		private readonly _onDidChangeLiveAgentTree = this._register(new Emitter<ILiveAgentTreeChangeEvent>());
		override readonly onDidChangeLiveAgentTree = this._onDidChangeLiveAgentTree.event;

		fireLiveTree(tree: LiveAgentTreeNodeView, sessionId = SESSION_KEY): void {
			this._onDidChangeLiveAgentTree.fire({ sessionId, tree });
		}
	}

	class TestConversationSessionChatService extends ConversationSessionChatService {
		override async openExtensionTab(sessionKey: string, chatId: string, options?: { title?: string }): Promise<void> {
			const part = this.getConversationPart(sessionKey);
			if (!part) {
				throw new Error(`Conversation editor part for session ${sessionKey} is not available`);
			}

			const resource = getConversationChatResource(sessionKey, chatId);
			const existing = part.activeGroup.editors.find(editor => editor instanceof ConversationChatInput && editor.resource.toString() === resource.toString());
			if (existing instanceof ConversationChatInput) {
				await part.activeGroup.openEditor(existing);
				return;
			}

			const input = store.add(new ConversationChatInput(
				resource,
				{ isDefaultRoot: chatId === 'default', title: options?.title },
			));
			await part.activeGroup.openEditor(input, { pinned: true });
		}

		override async navigateAgentBreadcrumb(sessionKey: string, targetChatId: string): Promise<void> {
			if (this.isSubAgentDialogOpen(sessionKey)) {
				await super.navigateAgentBreadcrumb(sessionKey, targetChatId);
				return;
			}

			const part = this.getConversationPart(sessionKey);
			if (!part) {
				return;
			}

			const activeEditor = part.activeGroup.activeEditor;
			if (!(activeEditor instanceof ConversationChatInput) || activeEditor.isDefaultRoot) {
				return;
			}

			const activeChatId = parseConversationChatResource(activeEditor.resource)?.chatId;
			const activeEntry = activeChatId ? this.getCatalog(sessionKey).find(entry => entry.chatId === activeChatId) : undefined;
			if (!activeEntry || activeEntry.originKind !== 'tool') {
				return;
			}

			if (targetChatId === activeChatId) {
				return;
			}

			const group = part.activeGroup;

			if (targetChatId === 'default') {
				const rootEditor = group.getEditorByIndex(0);
				if (rootEditor instanceof ConversationChatInput && rootEditor.isDefaultRoot) {
					await group.closeEditor(activeEditor);
					await group.openEditor(rootEditor);
				}
				return;
			}

			const targetEntry = this.getCatalog(sessionKey).find(entry => entry.chatId === targetChatId);
			if (!targetEntry) {
				return;
			}

			const replacement = store.add(new ConversationChatInput(
				getConversationChatResource(sessionKey, targetChatId),
				{ isDefaultRoot: false, title: targetEntry.title },
			));
			await group.closeEditor(activeEditor);
			await group.openEditor(replacement, { pinned: true });
		}

		override async closeNonRootTabs(sessionKey?: string): Promise<void> {
			const key = sessionKey ?? (this as unknown as { rosterService: ConversationStubService }).rosterService.getActiveSessionId();
			const part = this.getConversationPart(key);
			if (!part) {
				return;
			}

			this.closeSubAgentDialog(key);

			for (const group of part.groups) {
				for (const editor of [...group.editors]) {
					if (isConversationExtensionTab(editor)) {
						await part.activeGroup.closeEditor(editor);
					}
				}
			}
		}
	}

	class TestConversationForkAction extends ForkConversationAction {
		tryForkAsChat(instantiationService: TestInstantiationService, sourceSessionResource: URI): Promise<boolean> {
			return this._tryForkAsChat(instantiationService, sourceSessionResource, undefined);
		}

		protected override async _tryForkAsChat(
			instantiationService: IInstantiationService,
			sourceSessionResource: URI,
			request: import('../../../chat/common/chatSessionsService.js').IChatSessionRequestHistoryItem | undefined,
		): Promise<boolean> {
			const context = instantiationService.invokeFunction(accessor => {
				if (!isDefaultCodeWindow(accessor)) {
					return undefined;
				}

				const chatSessionsService = accessor.get(IChatSessionsService);
				if (!chatSessionsService.getContentProviderSchemes().includes(getChatSessionType(sourceSessionResource))) {
					return undefined;
				}

				return {
					chatSessionsService,
					sessionChatService: accessor.get(IConversationSessionChatService),
				};
			});

			if (!context) {
				return false;
			}

			const cts = new CancellationTokenSource();
			try {
				const forkedItem = await context.chatSessionsService.forkChatSession(sourceSessionResource, request, cts.token);
				await context.sessionChatService.openForkTab(forkedItem.resource, forkedItem.label);
				return true;
			} finally {
				cts.dispose();
			}
		}
	}

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
		const editorFactory = Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory);
		if (!conversationChatEditorRegistered && !editorFactory.getEditorSerializer(ConversationChatInputTypeId)) {
			conversationChatEditorRegistered = registerTestConversationChatEditor(store);
			store.add(conversationChatEditorRegistered);
		}
		if (!conversationDiffReviewEditorRegistered && !editorFactory.getEditorSerializer(ConversationDiffReviewInputTypeId)) {
			conversationDiffReviewEditorRegistered = registerTestConversationDiffReviewEditor(store);
			store.add(conversationDiffReviewEditorRegistered);
		}
	});

	async function createHarness(rosterService: IConversationRosterService = new ConversationStubService()) {
		const instantiationService = workbenchInstantiationService({
			configurationService: () => new TestConfigurationService({
				workbench: { editor: { enablePreview: false } },
			}),
		}, store);
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));

		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);

		const host = document.createElement('div');
		const sessionBar = document.createElement('div');
		const sessionWindow = document.createElement('div');
		sessionWindow.className = 'conversation-session-window';
		const editorHost = document.createElement('div');
		editorHost.style.width = '800px';
		editorHost.style.height = '600px';
		sessionWindow.appendChild(editorHost);
		document.body.appendChild(host);
		document.body.appendChild(sessionBar);
		document.body.appendChild(sessionWindow);
		store.add({ dispose: () => { host.remove(); sessionBar.remove(); sessionWindow.remove(); } });

		const conversationPart = parts.createConversationEditorPart(editorHost, SESSION_KEY);
		await conversationPart.whenReady;
		(conversationPart as unknown as { layout(width: number, height: number, top: number, left: number): void }).layout(800, 600, 0, 0);
		conversationPart.activeGroup.focus();

		while (conversationPart.activeGroup.count === 0) {
			await timeout(0);
		}

		const sessionChatService = disposables.add(instantiationService.createInstance(TestConversationSessionChatService));
		sessionChatService.mountSubAgentOverlay(SESSION_KEY, sessionWindow);
		store.add(sessionChatService.registerPartListeners(conversationPart));
		if (rosterService instanceof ConversationStubService) {
			store.add(rosterService);
		}

		for (const editor of conversationPart.activeGroup.editors) {
			if (editor instanceof ConversationChatInput) {
				store.add(editor);
			}
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

	function makeLiveAgentTree(children: LiveAgentTreeNodeView[] = []): LiveAgentTreeNodeView {
		return {
			agentId: 'root',
			name: 'Root',
			type: 'AGENT_TYPE_ROOT',
			status: 'AGENT_STATUS_IDLE',
			model: 'm',
			turnCount: 0,
			createdAt: 0,
			children,
		};
	}

	function makeSubAgent(agentId: string, name: string, children: LiveAgentTreeNodeView[] = []): LiveAgentTreeNodeView {
		return {
			agentId,
			name,
			type: 'AGENT_TYPE_SUB',
			status: 'AGENT_STATUS_IDLE',
			model: 'm',
			turnCount: 0,
			createdAt: 0,
			children,
		};
	}

	test('live agent tree syncs non-root nodes into the catalog once', async () => {
		const { sessionChatService } = await createHarness();
		const tree = makeLiveAgentTree([makeSubAgent('research', 'Research')]);
		sessionChatService.syncSubAgentsFromLiveTree(SESSION_KEY, tree);
		sessionChatService.syncSubAgentsFromLiveTree(SESSION_KEY, tree);
		const catalog = sessionChatService.getCatalog(SESSION_KEY);
		assert.strictEqual(catalog.filter(entry => entry.chatId === 'research').length, 1);
		assert.strictEqual(catalog.find(entry => entry.chatId === 'research')?.parentChatId, 'default');
	});

	test('onDidChangeLiveAgentTree registers sub-agent for openSubAgent without reveal', async () => {
		const rosterService = store.add(new TestRosterWithLiveTree());
		const { sessionChatService, sessionWindow } = await createHarness(rosterService);
		const tree = makeLiveAgentTree([makeSubAgent('research', 'Research')]);
		rosterService.fireLiveTree(tree);

		await sessionChatService.openSubAgent(SESSION_KEY, 'research');

		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), true);
		const overlay = sessionWindow.querySelector(`.${conversationSubAgentOverlayClass}:not([hidden])`) as HTMLElement | null;
		assert.ok(overlay);
		assert.strictEqual(overlay.querySelector(`#${conversationSubAgentOverlayTitleId}`)?.textContent, 'Research');
	});

	test('onDidChangeLiveAgentTree resolves breadcrumb without reveal', async () => {
		const rosterService = store.add(new TestRosterWithLiveTree());
		const { sessionChatService } = await createHarness(rosterService);
		const tree = makeLiveAgentTree([
			makeSubAgent('research', 'Research', [makeSubAgent('web', 'Web search')]),
		]);
		rosterService.fireLiveTree(tree);

		const breadcrumb = sessionChatService.getAgentHierarchyBreadcrumb(SESSION_KEY, 'web');
		assert.deepStrictEqual(breadcrumb.map(item => item.chatId), ['default', 'research', 'web']);
	});

	test('onDidChangeLiveAgentTree does not register root agent', async () => {
		const rosterService = store.add(new TestRosterWithLiveTree());
		const { sessionChatService } = await createHarness(rosterService);
		rosterService.fireLiveTree(makeLiveAgentTree());

		const catalog = sessionChatService.getCatalog(SESSION_KEY);
		assert.ok(!catalog.some(entry => entry.chatId === 'root' || entry.chatId === 'default'));
	});

	test('duplicate live tree event does not fire onDidChangeCatalog again', async () => {
		const rosterService = store.add(new TestRosterWithLiveTree());
		const { sessionChatService } = await createHarness(rosterService);
		const tree = makeLiveAgentTree([makeSubAgent('research', 'Research')]);
		let catalogChanges = 0;
		store.add(sessionChatService.onDidChangeCatalog(() => catalogChanges++));

		rosterService.fireLiveTree(tree);
		rosterService.fireLiveTree(tree);

		assert.strictEqual(catalogChanges, 1);
	});

	test('renamed sub-agent updates title and fires onDidChangeCatalog once', async () => {
		const rosterService = store.add(new TestRosterWithLiveTree());
		const { sessionChatService } = await createHarness(rosterService);
		let catalogChanges = 0;
		store.add(sessionChatService.onDidChangeCatalog(() => catalogChanges++));

		rosterService.fireLiveTree(makeLiveAgentTree([makeSubAgent('research', 'Research')]));
		rosterService.fireLiveTree(makeLiveAgentTree([makeSubAgent('research', 'Renamed research')]));

		const entry = sessionChatService.getCatalog(SESSION_KEY).find(item => item.chatId === 'research');
		assert.strictEqual(entry?.title, 'Renamed research');
		assert.strictEqual(catalogChanges, 2);
	});

	test('sub-agent spawn registers catalog entry without opening a tab or dialog', async () => {
		const { conversationPart, sessionChatService, sessionWindow } = await createHarness();

		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Research sub-agent');

		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), false);
		assert.strictEqual(sessionWindow.querySelector(`.${conversationSubAgentOverlayClass}`)?.hasAttribute('hidden'), true);
	});

	test('sub-agent click opens a centered session-leaf dialog while root tab stays mounted', async () => {
		const { conversationPart, sessionChatService, sessionWindow } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Research sub-agent');

		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-1');

		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), true);
		const overlay = sessionWindow.querySelector(`.${conversationSubAgentOverlayClass}:not([hidden])`) as HTMLElement | null;
		assert.ok(overlay);
		assert.strictEqual(overlay.getAttribute('aria-modal'), 'true');
		assert.strictEqual(overlay.getAttribute('aria-labelledby'), conversationSubAgentOverlayTitleId);
		assert.strictEqual(overlay.querySelector(`#${conversationSubAgentOverlayTitleId}`)?.textContent, 'Research sub-agent');
		assert.strictEqual(overlay.getAttribute(conversationSubAgentOverlayMaximizedAttribute), 'false');
		assert.ok(overlay.querySelector(`.${conversationSubAgentOverlayCardClass}`));
		assert.ok(overlay.querySelector(`.${conversationSubAgentOverlayBackdropClass}`));
		assert.ok(overlay.querySelector(`.${conversationSubAgentOverlayPopoutClass}`));
		assert.ok(overlay.querySelector('.conversation-subagent-overlay-session-bar'));
		assert.ok(conversationPart.activeGroup.getEditorByIndex(0) instanceof ConversationChatInput);
		assert.ok(sessionWindow.contains(overlay));
		assert.strictEqual(overlay.closest('.monaco-modal-editor-block'), null);
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

	test('pop-out promotes sub-agent dialog to an extension tab', async () => {
		const { conversationPart, sessionChatService } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Research sub-agent');
		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-1');

		await sessionChatService.promoteSubAgentDialog();

		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), false);
		assert.strictEqual(conversationPart.activeGroup.count, 2);
		assert.ok(sessionChatService.findOpenTabForChat(SESSION_KEY, 'sub-1'));
	});

	test('leaf maximize keeps the sub-agent dialog open without adding a tab', async () => {
		const { conversationPart, sessionChatService, sessionWindow } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Research sub-agent');
		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-1');

		sessionChatService.toggleSubAgentDialogMaximized();

		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), true);
		assert.strictEqual(sessionChatService.isSubAgentDialogMaximized(), true);
		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.strictEqual(
			sessionWindow.querySelector(`.${conversationSubAgentOverlayClass}`)?.getAttribute(conversationSubAgentOverlayMaximizedAttribute),
			'true',
		);
		assert.ok(sessionWindow.querySelector(`.${conversationSubAgentOverlayMaximizeClass}`));
	});

	test('header double-click toggles leaf maximize', async () => {
		const { sessionChatService, sessionWindow } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Research sub-agent');
		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-1');

		const header = sessionWindow.querySelector('.conversation-subagent-overlay-header') as HTMLElement;
		header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		assert.strictEqual(sessionChatService.isSubAgentDialogMaximized(), true);
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), true);
	});

	test('backdrop click closes the sub-agent dialog', async () => {
		const { sessionChatService, sessionWindow } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Research sub-agent');
		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-1');

		const backdrop = sessionWindow.querySelector(`.${conversationSubAgentOverlayBackdropClass}`) as HTMLElement;
		backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), false);
	});

	test('CONVERSATION_GROUP open targets the conversation editor part active group', async () => {
		const { parts, conversationPart, sessionChatService } = await createHarness();

		await sessionChatService.openExtensionTab(SESSION_KEY, 'explicit-target', { title: 'Explicit target' });

		assert.strictEqual(conversationPart.activeGroup.count, 2);
		assert.strictEqual(parts.activePart, parts.mainPart);
		assert.ok(sessionChatService.findOpenTabForChat(SESSION_KEY, 'explicit-target'));
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

	test('dialog breadcrumb root click closes overlay and keeps the root tab', async () => {
		const { conversationPart, sessionChatService } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Parent agent', 'default');
		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-1');

		await sessionChatService.navigateAgentBreadcrumb(SESSION_KEY, 'default');

		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), false);
		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.ok((conversationPart.activeGroup.getEditorByIndex(0) as ConversationChatInput).isDefaultRoot);
	});

	test('dialog breadcrumb ancestor without a tab replaces overlay content', async () => {
		const { conversationPart, sessionChatService } = await createHarness();
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-1', 'Parent agent', 'default');
		sessionChatService.registerSubAgentChat(SESSION_KEY, 'sub-2', 'Child agent', 'sub-1');
		await sessionChatService.openSubAgent(SESSION_KEY, 'sub-2');

		await sessionChatService.navigateAgentBreadcrumb(SESSION_KEY, 'sub-1');

		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(), true);
		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.ok((conversationPart.activeGroup.getEditorByIndex(0) as ConversationChatInput).isDefaultRoot);
		assert.strictEqual(sessionChatService.findOpenTabForChat(SESSION_KEY, 'sub-1'), undefined);
		assert.strictEqual(sessionChatService.findOpenTabForChat(SESSION_KEY, 'sub-2'), undefined);
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

	test('close non-root closes diff review tab but keeps root tab', async () => {
		const { conversationPart, sessionChatService, instantiationService } = await createHarness();
		const reviewInput = store.add(instantiationService.createInstance(
			ConversationDiffReviewInput,
			URI.file('/tmp/close-review-modified.ts'),
			URI.file('/tmp/close-review-original.ts'),
		));
		await conversationPart.activeGroup.openEditor(reviewInput);

		assert.strictEqual(conversationPart.activeGroup.count, 2);
		assert.strictEqual(sessionChatService.canCloseNonRoot(), true);

		await sessionChatService.closeNonRootTabs();

		assert.strictEqual(conversationPart.activeGroup.count, 1);
		assert.ok((conversationPart.activeGroup.activeEditor as ConversationChatInput).isDefaultRoot);
		assert.strictEqual(sessionChatService.canCloseNonRoot(), false);
	});
});
