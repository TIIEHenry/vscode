/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { findGroup } from '../../../../services/editor/common/editorGroupFinder.js';
import { CONVERSATION_GROUP, CONVERSATION_SIDE_GROUP, SIDE_GROUP } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { ConversationChatInput, getDefaultConversationChatResource } from '../../browser/conversationChatInput.js';
import '../../browser/conversationEditor.contribution.js';

suite('Conversation editor fence', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const TEST_EDITOR_ID = 'MyFileEditorForConversationFence';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationFence';

	const disposables = new DisposableStore();

	setup(() => {
		disposables.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	teardown(() => {
		disposables.clear();
	});

	async function createHarness() {
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));
		const parts = await createEditorParts(instantiationService, disposables);
		instantiationService.stub(IEditorGroupsService, parts);

		const conversationHost = document.createElement('div');
		document.body.appendChild(conversationHost);
		disposables.add({ dispose: () => conversationHost.remove() });

		const conversationPart = parts.createConversationEditorPart(conversationHost, 'session-a');
		await conversationPart.whenReady;
		conversationPart.activeGroup.focus();

		return { instantiationService, parts, conversationPart };
	}

	test('CONVERSATION_GROUP constants are defined', () => {
		assert.strictEqual(CONVERSATION_GROUP, -5);
		assert.strictEqual(CONVERSATION_SIDE_GROUP, -6);
	});

	test('openEditor(file) while conversation focused routes to main editor part', async () => {
		const { instantiationService, parts, conversationPart } = await createHarness();
		const file = disposables.add(new TestFileEditorInput(URI.file('/tmp/fence.txt'), TEST_EDITOR_INPUT_ID));

		const [group] = instantiationService.invokeFunction(accessor => findGroup(accessor, file, undefined)) as [typeof parts.mainPart.activeGroup, unknown];
		assert.strictEqual(parts.getPart(group), parts.mainPart);
		assert.notStrictEqual(parts.getPart(group), conversationPart);
	});

	test('SIDE_GROUP never targets conversation editor part', async () => {
		const { instantiationService, parts, conversationPart } = await createHarness();
		const file = disposables.add(new TestFileEditorInput(URI.file('/tmp/side.txt'), TEST_EDITOR_INPUT_ID));
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
		const file = disposables.add(new TestFileEditorInput(URI.file('/tmp/reject.txt'), TEST_EDITOR_INPUT_ID));

		const [group] = instantiationService.invokeFunction(accessor => findGroup(accessor, file, CONVERSATION_GROUP)) as [typeof parts.mainPart.activeGroup, unknown];
		assert.strictEqual(parts.getPart(group), parts.mainPart);
		assert.notStrictEqual(parts.getPart(group), conversationPart);
	});

	test('ChatEditorInput is blocked from conversation groups', async () => {
		const { instantiationService, parts, conversationPart } = await createHarness();
		const chatInput = disposables.add(instantiationService.createInstance(ChatEditorInput, URI.parse('vscode-chat:session/test'), {}));

		const [group] = instantiationService.invokeFunction(accessor => findGroup(accessor, chatInput, CONVERSATION_GROUP)) as [typeof parts.mainPart.activeGroup, unknown];
		assert.strictEqual(parts.getPart(group), parts.mainPart);
		assert.notStrictEqual(parts.getPart(group), conversationPart);
	});

	test('conversation input opens in conversation part when explicitly requested', async () => {
		const { instantiationService, parts } = await createHarness();
		const conversationInput = disposables.add(instantiationService.createInstance(
			ConversationChatInput,
			getDefaultConversationChatResource('session-b'),
		));

		const [targetGroup] = instantiationService.invokeFunction(accessor => findGroup(accessor, conversationInput, CONVERSATION_GROUP)) as [typeof parts.mainPart.activeGroup, unknown];
		assert.ok(parts.conversationParts.some(part => part.groups.some(g => g.id === targetGroup.id)));
	});
});
