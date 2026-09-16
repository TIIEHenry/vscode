/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { findGroup } from '../../../../services/editor/common/editorGroupFinder.js';
import { CONVERSATION_GROUP, CONVERSATION_SIDE_GROUP, IEditorService, SIDE_GROUP } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService, type IConversationEditorPart } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { ConversationChatInput, getConversationChatResource, getDefaultConversationChatResource } from '../../common/conversationChatInput.js';
import { IConversationSessionChatService } from '../../common/conversationSessionChat.js';
import { ConversationDiffReviewInput } from '../../../sources/browser/conversationDiffReviewInput.js';
import '../../browser/conversationEditor.contribution.js';
import { ConversationEditorPane } from '../../browser/conversationEditorPane.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { createEmptyConversationSessionChatService, stubConversationLensRuntimeServices, stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';
import { installConversationLensResizeObserverHarness } from './conversationLensLayoutHarness.js';

suite('Conversation editor fence', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationFence';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationFence';

	installConversationLensResizeObserverHarness();

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	teardown(async () => {
		await new Promise<void>(resolve => mainWindow.requestAnimationFrame(() => mainWindow.requestAnimationFrame(() => resolve())));
	});

	function trackEditors(part: IConversationEditorPart): void {
		for (const editor of part.activeGroup.editors) {
			store.add(editor);
		}
	}

	async function waitForPane(part: IConversationEditorPart): Promise<ConversationEditorPane> {
		await part.whenReady;
		const deadline = Date.now() + 3000;
		while (Date.now() < deadline) {
			const pane = part.activeGroup.activeEditorPane;
			if (pane instanceof ConversationEditorPane && pane.activeConversationLens) {
				return pane;
			}
			await timeout(20);
		}
		throw new Error(`ConversationEditorPane not ready for ${part.sessionKey}; got ${part.activeGroup.activeEditorPane?.getId()}`);
	}

	setup(function () {
		this.timeout(20_000);
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	async function assertWarnThenRethrowDoesNotLeak(paintBoom: Error, run: () => void): Promise<void> {
		// Overlay leftover already locks session-chat `navigateAgentBreadcrumb`.
		// This pane click is a separate fire-and-forget. A lone
		// `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			run();
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	}

	async function createHarness(options?: { sessionChat?: IConversationSessionChatService }) {
		const rosterService = store.add(new ConversationStubService());
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		stubConversationLensRuntimeServices(instantiationService);
		stubConversationTimelineLinkServices(instantiationService);
		if (options?.sessionChat) {
			instantiationService.stub(IConversationSessionChatService, options.sessionChat);
		}
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));
		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);
		const editorService = disposables.add(instantiationService.createInstance(EditorService, undefined));
		instantiationService.stub(IEditorService, editorService);

		const conversationHost = document.createElement('div');
		conversationHost.style.width = '800px';
		conversationHost.style.height = '600px';
		document.body.appendChild(conversationHost);
		disposables.add({ dispose: () => conversationHost.remove() });

		const conversationPart = parts.createConversationEditorPart(conversationHost, 'session-a');
		await waitForPane(conversationPart);
		conversationPart.layout(800, 600, 0, 0);
		trackEditors(conversationPart);
		conversationPart.activeGroup.focus();

		return { instantiationService, parts, conversationPart };
	}

	test('CONVERSATION_GROUP constants are defined', () => {
		assert.strictEqual(CONVERSATION_GROUP, -5);
		assert.strictEqual(CONVERSATION_SIDE_GROUP, -6);
	});

	test('openEditor(file) while conversation focused routes to main editor part', async () => {
		const { instantiationService, parts, conversationPart } = await createHarness();
		const file = store.add(new TestFileEditorInput(URI.file('/tmp/fence.txt'), TEST_EDITOR_INPUT_ID));

		const [group] = instantiationService.invokeFunction(accessor => findGroup(accessor, file, undefined)) as [typeof parts.mainPart.activeGroup, unknown];
		assert.strictEqual(parts.getPart(group), parts.mainPart);
		assert.notStrictEqual(parts.getPart(group), conversationPart);
	});

	test('SIDE_GROUP never targets conversation editor part', async () => {
		const { instantiationService, parts, conversationPart } = await createHarness();
		const file = store.add(new TestFileEditorInput(URI.file('/tmp/side.txt'), TEST_EDITOR_INPUT_ID));
		const conversationGroupsBefore = conversationPart.groups.length;
		const mainGroupsBefore = parts.mainPart.groups.length;

		const [group] = instantiationService.invokeFunction(accessor => findGroup(accessor, file, SIDE_GROUP)) as [typeof parts.mainPart.activeGroup, unknown];
		assert.strictEqual(parts.getPart(group), parts.mainPart);
		assert.strictEqual(conversationPart.groups.length, conversationGroupsBefore);
		assert.ok(parts.mainPart.groups.length > mainGroupsBefore);
		assert.notStrictEqual(parts.getPart(group), conversationPart);
	});

	test('CONVERSATION_GROUP + file is rejected to main editor part', async () => {
		const { instantiationService, parts, conversationPart } = await createHarness();
		const file = store.add(new TestFileEditorInput(URI.file('/tmp/reject.txt'), TEST_EDITOR_INPUT_ID));

		const [group] = instantiationService.invokeFunction(accessor => findGroup(accessor, file, CONVERSATION_GROUP)) as [typeof parts.mainPart.activeGroup, unknown];
		assert.strictEqual(parts.getPart(group), parts.mainPart);
		assert.notStrictEqual(parts.getPart(group), conversationPart);
	});

	test('ChatEditorInput is blocked from conversation groups', async () => {
		const { instantiationService, parts, conversationPart } = await createHarness();
		const chatInput = store.add(instantiationService.createInstance(ChatEditorInput, URI.parse('vscode-chat:session/test'), {}));

		const [group] = instantiationService.invokeFunction(accessor => findGroup(accessor, chatInput, CONVERSATION_GROUP)) as [typeof parts.mainPart.activeGroup, unknown];
		assert.strictEqual(parts.getPart(group), parts.mainPart);
		assert.notStrictEqual(parts.getPart(group), conversationPart);
	});

	test('conversation input opens in conversation part when explicitly requested', async () => {
		const { instantiationService, parts } = await createHarness();
		const conversationInput = store.add(instantiationService.createInstance(
			ConversationChatInput,
			getDefaultConversationChatResource('session-b'),
		));

		const [targetGroup] = instantiationService.invokeFunction(accessor => findGroup(accessor, conversationInput, CONVERSATION_GROUP)) as [typeof parts.mainPart.activeGroup, unknown];
		assert.ok(parts.conversationParts.some(part => part.groups.some(g => g.id === targetGroup.id)));
	});

	test('CONVERSATION_GROUP + diff review input opens in conversation part', async () => {
		const { instantiationService, parts } = await createHarness();
		const reviewInput = store.add(instantiationService.createInstance(
			ConversationDiffReviewInput,
			URI.file('/tmp/fence-modified.ts'),
			URI.file('/tmp/fence-original.ts'),
		));

		const [targetGroup] = instantiationService.invokeFunction(accessor => findGroup(accessor, reviewInput, CONVERSATION_GROUP)) as [typeof parts.mainPart.activeGroup, unknown];
		assert.ok(parts.conversationParts.some(part => part.groups.some(g => g.id === targetGroup.id)));
	});

	test('diff review input without explicit conversation group throws', async () => {
		const { instantiationService } = await createHarness();
		const reviewInput = store.add(instantiationService.createInstance(
			ConversationDiffReviewInput,
			URI.file('/tmp/fence-throw-modified.ts'),
			URI.file('/tmp/fence-throw-original.ts'),
		));

		assert.throws(() => {
			instantiationService.invokeFunction(accessor => findGroup(accessor, reviewInput, undefined));
		}, /explicit conversation group target/);
	});

	test('does not leak unhandled rejection when editor pane breadcrumb navigate rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('paint boom');
		const { conversationPart } = await createHarness({
			sessionChat: {
				...createEmptyConversationSessionChatService(),
				getAgentHierarchyBreadcrumb: () => [
					{ chatId: 'default', title: 'Root session', isCurrent: false },
					{ chatId: 'sub-1', title: 'Child agent', isCurrent: true },
				],
				navigateAgentBreadcrumb: async () => {
					throw paintBoom;
				},
			},
		});
		const input = store.add(new ConversationChatInput(
			getConversationChatResource('session-a', 'sub-1'),
			{ isDefaultRoot: false, title: 'Child agent' },
		));
		await conversationPart.activeGroup.openEditor(input, { pinned: true });
		const pane = await waitForPane(conversationPart);
		trackEditors(conversationPart);
		pane.layout({ width: 800, height: 400 });
		const ancestor = [...(pane.getContainer()?.querySelectorAll('.conversation-agent-breadcrumb-item') ?? [])].find(element => {
			return element.getAttribute('aria-current') !== 'location';
		}) as HTMLElement | undefined;
		assert.ok(ancestor, 'missing editor pane breadcrumb ancestor');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => ancestor.click());
	});
});
