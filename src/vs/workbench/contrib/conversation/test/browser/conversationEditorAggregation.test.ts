/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { timeout } from '../../../../../base/common/async.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IEditorGroupsService, isExcludedFromGlobalEditorAggregation, IAuxiliaryEditorPart, type IConversationEditorPart } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IStatusbarService } from '../../../../services/statusbar/browser/statusbar.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { createEditorParts, registerTestEditor, TestEnvironmentService, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { INativeHostService } from '../../../../../platform/native/common/native.js';
import { TestWorkspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import { URI } from '../../../../../base/common/uri.js';
import { ConversationChatInput, getConversationChatResource } from '../../common/conversationChatInput.js';
import { ConversationDiffReviewInput } from '../../../sources/browser/conversationDiffReviewInput.js';
import { ConversationDiffReviewInputTypeId } from '../../../../common/editor/conversationDiffReviewInput.js';
import { registerTestConversationDiffReviewEditor } from './conversationDiffReviewTestEditor.js';
import '../../browser/conversationEditor.contribution.js';
import { ConversationEditorPane } from '../../browser/conversationEditorPane.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { installConversationLensResizeObserverHarness } from './conversationLensLayoutHarness.js';
import { stubConversationLensRuntimeServices, stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';
import { NativeWindow } from '../../../../electron-browser/window.js';
import { TestNativeHostService, workbenchInstantiationService as electronWorkbenchInstantiationService } from '../../../../test/electron-browser/workbenchTestServices.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../../platform/workspace/common/workspace.js';
import { TestContextService } from '../../../../test/common/workbenchTestServices.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { INativeWorkbenchEnvironmentService } from '../../../../services/environment/electron-browser/environmentService.js';

installConversationLensResizeObserverHarness();

class TrackingNativeHostService extends TestNativeHostService {
	closeWindowCalls = 0;
	override async closeWindow(): Promise<void> {
		this.closeWindowCalls++;
	}
}

class CloseWhenEmptyNativeWindow extends NativeWindow {
	protected override create(): void { }
	protected override registerListeners(): void { }
	protected override enableMultiWindowAwareTimeout(): void { }
	invokeMaybeCloseWindow(): void {
		// eslint-disable-next-line local/code-no-any-casts
		(this as any).maybeCloseWindow();
	}
}

suite('Conversation editor aggregation exemption (S1a)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationAggregation';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationAggregation';

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	setup(() => {
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
		const editorFactory = Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory);
		if (!editorFactory.getEditorSerializer(ConversationDiffReviewInputTypeId)) {
			store.add(registerTestConversationDiffReviewEditor(store));
		}
	});

	teardown(async () => {
		await new Promise<void>(resolve => mainWindow.requestAnimationFrame(() => mainWindow.requestAnimationFrame(() => resolve())));
	});

	async function waitForConversationPane(part: IConversationEditorPart): Promise<ConversationEditorPane> {
		await part.whenReady;
		const deadline = Date.now() + 3000;
		while (Date.now() < deadline) {
			const pane = part.activeGroup.activeEditorPane;
			if (pane instanceof ConversationEditorPane && pane.activeConversationLens) {
				return pane;
			}
			await timeout(20);
		}
		throw new Error(`ConversationEditorPane not ready for ${part.sessionKey}`);
	}

	async function createHarness() {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const rosterService = store.add(new ConversationStubService());
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		stubConversationTimelineLinkServices(instantiationService);
		stubConversationLensRuntimeServices(instantiationService);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));
		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);
		const editorService = store.add(instantiationService.createInstance(EditorService, undefined));
		instantiationService.stub(IEditorService, editorService);
		const statusbarService = {
			createScoped() {
				return this;
			},
		} as unknown as IStatusbarService;
		instantiationService.stub(IStatusbarService, statusbarService);

		const hostA = document.createElement('div');
		const hostB = document.createElement('div');
		document.body.appendChild(hostA);
		document.body.appendChild(hostB);
		store.add({ dispose: () => { hostA.remove(); hostB.remove(); } });

		const conversationA = parts.createConversationEditorPart(hostA, 'session-a');
		const conversationB = parts.createConversationEditorPart(hostB, 'session-b');
		await Promise.all([
			waitForConversationPane(conversationA),
			waitForConversationPane(conversationB),
		]);
		store.add({
			dispose: () => {
				parts.disposeConversationEditorPart('session-a');
				parts.disposeConversationEditorPart('session-b');
			},
		});

		for (const part of [conversationA, conversationB]) {
			const rootEditor = part.activeGroup.getEditorByIndex(0);
			if (rootEditor) {
				store.add(rootEditor);
			}
		}

		const extraInput = store.add(instantiationService.createInstance(
			ConversationChatInput,
			getConversationChatResource('session-a', 'fork-1'),
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

	test('global editor enumeration excludes diff review tabs', async () => {
		const { parts, editorService, conversationA, instantiationService } = await createHarness();

		const reviewInput = store.add(instantiationService.createInstance(
			ConversationDiffReviewInput,
			URI.file('/tmp/aggregate-review-modified.ts'),
			URI.file('/tmp/aggregate-review-original.ts'),
		));
		await conversationA.activeGroup.openEditor(reviewInput);

		const mainFile = store.add(new TestFileEditorInput(URI.file('/tmp/main-with-review.txt'), TEST_EDITOR_INPUT_ID));
		await parts.mainPart.activeGroup.openEditor(mainFile);

		const globalEditors = editorService.editors;
		assert.ok(globalEditors.some(editor => editor === mainFile));
		assert.ok(!globalEditors.some(editor => editor === reviewInput));
		assert.ok(!globalEditors.some(editor => editor instanceof ConversationDiffReviewInput));
	});

	test('getGroups for global navigation excludes conversation groups', async () => {
		const { parts, conversationA } = await createHarness();
		const globalGroupIds = new Set(parts.getGroups().map(group => group.id));
		for (const group of conversationA.groups) {
			assert.ok(!globalGroupIds.has(group.id));
		}
	});

	test('maybeCloseWindow keeps empty window open when conversation tabs remain', async () => {
		const { parts, editorService, conversationA } = await createHarness();
		const nativeHost = new TrackingNativeHostService();
		const config = new TestConfigurationService({ window: { closeWhenEmpty: true } });
		const context = new TestContextService({ id: 'empty', folders: [] } as typeof TestWorkspace);
		assert.strictEqual(context.getWorkbenchState(), WorkbenchState.EMPTY);
		const instantiationService = electronWorkbenchInstantiationService({
			configurationService: () => config,
		}, store as unknown as DisposableStore);
		instantiationService.stub(IEditorGroupsService, parts);
		instantiationService.stub(IEditorService, editorService);
		instantiationService.stub(IWorkspaceContextService, context);
		instantiationService.stub(INativeWorkbenchEnvironmentService, { ...TestEnvironmentService, args: { wait: false } } as INativeWorkbenchEnvironmentService);
		instantiationService.stub(INativeHostService, nativeHost);

		for (const group of parts.mainPart.groups) {
			await group.closeAllEditors();
		}
		assert.ok(conversationA.groups.some(group => !group.isEmpty));

		const nativeWindow = store.add(instantiationService.createInstance(CloseWhenEmptyNativeWindow));
		nativeWindow.invokeMaybeCloseWindow();
		assert.strictEqual(nativeHost.closeWindowCalls, 0);
	});

	test('maybeCloseWindow closes empty window when conversation tabs are empty', async () => {
		const { parts, editorService } = await createHarness();
		const nativeHost = new TrackingNativeHostService();
		const config = new TestConfigurationService({ window: { closeWhenEmpty: true } });
		const context = new TestContextService({ id: 'empty', folders: [] } as typeof TestWorkspace);
		const instantiationService = electronWorkbenchInstantiationService({
			configurationService: () => config,
		}, store as unknown as DisposableStore);
		instantiationService.stub(IEditorGroupsService, parts);
		instantiationService.stub(IEditorService, editorService);
		instantiationService.stub(IWorkspaceContextService, context);
		instantiationService.stub(INativeWorkbenchEnvironmentService, { ...TestEnvironmentService, args: { wait: false } } as INativeWorkbenchEnvironmentService);
		instantiationService.stub(INativeHostService, nativeHost);

		for (const group of parts.mainPart.groups) {
			await group.closeAllEditors();
		}
		parts.disposeConversationEditorPart('session-a');
		parts.disposeConversationEditorPart('session-b');

		const nativeWindow = store.add(instantiationService.createInstance(CloseWhenEmptyNativeWindow));
		nativeWindow.invokeMaybeCloseWindow();
		assert.strictEqual(nativeHost.closeWindowCalls, 1);
	});

	test('maybeCloseWindow does not close non-empty workspace windows', async () => {
		const { parts, editorService } = await createHarness();
		const nativeHost = new TrackingNativeHostService();
		const config = new TestConfigurationService({ window: { closeWhenEmpty: true } });
		const context = store.add(new TestContextService(TestWorkspace));
		const instantiationService = electronWorkbenchInstantiationService({
			configurationService: () => config,
		}, store as unknown as DisposableStore);
		instantiationService.stub(IEditorGroupsService, parts);
		instantiationService.stub(IEditorService, editorService);
		instantiationService.stub(IWorkspaceContextService, context);
		instantiationService.stub(INativeWorkbenchEnvironmentService, { ...TestEnvironmentService, args: { wait: false } } as INativeWorkbenchEnvironmentService);
		instantiationService.stub(INativeHostService, nativeHost);

		for (const group of parts.mainPart.groups) {
			await group.closeAllEditors();
		}
		assert.notStrictEqual(context.getWorkbenchState(), WorkbenchState.EMPTY);

		const nativeWindow = store.add(instantiationService.createInstance(CloseWhenEmptyNativeWindow));
		nativeWindow.invokeMaybeCloseWindow();
		assert.strictEqual(nativeHost.closeWindowCalls, 0);
	});
});
