/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { EditorInputCapabilities } from '../../../common/editor.js';
import { TestInstantiationService } from '../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { getConversationChatResource, getDefaultConversationChatResource } from '../common/conversationChatInput.js';
import { ConversationChatInputSerializer } from './conversationEditor.contribution.js';

suite('ConversationEditorContribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('deserialize restores default-root identity from the chat resource when stale isDefaultRoot is false', () => {
		const instantiationService = store.add(new TestInstantiationService());
		const serializer = new ConversationChatInputSerializer();
		const resource = getDefaultConversationChatResource('session-restore-root');
		const serialized = JSON.stringify({
			resource: resource.toString(),
			isDefaultRoot: false,
		});

		const restored = serializer.deserialize(instantiationService, serialized);
		if (restored) {
			store.add(restored);
		}

		assert.ok(restored);
		assert.strictEqual(restored.isDefaultRoot, true);
		assert.notStrictEqual(restored.capabilities & EditorInputCapabilities.CannotClose, 0);
	});

	test('deserialize restores non-root identity from the chat resource when stale isDefaultRoot is true', () => {
		const instantiationService = store.add(new TestInstantiationService());
		const serializer = new ConversationChatInputSerializer();
		const resource = getConversationChatResource('session-restore-child', 'agent-child');
		const serialized = JSON.stringify({
			resource: resource.toString(),
			isDefaultRoot: true,
		});

		const restored = serializer.deserialize(instantiationService, serialized);
		if (restored) {
			store.add(restored);
		}

		assert.ok(restored);
		assert.strictEqual(restored.isDefaultRoot, false);
		assert.strictEqual(restored.capabilities & EditorInputCapabilities.CannotClose, 0);
	});
});
