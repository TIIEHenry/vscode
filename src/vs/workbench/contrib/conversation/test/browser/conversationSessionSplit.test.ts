/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { findGroup } from '../../../../services/editor/common/editorGroupFinder.js';
import { IEditorGroupsService, type IConversationEditorPart } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { CONVERSATION_SIDE_GROUP, IEditorService, SIDE_GROUP } from '../../../../services/editor/common/editorService.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { getDefaultConversationChatResource } from '../../common/conversationChatInput.js';
import '../../browser/conversationEditor.contribution.js';
import { ConversationChatTablistKeyboard } from '../../browser/conversationSplitActions.contribution.js';
import { ConversationEditorPane } from '../../browser/conversationEditorPane.js';
import { ConversationSessionChatService, IConversationSessionChatService } from '../../browser/conversationSessionChatService.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { stubConversationLensRuntimeServices, stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';
import { installConversationLensResizeObserverHarness } from './conversationLensLayoutHarness.js';

declare function __readFileInTests(path: string): Promise<string>;

suite('Conversation session split (S4)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationSplit';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationSplit';
	const SESSION_KEY = 'untitled';

	installConversationLensResizeObserverHarness();

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	teardown(async () => {
		await new Promise<void>(resolve => mainWindow.requestAnimationFrame(() => mainWindow.requestAnimationFrame(() => resolve())));
	});

	function layoutConversationEditorPart(part: IConversationEditorPart): void {
		part.layout(800, 600, 0, 0);
	}

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

	async function createHarness() {
		const rosterService = new ConversationStubService();
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		stubConversationLensRuntimeServices(instantiationService);
		stubConversationTimelineLinkServices(instantiationService);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));

		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);
		const editorService = disposables.add(instantiationService.createInstance(EditorService, undefined));
		instantiationService.stub(IEditorService, editorService);

		const sessionChatService = disposables.add(instantiationService.createInstance(ConversationSessionChatService));
		instantiationService.stub(IConversationSessionChatService, sessionChatService);

		const editorHost = document.createElement('div');
		editorHost.style.width = '800px';
		editorHost.style.height = '600px';
		document.body.appendChild(editorHost);
		store.add({ dispose: () => editorHost.remove() });

		const conversationPart = parts.createConversationEditorPart(editorHost, SESSION_KEY);
		await waitForPane(conversationPart);
		layoutConversationEditorPart(conversationPart);
		trackEditors(conversationPart);
		conversationPart.activeGroup.focus();

		store.add(sessionChatService.registerPartListeners(conversationPart));
		store.add(rosterService);

		return { instantiationService, parts, conversationPart, sessionChatService, rosterService };
	}

	test('CONVERSATION_SIDE_GROUP increases conversation editor part group count', async () => {
		const { instantiationService, conversationPart } = await createHarness();
		const resource = getDefaultConversationChatResource(SESSION_KEY);
		const groupsBefore = conversationPart.groups.length;

		instantiationService.invokeFunction(accessor => findGroup(accessor, { resource }, CONVERSATION_SIDE_GROUP));

		assert.strictEqual(conversationPart.groups.length, groupsBefore + 1);
	});

	test('splitSessionWindow adds a second group in the same conversation part', async () => {
		const { conversationPart, sessionChatService } = await createHarness();

		await sessionChatService.splitSessionWindow();

		assert.strictEqual(conversationPart.groups.length, 2);
	});

	test('file SIDE_GROUP increases preview groups only', async () => {
		const { instantiationService, parts, conversationPart } = await createHarness();
		const file = store.add(new TestFileEditorInput(URI.file('/tmp/split-preview.txt'), TEST_EDITOR_INPUT_ID));
		const conversationGroupsBefore = conversationPart.groups.length;
		const mainGroupsBefore = parts.mainPart.groups.length;

		conversationPart.activeGroup.focus();
		instantiationService.invokeFunction(accessor => findGroup(accessor, file, SIDE_GROUP));

		assert.strictEqual(conversationPart.groups.length, conversationGroupsBefore);
		assert.ok(parts.mainPart.groups.length > mainGroupsBefore);
	});

	test('hide split column preserves group model without rendering the column', async () => {
		const { conversationPart, sessionChatService } = await createHarness();

		await sessionChatService.splitSessionWindow();
		const sideGroup = conversationPart.groups.at(1);
		assert.ok(sideGroup);

		const editorsBefore = sideGroup.count;
		sessionChatService.hideSplitColumn(undefined, sideGroup.id);

		assert.strictEqual(conversationPart.groups.length, 2);
		assert.strictEqual(conversationPart.isGroupHidden(sideGroup.id), true);
		assert.strictEqual(sideGroup.count, editorsBefore);
	});

	test('show split column restores hidden column rendering', async () => {
		const { conversationPart, sessionChatService } = await createHarness();

		await sessionChatService.splitSessionWindow();
		const sideGroup = conversationPart.groups.at(1);
		assert.ok(sideGroup);

		sessionChatService.hideSplitColumn(undefined, sideGroup.id);
		sessionChatService.showSplitColumn(undefined, sideGroup.id);

		assert.strictEqual(conversationPart.isGroupHidden(sideGroup.id), false);
	});
});

suite('Conversation chat tablist keyboard leftover (D548)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	async function assertWarnThenRethrowDoesNotLeak(paintBoom: Error, run: () => void): Promise<void> {
		// cycleSameConversationChatTablist returns a Promise. A lone
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

	test('does not leak unhandled rejection when tablist cycle openEditor rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('paint boom');
		const editorA = { id: 'chat-a' };
		const editorB = { id: 'chat-b' };
		const group = {
			count: 2,
			activeEditor: editorA,
			getEditors: () => [editorA, editorB],
			openEditor: () => Promise.reject(paintBoom),
		};
		const part = {
			groups: [group],
			activeGroup: group,
			isGroupHidden: () => false,
		};

		const instantiationService = workbenchInstantiationService(undefined, store);
		const layoutService = instantiationService.get(IWorkbenchLayoutService);
		(layoutService as { hasFocus(part: Parts): boolean }).hasFocus = (part: Parts) => part === Parts.CONVERSATION_PART;
		instantiationService.stub(IEditorGroupsService, {
			getActiveConversationEditorPart: () => part,
		} as unknown as IEditorGroupsService);
		store.add(instantiationService.createInstance(ConversationChatTablistKeyboard));

		const host = document.createElement('div');
		host.className = 'conversation-editor-part-host';
		const tablist = document.createElement('div');
		tablist.className = 'tabs-container';
		tablist.setAttribute('role', 'tablist');
		const tab = document.createElement('div');
		tab.className = 'tab';
		tablist.appendChild(tab);
		host.appendChild(tablist);
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			const event = new KeyboardEvent('keydown', {
				key: 'ArrowRight',
				code: 'ArrowRight',
				bubbles: true,
				cancelable: true,
			});
			Object.defineProperty(event, 'keyCode', { get: () => 39 });
			tab.dispatchEvent(event);
		});
	});

	test('tablist cycle fire-and-forget voids double-catch onUnexpectedError', async () => {
		const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationSplitActions.contribution.ts`);
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes(`void cycleSameConversationChatTablist(this.editorGroupsService, delta).then(() => {\n\t\t\tfocusActiveConversationChatTab(tablistHost);\n\t\t})${doubleCatch};`));
		assert.ok(!source.includes('void cycleSameConversationChatTablist(this.editorGroupsService, delta).then(() => {\n\t\t\tfocusActiveConversationChatTab(tablistHost);\n\t\t});'));
	});
});
