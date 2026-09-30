/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileChangeType, FileChangesEvent, IFileService } from '../../../../../platform/files/common/files.js';
import { getSelectionKeyboardEvent, WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { TestWorkspace, testWorkspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { TestContextService, TestFileService } from '../../../../test/common/workbenchTestServices.js';
import { IFileQuery, ISearchComplete, ISearchService } from '../../../../services/search/common/search.js';
import { SourcesFilesList } from '../../browser/sourcesFilesList.js';
import { sourcesFilesListEmptyMessage, sourcesFilesListReadFailureMessage, sourcesFilesListTruncatedMessage } from '../../browser/sourcesFilesListStrings.js';
import { ISourcesFileEntry } from '../../common/sourcesFilesModel.js';

suite('Sources - Files list search', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	interface ISearchHook {
		queries: IFileQuery[];
		tokens: CancellationToken[];
		impl: (query: IFileQuery, token?: CancellationToken) => Promise<ISearchComplete>;
	}

	function mountList(this: Mocha.Context): {
		host: HTMLElement;
		widget: SourcesFilesList;
		fileService: TestFileService;
		search: ISearchHook;
		context: TestContextService;
		folderChange: Emitter<unknown>;
	} {
		const host = document.createElement('div');
		host.style.width = '400px';
		host.style.height = '300px';
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		const context = instantiationService.get(IWorkspaceContextService) as TestContextService;
		const folder = context.getWorkspace().folders[0]?.uri ?? TestWorkspace.folders[0].uri;
		const search: ISearchHook = {
			queries: [],
			tokens: [],
			impl: async query => ({
				results: [{ resource: folder.with({ path: `${folder.path}/src/leftover.ts` }) }],
				messages: [],
				limitHit: false,
			}),
		};
		instantiationService.stub(ISearchService, {
			fileSearch: (query: IFileQuery, token?: CancellationToken) => {
				search.queries.push(query);
				if (token) {
					search.tokens.push(token);
				}
				return search.impl(query, token);
			},
		});
		const folderChange = store.add(new Emitter<unknown>());
		const widget = store.add(instantiationService.createInstance(SourcesFilesList, host));
		const fileService = instantiationService.get(IFileService) as TestFileService;
		return { host, widget, fileService, search, context, folderChange };
	}

	async function waitForText(host: HTMLElement, selector: string, contains?: string): Promise<string> {
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

	async function waitForList(owner: { list?: WorkbenchList<ISourcesFileEntry> }): Promise<WorkbenchList<ISourcesFileEntry>> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const list = owner.list;
			if (list && list.length > 0) {
				list.layout(120, 400);
				return list;
			}
			await timeout(20);
		}
		throw new Error('list stayed empty');
	}

	async function flush(widget: SourcesFilesList): Promise<void> {
		const scheduler = (widget as unknown as { refreshScheduler: { isScheduled(): boolean; flush(): void } }).refreshScheduler;
		if (scheduler.isScheduled()) {
			scheduler.flush();
		}
		await timeout(0);
	}

	async function assertWarnThenRethrowDoesNotLeak(paintBoom: Error, run: () => void | Promise<void>): Promise<void> {
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			await run();
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	}

	test('all folder rejects paint failure, not empty-workspace success', async function () {
		const mounted = mountList.call(this);
		mounted.search.impl = async () => { throw new Error('boom'); };
		await flush(mounted.widget);
		const empty = await waitForText(mounted.host, '.sources-files-empty', 'Unable to read workspace files');
		assert.strictEqual(empty, sourcesFilesListReadFailureMessage(new Error('boom')));
		assert.ok(!empty.includes(sourcesFilesListEmptyMessage));
		assert.ok((mounted.host.querySelector('.sources-files-empty') as HTMLElement).classList.contains('is-error'));
	});

	test('partial folder reject keeps leftover rows and paints failure', async function () {
		const { host, widget, search, context, fileService } = mountList.call(this);
		const folderA = context.getWorkspace().folders[0].uri;
		const folderB = folderA.with({ path: '/other-root' });
		context.setWorkspace(testWorkspace(folderA, folderB));
		(context as unknown as { _onDidChangeWorkspaceFolders: { fire(event: unknown): void } })._onDidChangeWorkspaceFolders.fire({ added: [], removed: [], changed: [] });
		(host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		const fileA = folderA.with({ path: `${folderA.path}/a.ts` });
		const fileB = folderB.with({ path: `${folderB.path}/b.ts` });
		search.impl = async query => {
			const folder = query.folderQueries[0].folder;
			if (folder.toString() === folderB.toString()) {
				return { results: [{ resource: fileB }], messages: [], limitHit: false };
			}
			return { results: [{ resource: fileA }], messages: [], limitHit: false };
		};
		await flush(widget);
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesFileEntry> });
		assert.strictEqual(list.length, 2);
		search.impl = async query => {
			const folder = query.folderQueries[0].folder;
			if (folder.toString() === folderB.toString()) {
				throw new Error('partial boom');
			}
			return { results: [{ resource: fileA }], messages: [], limitHit: false };
		};
		fileService.fireFileChanges(new FileChangesEvent([{ resource: fileA, type: FileChangeType.UPDATED }], false));
		await flush(widget);
		const status = await waitForText(host, '.sources-files-status', 'Unable to read workspace files');
		assert.strictEqual(status, sourcesFilesListReadFailureMessage(new Error('partial boom')));
		assert.strictEqual(list.length, 2);
		search.impl = async query => {
			const folder = query.folderQueries[0].folder;
			if (folder.toString() === folderB.toString()) {
				return { results: [{ resource: fileB }], messages: [], limitHit: false };
			}
			return { results: [{ resource: fileA }], messages: [], limitHit: false };
		};
		fileService.fireFileChanges(new FileChangesEvent([{ resource: fileA, type: FileChangeType.UPDATED }], false));
		await flush(widget);
		await timeout(50);
		const statusEl = host.querySelector('.sources-files-status') as HTMLElement;
		assert.ok(!statusEl.classList.contains('is-error'));
		assert.strictEqual(statusEl.textContent ?? '', '');
	});

	test('success then reject keeps leftover rows', async function () {
		const { host, widget, search, fileService } = mountList.call(this);
		(host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesFileEntry> });
		assert.strictEqual(list.length, 1);
		const before = search.queries.length;
		search.impl = async () => { throw new Error('boom'); };
		fileService.fireFileChanges(new FileChangesEvent([{ resource: list.element(0).resource, type: FileChangeType.UPDATED }], false));
		await flush(widget);
		const status = await waitForText(host, '.sources-files-status', 'Unable to read workspace files');
		assert.strictEqual(status, sourcesFilesListReadFailureMessage(new Error('boom')));
		assert.strictEqual(list.length, 1);
		assert.ok(search.queries.length > before);
	});

	test('a cancelled round does not replace a newer result', async function () {
		const { host, widget, search } = mountList.call(this);
		(host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		await flush(widget);
		await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesFileEntry> });
		let release!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const folder = TestWorkspace.folders[0].uri;
		search.impl = async (_query, token) => {
			await gate;
			const path = token?.isCancellationRequested ? `${folder.path}/stale.ts` : `${folder.path}/fresh.ts`;
			return { results: [{ resource: folder.with({ path }) }], messages: [], limitHit: false };
		};
		const scheduler = (widget as unknown as { refreshScheduler: { flush(): void } }).refreshScheduler;
		(widget as unknown as { scheduleRefresh(): void }).scheduleRefresh();
		scheduler.flush();
		await timeout(0);
		(widget as unknown as { scheduleRefresh(): void }).scheduleRefresh();
		scheduler.flush();
		release();
		await timeout(30);
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesFileEntry> });
		assert.ok(list.element(0).resource.path.endsWith('/fresh.ts'));
		assert.ok(![...Array(list.length)].some((_, index) => list.element(index).resource.path.endsWith('/stale.ts')));
	});

	test('workspace folder changes search again and a hidden Files tab does not', async function () {
		const { host, widget, search, context } = mountList.call(this);
		await flush(widget);
		const visibleQueries = search.queries.length;
		assert.ok(visibleQueries > 0);

		host.classList.add('sources-tab-panel');
		host.toggleAttribute('hidden', true);
		widget.setFilesTabActive(false);
		const hiddenQueries = search.queries.length;
		(context as unknown as { _onDidChangeWorkspaceFolders: { fire(event: unknown): void } })._onDidChangeWorkspaceFolders.fire({ added: [], removed: [], changed: [] });
		await flush(widget);
		assert.strictEqual(search.queries.length, hiddenQueries);

		host.classList.add('visible');
		host.toggleAttribute('hidden', false);
		widget.setFilesTabActive(true);
		await flush(widget);
		assert.ok(search.queries.length > hiddenQueries);

		context.setWorkspace(testWorkspace(TestWorkspace.folders[0].uri, TestWorkspace.folders[0].uri.with({ path: '/other-root' })));
		(context as unknown as { _onDidChangeWorkspaceFolders: { fire(event: unknown): void } })._onDidChangeWorkspaceFolders.fire({ added: [], removed: [], changed: [] });
		await flush(widget);
		await timeout(20);
		assert.ok(search.queries.at(-1)!.folderQueries.length === 1);
		assert.ok(search.queries.length > hiddenQueries + 1);
	});

	test('limitHit explains that the list is incomplete', async function () {
		const { host, widget, search } = mountList.call(this);
		search.impl = async query => ({
			results: [{ resource: query.folderQueries[0].folder.with({ path: `${query.folderQueries[0].folder.path}/a.ts` }) }],
			messages: [],
			limitHit: true,
		});
		await flush(widget);
		const status = await waitForText(host, '.sources-files-status', 'Not all files are listed');
		assert.strictEqual(status, sourcesFilesListTruncatedMessage());
		assert.ok(!(host.querySelector('.sources-files-status') as HTMLElement).classList.contains('is-error'));
	});

	test('does not leak unhandled rejection when refresh catch-path setStatusMessage throws and onUnexpectedError warn-then-rethrows', async function () {
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const { widget, search } = mountList.call(this);
			await flush(widget);
			search.impl = async () => { throw new Error('boom'); };
			(widget as unknown as { setStatusMessage(message: string | undefined): void }).setStatusMessage = message => {
				if (message) {
					throw paintBoom;
				}
			};
			(widget as unknown as { scheduleRefresh(): void }).scheduleRefresh();
			(widget as unknown as { refreshScheduler: { flush(): void } }).refreshScheduler.flush();
		});
	});

	test('renders parent directory beside the file name', async function () {
		const { host, widget, search, context } = mountList.call(this);
		const folder = context.getWorkspace().folders[0].uri;
		search.impl = async () => ({
			results: [
				{ resource: folder.with({ path: `${folder.path}/README.md` }) },
				{ resource: folder.with({ path: `${folder.path}/src/nested.ts` }) },
			],
			messages: [],
			limitHit: false,
		});
		(host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		await flush(widget);
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesFileEntry> });
		assert.strictEqual(list.length, 2);
		const rows = host.querySelectorAll('.sources-files-list .monaco-list-row');
		const names = Array.from(rows).map(row => row.querySelector('.label-name')?.textContent ?? '');
		const descriptions = Array.from(rows).map(row => row.querySelector('.label-description')?.textContent ?? '');
		assert.strictEqual(descriptions[names.indexOf('README.md')], '');
		assert.strictEqual(descriptions[names.indexOf('nested.ts')], 'src');
	});

	test('does not leak unhandled rejection when onDidOpen openEditor rejects and onUnexpectedError warn-then-rethrows', async function () {
		const boom = new Error('open boom');
		await assertWarnThenRethrowDoesNotLeak(boom, async () => {
			const { host, widget } = mountList.call(this);
			(host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesFileEntry> });
			(widget as unknown as { editorService: { openEditor: (...args: unknown[]) => Promise<unknown> } }).editorService.openEditor = async () => {
				throw boom;
			};
			list.setFocus([0]);
			list.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
		});
	});
});
