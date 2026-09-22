/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { DiffEditorInput } from '../../../../common/editor/diffEditorInput.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { workbenchInstantiationService, TestEditorInput } from '../../../../test/browser/workbenchTestServices.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { moveActiveDiffToConversation, moveActiveDiffToPanel, moveActiveDiffToPreview, resolveSourcesChangeRefFromEditor } from '../../browser/sourcesDiffRefHelpers.js';
import { parseSerializedConversationDiffReviewInput, serializeConversationDiffReviewInput } from '../../common/conversationDiffReviewInput.js';
import { attachSourcesGitApplyHunksPatch, ISourcesChangeRef, sourcesDiffLocalWritePath, sourcesGitApplyHunksPatches } from '../../common/sourcesChangeRef.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';

suite('Sources - Diff ref helpers', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

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
			},
			clear: () => {
				service.cleared = true;
				current = undefined;
			},
		};
		return service;
	}

	function createEditorService(activeEditor: EditorInput | undefined): IEditorService & { closed: EditorInput[]; opened: unknown[] } {
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
				return undefined;
			},
			get closed() { return state.closed; },
			get opened() { return state.opened; },
		} as unknown as IEditorService & { closed: EditorInput[]; opened: unknown[] };
	}

	test('move prefers focused preview diff over panel ref', async function () {
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

		await moveActiveDiffToConversation(editorService, createScmService(), instantiationService, panelService);

		assert.strictEqual(panelService.cleared, false);
		assert.strictEqual(editorService.closed.length, 1);
		assert.strictEqual(editorService.closed[0], diffInput);
		assert.ok(editorService.opened[0] instanceof ConversationDiffReviewInput);
		store.add(editorService.opened[0] as ConversationDiffReviewInput);
		assert.strictEqual((editorService.opened[0] as ConversationDiffReviewInput).modified.toString(), previewModified.toString());
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(editorService.opened[0] as ConversationDiffReviewInput), []);
	});

	test('move falls back to panel when focused editor is not a diff', async function () {
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

		await moveActiveDiffToConversation(editorService, createScmService(), instantiationService, panelService);

		assert.strictEqual(panelService.cleared, true);
		assert.strictEqual(editorService.closed.length, 0);
		assert.ok(editorService.opened[0] instanceof ConversationDiffReviewInput);
		store.add(editorService.opened[0] as ConversationDiffReviewInput);
		assert.strictEqual((editorService.opened[0] as ConversationDiffReviewInput).modified.toString(), panelModified.toString());
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

		await moveActiveDiffToPanel(editorService, createScmService(), panelService);

		assert.strictEqual(panelService.cleared, false);
		assert.strictEqual(editorService.closed[0], diffInput);
		assert.strictEqual(panelService.shown?.modified.toString(), previewModified.toString());
	});

	test('move to preview closes the conversation diff host', async function () {
		const panelModified = toResource.call(this, '/project/panel.ts');
		const conversationModified = toResource.call(this, '/project/conversation.ts');
		const conversationOriginal = toResource.call(this, '/project/conversation.ts.git');

		const conversationInput = store.add(new ConversationDiffReviewInput(conversationModified, conversationOriginal));
		const editorService = createEditorService(conversationInput);
		const panelService = createPanelService({
			modified: panelModified,
			original: undefined,
			groupId: 'workingTree',
		});

		await moveActiveDiffToPreview(editorService, createScmService(), panelService);

		assert.strictEqual(panelService.cleared, false);
		assert.strictEqual(editorService.closed[0], conversationInput);
		const opened = editorService.opened[0] as { original?: { resource?: URI }; modified?: { resource?: URI } };
		assert.strictEqual(opened.modified?.resource?.toString(), conversationModified.toString());
		assert.strictEqual(opened.original?.resource?.toString(), conversationOriginal.toString());
	});

	test('local write path does not invent a path for non-file URIs', function () {
		const file = toResource.call(this, '/project/a.ts');
		assert.strictEqual(sourcesDiffLocalWritePath({ modified: file }), file.fsPath);
		assert.strictEqual(sourcesDiffLocalWritePath({
			modified: URI.from({ scheme: 'sources-git-diff', path: '/modified/a.ts' }),
		}), '');
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
			unifiedDiff: carriedUnifiedDiff,
		});

		await moveActiveDiffToConversation(editorService, createScmService(), instantiationService, panelService);

		const opened = editorService.opened[0] as ConversationDiffReviewInput;
		assert.ok(opened instanceof ConversationDiffReviewInput);
		store.add(opened);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(opened), [carriedUnifiedDiff]);
	});

	test('move to conversation carries WeakMap patch from ConversationDiffReviewInput', async function () {
		const conversationModified = toResource.call(this, '/project/carry-conversation.ts');
		const conversationOriginal = toResource.call(this, '/project/carry-conversation.ts.git');

		const conversationInput = store.add(new ConversationDiffReviewInput(conversationModified, conversationOriginal, 'workingTree'));
		attachSourcesGitApplyHunksPatch(conversationInput, carriedUnifiedDiff);
		const resolved = resolveSourcesChangeRefFromEditor(conversationInput, createScmService());
		assert.strictEqual(resolved?.unifiedDiff, carriedUnifiedDiff);

		const instantiationService = workbenchInstantiationService(undefined, store);
		const editorService = createEditorService(conversationInput);
		const panelService = createPanelService();

		await moveActiveDiffToConversation(editorService, createScmService(), instantiationService, panelService);

		const opened = editorService.opened[0] as ConversationDiffReviewInput;
		assert.ok(opened instanceof ConversationDiffReviewInput);
		store.add(opened);
		assert.notStrictEqual(opened, conversationInput);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(opened), [carriedUnifiedDiff]);
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
			unifiedDiff: '',
		});

		await moveActiveDiffToConversation(editorService, createScmService(), instantiationService, panelService);

		const opened = editorService.opened[0] as ConversationDiffReviewInput;
		assert.ok(opened instanceof ConversationDiffReviewInput);
		store.add(opened);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(opened), []);
	});

	test('Conversation Diff serializer cannot persist WeakMap patch', function () {
		const modified = toResource.call(this, '/project/reload.ts');
		const original = toResource.call(this, '/project/reload.ts.git');
		const input = store.add(new ConversationDiffReviewInput(modified, original, 'workingTree'));
		attachSourcesGitApplyHunksPatch(input, carriedUnifiedDiff);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(input), [carriedUnifiedDiff]);

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
