/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { EditorOpenSource, IResourceEditorInput } from '../../../../../platform/editor/common/editor.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ISCMResource } from '../../../scm/common/scm.js';
import { ACTIVE_GROUP, CONVERSATION_GROUP, IEditorService } from '../../../../services/editor/common/editorService.js';
import { openSourcesChangeEntry, ISourcesChangeEntryOpenDeps } from '../../browser/sourcesChangeEntryOpen.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { ISourcesChangeEntry } from '../../common/sourcesChangesModel.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';

suite('Sources - Changes list open', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createEntry(resource: URI, scmResource?: ISCMResource): ISourcesChangeEntry {
		return {
			resource,
			name: resource.path.split('/').pop() ?? '',
			description: 'Changes',
			groupId: 'workingTree',
			scmResource,
		};
	}

	function createDeps(overrides: Partial<ISourcesChangeEntryOpenDeps> & Pick<ISourcesChangeEntryOpenDeps, 'editorService'>): ISourcesChangeEntryOpenDeps {
		const configurationService = new TestConfigurationService();
		return {
			quickDiffService: {
				getQuickDiffs: async () => [],
			} as unknown as IQuickDiffService,
			configurationService,
			instantiationService: {
				createInstance: (ctor: typeof ConversationDiffReviewInput, modified: URI, original?: URI) =>
					store.add(new ctor(modified, original)),
			} as unknown as ISourcesChangeEntryOpenDeps['instantiationService'],
			sourcesDiffPanelService: {
				show: async () => { },
			} as unknown as ISourcesDiffPanelService,
			...overrides,
		};
	}

	test('openSourcesChangeEntry uses scmResource.open for working-tree diff', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let openedPreserveFocus: boolean | undefined;
		const scmResource = {
			open: async (preserveFocus: boolean) => {
				openedPreserveFocus = preserveFocus;
			},
		} as unknown as ISCMResource;

		await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
			editorService: {
				openEditor: async () => {
					assert.fail('must not open file preview when scmResource is present');
				},
			} as unknown as IEditorService,
		}), { preserveFocus: true });

		assert.strictEqual(openedPreserveFocus, true);
	});

	test('openSourcesChangeEntry falls back to file preview without scmResource', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let openedResource: URI | undefined;
		let openedGroup: unknown;

		await openSourcesChangeEntry(createEntry(resource), createDeps({
			editorService: {
				openEditor: async (input: IResourceEditorInput, group?: unknown) => {
					openedResource = input.resource;
					openedGroup = group;
					return undefined;
				},
			} as unknown as IEditorService,
		}), { preserveFocus: false, pinned: true });

		assert.strictEqual(openedResource?.toString(), resource.toString());
		assert.strictEqual(openedGroup, ACTIVE_GROUP);
	});

	test('openSourcesChangeEntry passes editor options on preview fallback', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let capturedOptions: { preserveFocus?: boolean; pinned?: boolean; source?: EditorOpenSource } | undefined;

		await openSourcesChangeEntry(createEntry(resource), createDeps({
			editorService: {
				openEditor: async (input: IResourceEditorInput) => {
					capturedOptions = input.options;
					return undefined;
				},
			} as unknown as IEditorService,
		}), { preserveFocus: true, pinned: true });

		assert.strictEqual(capturedOptions?.preserveFocus, true);
		assert.strictEqual(capturedOptions?.pinned, true);
		assert.strictEqual(capturedOptions?.source, EditorOpenSource.USER);
	});

	test('openSourcesChangeEntry opens conversation diff review input when default owner is conversation', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/src/a.ts.git');
		let openedInput: unknown;
		let openedGroup: unknown;

		const configurationService = new TestConfigurationService({ 'sources.diff.defaultOwner': 'conversation' });
		const store = new DisposableStore();

		await openSourcesChangeEntry(createEntry(resource), createDeps({
			editorService: {
				openEditor: async (input: unknown, _options: unknown, group?: unknown) => {
					if (input instanceof ConversationDiffReviewInput) {
						store.add(input);
					}
					openedInput = input;
					openedGroup = group;
					return undefined;
				},
			} as unknown as IEditorService,
			quickDiffService: {
				getQuickDiffs: async () => [{ originalResource: original, id: 'git', label: 'Git', kind: 'primary' }],
			} as unknown as IQuickDiffService,
			configurationService,
			instantiationService: {
				createInstance: (ctor: typeof ConversationDiffReviewInput, modified: URI, originalUri?: URI) => store.add(new ctor(modified, originalUri)),
			} as unknown as ISourcesChangeEntryOpenDeps['instantiationService'],
		}), { preserveFocus: false });

		assert.ok(openedInput instanceof ConversationDiffReviewInput);
		assert.strictEqual((openedInput as ConversationDiffReviewInput).modified.toString(), resource.toString());
		assert.strictEqual((openedInput as ConversationDiffReviewInput).original?.toString(), original.toString());
		assert.strictEqual(openedGroup, CONVERSATION_GROUP);
		store.dispose();
	});
});
