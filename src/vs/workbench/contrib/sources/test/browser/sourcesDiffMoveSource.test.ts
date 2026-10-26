/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { NullCommandService } from '../../../../../platform/commands/test/common/nullCommandService.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IUserInteractionService, MockUserInteractionService } from '../../../../../platform/userInteraction/browser/userInteractionService.js';
import { StorageScope } from '../../../../../platform/storage/common/storage.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IDiffProviderFactoryService } from '../../../../../editor/browser/widget/diffEditor/diffProviderFactoryService.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { TestDiffProviderFactoryService } from '../../../../../editor/test/browser/diff/testDiffProviderFactoryService.js';
import { EditorParts } from '../../../../browser/parts/editor/editorParts.js';
import { EditorExtensions, IEditorFactoryRegistry, IVisibleEditorPane } from '../../../../common/editor.js';
import { DiffEditorInput } from '../../../../common/editor/diffEditorInput.js';
import { Memento } from '../../../../common/memento.js';
import { CommandService } from '../../../../services/commands/common/commandService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { GroupDirection, IConversationEditorPart, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { registerTestEditor, TestEditorGroupsService, TestEditorGroupView, TestEditorInput, TestEditorService, workbenchInstantiationService, workbenchTeardown } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationStubService, IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import '../../../conversation/browser/conversationEditor.contribution.js';
import { createConversationConnectionTestStub } from '../../../conversation/test/common/conversationConnectionTestStub.js';
import { installConversationLensResizeObserverHarness } from '../../../conversation/test/browser/conversationLensLayoutHarness.js';
import { stubConversationLensRuntimeServices, stubConversationTimelineLinkServices } from '../../../conversation/test/browser/conversationTimelineLinkTestStubs.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ISourcesChangeRef } from '../../common/sourcesChangeRef.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { SourcesChangesModel } from '../../common/sourcesChangesReadModel.js';
import { ISourcesChangesModel } from '../../common/sourcesChangesModel.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { ConversationDiffReviewPane } from '../../browser/conversationDiffReviewPane.js';
import '../../browser/conversationDiffReview.contribution.js';
import { SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND } from '../../browser/sourcesDiffActions.js';
import { moveActiveDiffToConversation, moveActiveDiffToPanel, moveActiveDiffToPreview, resolveSourcesChangeRefFromEditor, type ISourcesConversationDiffMoveSource, type SourcesDiffMoveResult } from '../../browser/sourcesDiffRefHelpers.js';
import type { ISourcesChangeEntryOpenDeps } from '../../browser/sourcesChangeEntryOpen.js';

