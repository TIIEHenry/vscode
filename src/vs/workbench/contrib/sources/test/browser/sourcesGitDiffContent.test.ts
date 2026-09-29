/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { workbenchInstantiationService, TestServiceAccessor } from '../../../../test/browser/workbenchTestServices.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ISourcesChangeEntry } from '../../common/sourcesChangesModel.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { ISourcesChangeEntryOpenDeps, openSourcesChangeEntry } from '../../browser/sourcesChangeEntryOpen.js';
import { provideSourcesGitDiffTextContent, sourcesGitDiffContentStore, sourcesGitDiffModelUri } from '../../browser/sourcesGitDiffContent.js';

suite('Sources - git diff content provider', () => {

	const disposables = new DisposableStore();
	let instantiationService: IInstantiationService;
	let accessor: TestServiceAccessor;

	setup(() => {
		sourcesGitDiffContentStore.resetForTests();
		instantiationService = workbenchInstantiationService(undefined, disposables);
		accessor = instantiationService.createInstance(TestServiceAccessor);
	});

	teardown(() => {
		sourcesGitDiffContentStore.resetForTests();
		disposables.clear();
	});

	test('createModel alone cannot resolve sources-git-diff', async function () {
		const resource = sourcesGitDiffModelUri('modified', 'src/a.ts', 'WORKTREE');
		disposables.add(accessor.modelService.createModel('only-created', null, resource));
		await assert.rejects(() => accessor.textModelResolverService.createModelReference(resource), /resolve/i);
	});

	test('put plus the provider resolves the stored text and updates a live model without creating another', async function () {
		const resource = sourcesGitDiffModelUri('modified', 'src/live.ts', 'WORKTREE');
		let creates = 0;
		const originalCreate = accessor.modelService.createModel.bind(accessor.modelService);
		accessor.modelService.createModel = ((value: string, language: unknown, uri?: URI) => {
			creates++;
			return originalCreate(value, language as never, uri);
		}) as typeof accessor.modelService.createModel;

		disposables.add(accessor.textModelResolverService.registerTextModelContentProvider(resource.scheme, {
			provideTextContent: uri => Promise.resolve(provideSourcesGitDiffTextContent(uri, accessor.modelService)),
		}));

		assert.strictEqual(sourcesGitDiffContentStore.put(resource, 'first', sourcesGitDiffContentStore.begin([resource]), accessor.modelService), true);
		const ref = await accessor.textModelResolverService.createModelReference(resource);
		disposables.add(ref);
		const model = ref.object.textEditorModel;
		assert.strictEqual(model.getValue(), 'first');
		const createsAfterResolve = creates;

		const next = sourcesGitDiffContentStore.begin([resource]);
		assert.strictEqual(sourcesGitDiffContentStore.put(resource, 'second', next, accessor.modelService), true);
		assert.strictEqual(model.getValue(), 'second');
		assert.strictEqual(creates, createsAfterResolve);
		assert.strictEqual(accessor.modelService.getModel(resource), model);
	});

	test('an older read does not open and a failed open does not destroy a second reference', async function () {
		const entry: ISourcesChangeEntry = {
			resource: URI.file('/project/src/a.ts'),
			name: 'a.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
		};
		const originalUri = sourcesGitDiffModelUri('original', entry.gitPath!, entry.indexState!);
		const modifiedUri = sourcesGitDiffModelUri('modified', entry.gitPath!, entry.indexState!);
		disposables.add(accessor.textModelResolverService.registerTextModelContentProvider(modifiedUri.scheme, {
			provideTextContent: uri => Promise.resolve(provideSourcesGitDiffTextContent(uri, accessor.modelService)),
		}));
		const generation = sourcesGitDiffContentStore.begin([originalUri, modifiedUri]);
		sourcesGitDiffContentStore.put(originalUri, 'old', generation, accessor.modelService);
		sourcesGitDiffContentStore.put(modifiedUri, 'new', generation, accessor.modelService);
		const firstRef = await accessor.textModelResolverService.createModelReference(modifiedUri);
		const secondRef = await accessor.textModelResolverService.createModelReference(modifiedUri);
		disposables.add(firstRef);
		disposables.add(secondRef);
		const live = secondRef.object.textEditorModel;
		assert.strictEqual(live.isDisposed(), false);

		let opens = 0;
		let calls = 0;
		let releaseFirst!: () => void;
		let releaseSecond!: () => void;
		const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
		const secondGate = new Promise<void>(resolve => { releaseSecond = resolve; });
		const deps = openDeps(accessor.modelService, async () => {
			calls++;
			if (calls === 1) {
				await firstGate;
				return diff('@@ -1 +1 @@\n-old\n+first\n');
			}
			await secondGate;
			return diff('@@ -1 +1 @@\n-old\n+second\n');
		}, () => { opens++; });

		const staleOpen = openSourcesChangeEntry(entry, deps, { preserveFocus: true });
		const freshOpen = openSourcesChangeEntry(entry, deps, { preserveFocus: true });
		await timeout(0);
		assert.strictEqual(calls, 2);
		releaseSecond();
		assert.strictEqual(await freshOpen, true);
		releaseFirst();
		assert.strictEqual(await staleOpen, 'stale');
		assert.strictEqual(opens, 1);
		assert.ok(sourcesGitDiffContentStore.get(modifiedUri)?.text.includes('second'));
		assert.ok(!sourcesGitDiffContentStore.get(modifiedUri)?.text.includes('first'));

		let panelShows = 0;
		const failed = await openSourcesChangeEntry(entry, {
			...deps,
			configurationService: new TestConfigurationService({ 'sources.diff.defaultOwner': 'panel' }),
			sourcesDiffPanelService: {
				show: async () => {
					panelShows++;
					return false;
				},
			} as unknown as ISourcesDiffPanelService,
			readGitFileDiff: async () => diff('@@ -1 +1 @@\n-old\n+kept\n'),
		}, { preserveFocus: true });
		assert.strictEqual(failed, false);
		assert.strictEqual(panelShows, 1);
		assert.strictEqual(live.isDisposed(), false);
		assert.strictEqual(accessor.modelService.getModel(modifiedUri)?.isDisposed(), false);

		let staleShows = 0;
		let releaseStale!: () => void;
		let releaseFresh!: () => void;
		const staleGate = new Promise<void>(resolve => { releaseStale = resolve; });
		const freshGate = new Promise<void>(resolve => { releaseFresh = resolve; });
		let staleCalls = 0;
		const staleDeps: ISourcesChangeEntryOpenDeps = {
			...deps,
			configurationService: new TestConfigurationService({ 'sources.diff.defaultOwner': 'panel' }),
			sourcesDiffPanelService: {
				show: async () => {
					staleShows++;
					return true;
				},
			} as unknown as ISourcesDiffPanelService,
			readGitFileDiff: async () => {
				staleCalls++;
				if (staleCalls === 1) {
					await staleGate;
					return diff('@@ -1 +1 @@\n-old\n+stale\n');
				}
				await freshGate;
				return diff('@@ -1 +1 @@\n-old\n+fresh\n');
			},
		};
		const older = openSourcesChangeEntry(entry, staleDeps, { preserveFocus: true });
		const newer = openSourcesChangeEntry(entry, staleDeps, { preserveFocus: true });
		await timeout(0);
		releaseFresh();
		assert.strictEqual(await newer, true);
		releaseStale();
		assert.strictEqual(await older, 'stale');
		assert.strictEqual(staleShows, 1);
	});
});

function diff(unifiedDiff: string) {
	return { supported: true, reason: '', path: 'src/a.ts', unifiedDiff };
}

function openDeps(
	modelService: IModelService,
	readGitFileDiff: ISourcesChangeEntryOpenDeps['readGitFileDiff'],
	onOpen: () => void,
): ISourcesChangeEntryOpenDeps {
	return {
		editorService: {
			openEditor: async () => {
				onOpen();
				return undefined;
			},
		} as unknown as IEditorService,
		quickDiffService: { getQuickDiffs: async () => [] } as unknown as IQuickDiffService,
		configurationService: new TestConfigurationService({ 'sources.diff.defaultOwner': 'preview' }),
		instantiationService: { createInstance: () => { throw new Error('preview open must not create an input'); } } as unknown as IInstantiationService,
		sourcesDiffPanelService: { show: async () => { throw new Error('preview open must not show the panel'); } } as unknown as ISourcesDiffPanelService,
		modelService,
		readGitFileDiff,
	};
}
