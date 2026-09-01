/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IEditorGroupsService, isExcludedFromGlobalEditorAggregation, IAuxiliaryEditorPart } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { URI } from '../../../../../base/common/uri.js';
import { ConversationChatInput, getDefaultConversationChatResource } from '../../browser/conversationChatInput.js';
import '../../browser/conversationEditor.contribution.js';

suite('Conversation editor aggregation exemption (S1a)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationAggregation';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationAggregation';

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	async function createHarness() {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));
		const parts = await createEditorParts(instantiationService, disposables);
		instantiationService.stub(IEditorGroupsService, parts);
		const editorService = instantiationService.invokeFunction(accessor => accessor.get(IEditorService));

		const hostA = document.createElement('div');
		const hostB = document.createElement('div');
		document.body.appendChild(hostA);
		document.body.appendChild(hostB);
		store.add({ dispose: () => { hostA.remove(); hostB.remove(); } });

		const conversationA = parts.createConversationEditorPart(hostA, 'session-a');
		const conversationB = parts.createConversationEditorPart(hostB, 'session-b');
		await Promise.all([conversationA.whenReady, conversationB.whenReady]);

		const extraInput = store.add(instantiationService.createInstance(
			ConversationChatInput,
			getDefaultConversationChatResource('session-a-fork'),
		));
		await conversationA.activeGroup.openEditor(extraInput);

		return { instantiationService, parts, editorService, conversationA, conversationB, extraInput };
	}

	test('conversation parts declare aggregation exclusion and do not implement auxiliary close()', async () => {
		const { conversationA } = await createHarness();
		assert.strictEqual(conversationA.excludeFromGlobalEditorAggregation, true);
		assert.strictEqual(isExcludedFromGlobalEditorAggregation(conversationA), true);
		assert.strictEqual(typeof (conversationA as unknown as IAuxiliaryEditorPart).close, 'undefined');
	});

	test('applyState skips conversation parts and keeps default root input', async () => {
		const { parts, conversationA } = await createHarness();
		const rootEditor = conversationA.activeGroup.getEditorByIndex(0);
		assert.ok(rootEditor instanceof ConversationChatInput);
		assert.strictEqual(rootEditor.isDefaultRoot, true);

		await (parts as unknown as { applyState(state: 'empty'): Promise<boolean> }).applyState('empty');

		assert.ok(parts.conversationParts.includes(conversationA));
		const rootAfterApply = conversationA.activeGroup.getEditorByIndex(0);
		assert.ok(rootAfterApply);
		assert.ok(rootAfterApply.resource);
		assert.strictEqual(rootAfterApply.resource.toString(), rootEditor.resource.toString());
	});

	test('scoped instantiation services are unique per conversation part', async () => {
		const { parts, conversationA, conversationB } = await createHarness();
		const mainScoped = parts.getScopedInstantiationService(parts.mainPart);
		const scopedA = parts.getScopedInstantiationService(conversationA);
		const scopedB = parts.getScopedInstantiationService(conversationB);

		assert.notStrictEqual(scopedA, scopedB);
		assert.notStrictEqual(scopedA, mainScoped);
		assert.notStrictEqual(scopedB, mainScoped);
	});

	test('global editor enumeration excludes conversation chat tabs', async () => {
		const { parts, editorService, conversationA, extraInput } = await createHarness();

		const mainFile = store.add(new TestFileEditorInput(URI.file('/tmp/main-only.txt'), TEST_EDITOR_INPUT_ID));
		await parts.mainPart.activeGroup.openEditor(mainFile);

		conversationA.activeGroup.focus();
		assert.strictEqual(parts.activePart, parts.mainPart);

		const globalEditors = editorService.editors;
		assert.ok(globalEditors.some(editor => editor === mainFile));
		assert.ok(!globalEditors.some(editor => editor === extraInput));
		assert.ok(!globalEditors.some(editor => editor instanceof ConversationChatInput));
	});

	test('getGroups for global navigation excludes conversation groups', async () => {
		const { parts, conversationA } = await createHarness();
		const globalGroupIds = new Set(parts.getGroups().map(group => group.id));
		for (const group of conversationA.groups) {
			assert.ok(!globalGroupIds.has(group.id));
		}
	});
});
