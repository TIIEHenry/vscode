/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ConversationPart, IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { IConversationEditorPart, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { ConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { ConversationSessionChatService } from '../../browser/conversationSessionChatService.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { conversationSessionLeafHiddenClass } from '../../common/conversationSessionWindow.js';

suite('Conversation session window side-by-side (S5)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationSideBySide';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationSideBySide';

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	teardown(async () => {
		await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	});

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	function layoutConversationEditorParts(parts: Awaited<ReturnType<typeof createEditorParts>>): void {
		for (const part of parts.conversationParts) {
			(part as { layout(width: number, height: number, top: number, left: number): void }).layout(800, 600, 0, 0);
		}
	}

	function trackConversationEditors(parts: Awaited<ReturnType<typeof createEditorParts>>): void {
		for (const part of parts.conversationParts) {
			for (const editor of part.activeGroup.editors) {
				store.add(editor);
			}
		}
	}

	async function createHarness() {
		const rosterService = new ConversationStubService();
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));

		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);

		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		conversationPart.create(parent);
		instantiationService.stub(IConversationPartService, conversationPart);

		const sessionWindowService = disposables.add(instantiationService.createInstance(ConversationSessionWindowService));
		const sessionChatService = disposables.add(instantiationService.createInstance(ConversationSessionChatService));
		store.add(rosterService);

		const primaryId = rosterService.getActiveSessionId();
		await sessionWindowService.ensurePrimaryWindow(primaryId);
		layoutConversationEditorParts(parts);
		trackConversationEditors(parts);

		return { parts, conversationPart, rosterService, sessionWindowService, sessionChatService, primaryId };
	}

	async function createSideBySideHarness() {
		const harness = await createHarness();
		const secondaryId = harness.rosterService.createSession();
		harness.rosterService.switchSession(harness.primaryId);

		await harness.sessionWindowService.openSessionBeside(secondaryId);
		layoutConversationEditorParts(harness.parts);
		trackConversationEditors(harness.parts);

		return { ...harness, secondaryId };
	}

	function createPrimaryBootstrapHarness() {
		const rosterService = store.add(new ConversationStubService());
		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

		let throwOnCreate = true;
		const conversationParts: IConversationEditorPart[] = [];
		const editorGroupsService = {
			createConversationEditorPart: (_parent: unknown, sessionKey: string) => {
				if (throwOnCreate) {
					throw new Error('primary bootstrap boom');
				}
				const part = { sessionKey, whenReady: Promise.resolve() } as IConversationEditorPart;
				conversationParts.push(part);
				return part;
			},
			get conversationParts() {
				return conversationParts;
			},
		} as IEditorGroupsService;

		const sessionWindowService = store.add(new ConversationSessionWindowService(
			{
				onDidCreateSlots: Event.None,
				onDidFocus: Event.None,
				getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined }),
				focus: () => { },
			} as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
		));

		return {
			sessionWindowService,
			gridHost,
			primaryId: rosterService.getActiveSessionId(),
			setThrowOnCreate(value: boolean) {
				throwOnCreate = value;
			},
		};
	}

	test('openSessionBeside creates two conversation editor parts in two leaves', async () => {
		const { parts, sessionWindowService, primaryId, secondaryId } = await createSideBySideHarness();

		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(parts.conversationParts.length, 2);
		assert.ok(parts.conversationParts.some(part => part.sessionKey === primaryId));
		assert.ok(parts.conversationParts.some(part => part.sessionKey === secondaryId));
	});

	test('two session windows share one preview editor part', async () => {
		const { parts, sessionWindowService } = await createSideBySideHarness();

		assert.strictEqual(parts.conversationParts.length, 2);
		assert.ok(parts.mainPart.groups.length >= 1);
		assert.strictEqual(parts.parts.filter(part => part === parts.mainPart).length, 1);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
	});

	test('hide second session window leaves one visible leaf and preserves editor model', async () => {
		const { parts, sessionWindowService, secondaryId } = await createSideBySideHarness();
		const secondaryPart = parts.conversationParts.find(part => part.sessionKey === secondaryId);
		assert.ok(secondaryPart);
		const editorsBefore = secondaryPart.activeGroup.count;

		sessionWindowService.hideSessionWindow(secondaryId);

		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(secondaryId), true);
		assert.strictEqual(parts.conversationParts.length, 2);
		assert.strictEqual(secondaryPart.activeGroup.count, editorsBefore);

		const leaf = sessionWindowService.getLeafSlots(secondaryId);
		assert.ok(leaf?.container.classList.contains(conversationSessionLeafHiddenClass));
	});

	test('restore hidden session window shows side-by-side layout again', async () => {
		const { sessionWindowService, secondaryId } = await createSideBySideHarness();

		sessionWindowService.hideSessionWindow(secondaryId);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);

		sessionWindowService.restoreSessionWindow(secondaryId);

		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
		const leaf = sessionWindowService.getLeafSlots(secondaryId);
		assert.ok(leaf);
		assert.ok(!leaf.container.classList.contains(conversationSessionLeafHiddenClass));
	});

	test('openSessionBeside on hidden session restores without creating a third part', async () => {
		const { parts, sessionWindowService, secondaryId } = await createSideBySideHarness();

		sessionWindowService.hideSessionWindow(secondaryId);
		await sessionWindowService.openSessionBeside(secondaryId);

		assert.strictEqual(parts.conversationParts.length, 2);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
	});

	test('splitSessionWindow targets a specific parallel session part by session key', async () => {
		const { parts, sessionChatService, primaryId, secondaryId } = await createSideBySideHarness();
		const primaryPart = parts.conversationParts.find(part => part.sessionKey === primaryId);
		const secondaryPart = parts.conversationParts.find(part => part.sessionKey === secondaryId);
		assert.ok(primaryPart);
		assert.ok(secondaryPart);

		await sessionChatService.splitSessionWindow(secondaryId);

		assert.strictEqual(secondaryPart.groups.length, 2);
		assert.strictEqual(primaryPart.groups.length, 1);
	});

	test('ConversationPart.layout fans leaf host size to each conversation editor part', async () => {
		const { conversationPart, parts, sessionWindowService, primaryId, secondaryId } = await createSideBySideHarness();
		const primaryEditor = parts.conversationParts.find(part => part.sessionKey === primaryId);
		const secondaryEditor = parts.conversationParts.find(part => part.sessionKey === secondaryId);
		assert.ok(primaryEditor);
		assert.ok(secondaryEditor);
		assert.strictEqual(primaryEditor.contentDimension.width, 800);
		assert.strictEqual(primaryEditor.contentDimension.height, 600);

		const resized = { width: 640, height: 480 };
		for (const sessionKey of [primaryId, secondaryId]) {
			const host = sessionWindowService.getLeafSlots(sessionKey)?.editorPartHost;
			assert.ok(host);
			Object.defineProperty(host, 'clientWidth', { configurable: true, get: () => resized.width });
			Object.defineProperty(host, 'clientHeight', { configurable: true, get: () => resized.height });
		}

		conversationPart.layout(1280, 502, 0, 0);

		assert.strictEqual(primaryEditor.contentDimension.width, resized.width);
		assert.strictEqual(primaryEditor.contentDimension.height, resized.height);
		assert.strictEqual(secondaryEditor.contentDimension.width, resized.width);
		assert.strictEqual(secondaryEditor.contentDimension.height, resized.height);
	});

	test('ensurePrimaryWindow createConversationEditorPart throw does not stick a half primary', async () => {
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const harness = createPrimaryBootstrapHarness();
			void harness.sessionWindowService.ensurePrimaryWindow(harness.primaryId);
			await timeout(0);

			assert.deepStrictEqual(unhandledRejections, []);
			assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), undefined);
			assert.strictEqual(harness.sessionWindowService.getAllLeafSessionKeys().length, 0);
			assert.strictEqual(harness.sessionWindowService.getLeafSlots(harness.primaryId), undefined);
			assert.strictEqual(harness.gridHost.querySelector('.conversation-session-leaf'), null);

			harness.setThrowOnCreate(false);
			await harness.sessionWindowService.ensurePrimaryWindow(harness.primaryId);

			assert.deepStrictEqual(unhandledRejections, []);
			assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), harness.primaryId);
			assert.ok(harness.sessionWindowService.getLeafSlots(harness.primaryId));
			assert.strictEqual(harness.sessionWindowService.getVisibleWindowCount(), 1);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
