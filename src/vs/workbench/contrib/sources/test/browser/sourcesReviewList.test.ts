/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { timeout } from '../../../../../base/common/async.js';
import { getErrorMessage } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { localize } from '../../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { getSelectionKeyboardEvent, WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ISCMResource, ISCMService } from '../../../scm/common/scm.js';
import { SourcesChangesList } from '../../browser/sourcesChangesList.js';
import { SourcesReviewList } from '../../browser/sourcesReviewList.js';
import { sourcesGitDiffOpenFailureMessage, sourcesGitReadFailureMessage } from '../../common/sourcesChangesGitRead.js';
import { ISourcesChangeEntry } from '../../common/sourcesChangesModel.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { ISourcesReviewAttributionService } from '../../common/sourcesReviewAttribution.js';
import {
	countReviewProgress,
	filterReviewEntries,
	markReviewedAfterSuccessfulOpen,
	reviewListEmptyReason,
} from '../../common/sourcesReviewListModel.js';
import { buildSourcesReviewProgressKey, ISourcesReviewProgressKey, ISourcesReviewProgressService } from '../../common/sourcesReviewProgress.js';

suite('Sources - review list model', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createThrowingGitConnection(): IUniverseAgentConnection {
		return createGitConnection({ throwOnRead: true });
	}

	function deniedWriteResult() {
		return {
			supported: true,
			reason: '',
			success: false,
			errorMessage: 'denied',
			exitCode: 1,
			stdout: '',
		};
	}

	function createGitConnection(options: {
		throwOnRead?: boolean;
		throwOnStage?: boolean;
		throwOnCommit?: boolean;
		failOnStage?: boolean;
		failOnCommit?: boolean;
	} = {}): IUniverseAgentConnection {
		return {
			isEngineConnected: () => true,
			onDidChangeConnection: Event.None,
			readGitChanges: async () => {
				if (options.throwOnRead) {
					throw new Error('boom');
				}
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			...(options.throwOnStage || options.failOnStage ? {
				writeGitStagePaths: async () => {
					if (options.throwOnStage) {
						throw new Error('boom');
					}
					return deniedWriteResult();
				},
			} : {}),
			...(options.throwOnCommit || options.failOnCommit ? {
				writeGitCommit: async () => {
					if (options.throwOnCommit) {
						throw new Error('boom');
					}
					return deniedWriteResult();
				},
			} : {}),
		} as unknown as IUniverseAgentConnection;
	}

	function createEmptyScmService(): ISCMService {
		return {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function createNoGitReadConnection(): IUniverseAgentConnection {
		return {
			isEngineConnected: () => false,
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection;
	}

	function createIndexScmService(resource: URI): ISCMService {
		const group = {
			id: 'index',
			label: 'Staged Changes',
			resources: [] as ISCMResource[],
		};
		const scmResource = {
			sourceUri: resource,
			resourceGroup: group,
			decorations: {},
			contextValue: undefined,
			command: undefined,
			multiDiffEditorOriginalUri: undefined,
			multiDiffEditorModifiedUri: undefined,
			open: async () => { },
		} as unknown as ISCMResource;
		group.resources.push(scmResource);

		const repository = {
			provider: {
				groups: [group],
				onDidChangeResources: Event.None,
				onDidChangeResourceGroups: Event.None,
				inputBoxTextModel: { setValue: () => { } },
			},
			input: {
				value: '',
				setValue: () => { },
				onDidChange: Event.None,
			},
		};

		return {
			_serviceBrand: undefined,
			get repositories() { return [repository]; },
			get repositoryCount() { return 1; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function stubSourcesGitListServices(options: {
		connection?: IUniverseAgentConnection;
		scmService?: ISCMService;
		getQuickDiffs?: () => Promise<unknown>;
		markReviewed?: () => void;
		executeCommand?: (...args: unknown[]) => Promise<unknown>;
	} = {}) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, options.connection ?? createThrowingGitConnection());
		instantiationService.stub(ISCMService, options.scmService ?? createEmptyScmService());
		instantiationService.stub(IQuickDiffService, {
			getQuickDiffs: options.getQuickDiffs ?? (async () => []),
		} as unknown as IQuickDiffService);
		instantiationService.stub(ISourcesDiffPanelService, {
			onDidChangeRef: Event.None,
			getCurrentRef: () => undefined,
			show: async () => { },
			clear: () => { },
		} as unknown as ISourcesDiffPanelService);
		instantiationService.stub(ICommandService, {
			onWillExecuteCommand: Event.None,
			onDidExecuteCommand: Event.None,
			executeCommand: options.executeCommand ?? (async () => undefined),
		} as unknown as ICommandService);
		instantiationService.stub(ISourcesReviewProgressService, {
			onDidChange: Event.None,
			isReviewed: () => false,
			markReviewed: options.markReviewed ?? (() => { }),
			markUnreviewed: () => { },
			markAllReviewed: () => { },
			resolveKey: async (resource: URI) => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: '' }),
			pruneMissingKeys: () => { },
		} as unknown as ISourcesReviewProgressService);
		instantiationService.stub(ISourcesReviewAttributionService, {
			onDidChange: Event.None,
			isAttributionEnabled: () => false,
			getWorkDirMismatchNote: () => undefined,
			getAttributionHeaderSuffix: () => undefined,
			resolveRevealItemId: () => undefined,
			buildChipMapForEntries: () => new Map(),
		} as unknown as ISourcesReviewAttributionService);
		return instantiationService;
	}

	async function waitForStatusText(host: HTMLElement, selector: string, contains?: string): Promise<string> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const text = host.querySelector(selector)?.textContent ?? '';
			if (text && (!contains || text.includes(contains))) {
				return text;
			}
			await timeout(20);
		}
		throw new Error(`status ${selector} stayed empty${contains ? ` (wanted ${contains})` : ''}`);
	}

	function mountListHost(): HTMLElement {
		const host = document.createElement('div');
		host.style.width = '400px';
		host.style.height = '300px';
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });
		return host;
	}

	async function waitForList(owner: { list?: WorkbenchList<unknown> }): Promise<WorkbenchList<unknown>> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			if (owner.list && owner.list.length > 0) {
				owner.list.layout(120, 400);
				return owner.list;
			}
			await timeout(20);
		}
		throw new Error('list stayed empty');
	}

	async function openFirstListRow(owner: { list?: WorkbenchList<unknown> }): Promise<void> {
		const list = await waitForList(owner);
		list.setFocus([0]);
		list.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
	}

	async function selectFirstListRow(owner: { list?: WorkbenchList<unknown> }): Promise<void> {
		const list = await waitForList(owner);
		list.setFocus([0]);
		list.setSelection([0]);
	}

	async function waitForEnabledButton(host: HTMLElement, selector: string): Promise<HTMLElement> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			for (const button of host.querySelectorAll(selector)) {
				if (!button.classList.contains('disabled')) {
					return button as HTMLElement;
				}
			}
			await timeout(20);
		}
		throw new Error(`enabled button ${selector} not found`);
	}

	function entry(resource: URI): ISourcesChangeEntry {
		return {
			resource,
			name: resource.path.split('/').pop() ?? '',
			description: 'Changes',
			groupId: 'workingTree',
		};
	}

	test('filterReviewEntries applies text, path-set, and unreviewed toggle with AND semantics', function () {
		const a = entry(toResource.call(this, '/project/a.ts'));
		const b = entry(toResource.call(this, '/project/b.ts'));
		const c = entry(toResource.call(this, '/project/c.ts'));
		const reviewed = new Set([a.resource.toString()]);

		const pathFiltered = filterReviewEntries(
			[a, b, c],
			'',
			[a.resource, c.resource],
			false,
			e => reviewed.has(e.resource.toString()),
		);
		assert.deepStrictEqual(pathFiltered.map(e => e.name), ['a.ts', 'c.ts']);

		const unreviewedOnly = filterReviewEntries(
			[a, b, c],
			'',
			undefined,
			true,
			e => reviewed.has(e.resource.toString()),
		);
		assert.deepStrictEqual(unreviewedOnly.map(e => e.name), ['b.ts', 'c.ts']);

		const textAndPath = filterReviewEntries(
			[a, b, c],
			'b',
			[b.resource],
			false,
			e => reviewed.has(e.resource.toString()),
		);
		assert.deepStrictEqual(textAndPath.map(e => e.name), ['b.ts']);
	});

	test('reviewListEmptyReason distinguishes unreviewed-done, path miss, and text miss', function () {
		const a = entry(toResource.call(this, '/project/a.ts'));
		const b = entry(toResource.call(this, '/project/b.ts'));
		const reviewed = new Set([a.resource.toString(), b.resource.toString()]);
		const isReviewed = (e: ISourcesChangeEntry) => reviewed.has(e.resource.toString());

		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], '', undefined, true, isReviewed),
			'unreviewedDone',
		);
		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], '', [toResource.call(this, '/project/other.ts')], false, () => false),
			'pathNoIntersection',
		);
		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], 'zzz', undefined, false, () => false),
			'textFilterEmpty',
		);
		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], '', undefined, false, () => false),
			undefined,
		);
	});

	test('countReviewProgress reports reviewed and total', function () {
		const entries = [
			entry(toResource.call(this, '/project/a.ts')),
			entry(toResource.call(this, '/project/b.ts')),
		];
		const reviewed = new Set([entries[0].resource.toString()]);
		const counts = countReviewProgress(entries, e => reviewed.has(e.resource.toString()));
		assert.deepStrictEqual(counts, { reviewed: 1, total: 2 });
	});

	test('markReviewedAfterSuccessfulOpen marks only after open resolves', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const marked: ISourcesReviewProgressKey[] = [];
		let shouldFail = false;

		await markReviewedAfterSuccessfulOpen(
			async () => {
				if (shouldFail) {
					throw new Error('open failed');
				}
			},
			async () => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
			key => marked.push(key),
			resource,
		);

		assert.strictEqual(marked.length, 1);

		shouldFail = true;
		await assert.rejects(() => markReviewedAfterSuccessfulOpen(
			async () => { throw new Error('open failed'); },
			async () => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
			key => marked.push(key),
			resource,
		));
		assert.strictEqual(marked.length, 1);
	});

	const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

	test('Review list surfaces git read failure on a status line instead of a silent catch', () => {
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		assert.ok(review.includes('sourcesGitReadFailureMessage'));
		assert.ok(review.includes('setStatusMessage'));
		assert.ok(review.includes('sources-review-status'));
		assert.ok(!review.includes('} catch {\n\t\t\tif (seq !== this.refreshSeq)'));
	});

	test('Review list status DOM shows git-read throw', async function () {
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const instantiationService = stubSourcesGitListServices();
		store.add(instantiationService.createInstance(SourcesReviewList, host));

		const status = await waitForStatusText(host, '.sources-review-status');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.ok(status.includes('Unable to read git changes:'));
		assert.ok(status.includes('boom'));
	});

	test('Changes list status DOM shows git-read throw', async function () {
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const instantiationService = stubSourcesGitListServices();
		store.add(instantiationService.createInstance(SourcesChangesList, host));

		const status = await waitForStatusText(host, '.sources-changes-status');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.ok(status.includes('Unable to read git changes:'));
		assert.ok(status.includes('boom'));
	});

	test('Review list surfaces open-diff failure on the same status line and does not mark reviewed', () => {
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		const openStart = review.indexOf('this._register(this.list.onDidOpen');
		const openEnd = review.indexOf('this._register(this.list.onContextMenu', openStart);
		assert.ok(openStart >= 0 && openEnd > openStart);
		const openHandler = review.slice(openStart, openEnd);
		assert.ok(openHandler.includes('markReviewedAfterSuccessfulOpen'));
		assert.ok(openHandler.includes('} catch (error)'));
		assert.ok(openHandler.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(openHandler.includes('setStatusMessage'));
		assert.ok(!openHandler.includes('} catch {'));
	});

	test('Review list status DOM shows onDidOpen open-diff throw and does not mark reviewed', async function () {
		const host = mountListHost();
		let marked = 0;
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection(),
			getQuickDiffs: async () => { throw new Error('boom'); },
			markReviewed: () => { marked += 1; },
		});
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const status = await waitForStatusText(host, '.sources-review-status', 'Unable to open diff');
		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error('boom')));
		assert.ok(status.includes('boom'));
		assert.strictEqual(marked, 0);
	});

	test('Changes list status DOM shows onDidOpen open-diff throw', async function () {
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection(),
			getQuickDiffs: async () => { throw new Error('boom'); },
		});
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to open diff');
		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error('boom')));
		assert.ok(status.includes('boom'));
	});

	test('Changes list status DOM shows Stage Selected write throw', async function () {
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection({ throwOnStage: true }),
		});
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const stageButton = await waitForEnabledButton(host, '.sources-changes-toolbar .monaco-button');
		stageButton.click();

		const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to stage');
		assert.strictEqual(status, localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", getErrorMessage(new Error('boom'))));
		assert.ok(status.includes('Unable to stage:'));
		assert.ok(status.includes('boom'));
	});

	test('Changes list status DOM shows Commit write throw', async function () {
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection({ throwOnCommit: true }),
		});
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const input = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
		input.value = 'fix';
		input.dispatchEvent(new window.Event('input', { bubbles: true }));

		const commitButton = await waitForEnabledButton(host, '.sources-changes-commit .monaco-button');
		commitButton.click();

		const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to commit');
		assert.strictEqual(status, localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(new Error('boom'))));
		assert.ok(status.includes('Unable to commit:'));
		assert.ok(status.includes('boom'));
	});

	test('Changes list status DOM shows Stage Selected write ok:false', async function () {
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection({ failOnStage: true }),
		});
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const stageButton = await waitForEnabledButton(host, '.sources-changes-toolbar .monaco-button');
		stageButton.click();

		const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to stage');
		assert.strictEqual(status, localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", 'denied'));
		assert.ok(status.includes('Unable to stage:'));
		assert.ok(status.includes('denied'));
	});

	test('Changes list status DOM shows Commit write ok:false', async function () {
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection({ failOnCommit: true }),
		});
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const input = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
		input.value = 'fix';
		input.dispatchEvent(new window.Event('input', { bubbles: true }));

		const commitButton = await waitForEnabledButton(host, '.sources-changes-commit .monaco-button');
		commitButton.click();

		const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to commit');
		assert.strictEqual(status, localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", 'denied'));
		assert.ok(status.includes('Unable to commit:'));
		assert.ok(status.includes('denied'));
	});

	test('Changes list status DOM shows Unstage Selected command throw', async function () {
		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		try {
			const resource = toResource.call(this, '/project/src/a.ts');
			const host = mountListHost();
			const instantiationService = stubSourcesGitListServices({
				connection: createNoGitReadConnection(),
				scmService: createIndexScmService(resource),
				executeCommand: async () => {
					throw new Error('boom');
				},
			});
			const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

			await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

			const toolbarButtons = host.querySelectorAll('.sources-changes-toolbar .monaco-button');
			const unstageButton = toolbarButtons[1] as HTMLElement | undefined;
			assert.ok(unstageButton, 'Unstage Selected is the toolbar second button');
			const enabledUnstage = await waitForEnabledButton(host, '.sources-changes-toolbar .monaco-button:nth-child(2)');
			enabledUnstage.click();

			const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to unstage');
			assert.strictEqual(status, localize('sourcesChangesList.unstageFailed', "Unable to unstage: {0}", getErrorMessage(new Error('boom'))));
			assert.ok(status.includes('Unable to unstage:'));
			assert.ok(status.includes('boom'));
		} finally {
			unstageCommand.dispose();
		}
	});

	test('Changes list does not reference review progress service', () => {
		const changesListPath = path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts');
		const source = fs.readFileSync(changesListPath, 'utf8');
		assert.ok(!source.includes('ISourcesReviewProgressService'));
		assert.ok(!source.includes('sourcesReviewProgress'));
	});

	test('review progress keys remain distinct per content hash', () => {
		const base = { scopeKeyId: 'root', path: 'file:///a.ts' };
		const keyA = buildSourcesReviewProgressKey({ ...base, contentHash: '1' });
		const keyB = buildSourcesReviewProgressKey({ ...base, contentHash: '2' });
		assert.notStrictEqual(keyA, keyB);
	});
});
