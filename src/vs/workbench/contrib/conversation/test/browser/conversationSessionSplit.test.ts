/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { findGroup } from '../../../../services/editor/common/editorGroupFinder.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { CONVERSATION_SIDE_GROUP, SIDE_GROUP } from '../../../../services/editor/common/editorService.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { getDefaultConversationChatResource } from '../../browser/conversationChatInput.js';
import '../../browser/conversationEditor.contribution.js';
import { ConversationSessionChatService } from '../../browser/conversationSessionChatService.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';

suite('Conversation session split (S4)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationSplit';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationSplit';
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

		const editorHost = document.createElement('div');
		document.body.appendChild(editorHost);
		store.add({ dispose: () => editorHost.remove() });

		const conversationPart = parts.createConversationEditorPart(editorHost, SESSION_KEY);
		await conversationPart.whenReady;

		const sessionChatService = disposables.add(instantiationService.createInstance(ConversationSessionChatService));
		store.add(sessionChatService.registerPartListeners(conversationPart));
		store.add(rosterService);

		for (const editor of conversationPart.activeGroup.editors) {
			store.add(editor);
		}

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
