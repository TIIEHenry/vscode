/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { getErrorMessage } from '../../../../../base/common/errors.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { isResourceEditorInput, EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { IConversationEditorPart, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { HistoryService } from '../../../../services/history/browser/historyService.js';
import { IHistoryService } from '../../../../services/history/common/history.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { ConversationChatInput, getConversationChatResource } from '../../common/conversationChatInput.js';
import { ConversationDiffReviewInput } from '../../../sources/browser/conversationDiffReviewInput.js';
import { ConversationNavigationService } from '../../browser/conversationNavigationService.js';
import { CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING } from '../../common/conversationNavigation.js';
import { ConversationDiffReviewInputTypeId } from '../../../sources/common/conversationDiffReviewInput.js';
import { registerTestConversationDiffReviewEditor } from './conversationDiffReviewTestEditor.js';
import '../../browser/conversationEditor.contribution.js';

suite('Conversation navigation (S2)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationNavigation';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationNavigation';

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
		const editorFactory = Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory);
		if (!editorFactory.getEditorSerializer(ConversationDiffReviewInputTypeId)) {
			store.add(registerTestConversationDiffReviewEditor(store));
		}
	});

	async function createHarness(options?: { closeChildOnBack?: boolean; notificationService?: INotificationService }) {
		const configurationService = new TestConfigurationService({
			[CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING]: options?.closeChildOnBack ?? true,
		});

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConfigurationService, configurationService);
		if (options?.notificationService) {
			instantiationService.stub(INotificationService, options.notificationService);
		}
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

	function getConversationNavStack(service: ConversationNavigationService, part: IConversationEditorPart): {
		readonly stack: Array<{ readonly groupId: number; readonly editor: unknown } | undefined>;
		index: number;
	} {
		const stacks = (service as unknown as {
			stacks: Map<IConversationEditorPart, { stack: Array<{ groupId: number; editor: unknown } | undefined>; index: number }>;
		}).stacks;
		const navStack = stacks.get(part);
		assert.ok(navStack);
		return navStack;
	}

	function createNotificationCapture(): { errors: string[]; notificationService: INotificationService } {
		const errors: string[] = [];
		return {
			errors,
			notificationService: {
				error: (message: string | Error) => {
					errors.push(typeof message === 'string' ? message : getErrorMessage(message));
				},
			} as INotificationService,
		};
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

	test('goBack closeEditor throw notifies error and restores stack without unhandled rejection', async () => {
		const boom = new Error('boom');
		const { errors, notificationService } = createNotificationCapture();
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		const { navigationService, conversationA, parts } = await createHarness({ closeChildOnBack: true, notificationService });

		const tabA = createExtensionTab('session-a', 'back-throw');
		await conversationA.activeGroup.openEditor(tabA);
		assert.strictEqual(navigationService.canGoBack(conversationA), true);
		assert.strictEqual(navigationService.canGoForward(conversationA), false);

		const scopedEditorService = parts.getScopedInstantiationService(conversationA).invokeFunction(accessor => accessor.get(IEditorService));
		scopedEditorService.closeEditor = async () => {
			throw boom;
		};

		process.on('unhandledRejection', onUnhandledRejection);
		try {
			void navigationService.goBack(conversationA);
			await timeout(0);
			assert.deepStrictEqual(errors, [getErrorMessage(boom)]);
			assert.deepStrictEqual(unhandledRejections, []);
			assert.strictEqual(navigationService.canGoBack(conversationA), true);
			assert.strictEqual(navigationService.canGoForward(conversationA), false);
			assert.strictEqual(conversationA.activeGroup.activeEditor, tabA);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('goForward openEditor throw notifies error and restores stack without unhandled rejection', async () => {
		const boom = new Error('boom');
		const { errors, notificationService } = createNotificationCapture();
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		const { navigationService, conversationA } = await createHarness({ closeChildOnBack: false, notificationService });

		const tabA = createExtensionTab('session-a', 'fwd-throw');
		await conversationA.activeGroup.openEditor(tabA);
		await navigationService.goBack(conversationA);
		assert.strictEqual(navigationService.canGoForward(conversationA), true);
		assert.strictEqual(navigationService.canGoBack(conversationA), false);

		conversationA.activeGroup.openEditor = async () => {
			throw boom;
		};

		process.on('unhandledRejection', onUnhandledRejection);
		try {
			void navigationService.goForward(conversationA);
			await timeout(0);
			assert.deepStrictEqual(errors, [getErrorMessage(boom)]);
			assert.deepStrictEqual(unhandledRejections, []);
			assert.strictEqual(navigationService.canGoForward(conversationA), true);
			assert.strictEqual(navigationService.canGoBack(conversationA), false);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('goBack empty destination does not mutate stack or enablement', async () => {
		const { navigationService, conversationA } = await createHarness({ closeChildOnBack: false });

		const tabA = createExtensionTab('session-a', 'back-empty');
		await conversationA.activeGroup.openEditor(tabA);
		assert.strictEqual(navigationService.canGoBack(conversationA), true);
		assert.strictEqual(navigationService.canGoForward(conversationA), false);

		const navStack = getConversationNavStack(navigationService, conversationA);
		const indexBefore = navStack.index;
		const lengthBefore = navStack.stack.length;
		const snapshot = navStack.stack.slice();
		navStack.stack[navStack.index - 1] = undefined;

		await navigationService.goBack(conversationA);

		assert.strictEqual(navigationService.canGoBack(conversationA), true);
		assert.strictEqual(navigationService.canGoForward(conversationA), false);
		assert.strictEqual(navStack.index, indexBefore);
		assert.strictEqual(navStack.stack.length, lengthBefore);
		assert.strictEqual(conversationA.activeGroup.activeEditor, tabA);
		assert.strictEqual(navStack.stack[indexBefore - 1], undefined);
		assert.strictEqual(navStack.stack[indexBefore], snapshot[indexBefore]);
	});

	test('goForward empty destination does not mutate stack or enablement', async () => {
		const { navigationService, conversationA } = await createHarness({ closeChildOnBack: false });

		const tabA = createExtensionTab('session-a', 'fwd-empty');
		await conversationA.activeGroup.openEditor(tabA);
		await navigationService.goBack(conversationA);
		assert.strictEqual(navigationService.canGoForward(conversationA), true);
		assert.strictEqual(navigationService.canGoBack(conversationA), false);

		const navStack = getConversationNavStack(navigationService, conversationA);
		const indexBefore = navStack.index;
		const lengthBefore = navStack.stack.length;
		const snapshot = navStack.stack.slice();
		navStack.stack[navStack.index + 1] = undefined;
		const editorBefore = conversationA.activeGroup.activeEditor;

		await navigationService.goForward(conversationA);

		assert.strictEqual(navigationService.canGoForward(conversationA), true);
		assert.strictEqual(navigationService.canGoBack(conversationA), false);
		assert.strictEqual(navStack.index, indexBefore);
		assert.strictEqual(navStack.stack.length, lengthBefore);
		assert.strictEqual(conversationA.activeGroup.activeEditor, editorBefore);
		assert.strictEqual(navStack.stack[indexBefore + 1], undefined);
		assert.strictEqual(navStack.stack[indexBefore], snapshot[indexBefore]);
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
