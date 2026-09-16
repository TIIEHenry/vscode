/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { FileChangeType, FileChangesEvent, IFileService } from '../../../../../platform/files/common/files.js';
import { getSelectionKeyboardEvent, WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { NullFilesConfigurationService, TestFileService } from '../../../../test/common/workbenchTestServices.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ExplorerItem } from '../../../files/common/explorerModel.js';
import { SortOrder } from '../../../files/common/files.js';
import { SourcesFilesList } from '../../browser/sourcesFilesList.js';
import { sourcesFilesListEmptyMessage, sourcesFilesListReadFailureMessage } from '../../browser/sourcesFilesListStrings.js';
import { ISourcesFileEntry } from '../../common/sourcesFilesModel.js';

suite('Sources - Files list leftover honesty', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const configService = new TestConfigurationService();
	const fileService = new TestFileService();

	function createStat(this: Mocha.Context, path: string, name: string, isFolder: boolean): ExplorerItem {
		return new ExplorerItem(toResource.call(this, path), fileService, configService, NullFilesConfigurationService, undefined, isFolder, false, false, false, name);
	}

	function createThrowingRoot(this: Mocha.Context): ExplorerItem {
		const root = createStat.call(this, '/project', 'project', true);
		root.fetchChildren = async () => {
			throw new Error('boom');
		};
		return root;
	}

	function mountList(this: Mocha.Context, roots: ExplorerItem[]): {
		host: HTMLElement;
		widget: SourcesFilesList;
		explorer: { roots: ExplorerItem[] };
		fileService: TestFileService;
	} {
		const host = document.createElement('div');
		host.style.width = '400px';
		host.style.height = '300px';
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const explorer = {
			roots,
			sortOrderConfiguration: { sortOrder: SortOrder.Default },
		};
		const instantiationService = workbenchInstantiationService(undefined, store);
		const testFileService = instantiationService.get(IFileService) as TestFileService;
		instantiationService.stub(IExplorerService, explorer as IExplorerService);
		const widget = store.add(instantiationService.createInstance(SourcesFilesList, host));
		return { host, widget, explorer, fileService: testFileService };
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
			const list = (owner as { list?: WorkbenchList<ISourcesFileEntry> }).list;
			if (list && list.length > 0) {
				list.layout(120, 400);
				return list;
			}
			await timeout(20);
		}
		throw new Error('list stayed empty');
	}

	async function assertWarnThenRethrowDoesNotLeak(paintBoom: Error, run: () => void | Promise<void>): Promise<void> {
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
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

	test('first fetchChildren throw paints failure, not empty-workspace success', async function () {
		const { host } = mountList.call(this, [createThrowingRoot.call(this)]);
		const empty = await waitForText(host, '.sources-files-empty', 'Unable to read workspace files');
		assert.strictEqual(empty, sourcesFilesListReadFailureMessage(new Error('boom')));
		assert.ok(!empty.includes(sourcesFilesListEmptyMessage));
		assert.ok(!host.querySelector('.sources-files-list .monaco-list-row'));
	});

	test('success then fetchChildren throw keeps leftover rows and paints status', async function () {
		const root = createStat.call(this, '/project', 'project', true);
		root._isDirectoryResolved = true;
		const leftover = createStat.call(this, '/project/src/leftover.ts', 'leftover.ts', false);
		root.addChild(leftover);

		const { host, widget, explorer, fileService } = mountList.call(this, [root]);
		(host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesFileEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).name, 'leftover.ts');

		explorer.roots = [createThrowingRoot.call(this)];
		fileService.fireFileChanges(new FileChangesEvent([{ resource: leftover.resource, type: FileChangeType.UPDATED }], false));

		const status = await waitForText(host, '.sources-files-status', 'Unable to read workspace files');
		assert.strictEqual(status, sourcesFilesListReadFailureMessage(new Error('boom')));
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).name, 'leftover.ts');
		assert.notStrictEqual((host.querySelector('.sources-files-status') as HTMLElement).style.display, 'none');
	});

	test('does not leak unhandled rejection when refresh catch-path setStatusMessage throws and onUnexpectedError warn-then-rethrows', async function () {
		// refresh() already catches fetchChildren throw; a lone inner reject does not leak.
		// The void scheduler call site still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const root = createStat.call(this, '/project', 'project', true);
			root._isDirectoryResolved = true;
			const leftover = createStat.call(this, '/project/src/leftover.ts', 'leftover.ts', false);
			root.addChild(leftover);

			const { host, widget, explorer } = mountList.call(this, [root]);
			(host.querySelector('.sources-files-list') as HTMLElement).style.height = '120px';
			await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesFileEntry> });

			(widget as unknown as { setStatusMessage(message: string | undefined): void }).setStatusMessage = message => {
				if (message) {
					throw paintBoom;
				}
			};
			explorer.roots = [createThrowingRoot.call(this)];
			(widget as unknown as { scheduleRefresh(): void }).scheduleRefresh();
			(widget as unknown as { refreshScheduler: { flush(): void } }).refreshScheduler.flush();
		});
	});

	test('does not leak unhandled rejection when onDidOpen openEditor rejects and onUnexpectedError warn-then-rethrows', async function () {
		// onDidOpen has no paint path. openEditor reject still needs double catch:
		// a lone `.catch(onUnexpectedError)` leaks when the handler warn-then-rethrows.
		const boom = new Error('open boom');
		await assertWarnThenRethrowDoesNotLeak(boom, async () => {
			const root = createStat.call(this, '/project', 'project', true);
			root._isDirectoryResolved = true;
			const leftover = createStat.call(this, '/project/src/leftover.ts', 'leftover.ts', false);
			root.addChild(leftover);

			const { host, widget } = mountList.call(this, [root]);
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