suite('Sources M01 move source', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	installConversationLensResizeObserverHarness();

	function controlledSource() {
		const input = store.add(new ConversationDiffReviewInput(URI.file('/m01/shared.ts'), URI.parse('git:/m01/shared.ts?index#base'), 'workingTree'));
		const other = store.add(new ConversationDiffReviewInput(input.modified, input.original, 'index'));
		const group = new TestEditorGroupView(401);
		group.editors = [input];
		group.activeEditor = input;
		const pane = new class extends mock<IVisibleEditorPane>() {
			override input = input;
			override group = group;
		}();
		group.activeEditorPane = pane;
		const part = new class extends mock<IConversationEditorPart>() {
			override sessionKey = 'owner-b';
			override groups = [group];
		}();
		const groups = new class extends TestEditorGroupsService {
			override conversationParts: IConversationEditorPart[] = [part];
		}([group]);
		const trace: string[] = [];
		group.closeEditor = async editor => { assert.strictEqual(editor, input); trace.push('close:source'); return true; };
		let preview: () => Promise<undefined> = async () => undefined;
		const editorService = store.add(new class extends TestEditorService {
			override async openEditor(): Promise<undefined> { trace.push('open:preview'); return preview(); }
		}());
		let shown: ISourcesChangeRef | undefined;
		const panel = new class extends mock<ISourcesDiffPanelService>() {
			override async show(ref: ISourcesChangeRef): Promise<boolean> { shown = ref; trace.push('open:panel'); return true; }
		}();
		const scm = new class extends mock<ISCMService>() { override readonly repositories = []; }();
		const deps: ISourcesChangeEntryOpenDeps = {
			commandService: NullCommandService, editorService, editorGroupsService: groups,
			configurationService: new TestConfigurationService(), instantiationService: workbenchInstantiationService(undefined, store),
			quickDiffService: new class extends mock<IQuickDiffService>() { override async getQuickDiffs() { return []; } }(),
			sourcesDiffPanelService: panel,
		};
		const source: ISourcesConversationDiffMoveSource = { kind: 'conversationPane', editor: input, group, pane };
		return { input, other, group, pane, part, groups, editorService, deps, scm, source, trace, get shown() { return shown; }, setPreview: (run: () => Promise<undefined>) => { preview = run; } };
	}

	for (const shape of ['toolbar', 'context menu'] as const) {
		test(`native ${shape} captures the explicit group instead of unrelated global active`, async () => {
			const h = controlledSource();
			h.editorService.activeEditor = h.other;
			const args = shape === 'toolbar' ? [{ groupId: h.group.id }] : [h.input.modified, { groupId: h.group.id, editorIndex: 0 }];
			assert.strictEqual(await moveActiveDiffToPanel(h.deps, h.scm, ...args), true);
			assert.deepStrictEqual({ trace: h.trace, uri: h.shown?.modified.toString(), group: h.shown?.groupId }, { trace: ['open:panel', 'close:source'], uri: h.input.modified.toString(), group: 'workingTree' });
		});
	}

	for (const index of [-1, 1, 0.5, NaN, null]) {
		test(`native explicit invalid index ${String(index)} never falls back`, async () => {
			const h = controlledSource();
			h.editorService.activeEditor = h.other;
			assert.strictEqual(await moveActiveDiffToPanel(h.deps, h.scm, h.input.modified, { groupId: h.group.id, editorIndex: index }), undefined);
			assert.deepStrictEqual(h.trace, []);
		});
	}

	for (const invalidation of ['disposed input', 'replaced member', 'changed pane', 'removed group', 'same id group', 'removed part', 'same key part', 'wrong source kind', 'wrong input type'] as const) {
		test(`explicit ${invalidation} cannot borrow another active editor`, async () => {
			const h = controlledSource();
			h.editorService.activeEditor = h.other;
			let source: object = h.source;
			switch (invalidation) {
				case 'disposed input': h.input.dispose(); break;
				case 'replaced member': h.group.editors = [h.other]; break;
				case 'changed pane': h.pane.input = h.other; break;
				case 'removed group': h.groups.groups = []; break;
				case 'same id group': h.groups.groups = [new TestEditorGroupView(h.group.id)]; break;
				case 'removed part': h.groups.conversationParts = []; break;
				case 'same key part': h.groups.conversationParts = [new class extends mock<IConversationEditorPart>() { override sessionKey = h.part.sessionKey; override groups = []; }()]; break;
				case 'wrong source kind': source = { ...h.source, kind: 'other' }; break;
				case 'wrong input type': source = { ...h.source, editor: store.add(new TestEditorInput(h.input.modified, 'm01.wrong')) }; break;
			}
			assert.strictEqual(await moveActiveDiffToPanel(h.deps, h.scm, source), undefined);
			assert.deepStrictEqual(h.trace, []);
		});
	}

	for (const change of ['global focus', 'same URI replacement', 'pane replacement', 'group replacement', 'part replacement', 'session key change'] as const) {
		test(`await ${change} preserves dispatch and rechecks the captured close target`, async () => {
			const h = controlledSource();
			const entered = new DeferredPromise<void>();
			const release = new DeferredPromise<void>();
			h.setPreview(async () => { await entered.complete(); await release.p; return undefined; });
			const result = moveActiveDiffToPreview('editorTitle', h.deps, h.scm, h.source);
			await entered.p;
			if (change === 'global focus') { h.editorService.activeEditor = h.other; }
			if (change === 'same URI replacement') { h.group.editors = [h.other]; }
			if (change === 'pane replacement') { h.pane.input = h.other; }
			if (change === 'group replacement') { h.groups.groups = [new TestEditorGroupView(h.group.id)]; }
			if (change === 'part replacement') { h.groups.conversationParts = [new class extends mock<IConversationEditorPart>() { override sessionKey = h.part.sessionKey; override groups = [h.group]; }()]; }
			if (change === 'session key change') { h.part.sessionKey = 'changed'; }
			await release.complete();
			assert.strictEqual(await result, false);
			assert.deepStrictEqual(h.trace, change === 'global focus' ? ['open:preview', 'close:source'] : ['open:preview']);
		});
	}

	test('explicit non-leaf rejection retains the existing close algebra', async () => {
		const h = controlledSource();
		const boom = new Error('preview failed');
		h.setPreview(async () => { throw boom; });
		await assert.rejects(moveActiveDiffToPreview('editorTitle', h.deps, h.scm, h.source), error => error === boom);
		assert.deepStrictEqual(h.trace, ['open:preview', 'close:source']);
	});

	for (const entrance of ['button empty global', 'button unrelated global', 'native toolbar', 'native context menu'] as const) {
		test(`real Pane registered command ${entrance} moves only B from real Conversation parts`, async function () {
			this.timeout(20_000);
			const disposables = store.add(new DisposableStore());
			const instantiation = workbenchInstantiationService(undefined, disposables);
			instantiation.stub(IConversationRosterService, disposables.add(new ConversationStubService()));
			instantiation.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
			stubConversationLensRuntimeServices(instantiation);
			stubConversationTimelineLinkServices(instantiation);
			instantiation.stub(IDiffProviderFactoryService, new TestDiffProviderFactoryService());
			instantiation.stub(IUserInteractionService, new MockUserInteractionService());
			instantiation.stub(IAgentSessionContext, {
				_serviceBrand: undefined, getActiveSessionId: () => 'm01-owner-b', isEngineSessionReady: () => false,
				isPairingHold: () => false, onDidChangeActiveSession: Event.None, onDidChangeSession: Event.None,
				acquireSessionView: () => { throw new Error('not used'); },
			} satisfies IAgentSessionContext);
			instantiation.stub(ISourcesChangesModel, disposables.add(instantiation.createInstance(SourcesChangesModel)));
			instantiation.stub(IQuickDiffService, new class extends mock<IQuickDiffService>() { override async getQuickDiffs() { return []; } }());
			instantiation.stub(ISourcesDiffPanelService, new class extends mock<ISourcesDiffPanelService>() { }());
			const done = new DeferredPromise<SourcesDiffMoveResult>();
			let calls = 0;
			const registeredCommands = disposables.add(instantiation.createInstance(CommandService));
			const commandService: ICommandService = { ...NullCommandService, executeCommand: async <R>(id: string, ...args: unknown[]): Promise<R | undefined> => {
				assert.ok(CommandsRegistry.getCommand(id));
				const result = await registeredCommands.executeCommand<R | undefined>(id, ...args);
				if (id === SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND) {
					const observed: unknown = result;
					assert.ok(observed === undefined || typeof observed === 'boolean' || observed === 'stale');
					calls++;
					await done.complete(observed);
				}
				return result;
			} };
			instantiation.stub(ICommandService, commandService);
			instantiation.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));
			try {
				const parts = disposables.add(instantiation.createInstance(EditorParts));
				parts.mainPart.create(document.createElement('div'));
				parts.mainPart.layout(1080, 800, 0, 0);
				await parts.whenReady;
				instantiation.stub(IEditorGroupsService, parts);
				const editorService = disposables.add(instantiation.createInstance(EditorService, undefined));
				instantiation.stub(IEditorService, editorService);
				disposables.add(editorService.onWillOpenEditor(event => {
					disposables.add(event.editor);
					if (event.editor instanceof DiffEditorInput) { disposables.add(event.editor.original); disposables.add(event.editor.modified); }
				}));
				const makePart = async (key: string) => {
					const host = document.createElement('div');
					document.body.appendChild(host);
					disposables.add({ dispose: () => host.remove() });
					const part = parts.createConversationEditorPart(host, key);
					await part.whenReady;
					part.layout(700, 600, 0, 0);
					for (let i = 0; !part.activeGroup.activeEditorPane && i < 200; i++) { await timeout(10); }
					assert.ok(part.activeGroup.activeEditorPane, 'real root pane must finish opening');
					for (const editor of part.activeGroup.editors) { disposables.add(editor); }
					return part;
				};
				const a = await makePart('m01-owner-a');
				const b = await makePart('m01-owner-b');
				const original = URI.parse('inmemory://m01/original');
				const modified = URI.parse('inmemory://m01/modified');
				const models = instantiation.invokeFunction(accessor => accessor.get(IModelService));
				disposables.add(models.createModel('before M01', null, original));
				disposables.add(models.createModel('after M01', null, modified));
				const rootA = a.activeGroup;
				const rootB = b.activeGroup;
				const groupA = a.addGroup(rootA, GroupDirection.RIGHT);
				const groupB = b.addGroup(rootB, GroupDirection.RIGHT);
				const inputA = disposables.add(new ConversationDiffReviewInput(modified, original, 'index'));
				const inputB = disposables.add(new ConversationDiffReviewInput(modified, original, 'workingTree'));
				await editorService.openEditor(inputA, { pinned: true }, groupA);
				await editorService.openEditor(inputB, { pinned: true }, groupB);
				const paneB = groupB.activeEditorPane;
				assert.ok(paneB instanceof ConversationDiffReviewPane);
				assert.strictEqual(paneB.getComparisonLoadState(), 'ok');
				const previewGroup = parts.mainPart.activeGroup;
				let unrelated: TestEditorInput | undefined;
				if (entrance === 'button unrelated global') {
					disposables.add(registerTestEditor('M01UnrelatedPreview', [new SyncDescriptor(TestEditorInput)]));
					unrelated = disposables.add(new TestEditorInput(URI.file('/unrelated/other.ts'), 'm01.unrelated'));
					await editorService.openEditor(unrelated, { pinned: true }, previewGroup);
				}
				parts.activateGroup(previewGroup.id);
				assert.strictEqual(editorService.activeEditor, unrelated);
				if (entrance === 'native toolbar') {
					await commandService.executeCommand(SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND, { groupId: groupB.id });
				} else if (entrance === 'native context menu') {
					await commandService.executeCommand(SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND, modified, { groupId: groupB.id, editorIndex: groupB.getIndexOfEditor(inputB) });
				} else {
					const button = b.getContainer()?.querySelector('button.conversation-diff-review-open-preview');
					assert.ok(button instanceof HTMLButtonElement && button.style.display !== 'none');
					button.click();
				}
				await done.p;
				const preview = editorService.activeEditor;
				assert.ok(preview && preview !== unrelated, 'registered Move must open B in Preview');
				const moved = resolveSourcesChangeRefFromEditor(preview, instantiation.invokeFunction(accessor => accessor.get(ISCMService)));
				assert.deepStrictEqual({ calls, aKept: groupA.editors.includes(inputA), bClosed: !groupB.editors.includes(inputB), rootAKept: !rootA.isEmpty, rootBKept: !rootB.isEmpty, original: moved?.original?.toString(), modified: moved?.modified.toString(), group: moved?.groupId, aIdentity: inputA.groupId }, {
					calls: 1, aKept: true, bClosed: true, rootAKept: true, rootBKept: true, original: original.toString(), modified: modified.toString(), group: 'workingTree', aIdentity: 'index',
				});
				if (unrelated) { assert.ok(previewGroup.editors.includes(unrelated)); }
			} finally {
				try { await workbenchTeardown(instantiation); } finally {
					disposables.dispose();
					Memento.clear(StorageScope.WORKSPACE);
					Memento.clear(StorageScope.PROFILE);
				}
			}
		});
	}


	async function feedbackPane() {
		const instantiation = workbenchInstantiationService(undefined, store);
		instantiation.stub(IDiffProviderFactoryService, new TestDiffProviderFactoryService());
		instantiation.stub(IUserInteractionService, new MockUserInteractionService());
		const connection = createConversationConnectionTestStub();
		instantiation.stub(IUniverseAgentConnection, connection);
		instantiation.stub(IAgentSessionContext, {
			_serviceBrand: undefined, getActiveSessionId: () => 'm01-owner', isEngineSessionReady: () => false,
			isPairingHold: () => false, onDidChangeActiveSession: Event.None, onDidChangeSession: Event.None,
			acquireSessionView: () => { throw new Error('not used'); },
		} satisfies IAgentSessionContext);
		instantiation.stub(ISCMService, new class extends mock<ISCMService>() { override readonly repositories = []; }());
		instantiation.stub(ISourcesChangesModel, store.add(instantiation.createInstance(SourcesChangesModel)));
		const pending: DeferredPromise<SourcesDiffMoveResult>[] = [];
		let pane: ConversationDiffReviewPane;
		const group = new TestEditorGroupView(501);
		const commandService: ICommandService = { ...NullCommandService, executeCommand: async <T>(id: string, ...args: unknown[]) => {
			assert.strictEqual(id, SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND);
			const source = args[0] as ISourcesConversationDiffMoveSource;
			assert.deepStrictEqual({ kind: source.kind, sameInput: source.editor === pane.input, sameGroup: source.group === group, samePane: source.pane === pane }, { kind: 'conversationPane', sameInput: true, sameGroup: true, samePane: true });
			const result = new DeferredPromise<SourcesDiffMoveResult>();
			pending.push(result);
			return result.p as Promise<T>;
		} };
		instantiation.stub(ICommandService, commandService);
		pane = store.add(instantiation.createInstance(ConversationDiffReviewPane, group));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		pane.create(parent);
		const input = store.add(new ConversationDiffReviewInput(URI.parse('inmemory://m01/feedback'), undefined, 'workingTree'));
		const models = instantiation.invokeFunction(accessor => accessor.get(IModelService));
		store.add(models.createModel('feedback content', null, input.modified));
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		const button = parent.querySelector('button.conversation-diff-review-open-preview');
		const notice = parent.querySelector('.conversation-diff-review-move-notice');
		assert.ok(button instanceof HTMLButtonElement && notice instanceof HTMLElement);
		return { pane, parent, input, notice, click: () => { button.click(); assert.ok(pending.length); return pending[pending.length - 1]; } };
	}

	test('Pane move failure then current success restores only its local move notice', async () => {
		const h = await feedbackPane();
		const comparisonNotice = h.parent.querySelector('.conversation-diff-review-notice:not(.conversation-diff-review-move-notice)');
		assert.ok(comparisonNotice instanceof HTMLElement);
		const originalNotice = comparisonNotice.textContent;
		const first = h.click();
		await first.error(new Error('M01 preview refused'));
		await timeout(0);
		assert.ok(h.notice.textContent?.includes('M01 preview refused'));
		const next = h.click();
		await next.complete(true);
		await timeout(0);
		assert.strictEqual(h.notice.style.display, 'none');
		assert.strictEqual(comparisonNotice.textContent, originalNotice);
	});

	for (const outcome of ['late rejection', 'late success', 'stale'] as const) {
		test(`Pane ${outcome} cannot overwrite a newer move failure`, async () => {
			const h = await feedbackPane();
			const first = h.click();
			const second = h.click();
			await second.error(new Error('current failure'));
			await timeout(0);
			const message = h.notice.textContent;
			if (outcome === 'late rejection') { await first.error(new Error('old failure')); }
			else { await first.complete(outcome === 'stale' ? 'stale' : true); }
			await timeout(0);
			assert.strictEqual(h.notice.textContent, message);
		});
	}

	for (const invalidation of ['clear input', 'replace input', 'dispose'] as const) {
		test(`Pane ${invalidation} suppresses old move error`, async () => {
			const h = await feedbackPane();
			const first = h.click();
			if (invalidation === 'dispose') { h.pane.dispose(); }
			else if (invalidation === 'clear input') { h.pane.clearInput(); }
			else { await h.pane.setInput(store.add(new ConversationDiffReviewInput(h.input.modified, undefined, 'index')), undefined, Object.create(null), CancellationToken.None); }
			await first.error(new Error('old owner error'));
			await timeout(0);
			assert.ok(!h.notice.textContent?.includes('old owner error'));
		});
	}


	test('explicit missing Conversation leaf preserves the captured source', async () => {
		const h = controlledSource();
		await assert.rejects(moveActiveDiffToConversation('editorTitle', h.deps, h.scm, h.source), /No conversation window/);
		assert.deepStrictEqual(h.trace, []);
	});

	for (const outcome of [false, undefined, 'stale'] as const) {
		test(`Pane current ${String(outcome)} keeps the existing completion meaning`, async () => {
			const h = await feedbackPane();
			const first = h.click();
			await first.error(new Error('retained move error'));
			await timeout(0);
			const message = h.notice.textContent;
			const current = h.click();
			await current.complete(outcome);
			await timeout(0);
			if (outcome === 'stale') { assert.strictEqual(h.notice.textContent, message); }
			else { assert.ok(h.notice.textContent?.includes('could not be opened')); }
		});
	}

});
