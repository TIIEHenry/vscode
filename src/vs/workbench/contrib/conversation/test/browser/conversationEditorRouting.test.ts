/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { isBlockedFromConversationGroup, isConversationExtensionTab } from '../../common/conversationEditorRouting.js';
import { registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { ConversationChatInput, getConversationChatResource, getDefaultConversationChatResource } from '../../browser/conversationChatInput.js';
import { ConversationDiffReviewInput } from '../../../sources/browser/conversationDiffReviewInput.js';

suite('Conversation editor routing (F1)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationRouting';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationRouting';

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	test('diff review input is not blocked from conversation group', () => {
		const reviewInput = store.add(new ConversationDiffReviewInput(
			URI.file('/tmp/review-modified.ts'),
			URI.file('/tmp/review-original.ts'),
		));

		assert.strictEqual(isBlockedFromConversationGroup(reviewInput), false);
		assert.strictEqual(isConversationExtensionTab(reviewInput), true);
	});

	test('plain file input is blocked from conversation group', () => {
		const file = store.add(new TestFileEditorInput(URI.file('/tmp/plain.txt'), TEST_EDITOR_INPUT_ID));
		assert.strictEqual(isBlockedFromConversationGroup(file), true);
		assert.strictEqual(isConversationExtensionTab(file), false);
	});

	test('ChatEditorInput is blocked from conversation group', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const chatInput = store.add(instantiationService.createInstance(ChatEditorInput, URI.parse('vscode-chat:session/test'), {}));
		assert.strictEqual(isBlockedFromConversationGroup(chatInput), true);
		assert.strictEqual(isConversationExtensionTab(chatInput), false);
	});

	test('default root conversation chat input is allowed but not an extension tab', () => {
		const rootInput = store.add(new ConversationChatInput(
			getDefaultConversationChatResource('session-root'),
			{ isDefaultRoot: true },
		));

		assert.strictEqual(isBlockedFromConversationGroup(rootInput), false);
		assert.strictEqual(isConversationExtensionTab(rootInput), false);
	});

	test('non-root conversation chat input is an extension tab', () => {
		const extensionInput = store.add(new ConversationChatInput(
			getConversationChatResource('session-fork', 'fork-1'),
		));

		assert.strictEqual(isBlockedFromConversationGroup(extensionInput), false);
		assert.strictEqual(isConversationExtensionTab(extensionInput), true);
	});
});
