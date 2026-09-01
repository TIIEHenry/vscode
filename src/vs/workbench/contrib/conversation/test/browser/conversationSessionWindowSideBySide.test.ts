/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ConversationPart, IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
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

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

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
		trackConversationEditors(parts);

		return { parts, rosterService, sessionWindowService, sessionChatService, primaryId };
	}

	async function createSideBySideHarness() {
		const harness = await createHarness();
		const secondaryId = harness.rosterService.createSession();
		harness.rosterService.switchSession(harness.primaryId);

		await harness.sessionWindowService.openSessionBeside(secondaryId);
		trackConversationEditors(harness.parts);

		return { ...harness, secondaryId };
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
});
