/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { Pane } from '../../../../../base/browser/ui/splitview/paneview.js';
import { URI } from '../../../../../base/common/uri.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileChangeType, FileChangesEvent, IFileService } from '../../../../../platform/files/common/files.js';
import { ITreeNode } from '../../../../../base/browser/ui/tree/tree.js';
import { getSelectionKeyboardEvent, WorkbenchObjectTree } from '../../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { UniverseAgentConnectionSnapshot, UniverseAgentFileEntry, UniverseAgentListFilesRequest, UniverseAgentListFilesResult, UniverseAgentReadFileRequest, UniverseAgentReadFileResult } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { TestWorkspace, testWorkspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { createFileStat, TestContextService, TestFileService } from '../../../../test/common/workbenchTestServices.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { IFileQuery, ISearchComplete, ISearchService } from '../../../../services/search/common/search.js';
import { SourcesFilesExplorer, SourcesFilesExplorerHost } from '../../browser/sourcesFilesExplorer.js';
import { SourcesFilesList } from '../../browser/sourcesFilesList.js';
import { buildSourcesFileTree, ISourcesFilesTreeNode } from '../../browser/sourcesFilesTree.js';
import { SOURCES_ENGINE_FILE_SCHEME } from '../../common/sourcesFilesEngineRead.js';
import { SOURCES_GIT_DIFF_SCHEME } from '../../browser/sourcesGitDiffContent.js';
import { sourcesFilesListEmptyMessage, sourcesFilesListNoOpenFileMessage, sourcesFilesListReadFailureMessage, sourcesFilesListTruncatedMessage } from '../../browser/sourcesFilesListStrings.js';
import { buildSourcesEngineLevel, filterSourcesLevelNodes, sourcesDirectoryLabel, sourcesEngineParentKey } from '../../browser/sourcesFilesLevel.js';
import { ISourcesFileEntry } from '../../common/sourcesFilesModel.js';
import { SOURCES_EDITOR_OPEN_MODE_SETTING } from '../../../../services/editor/common/editorOpenSlot.js';
import { isExplorerAutoRevealSuppressed } from '../../../../services/editor/common/explorerAutoRevealGate.js';

