/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { DiffEditorInput } from '../../../../common/editor/diffEditorInput.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { workbenchInstantiationService, TestEditorInput } from '../../../../test/browser/workbenchTestServices.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { ISourcesChangeEntryOpenDeps } from '../../browser/sourcesChangeEntryOpen.js';
import { moveActiveDiffToConversation, moveActiveDiffToPanel, moveActiveDiffToPreview, resolveSourcesChangeRefFromEditor } from '../../browser/sourcesDiffRefHelpers.js';
import { createSourcesConversationOpenHarness } from './sourcesConversationOpenHarness.js';
import { parseSerializedConversationDiffReviewInput, serializeConversationDiffReviewInput } from '../../common/conversationDiffReviewInput.js';
import { ISourcesChangeRef, sourcesDiffLocalWritePath, sourcesGitApplyHunksPatches } from '../../common/sourcesChangeRef.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';

suite('Sources - Diff ref helpers', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	let conversationOpened: EditorInput[] = [];

	function createMoveDeps(
		editorService: IEditorService,
		instantiationService: IInstantiationService,
		panelService: ISourcesDiffPanelService,
	): ISourcesChangeEntryOpenDeps {
		const harness = createSourcesConversationOpenHarness(store, {
			openEditor: async input => {
				store.add(input);
				return undefined;
			},
		});
		conversationOpened = harness.opened;
		return {
			editorService,
			quickDiffService: { getQuickDiffs: async () => [] } as unknown as IQuickDiffService,
			configurationService: new TestConfigurationService(),
			instantiationService,
			sourcesDiffPanelService: panelService,
			editorGroupsService: harness.editorGroupsService,
			session: harness.session,
		};
	}

	function createScmService(): ISCMService {
		return { repositories: [] } as unknown as ISCMService;
	}

	function createPanelService(initial?: ISourcesChangeRef): ISourcesDiffPanelService & { cleared: boolean; shown: ISourcesChangeRef | undefined } {
		let current = initial;
		const service = {
			cleared: false,
			shown: undefined as ISourcesChangeRef | undefined,
			_serviceBrand: undefined,
			onDidChangeRef: Event.None,
			getCurrentRef: () => current,
			show: async (ref: ISourcesChangeRef) => {
				current = ref;
				service.shown = ref;
				return true;
			},
			getPendingRenderGeneration: () => undefined,
			attachPendingRender: () => { },
			clear: () => {
				service.cleared = true;
				current = undefined;
			},
		};
		return service;
	}

	function createEditorService(activeEditor: EditorInput | undefined, instantiationService?: IInstantiationService): IEditorService & { closed: EditorInput[]; opened: unknown[] } {
		const state = {
			activeEditor,
			closed: [] as EditorInput[],
			opened: [] as unknown[],
		};
		return {
			get activeEditor() { return state.activeEditor; },
			activeEditorPane: { group: { id: 1 } },
			closeEditor: async (ident: { editor: EditorInput }) => {
				state.closed.push(ident.editor);
				if (state.activeEditor === ident.editor) {
					state.activeEditor = undefined;
				}
			},
			openEditor: async (input: unknown) => {
				state.opened.push(input);
				if (input instanceof EditorInput) {
					state.activeEditor = input;
					return { input };
				}
				const untyped = input as { original?: { resource?: URI }; modified?: { resource?: URI } };
				if (instantiationService && untyped.original?.resource && untyped.modified?.resource) {
					const originalInput = store.add(new TestEditorInput(untyped.original.resource, 'test.original'));
					const modifiedInput = store.add(new TestEditorInput(untyped.modified.resource, 'test.modified'));
					const diffInput = store.add(instantiationService.createInstance(DiffEditorInput, undefined, undefined, originalInput, modifiedInput, undefined));
					state.activeEditor = diffInput;
					return { input: diffInput };
				}
				return undefined;
			},
			get closed() { return state.closed; },
			get opened() { return state.opened; },
		} as unknown as IEditorService & { closed: EditorInput[]; opened: unknown[] };
	}

	test('view title moves the panel ref and leaves the editor diff; editor title moves the editor diff', async function () {
		const panelModified = toResource.call(this, '/project/panel.ts');
		const previewModified = toResource.call(this, '/project/preview.ts');
		const previewOriginal = toResource.call(this, '/project/preview.ts.git');

		const instantiationService = workbenchInstantiationService(undefined, store);
		const originalInput = store.add(new TestEditorInput(previewOriginal, 'test.original'));
		const modifiedInput = store.add(new TestEditorInput(previewModified, 'test.modified'));
		const diffInput = store.add(instantiationService.createInstance(DiffEditorInput, undefined, undefined, originalInput, modifiedInput, undefined));

		const editorService = createEditorService(diffInput);
		const panelRef: ISourcesChangeRef = {
			modified: panelModified,
			original: undefined,
			groupId: 'workingTree',
		};
		const panelService = createPanelService(panelRef);
		const deps = createMoveDeps(editorService, instantiationService, panelService);
		const scmService = createScmService();

		const movedFromView = await moveActiveDiffToConversation('viewTitle', deps, scmService);

		assert.strictEqual(movedFromView, false);
		assert.strictEqual(panelService.cleared, true);
		assert.strictEqual(editorService.closed.length, 0);
		assert.strictEqual(editorService.activeEditor, diffInput);
		assert.strictEqual(editorService.opened.length, 0);
		assert.ok(conversationOpened[0] instanceof ConversationDiffReviewInput);
		assert.strictEqual((conversationOpened[0] as ConversationDiffReviewInput).modified.toString(), panelModified.toString());
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(conversationOpened[0] as ConversationDiffReviewInput), []);

		panelService.cleared = false;
		await panelService.show(panelRef);
		const movedFromEditor = await moveActiveDiffToConversation('editorTitle', deps, scmService);

		assert.strictEqual(movedFromEditor, false);
		assert.strictEqual(panelService.cleared, false);
		assert.strictEqual(editorService.closed.length, 1);
		assert.strictEqual(editorService.closed[0], diffInput);
		assert.strictEqual(editorService.opened.length, 0);
		assert.ok(conversationOpened[1] instanceof ConversationDiffReviewInput);
		assert.strictEqual((conversationOpened[1] as ConversationDiffReviewInput).modified.toString(), previewModified.toString());
	});

	test('view title moves the panel when the focused editor is not a diff', async function () {
		const panelModified = toResource.call(this, '/project/panel.ts');
		const panelOriginal = toResource.call(this, '/project/panel.ts.git');
		const fileUri = toResource.call(this, '/project/readme.md');

		const instantiationService = workbenchInstantiationService(undefined, store);
		const fileInput = store.add(new TestEditorInput(fileUri, 'test.file'));
		const editorService = createEditorService(fileInput);
		const panelService = createPanelService({
			modified: panelModified,
			original: panelOriginal,
			groupId: 'workingTree',
		});

		await moveActiveDiffToConversation('viewTitle', createMoveDeps(editorService, instantiationService, panelService), createScmService());

		assert.strictEqual(panelService.cleared, true);
		assert.strictEqual(editorService.closed.length, 0);
		assert.strictEqual(editorService.activeEditor, fileInput);
		assert.strictEqual(editorService.opened.length, 0);
		assert.ok(conversationOpened[0] instanceof ConversationDiffReviewInput);
		assert.strictEqual((conversationOpened[0] as ConversationDiffReviewInput).modified.toString(), panelModified.toString());
	});

	test('editor title does not fall back to the panel when the focused editor is not a diff', async function () {
		const panelModified = toResource.call(this, '/project/panel-only.ts');
		const panelOriginal = toResource.call(this, '/project/panel-only.ts.git');
		const fileUri = toResource.call(this, '/project/readme.md');

		const instantiationService = workbenchInstantiationService(undefined, store);
		const fileInput = store.add(new TestEditorInput(fileUri, 'test.file'));
		const editorService = createEditorService(fileInput);
		const panelService = createPanelService({
			modified: panelModified,
			original: panelOriginal,
			groupId: 'workingTree',
		});

		const moved = await moveActiveDiffToConversation('editorTitle', createMoveDeps(editorService, instantiationService, panelService), createScmService());

		assert.strictEqual(moved, undefined);
		assert.strictEqual(panelService.cleared, false);
		assert.strictEqual(editorService.closed.length, 0);
		assert.strictEqual(editorService.activeEditor, fileInput);
		assert.strictEqual(conversationOpened.length, 0);
	});

	test('move to panel closes the focused editor host', async function () {
		const panelModified = toResource.call(this, '/project/panel.ts');
		const previewModified = toResource.call(this, '/project/preview.ts');
		const previewOriginal = toResource.call(this, '/project/preview.ts.git');

		const instantiationService = workbenchInstantiationService(undefined, store);
		const originalInput = store.add(new TestEditorInput(previewOriginal, 'test.original'));
		const modifiedInput = store.add(new TestEditorInput(previewModified, 'test.modified'));
		const diffInput = store.add(instantiationService.createInstance(DiffEditorInput, undefined, undefined, originalInput, modifiedInput, undefined));

		const editorService = createEditorService(diffInput);
		const panelService = createPanelService({
			modified: panelModified,
			original: undefined,
			groupId: 'workingTree',
		});

		await moveActiveDiffToPanel(createMoveDeps(editorService, instantiationService, panelService), createScmService());

		assert.strictEqual(panelService.cleared, false);
		assert.strictEqual(editorService.closed[0], diffInput);
		assert.strictEqual(panelService.shown?.modified.toString(), previewModified.toString());
	});

	test('move to preview closes the conversation diff host', async function () {
		const panelModified = toResource.call(this, '/project/panel.ts');
		const conversationModified = toResource.call(this, '/project/conversation.ts');
		const conversationOriginal = toResource.call(this, '/project/conversation.ts.git');

		const conversationInput = store.add(new ConversationDiffReviewInput(conversationModified, conversationOriginal));
		const instantiationService = workbenchInstantiationService(undefined, store);
		const editorService = createEditorService(conversationInput);
		const panelService = createPanelService({
			modified: panelModified,
			original: undefined,
			groupId: 'workingTree',
		});

		await moveActiveDiffToPreview('editorTitle', createMoveDeps(editorService, instantiationService, panelService), createScmService());

		assert.strictEqual(panelService.cleared, false);
		assert.strictEqual(editorService.closed[0], conversationInput);
		assert.strictEqual(conversationOpened.length, 0);
		const opened = editorService.opened[0] as { original?: { resource?: URI }; modified?: { resource?: URI } };
		assert.strictEqual(opened.modified?.resource?.toString(), conversationModified.toString());
		assert.strictEqual(opened.original?.resource?.toString(), conversationOriginal.toString());
	});

	test('local write path does not invent a path for non-file URIs', function () {
		const file = toResource.call(this, '/project/a.ts');
		const virtual = URI.from({ scheme: 'sources-git-diff', path: '/modified/a.ts' });
		assert.strictEqual(sourcesDiffLocalWritePath({ modified: file }), file.fsPath);
		assert.strictEqual(sourcesDiffLocalWritePath({ modified: virtual }), '');
		assert.strictEqual(sourcesDiffLocalWritePath({ modified: virtual, origin: 'engine', gitPath: 'src/a.ts' }), 'src/a.ts');
		assert.strictEqual(sourcesDiffLocalWritePath({ modified: virtual, origin: 'engine', gitPath: '' }), '');
		assert.ok(!sourcesDiffLocalWritePath({ modified: virtual, origin: 'engine', gitPath: 'src/a.ts' }).includes('sources-git-diff'));
	});

	test('resolveSourcesChangeRefFromEditor keeps identity copied onto the input', function () {
		const modified = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/src/a.ts.git');
		const input = store.add(new ConversationDiffReviewInput(modified, original, 'workingTree', {
			origin: 'engine',
			sessionId: 'session-old',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
			kind: 'MODIFIED',
		}));
		const resolved = resolveSourcesChangeRefFromEditor(input, createScmService());
		assert.strictEqual(resolved?.origin, 'engine');
		assert.strictEqual(resolved?.sessionId, 'session-old');
		assert.strictEqual(resolved?.gitPath, 'src/a.ts');
		assert.strictEqual(resolved?.indexState, 'WORKTREE');
		assert.strictEqual(resolved?.kind, 'MODIFIED');
		assert.strictEqual(resolved?.groupId, 'workingTree');
	});

	const carriedUnifiedDiff = '@@ -1 +1 @@\n-old\n+new\n';

	test('move to conversation carries panel unifiedDiff onto the rebuilt input', async function () {
		const panelModified = toResource.call(this, '/project/carry-panel.ts');
		const panelOriginal = toResource.call(this, '/project/carry-panel.ts.git');
		const fileUri = toResource.call(this, '/project/readme.md');

		const instantiationService = workbenchInstantiationService(undefined, store);
		const fileInput = store.add(new TestEditorInput(fileUri, 'test.file'));
		const editorService = createEditorService(fileInput);
		const panelService = createPanelService({
			modified: panelModified,
			original: panelOriginal,
			groupId: 'workingTree',
		});

		await moveActiveDiffToConversation('viewTitle', createMoveDeps(editorService, instantiationService, panelService), createScmService());

		const opened = conversationOpened[0] as ConversationDiffReviewInput;
		assert.ok(opened instanceof ConversationDiffReviewInput);
		assert.strictEqual(editorService.opened.length, 0);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(opened), []);
	});

	test('move to conversation carries WeakMap patch from ConversationDiffReviewInput', async function () {
		const conversationModified = toResource.call(this, '/project/carry-conversation.ts');
		const conversationOriginal = toResource.call(this, '/project/carry-conversation.ts.git');

		const conversationInput = store.add(new ConversationDiffReviewInput(conversationModified, conversationOriginal, 'workingTree'));
		const resolved = resolveSourcesChangeRefFromEditor(conversationInput, createScmService());
		assert.ok(resolved);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(resolved), []);

		const instantiationService = workbenchInstantiationService(undefined, store);
		const editorService = createEditorService(conversationInput);
		const panelService = createPanelService();

		await moveActiveDiffToConversation('editorTitle', createMoveDeps(editorService, instantiationService, panelService), createScmService());

		const opened = conversationOpened[0] as ConversationDiffReviewInput;
		assert.ok(opened instanceof ConversationDiffReviewInput);
		assert.strictEqual(editorService.opened.length, 0);
		assert.notStrictEqual(opened, conversationInput);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(opened), []);
	});

	test('move to conversation leaves empty patch absent', async function () {
		const panelModified = toResource.call(this, '/project/empty-panel.ts');
		const panelOriginal = toResource.call(this, '/project/empty-panel.ts.git');
		const fileUri = toResource.call(this, '/project/notes.md');

		const instantiationService = workbenchInstantiationService(undefined, store);
		const fileInput = store.add(new TestEditorInput(fileUri, 'test.file'));
		const editorService = createEditorService(fileInput);
		const panelService = createPanelService({
			modified: panelModified,
			original: panelOriginal,
			groupId: 'workingTree',
		});

		await moveActiveDiffToConversation('viewTitle', createMoveDeps(editorService, instantiationService, panelService), createScmService());

		const opened = conversationOpened[0] as ConversationDiffReviewInput;
		assert.ok(opened instanceof ConversationDiffReviewInput);
		assert.strictEqual(editorService.opened.length, 0);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(opened), []);
	});

	test('move to preview carries conversation WeakMap patch onto DiffEditorInput', async function () {
		const conversationModified = toResource.call(this, '/project/preview-carry.ts');
		const conversationOriginal = toResource.call(this, '/project/preview-carry.ts.git');

		const conversationInput = store.add(new ConversationDiffReviewInput(conversationModified, conversationOriginal, 'workingTree'));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const editorService = createEditorService(conversationInput, instantiationService);

		await moveActiveDiffToPreview('editorTitle', createMoveDeps(editorService, instantiationService, createPanelService()), createScmService());

		const previewHost = editorService.activeEditor;
		assert.ok(previewHost instanceof DiffEditorInput);
		assert.notStrictEqual(previewHost, conversationInput);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(previewHost), []);
	});

	test('move to preview carries panel unifiedDiff onto DiffEditorInput', async function () {
		const panelModified = toResource.call(this, '/project/preview-panel.ts');
		const panelOriginal = toResource.call(this, '/project/preview-panel.ts.git');
		const fileUri = toResource.call(this, '/project/notes.md');

		const instantiationService = workbenchInstantiationService(undefined, store);
		const fileInput = store.add(new TestEditorInput(fileUri, 'test.file'));
		const editorService = createEditorService(fileInput, instantiationService);
		const panelService = createPanelService({
			modified: panelModified,
			original: panelOriginal,
			groupId: 'workingTree',
		});

		await moveActiveDiffToPreview('viewTitle', createMoveDeps(editorService, instantiationService, panelService), createScmService());

		const previewHost = editorService.activeEditor;
		assert.ok(previewHost instanceof DiffEditorInput);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(previewHost), []);
	});

	test('Conversation to Preview to Conversation keeps the carried patch', async function () {
		const conversationModified = toResource.call(this, '/project/round-trip.ts');
		const conversationOriginal = toResource.call(this, '/project/round-trip.ts.git');

		const conversationInput = store.add(new ConversationDiffReviewInput(conversationModified, conversationOriginal, 'workingTree'));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const editorService = createEditorService(conversationInput, instantiationService);
		const panelService = createPanelService();
		const deps = createMoveDeps(editorService, instantiationService, panelService);

		await moveActiveDiffToPreview('editorTitle', deps, createScmService());
		const previewHost = editorService.activeEditor;
		assert.ok(previewHost instanceof DiffEditorInput);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(previewHost), []);
		const editorOpensAfterPreview = editorService.opened.length;

		await moveActiveDiffToConversation('editorTitle', deps, createScmService());

		assert.strictEqual(editorService.opened.length, editorOpensAfterPreview);
		assert.ok(!editorService.opened.some(input => input instanceof ConversationDiffReviewInput));
		const reopened = conversationOpened[0] as ConversationDiffReviewInput;
		assert.ok(reopened instanceof ConversationDiffReviewInput);
		assert.notStrictEqual(reopened, conversationInput);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(reopened), []);
	});

	test('move to preview leaves empty patch absent', async function () {
		const panelModified = toResource.call(this, '/project/preview-empty.ts');
		const panelOriginal = toResource.call(this, '/project/preview-empty.ts.git');
		const fileUri = toResource.call(this, '/project/empty-notes.md');

		const instantiationService = workbenchInstantiationService(undefined, store);
		const fileInput = store.add(new TestEditorInput(fileUri, 'test.file'));
		const editorService = createEditorService(fileInput, instantiationService);
		const panelService = createPanelService({
			modified: panelModified,
			original: panelOriginal,
			groupId: 'workingTree',
		});

		await moveActiveDiffToPreview('viewTitle', createMoveDeps(editorService, instantiationService, panelService), createScmService());

		const previewHost = editorService.activeEditor;
		assert.ok(previewHost instanceof DiffEditorInput);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(previewHost), []);
	});

	test('Conversation Diff serializer cannot persist WeakMap patch', function () {
		const modified = toResource.call(this, '/project/reload.ts');
		const original = toResource.call(this, '/project/reload.ts.git');
		const input = store.add(new ConversationDiffReviewInput(modified, original, 'workingTree'));
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(input), []);

		const serialized = serializeConversationDiffReviewInput(input);
		const payload = JSON.parse(serialized) as { modified?: string; original?: string; groupId?: string; unifiedDiff?: string };
		assert.strictEqual(payload.unifiedDiff, undefined);
		assert.ok(!serialized.includes(carriedUnifiedDiff));

		const parsed = parseSerializedConversationDiffReviewInput(serialized);
		assert.ok(parsed);
		const restored = store.add(new ConversationDiffReviewInput(parsed.modified, parsed.original, parsed.groupId));
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(restored), []);
	});
});
