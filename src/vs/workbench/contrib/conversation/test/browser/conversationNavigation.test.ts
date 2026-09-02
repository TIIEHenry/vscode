/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { isResourceEditorInput } from '../../../../common/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { HistoryService } from '../../../../services/history/browser/historyService.js';
import { IHistoryService } from '../../../../services/history/common/history.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { ConversationChatInput, getConversationChatResource, getDefaultConversationChatResource } from '../../browser/conversationChatInput.js';
import { ConversationDiffReviewInput } from '../../../sources/browser/conversationDiffReviewInput.js';
import { ConversationNavigationService } from '../../browser/conversationNavigationService.js';
import { CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING } from '../../common/conversationNavigation.js';
import '../../browser/conversationEditor.contribution.js';
import '../../../sources/browser/conversationDiffReview.contribution.js';

suite('Conversation navigation (S2)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationNavigation';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationNavigation';

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	async function createHarness(options?: { closeChildOnBack?: boolean }) {
		const configurationService = new TestConfigurationService({
			[CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING]: options?.closeChildOnBack ?? true,
		});

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));

		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);

		const editorService = disposables.add(instantiationService.createInstance(EditorService, undefined));
		instantiationService.stub(IEditorService, editorService);

		const historyService = disposables.add(instantiationService.createInstance(HistoryService));
		instantiationService.stub(IHistoryService, historyService);

		const hostA = document.createElement('div');
		const hostB = document.createElement('div');
		document.body.appendChild(hostA);
		document.body.appendChild(hostB);
		store.add({ dispose: () => { hostA.remove(); hostB.remove(); } });

		const conversationA = parts.createConversationEditorPart(hostA, 'session-a');
		const conversationB = parts.createConversationEditorPart(hostB, 'session-b');
		await Promise.all([conversationA.whenReady, conversationB.whenReady]);

		const navigationService = disposables.add(instantiationService.createInstance(ConversationNavigationService));
		disposables.add(navigationService.registerPart(conversationA));
		disposables.add(navigationService.registerPart(conversationB));

		for (const part of [conversationA, conversationB]) {
			const rootEditor = part.activeGroup.getEditorByIndex(0);
			if (rootEditor) {
				store.add(rootEditor);
			}
		}

		return {
			instantiationService,
			parts,
			editorService,
			historyService,
			navigationService,
			conversationA,
			conversationB,
			configurationService,
		};
	}

	function createExtensionTab(sessionKey: string, suffix: string): ConversationChatInput {
		return store.add(new ConversationChatInput(
			getConversationChatResource(sessionKey, suffix),
		));
	}

	test('conversation stacks are isolated per session window', async () => {
		const { navigationService, conversationA, conversationB } = await createHarness();

		const tabA = createExtensionTab('session-a', 'fork');
		const tabB = createExtensionTab('session-b', 'fork');

		await conversationA.activeGroup.openEditor(tabA);
		await conversationB.activeGroup.openEditor(tabB);

		assert.strictEqual(conversationA.activeGroup.activeEditor, tabA);
		assert.strictEqual(conversationB.activeGroup.activeEditor, tabB);

		await navigationService.goBack(conversationA);

		assert.notStrictEqual(conversationA.activeGroup.activeEditor, tabA);
		assert.ok(conversationA.activeGroup.activeEditor instanceof ConversationChatInput);
		assert.strictEqual((conversationA.activeGroup.activeEditor as ConversationChatInput).isDefaultRoot, true);
		assert.strictEqual(conversationB.activeGroup.activeEditor, tabB);
	});

	test('closeChildOnBack closes extension tab when navigating back', async () => {
		const { navigationService, conversationA } = await createHarness({ closeChildOnBack: true });

		const tabA = createExtensionTab('session-a', 'child');
		await conversationA.activeGroup.openEditor(tabA);
		assert.strictEqual(conversationA.activeGroup.count, 2);

		await navigationService.goBack(conversationA);

		assert.strictEqual(conversationA.activeGroup.count, 1);
		assert.strictEqual((conversationA.activeGroup.activeEditor as ConversationChatInput).isDefaultRoot, true);
	});

	test('closeChildOnBack false keeps extension tab when navigating back', async () => {
		const { navigationService, conversationA } = await createHarness({ closeChildOnBack: false });

		const tabA = createExtensionTab('session-a', 'keep');
		await conversationA.activeGroup.openEditor(tabA);
		assert.strictEqual(conversationA.activeGroup.count, 2);

		await navigationService.goBack(conversationA);

		assert.strictEqual(conversationA.activeGroup.count, 2);
		assert.strictEqual((conversationA.activeGroup.activeEditor as ConversationChatInput).isDefaultRoot, true);
	});

	test('closeChildOnBack closes diff review tab when navigating back', async () => {
		const { navigationService, conversationA, instantiationService } = await createHarness({ closeChildOnBack: true });

		const reviewInput = store.add(instantiationService.createInstance(
			ConversationDiffReviewInput,
			URI.file('/tmp/nav-review-modified.ts'),
			URI.file('/tmp/nav-review-original.ts'),
		));
		await conversationA.activeGroup.openEditor(reviewInput);
		assert.strictEqual(conversationA.activeGroup.count, 2);

		await navigationService.goBack(conversationA);

		assert.strictEqual(conversationA.activeGroup.count, 1);
		assert.strictEqual((conversationA.activeGroup.activeEditor as ConversationChatInput).isDefaultRoot, true);
	});

	test('conversation tab open does not write IHistoryService', async () => {
		const { editorService, historyService, conversationA } = await createHarness();

		const mainFile = store.add(new TestFileEditorInput(URI.file('/tmp/preview-only.txt'), TEST_EDITOR_INPUT_ID));
		await editorService.openEditor(mainFile);

		const historyAfterMain = historyService.getHistory();
		assert.ok(historyAfterMain.some(entry => isResourceEditorInput(entry) && entry.resource?.toString() === mainFile.resource.toString()));

		const tabA = createExtensionTab('session-a', 'hist');
		await conversationA.activeGroup.openEditor(tabA);
		conversationA.activeGroup.focus();

		const historyAfterConversation = historyService.getHistory();
		assert.strictEqual(historyAfterConversation.length, historyAfterMain.length);
		assert.ok(!historyAfterConversation.some(entry => {
			if (!isResourceEditorInput(entry) || !entry.resource) {
				return false;
			}
			return entry.resource.scheme === tabA.resource.scheme && entry.resource.path.includes('hist');
		}));
	});
});