suite('Sources - Files list search', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	interface ISearchHook {
		queries: IFileQuery[];
		tokens: CancellationToken[];
		impl: (query: IFileQuery, token?: CancellationToken) => Promise<ISearchComplete>;
	}

	interface IFilesListMountOptions {
		readonly workDir?: string;
		readonly sessionId?: string;
		readonly emptyWorkspace?: boolean;
		readonly listFiles?: (request: UniverseAgentListFilesRequest) => Promise<UniverseAgentListFilesResult>;
		readonly readFile?: (request: UniverseAgentReadFileRequest) => Promise<UniverseAgentReadFileResult>;
	}

	function mountList(this: Mocha.Context, options?: IFilesListMountOptions): {
		host: HTMLElement;
		widget: SourcesFilesList;
		fileService: TestFileService;
		search: ISearchHook;
		context: TestContextService;
		folderChange: Emitter<unknown>;
		listFilesCalls: UniverseAgentListFilesRequest[];
		readFileCalls: UniverseAgentReadFileRequest[];
	} {
		const host = document.createElement('div');
		host.style.width = '400px';
		host.style.height = '300px';
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		const context = instantiationService.get(IWorkspaceContextService) as TestContextService;
		if (options?.emptyWorkspace) {
			context.setWorkspace(testWorkspace());
		}
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
		const listFilesCalls: UniverseAgentListFilesRequest[] = [];
		const readFileCalls: UniverseAgentReadFileRequest[] = [];
		const connection: Partial<IUniverseAgentConnection> = {};
		if (options?.listFiles) {
			const listFiles = options.listFiles;
			connection.listFiles = async request => {
				listFilesCalls.push(request);
				return listFiles(request);
			};
		}
		if (options?.readFile) {
			const readFile = options.readFile;
			connection.readFile = async request => {
				readFileCalls.push(request);
				return readFile(request);
			};
		}
		instantiationService.stub(IAgentSessionContext, {
			getActiveSessionId: () => options?.sessionId ?? '',
			isEngineSessionReady: () => false,
			isPairingHold: () => false,
			getSessionWorkDir: () => options?.workDir,
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			acquireSessionView: () => {
				throw new Error('unused');
			},
		});
		instantiationService.stub(IUniverseAgentConnection, connection);
		const folderChange = store.add(new Emitter<unknown>());
		const widget = store.add(instantiationService.createInstance(SourcesFilesList, host));
		const fileService = instantiationService.get(IFileService) as TestFileService;
		return { host, widget, fileService, search, context, folderChange, listFilesCalls, readFileCalls };
	}

	function engineFile(name: string, path: string, isDirectory = false): UniverseAgentFileEntry {
		return { name, path, isDirectory, size: 1, lastModified: 0, mimeType: 'text/plain' };
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

	type SourcesFilesTree = WorkbenchObjectTree<ISourcesFilesTreeNode, void>;

	async function waitForNames(owner: { list?: SourcesFilesTree }, names: readonly string[]): Promise<SourcesFilesTree> {
		const deadline = Date.now() + 2000;
		let last = '';
		while (Date.now() < deadline) {
			const list = owner.list;
			if (list) {
				list.layout(160, 400);
				const rows = list.getNode(null).children.map(child => child.element?.name ?? '');
				last = rows.join(', ');
				if (rows.length === names.length && names.every((name, index) => rows[index] === name)) {
					return list;
				}
			}
			await timeout(20);
		}
		throw new Error(`names stayed ${last}`);
	}

	function namedFile(tree: SourcesFilesTree, name: string): ISourcesFilesTreeNode {
		const stack: ITreeNode<ISourcesFilesTreeNode | null, void>[] = [...tree.getNode(null).children];
		while (stack.length > 0) {
			const node = stack.shift()!;
			if (node.element?.name === name && node.element.file) {
				return node.element;
			}
			stack.push(...node.children);
		}
		throw new Error(name);
	}

	async function waitForTree(owner: { list?: SourcesFilesTree }): Promise<SourcesFilesTree> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const list = owner.list;
			if (list && list.getNode(null).children.length > 0) {
				list.layout(120, 400);
				return list;
			}
			await timeout(20);
		}
		throw new Error('list stayed empty');
	}

	function firstFile(tree: SourcesFilesTree): ISourcesFilesTreeNode {
		const stack: ITreeNode<ISourcesFilesTreeNode | null, void>[] = [...tree.getNode(null).children];
		while (stack.length > 0) {
			const node = stack.shift()!;
			if (node.element?.kind === 'file' && node.element.file) {
				return node.element;
			}
			stack.unshift(...node.children);
		}
		throw new Error('no file row');
	}

	function filePaths(tree: SourcesFilesTree): string[] {
		const paths: string[] = [];
		const stack: ITreeNode<ISourcesFilesTreeNode | null, void>[] = [...tree.getNode(null).children];
		while (stack.length > 0) {
			const node = stack.shift()!;
			const resource = node.element?.file?.resource;
			if (resource) {
				paths.push(resource.path);
			}
			stack.unshift(...node.children);
		}
		return paths;
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

	test('groups a relative path into folder rows', () => {
		const readme: ISourcesFileEntry = { resource: URI.file('/ws/README.md'), name: 'README.md', description: 'README.md' };
		const nested: ISourcesFileEntry = { resource: URI.file('/ws/src/nested.ts'), name: 'nested.ts', description: 'src/nested.ts' };
		const deep: ISourcesFileEntry = { resource: URI.file('/ws/src/a/b.ts'), name: 'b.ts', description: 'src/a/b.ts' };
		const tree = buildSourcesFileTree([nested, readme, deep], false);
		assert.strictEqual(tree[0].element.name, 'src');
		assert.strictEqual(tree[0].element.kind, 'folder');
		assert.strictEqual(tree[0].element.file, undefined);
		const srcChildren = [...tree[0].children!];
		assert.strictEqual(srcChildren[0].element.name, 'a');
		assert.strictEqual([...srcChildren[0].children!][0].element.name, 'b.ts');
		assert.strictEqual(srcChildren[1].element.file?.name, 'nested.ts');
		assert.strictEqual(tree[1].element.file?.name, 'README.md');
	});

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
		const list = await waitForTree(widget as unknown as { list?: SourcesFilesTree });
		assert.strictEqual(list.getNode(null).children.length, 2);
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
		assert.strictEqual(list.getNode(null).children.length, 2);
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
		const list = await waitForTree(widget as unknown as { list?: SourcesFilesTree });
		const leftover = firstFile(list);
		assert.strictEqual(leftover.name, 'leftover.ts');
		assert.strictEqual(list.getNode(null).children[0].element?.kind, 'folder');
		const before = search.queries.length;
		search.impl = async () => { throw new Error('boom'); };
		fileService.fireFileChanges(new FileChangesEvent([{ resource: leftover.file!.resource, type: FileChangeType.UPDATED }], false));
		await flush(widget);
		const status = await waitForText(host, '.sources-files-status', 'Unable to read workspace files');
		assert.strictEqual(status, sourcesFilesListReadFailureMessage(new Error('boom')));
		assert.strictEqual(firstFile(list).name, 'leftover.ts');
		assert.ok(search.queries.length > before);
	});

	test('a cancelled round does not replace a newer result', async function () {
		const { host, widget, search } = mountList.call(this);
		(host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		await flush(widget);
		await waitForTree(widget as unknown as { list?: SourcesFilesTree });
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
		const list = await waitForTree(widget as unknown as { list?: SourcesFilesTree });
		const paths = filePaths(list);
		assert.ok(paths.some(path => path.endsWith('/fresh.ts')));
		assert.ok(!paths.some(path => path.endsWith('/stale.ts')));
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

	test('nests a file under its parent folder', async function () {
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
		const list = await waitForTree(widget as unknown as { list?: SourcesFilesTree });
		const root = list.getNode(null);
		assert.strictEqual(root.children.length, 2);
		assert.strictEqual(root.children[0].element?.name, 'src');
		assert.strictEqual(root.children[0].element?.kind, 'folder');
		assert.strictEqual(root.children[0].children[0].element?.name, 'nested.ts');
		assert.strictEqual(root.children[1].element?.name, 'README.md');
		assert.strictEqual(root.children[1].element?.kind, 'file');
		const rows = host.querySelectorAll('.sources-files-list .monaco-list-row');
		const names = Array.from(rows).map(row => row.querySelector('.label-name')?.textContent ?? '');
		assert.deepStrictEqual(names, ['src', 'nested.ts', 'README.md']);
		assert.ok(rows[0].querySelector('.monaco-tl-twistie'));
		assert.ok(!rows[0].querySelector('.monaco-tl-twistie.collapsed'));
		assert.strictEqual(rows[names.indexOf('nested.ts')].querySelector('.label-description')?.textContent ?? '', '');
	});

	test('row click replaces the current tab, and the setting can ask for a new tab', async function () {
		const { host, widget } = mountList.call(this);
		(host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		const list = await waitForTree(widget as unknown as { list?: SourcesFilesTree });
		const groups = (widget as unknown as { editorGroupsService: { activeGroup: { activeEditor: unknown; editors: unknown[] } } }).editorGroupsService;
		const active = { resource: URI.file('/other.ts'), matches: () => false };
		groups.activeGroup.activeEditor = active;
		groups.activeGroup.editors = [active];
		const calls: string[] = [];
		const editorService = (widget as unknown as { editorService: { openEditor: () => Promise<undefined>; replaceEditors: () => Promise<void> } }).editorService;
		editorService.openEditor = async () => { calls.push('open'); return undefined; };
		editorService.replaceEditors = async () => { calls.push('replace'); };
		const file = firstFile(list);
		list.setFocus([file]);
		list.setSelection([file], getSelectionKeyboardEvent('keydown', false, false));
		await timeout(0);
		assert.deepStrictEqual(calls, ['replace']);

		calls.length = 0;
		const configurationService = (widget as unknown as { configurationService: { getValue: (key: string) => unknown } }).configurationService;
		const original = configurationService.getValue.bind(configurationService);
		configurationService.getValue = (key: string) => key === SOURCES_EDITOR_OPEN_MODE_SETTING ? 'newTab' : original(key);
		list.setSelection([]);
		list.setSelection([file], getSelectionKeyboardEvent('keydown', false, false));
		await timeout(0);
		assert.deepStrictEqual(calls, ['open']);
	});

	test('does not leak unhandled rejection when onDidOpen openEditor rejects and onUnexpectedError warn-then-rethrows', async function () {
		const boom = new Error('open boom');
		await assertWarnThenRethrowDoesNotLeak(boom, async () => {
			const { host, widget } = mountList.call(this);
			(host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
			const list = await waitForTree(widget as unknown as { list?: SourcesFilesTree });
			(widget as unknown as { editorService: { openEditor: (...args: unknown[]) => Promise<unknown> } }).editorService.openEditor = async () => {
				throw boom;
			};
			const file = firstFile(list);
			list.setFocus([file]);
			list.setSelection([file], getSelectionKeyboardEvent('keydown', false, false));
		});
	});

	test('workDir equal to a workspace root does not call listFiles', async function () {
		const folder = TestWorkspace.folders[0].uri;
		const mounted = mountList.call(this, {
			workDir: folder.fsPath,
			sessionId: 'sess-1',
			listFiles: async () => ({ entries: [], total: 0 }),
		});
		await flush(mounted.widget);
		await waitForTree(mounted.widget as unknown as { list?: SourcesFilesTree });
		assert.strictEqual(mounted.listFilesCalls.length, 0);
		assert.ok(mounted.search.queries.length > 0);
	});

	test('workDir with a trailing slash still matches the workspace root', async function () {
		const folder = TestWorkspace.folders[0].uri;
		const mounted = mountList.call(this, {
			workDir: `${folder.fsPath}/`,
			sessionId: 'sess-1',
			listFiles: async () => ({ entries: [], total: 0 }),
		});
		await flush(mounted.widget);
		await waitForTree(mounted.widget as unknown as { list?: SourcesFilesTree });
		assert.strictEqual(mounted.listFilesCalls.length, 0);
		assert.ok(mounted.search.queries.length > 0);
	});

	test('workDir outside every workspace root lists through listFiles and opens read-only text', async function () {
		const opened: Array<{ resource?: { scheme: string }; contents?: string }> = [];
		const mounted = mountList.call(this, {
			workDir: '/engine/proj',
			sessionId: 'sess-1',
			listFiles: async () => ({
				entries: [engineFile('a.ts', '/engine/proj/src/a.ts')],
				total: 1,
			}),
			readFile: async () => ({
				content: VSBuffer.fromString('hello engine').buffer,
				totalSize: 12,
				mimeType: 'text/plain',
				lineCount: 1,
				contentHash: 'abc',
			}),
		});
		(mounted.host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		await flush(mounted.widget);
		const list = await waitForTree(mounted.widget as unknown as { list?: SourcesFilesTree });
		assert.strictEqual(mounted.search.queries.length, 0);
		assert.strictEqual(mounted.listFilesCalls.length, 1);
		assert.strictEqual(mounted.listFilesCalls[0].sessionId, 'sess-1');
		assert.strictEqual(mounted.listFilesCalls[0].path, '/engine/proj');
		assert.strictEqual(mounted.listFilesCalls[0].recursive, true);
		assert.strictEqual(mounted.listFilesCalls[0].pattern, '');
		assert.ok(mounted.listFilesCalls[0].maxResults > 0);
		const file = firstFile(list);
		assert.strictEqual(file.file?.resource.scheme, SOURCES_ENGINE_FILE_SCHEME);
		assert.notStrictEqual(file.file?.resource.scheme, 'file');
		assert.strictEqual(file.file?.engine?.path, '/engine/proj/src/a.ts');
		assert.strictEqual(list.getNode(null).children[0].element?.name, 'src');
		(mounted.widget as unknown as { editorService: { openEditor: (input: { resource?: { scheme: string }; contents?: string }) => Promise<unknown> } }).editorService.openEditor = async input => {
			opened.push(input);
			return undefined;
		};
		list.setFocus([file]);
		list.setSelection([file], getSelectionKeyboardEvent('keydown', false, false));
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline && (mounted.readFileCalls.length === 0 || opened.length === 0)) {
			await timeout(20);
		}
		assert.deepStrictEqual(mounted.readFileCalls, [{
			path: '/engine/proj/src/a.ts',
			sessionId: 'sess-1',
			startLine: 0,
			endLine: 0,
			maxBytes: 0,
		}]);
		assert.strictEqual(opened.length, 1);
		assert.strictEqual(opened[0].resource?.scheme, SOURCES_ENGINE_FILE_SCHEME);
		assert.ok(opened.every(input => input.resource?.scheme !== 'file'));
		assert.strictEqual(opened[0].contents, 'hello engine');
	});

	test('empty workspace with an engine workDir lists files instead of returning nothing', async function () {
		const mounted = mountList.call(this, {
			emptyWorkspace: true,
			workDir: '/engine/proj',
			sessionId: 'sess-1',
			listFiles: async () => ({
				entries: [engineFile('a.ts', '/engine/proj/a.ts'), engineFile('src', '/engine/proj/src', true)],
				total: 2,
			}),
		});
		(mounted.host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		await flush(mounted.widget);
		const list = await waitForTree(mounted.widget as unknown as { list?: SourcesFilesTree });
		assert.strictEqual(mounted.search.queries.length, 0);
		assert.strictEqual(mounted.listFilesCalls.length, 1);
		assert.strictEqual(mounted.listFilesCalls[0].sessionId, 'sess-1');
		assert.strictEqual(mounted.listFilesCalls[0].path, '/engine/proj');
		assert.strictEqual(list.getNode(null).children.length, 1);
		assert.strictEqual(list.getNode(null).children[0].element?.name, 'a.ts');
		assert.strictEqual(list.getNode(null).children[0].element?.kind, 'file');
		assert.notStrictEqual(list.getNode(null).children[0].element?.file?.resource.scheme, 'file');
		const empty = mounted.host.querySelector('.sources-files-empty') as HTMLElement;
		assert.strictEqual(empty.style.display, 'none');
	});

	test('empty workspace without workDir stays an empty list', async function () {
		const mounted = mountList.call(this, {
			emptyWorkspace: true,
			listFiles: async () => ({ entries: [engineFile('a.ts', '/should-not-list')], total: 1 }),
		});
		await flush(mounted.widget);
		const empty = await waitForText(mounted.host, '.sources-files-empty', 'No workspace files');
		assert.strictEqual(empty, sourcesFilesListEmptyMessage);
		assert.strictEqual(mounted.listFilesCalls.length, 0);
		assert.strictEqual(mounted.search.queries.length, 0);
	});

	test('empty workspace with workDir but no listFiles stays an empty list', async function () {
		const mounted = mountList.call(this, {
			emptyWorkspace: true,
			workDir: '/engine/proj',
			sessionId: 'sess-1',
		});
		await flush(mounted.widget);
		const empty = await waitForText(mounted.host, '.sources-files-empty', 'No workspace files');
		assert.strictEqual(empty, sourcesFilesListEmptyMessage);
		assert.strictEqual(mounted.listFilesCalls.length, 0);
		assert.strictEqual(mounted.search.queries.length, 0);
	});

	test('workDir outside roots without listFiles still uses fileSearch', async function () {
		const mounted = mountList.call(this, {
			workDir: '/not-a-root',
			sessionId: 'sess-1',
		});
		await flush(mounted.widget);
		await waitForTree(mounted.widget as unknown as { list?: SourcesFilesTree });
		assert.strictEqual(mounted.listFilesCalls.length, 0);
		assert.ok(mounted.search.queries.length > 0);
	});

	test('list mode shows one level of the current tab folder and a folder click does not open', async function () {
		const mounted = mountList.call(this);
		const folder = mounted.context.getWorkspace().folders[0].uri;
		const resolved: string[] = [];
		mounted.fileService.resolve = async resource => {
			resolved.push(resource.path);
			const src = resource.path.endsWith('/src');
			return createFileStat(resource, false, false, true, false, src ? [
				{ resource: URI.joinPath(resource, 'lib'), isFile: false, isDirectory: true },
				{ resource: URI.joinPath(resource, 'other.ts'), isFile: true, isDirectory: false },
				{ resource: URI.joinPath(resource, 'app.ts'), isFile: true, isDirectory: false },
			] : [
				{ resource: URI.joinPath(resource, 'src'), isFile: false, isDirectory: true },
				{ resource: URI.joinPath(resource, 'README.md'), isFile: true, isDirectory: false },
			]);
		};
		(mounted.host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		await flush(mounted.widget);
		await waitForTree(mounted.widget as unknown as { list?: SourcesFilesTree });
		assert.strictEqual(resolved.length, 0);

		const groups = (mounted.widget as unknown as { editorGroupsService: { mainPart: { activeGroup: { activeEditor: unknown } } } }).editorGroupsService;
		groups.mainPart.activeGroup.activeEditor = { resource: URI.joinPath(folder, 'src', 'app.ts') };
		(mounted.host.querySelector('.sources-files-mode[data-mode="list"]') as HTMLButtonElement).click();
		const list = await waitForNames(mounted.widget as unknown as { list?: SourcesFilesTree }, ['lib', 'app.ts', 'other.ts']);
		assert.strictEqual((mounted.host.querySelector('.sources-files-location') as HTMLElement).textContent, 'src');
		assert.strictEqual((mounted.host.querySelector('.sources-files-mode[data-mode="list"]') as HTMLButtonElement).getAttribute('aria-pressed'), 'true');
		assert.ok(resolved.some(path => path.endsWith('/src')));

		const calls: string[] = [];
		let suppressed = false;
		const editorService = (mounted.widget as unknown as { editorService: { openEditor: () => Promise<undefined>; replaceEditors: () => Promise<void> } }).editorService;
		editorService.openEditor = async () => {
			suppressed = isExplorerAutoRevealSuppressed();
			calls.push('open');
			return undefined;
		};
		editorService.replaceEditors = async () => {
			suppressed = isExplorerAutoRevealSuppressed();
			calls.push('replace');
		};
		const folderRow = list.getNode(null).children.find(child => child.element?.kind === 'folder')?.element;
		assert.ok(folderRow);
		list.setFocus([folderRow!]);
		list.setSelection([folderRow!], getSelectionKeyboardEvent('keydown', false, false));
		await timeout(0);
		assert.deepStrictEqual(calls, []);

		const fileRow = list.getNode(null).children.find(child => child.element?.name === 'other.ts')?.element;
		assert.ok(fileRow?.file);
		list.setFocus([fileRow!]);
		list.setSelection([fileRow!], getSelectionKeyboardEvent('keydown', false, false));
		await timeout(0);
		assert.deepStrictEqual(calls, ['replace']);
		assert.strictEqual(suppressed, true);
		assert.strictEqual(isExplorerAutoRevealSuppressed(), false);

		groups.mainPart.activeGroup.activeEditor = { resource: URI.joinPath(folder, 'README.md') };
		(mounted.widget as unknown as { paintCollected(): void }).paintCollected();
		await waitForNames(mounted.widget as unknown as { list?: SourcesFilesTree }, ['src', 'README.md']);
		assert.strictEqual((mounted.host.querySelector('.sources-files-location') as HTMLElement).textContent, sourcesDirectoryLabel(folder, [folder]));

		(mounted.host.querySelector('.sources-files-mode[data-mode="tree"]') as HTMLButtonElement).click();
		const tree = await waitForTree(mounted.widget as unknown as { list?: SourcesFilesTree });
		assert.ok(tree.getNode(null).children.length > 0);
		assert.strictEqual((mounted.host.querySelector('.sources-files-location') as HTMLElement).style.display, 'none');
		assert.strictEqual((mounted.host.querySelector('.sources-files-mode[data-mode="tree"]') as HTMLButtonElement).getAttribute('aria-pressed'), 'true');
	});

	test('list mode without a file tab explains that the folder is unknown', async function () {
		const mounted = mountList.call(this);
		(mounted.host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		await flush(mounted.widget);
		await waitForTree(mounted.widget as unknown as { list?: SourcesFilesTree });
		(mounted.host.querySelector('.sources-files-mode[data-mode="list"]') as HTMLButtonElement).click();
		const empty = await waitForText(mounted.host, '.sources-files-empty', 'Open a file');
		assert.strictEqual(empty, sourcesFilesListNoOpenFileMessage);
		assert.strictEqual((mounted.host.querySelector('.sources-files-list') as HTMLElement).style.display, 'none');
		assert.strictEqual((mounted.host.querySelector('.sources-files-location') as HTMLElement).style.display, 'none');
	});

	test('list mode keeps the open-file empty state for a virtual preview resource', async function () {
		const mounted = mountList.call(this);
		const resolved: string[] = [];
		mounted.fileService.resolve = async resource => {
			resolved.push(resource.toString());
			return createFileStat(resource, false, false, true, false, []);
		};
		(mounted.host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		await flush(mounted.widget);
		await waitForTree(mounted.widget as unknown as { list?: SourcesFilesTree });
		const groups = (mounted.widget as unknown as { editorGroupsService: { mainPart: { activeGroup: { activeEditor: unknown } } } }).editorGroupsService;
		groups.mainPart.activeGroup.activeEditor = {
			resource: URI.from({ scheme: SOURCES_GIT_DIFF_SCHEME, path: '/proj/src/a.ts' }),
		};
		(mounted.host.querySelector('.sources-files-mode[data-mode="list"]') as HTMLButtonElement).click();
		const empty = await waitForText(mounted.host, '.sources-files-empty', 'Open a file');
		assert.strictEqual(empty, sourcesFilesListNoOpenFileMessage);
		assert.deepStrictEqual(resolved, []);
		assert.strictEqual((mounted.host.querySelector('.sources-files-list') as HTMLElement).style.display, 'none');
		assert.strictEqual((mounted.host.querySelector('.sources-files-location') as HTMLElement).style.display, 'none');
		assert.strictEqual((mounted.host.querySelector('.sources-files-empty') as HTMLElement).classList.contains('is-error'), false);
	});

	test('engine list mode lists the open file directory from the projection', async function () {
		const mounted = mountList.call(this, {
			workDir: '/engine/proj',
			sessionId: 'sess-1',
			listFiles: async () => ({
				entries: [
					engineFile('a.ts', '/engine/proj/src/a.ts'),
					engineFile('b.ts', '/engine/proj/src/b.ts'),
					engineFile('c.ts', '/engine/proj/src/lib/c.ts'),
					engineFile('README.md', '/engine/proj/README.md'),
				],
				total: 4,
			}),
		});
		(mounted.host.querySelector('.sources-files-list') as HTMLElement).style.height = '160px';
		await flush(mounted.widget);
		const tree = await waitForTree(mounted.widget as unknown as { list?: SourcesFilesTree });
		const file = namedFile(tree, 'a.ts');
		assert.strictEqual(sourcesEngineParentKey(file.file?.description ?? ''), 'src');
		const groups = (mounted.widget as unknown as { editorGroupsService: { mainPart: { activeGroup: { activeEditor: unknown } } } }).editorGroupsService;
		groups.mainPart.activeGroup.activeEditor = { resource: file.file?.resource };
		(mounted.host.querySelector('.sources-files-mode[data-mode="list"]') as HTMLButtonElement).click();
		const list = await waitForNames(mounted.widget as unknown as { list?: SourcesFilesTree }, ['lib', 'a.ts', 'b.ts']);
		assert.strictEqual((mounted.host.querySelector('.sources-files-location') as HTMLElement).textContent, 'src');
		assert.ok(![...list.getNode(null).children].some(child => child.element?.name === 'README.md'));
		const calls: string[] = [];
		(mounted.widget as unknown as { editorService: { openEditor: () => Promise<undefined> } }).editorService.openEditor = async () => {
			calls.push('open');
			return undefined;
		};
		const folderRow = list.getNode(null).children.find(child => child.element?.name === 'lib')?.element;
		assert.strictEqual(folderRow?.kind, 'folder');
		assert.strictEqual(folderRow?.file, undefined);
		list.setFocus([folderRow!]);
		list.setSelection([folderRow!], getSelectionKeyboardEvent('keydown', false, false));
		await timeout(0);
		assert.deepStrictEqual(calls, []);
	});
});

suite('Sources - Files current level', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('keeps only the open file parent and sorts folders ahead of files', () => {
		const file = (description: string): ISourcesFileEntry => ({
			resource: URI.file('/' + description),
			name: description.split('/').pop() ?? description,
			description,
		});
		const nodes = buildSourcesEngineLevel([
			file('README.md'),
			file('src/b.ts'),
			file('src/a.ts'),
			file('src/lib/c.ts'),
		], 'src');
		assert.deepStrictEqual(nodes.map(node => node.name), ['lib', 'a.ts', 'b.ts']);
		assert.strictEqual(nodes[0].kind, 'folder');
		assert.strictEqual(nodes[0].file, undefined);
		assert.deepStrictEqual(filterSourcesLevelNodes(nodes, 'b.ts').map(node => node.name), ['b.ts']);
		assert.strictEqual(sourcesEngineParentKey('src/a.ts'), 'src');
		assert.strictEqual(sourcesEngineParentKey('README.md'), '');
	});

	test('names a workspace root by its folder and a nested directory by the relative path', () => {
		const root = URI.file('/work/app');
		assert.strictEqual(sourcesDirectoryLabel(root, [root]), 'app');
		assert.strictEqual(sourcesDirectoryLabel(URI.joinPath(root, 'src'), [root]), 'src');
	});
});

suite('Sources - Files explorer engine directory', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	type SourcesFilesTree = WorkbenchObjectTree<ISourcesFilesTreeNode, void>;

	interface IHostMount {
		readonly container: HTMLElement;
		readonly host: SourcesFilesExplorerHost;
		readonly listFilesCalls: UniverseAgentListFilesRequest[];
		readonly readFileCalls: UniverseAgentReadFileRequest[];
		setWorkDir(workDir: string | undefined): void;
		setListFiles(listFiles: ((request: UniverseAgentListFilesRequest) => Promise<UniverseAgentListFilesResult>) | undefined): void;
		fireSession(): void;
		fireConnection(): void;
	}

	/** Pane stand-in so the workspace-root case does not construct ExplorerView's tree. */
	class SourcesExplorerPaneStub extends Pane {
		constructor() {
			super({ title: 'Files' });
		}
		protected renderHeader(container: HTMLElement): void {
			container.textContent = 'Files';
		}
		protected renderBody(container: HTMLElement): void {
			container.classList.add('sources-explorer-stub');
		}
		protected layoutBody(): void { }
		dockInlineFilter(): void { }
		setVisible(): void { }
	}

	function mountHost(this: Mocha.Context, options?: {
		readonly emptyWorkspace?: boolean;
		readonly workDir?: string;
		readonly withListFiles?: boolean;
		readonly stubExplorer?: boolean;
	}): IHostMount {
		const container = document.createElement('div');
		container.classList.add('sources-tab-panel', 'visible');
		container.style.width = '400px';
		container.style.height = '300px';
		document.body.appendChild(container);
		store.add({ dispose: () => container.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		const context = instantiationService.get(IWorkspaceContextService) as TestContextService;
		if (options?.emptyWorkspace) {
			context.setWorkspace(testWorkspace());
		}

		let workDir = options?.workDir;
		const sessionChanged = store.add(new Emitter<string>());
		instantiationService.stub(IAgentSessionContext, {
			getActiveSessionId: () => 'sess-1',
			isEngineSessionReady: () => false,
			isPairingHold: () => false,
			getSessionWorkDir: () => workDir,
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: sessionChanged.event,
			acquireSessionView: () => {
				throw new Error('unused');
			},
		});

		const listFilesCalls: UniverseAgentListFilesRequest[] = [];
		const readFileCalls: UniverseAgentReadFileRequest[] = [];
		let listFiles: ((request: UniverseAgentListFilesRequest) => Promise<UniverseAgentListFilesResult>) | undefined;
		if (options?.withListFiles) {
			listFiles = async () => ({ entries: [], total: 0 });
		}
		const connectionChanged = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection: IUniverseAgentConnection = {
			onDidChangeConnection: connectionChanged.event,
			listFiles: request => {
				if (!listFiles) {
					return Promise.reject(new Error('listFiles is unavailable'));
				}
				listFilesCalls.push(request);
				return listFiles(request);
			},
			readFile: async request => {
				readFileCalls.push(request);
				return {
					content: VSBuffer.fromString('hello engine').buffer,
					totalSize: 12,
					mimeType: 'text/plain',
					lineCount: 1,
					contentHash: 'abc',
				};
			},
		} as unknown as IUniverseAgentConnection;
		if (!options?.withListFiles) {
			delete (connection as { listFiles?: unknown }).listFiles;
		}
		instantiationService.stub(IUniverseAgentConnection, connection);
		if (options?.stubExplorer) {
			instantiationService.stubInstance(SourcesFilesExplorer, store.add(new SourcesExplorerPaneStub()) as unknown as SourcesFilesExplorer);
		}

		const host = store.add(instantiationService.createInstance(SourcesFilesExplorerHost, container));
		host.setFilesTabActive(true);
		return {
			container,
			host,
			listFilesCalls,
			readFileCalls,
			setWorkDir(next) {
				workDir = next;
			},
			setListFiles(next) {
				listFiles = next;
				if (next) {
					connection.listFiles = request => {
						listFilesCalls.push(request);
						return next(request);
					};
				} else {
					delete (connection as { listFiles?: unknown }).listFiles;
				}
			},
			fireSession() {
				sessionChanged.fire('sess-1');
			},
			fireConnection() {
				connectionChanged.fire({} as UniverseAgentConnectionSnapshot);
			},
		};
	}

	function engineFile(name: string, path: string, isDirectory = false): UniverseAgentFileEntry {
		return { name, path, isDirectory, size: 1, lastModified: 0, mimeType: 'text/plain' };
	}

	function explorerEmpty(container: HTMLElement): HTMLElement {
		const empty = container.querySelector('.sources-files-explorer-empty');
		assert.ok(empty instanceof HTMLElement);
		return empty;
	}

	async function waitForEngineNames(host: SourcesFilesExplorerHost, names: readonly string[]): Promise<SourcesFilesTree> {
		const list = (host as unknown as { engineFiles: { value?: SourcesFilesList } }).engineFiles.value;
		assert.ok(list);
		const owner = list as unknown as { list?: SourcesFilesTree };
		const deadline = Date.now() + 2000;
		let last = '';
		while (Date.now() < deadline) {
			const tree = owner.list;
			if (tree) {
				tree.layout(160, 400);
				const rows = tree.getNode(null).children.map(child => child.element?.name ?? '');
				last = rows.join(', ');
				if (rows.length === names.length && names.every((name, index) => rows[index] === name)) {
					return tree;
				}
			}
			const scheduler = (list as unknown as { refreshScheduler: { isScheduled(): boolean; flush(): void } }).refreshScheduler;
			if (scheduler.isScheduled()) {
				scheduler.flush();
			}
			await timeout(20);
		}
		throw new Error(`engine names stayed ${last}`);
	}

	test('no folder and no engine directory keeps the empty state', async function () {
		const mounted = mountHost.call(this, { emptyWorkspace: true, withListFiles: true });
		await timeout(0);
		const empty = explorerEmpty(mounted.container);
		assert.strictEqual(empty.style.display, '');
		assert.strictEqual(empty.textContent, 'You have not yet opened a folder.');
		assert.strictEqual(mounted.container.querySelector('.sources-files-engine'), null);
		assert.strictEqual(mounted.listFilesCalls.length, 0);

		mounted.setListFiles(undefined);
		mounted.setWorkDir('/engine/proj');
		mounted.fireSession();
		await timeout(0);
		assert.strictEqual(explorerEmpty(mounted.container).style.display, '');
		assert.strictEqual(mounted.container.querySelector('.sources-files-engine'), null);
		assert.strictEqual(mounted.listFilesCalls.length, 0);
	});

	test('empty workspace with an engine workDir lists that directory and opens its text', async function () {
		const mounted = mountHost.call(this, { emptyWorkspace: true });
		mounted.setListFiles(async () => ({
			entries: [engineFile('a.ts', '/engine/proj/a.ts'), engineFile('src', '/engine/proj/src', true)],
			total: 2,
		}));
		mounted.setWorkDir('/engine/proj');
		mounted.fireConnection();
		const row = mounted.container.querySelector('.sources-files-list') as HTMLElement;
		assert.ok(row);
		row.style.height = '120px';
		const tree = await waitForEngineNames(mounted.host, ['a.ts']);
		assert.strictEqual(mounted.listFilesCalls.length, 1);
		assert.strictEqual(mounted.listFilesCalls[0].sessionId, 'sess-1');
		assert.strictEqual(mounted.listFilesCalls[0].path, '/engine/proj');
		assert.strictEqual(mounted.listFilesCalls[0].recursive, true);
		assert.strictEqual(mounted.listFilesCalls[0].pattern, '');
		assert.strictEqual(explorerEmpty(mounted.container).style.display, 'none');
		assert.strictEqual(mounted.container.querySelector('.monaco-pane-view'), null);
		const file = tree.getNode(null).children[0].element;
		assert.strictEqual(file?.file?.resource.scheme, SOURCES_ENGINE_FILE_SCHEME);
		assert.strictEqual(file?.file?.engine?.path, '/engine/proj/a.ts');

		const opened: Array<{ resource?: { scheme: string }; contents?: string }> = [];
		const editorService = (mounted.host as unknown as {
			engineFiles: { value?: { editorService: { openEditor: (input: { resource?: { scheme: string }; contents?: string }) => Promise<unknown> } } };
		}).engineFiles.value;
		assert.ok(editorService);
		editorService.editorService.openEditor = async input => {
			opened.push(input);
			return undefined;
		};
		tree.setFocus([file!]);
		tree.setSelection([file!], getSelectionKeyboardEvent('keydown', false, false));
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline && (mounted.readFileCalls.length === 0 || opened.length === 0)) {
			await timeout(20);
		}
		assert.deepStrictEqual(mounted.readFileCalls, [{
			path: '/engine/proj/a.ts',
			sessionId: 'sess-1',
			startLine: 0,
			endLine: 0,
			maxBytes: 0,
		}]);
		assert.strictEqual(opened.length, 1);
		assert.strictEqual(opened[0].resource?.scheme, SOURCES_ENGINE_FILE_SCHEME);
		assert.strictEqual(opened[0].contents, 'hello engine');
	});

	test('workDir outside an open workspace lists the engine directory', async function () {
		const mounted = mountHost.call(this, { workDir: '/engine/proj', withListFiles: true });
		mounted.setListFiles(async () => ({
			entries: [engineFile('note.md', '/engine/proj/note.md')],
			total: 1,
		}));
		mounted.fireSession();
		const row = mounted.container.querySelector('.sources-files-list') as HTMLElement;
		assert.ok(row);
		row.style.height = '120px';
		await waitForEngineNames(mounted.host, ['note.md']);
		assert.strictEqual(mounted.listFilesCalls[0].path, '/engine/proj');
		assert.strictEqual(mounted.container.querySelector('.monaco-pane-view'), null);
		assert.strictEqual(explorerEmpty(mounted.container).style.display, 'none');
	});

	test('workDir equal to the open workspace root keeps the explorer', async function () {
		const folder = TestWorkspace.folders[0].uri;
		const mounted = mountHost.call(this, {
			workDir: `${folder.fsPath}/`,
			withListFiles: true,
			stubExplorer: true,
		});
		await timeout(300);
		assert.strictEqual(mounted.listFilesCalls.length, 0);
		assert.strictEqual(mounted.container.querySelector('.sources-files-engine'), null);
		assert.strictEqual(explorerEmpty(mounted.container).style.display, 'none');
		assert.ok(mounted.container.querySelector('.monaco-pane-view'));
	});
});
