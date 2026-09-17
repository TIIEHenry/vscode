/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const WINDOW_REL = 'src/vs/workbench/api/common/extHostWindow.ts';
const TABS_REL = 'src/vs/workbench/api/browser/mainThreadEditorTabs.ts';
const TREES_REL = 'src/vs/workbench/api/browser/mainThreadTreeViews.ts';
const CONFIG_REL = 'src/vs/workbench/api/common/extHostConfiguration.ts';
const SEARCH_REL = 'src/vs/workbench/api/node/extHostSearch.ts';
const TOOLS_REL = 'src/vs/workbench/api/common/extHostLanguageModelTools.ts';
const WORKSPACE_REL = 'src/vs/workbench/api/browser/mainThreadWorkspace.ts';
const LOGGER_REL = 'src/vs/workbench/api/common/extHostLoggerService.ts';
const PROTOCOL_REL = 'src/vs/workbench/api/common/extHost.protocol.ts';
const GROUPS_REL = 'src/vs/workbench/services/editor/common/editorGroupsService.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const WORKSPACE_IFACE_REL = 'src/vs/platform/workspace/common/workspace.ts';
const PROVIDERS_REL = 'src/vs/workbench/api/common/extHostDocumentContentProviders.ts';
const DATA_CHANNELS_REL = 'src/vs/workbench/api/browser/mainThreadDataChannels.ts';
const WORKER_REL = 'src/vs/workbench/api/worker/extensionHostWorker.ts';
const EXT_WORKSPACE_REL = 'src/vs/workbench/api/common/extHostWorkspace.ts';
const TERMINAL_REL = 'src/vs/workbench/api/browser/mainThreadTerminalService.ts';
const MAIN_WINDOW_REL = 'src/vs/workbench/api/browser/mainThreadWindow.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertDoubleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch};`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('workbench/api leftover Promise fire-and-forget catch scan (D708)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const files = [WINDOW_REL, TABS_REL, TREES_REL, CONFIG_REL, SEARCH_REL, TOOLS_REL, WORKSPACE_REL, LOGGER_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.ok(sites >= 4 && sites <= 8, `expected 4-8 leftover sites, got ${sites}`);
		assert.strictEqual(sites, 8);
	});

	test('extHostWindow leftover $getInitialState then is Promise double-chain; opener $openUri stays skipped', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$getInitialState(): Promise<{ isFocused: boolean; isActive: boolean }>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `this._proxy.$getInitialState().then(({ isFocused, isActive }) => {
			this.onDidChangeWindowProperty('focused', isFocused);
			this.onDidChangeWindowProperty('active', isActive);
		})`;
		assertDoubleThen(source, thenCall);
		assert.ok(source.includes('return this._proxy.$openUri(stringOrUri, uriAsString, options);'));
		assert.ok(!source.includes('$openUri(stringOrUri, uriAsString, options).catch'));
	});

	test('mainThreadEditorTabs leftover whenReady then is Promise double-chain; sync _createTabsModel stays skipped', () => {
		const source = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(GROUPS_REL), 'utf8');
		assertPromiseSignature(groups, 'readonly whenReady: Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._editorGroupsService.whenReady.then(() => this._createTabsModel())');
		assert.ok(source.includes('private _createTabsModel(): void {'));
		assert.ok(!source.includes('this._createTabsModel().catch'));
	});

	test('mainThreadTreeViews leftover whenInstalledExtensionsRegistered then is Promise double-chain; $reveal return stays skipped', () => {
		const source = fs.readFileSync(resolveSource(TREES_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `this.extensionService.whenInstalledExtensionsRegistered().then(() => {
			const dataProvider = new TreeViewDataProvider(treeViewId, this._proxy, this.notificationService);
			const disposables = new DisposableStore();
			this._dataProviders.set(treeViewId, { dataProvider, dispose: () => disposables.dispose() });
			const dndController = (options.hasHandleDrag || options.hasHandleDrop)
				? new TreeViewDragAndDropController(treeViewId, options.dropMimeTypes, options.dragMimeTypes, options.hasHandleDrag, this._proxy) : undefined;
			const viewer = this.getTreeView(treeViewId);
			if (viewer) {
				// Order is important here. The internal tree isn't created until the dataProvider is set.
				// Set all other properties first!
				viewer.showCollapseAllAction = options.showCollapseAll;
				viewer.canSelectMany = options.canSelectMany;
				viewer.manuallyManageCheckboxes = options.manuallyManageCheckboxes;
				viewer.dragAndDropController = dndController;
				if (dndController) {
					this._dndControllers.set(treeViewId, dndController);
				}
				viewer.dataProvider = dataProvider;
				this.registerListeners(treeViewId, viewer, disposables);
				this._proxy.$setVisible(treeViewId, viewer.visible);
			} else {
				this.notificationService.error('No view is registered with id: ' + treeViewId);
			}
		})`;
		assertDoubleThen(source, thenCall);
		assert.ok(source.includes('return this.viewsService.openView(treeViewId, options.focus)'));
		assert.ok(!source.includes(`openView(treeViewId, options.focus)
			.then(() => {}${doubleCatch}`));
		assert.ok(!/openView\([^)]*\)\s*\.then\([^;]+\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
	});

	test('extHostConfiguration leftover getConfigProvider then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(source, 'public getConfigProvider(): Promise<ExtHostConfigProvider> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.getConfigProvider().then(provider => provider.$acceptConfigurationChanged(data, change))');
	});

	test('extHostSearch leftover getConfigProvider then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(config, 'public getConfigProvider(): Promise<ExtHostConfigProvider> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `configurationService.getConfigProvider().then(provider => {
			if (this.isDisposed) {
				return;
			}
			this._disposables.add(provider.onDidChangeConfiguration(this.handleConfigurationChanged));
		})`;
		assertDoubleThen(source, thenCall);
	});

	test('extHostLanguageModelTools leftover $getTools then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TOOLS_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$getTools(): Promise<Dto<IToolDataDto>[]>;');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `this._proxy.$getTools().then(tools => {
			for (const tool of tools) {
				this._allTools.set(tool.id, new Tool(revive(tool)));
			}
		})`;
		assertDoubleThen(source, thenCall);
	});

	test('mainThreadWorkspace leftover getCompleteWorkspace then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WORKSPACE_REL), 'utf8');
		const workspace = fs.readFileSync(resolveSource(WORKSPACE_IFACE_REL), 'utf8');
		assertPromiseSignature(workspace, 'getCompleteWorkspace(): Promise<IWorkspace>;');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._contextService.getCompleteWorkspace().then(workspace => this._proxy.$initializeWorkspace(this.getWorkspaceData(workspace), this.isWorkspaceTrusted()))');
	});

	test('extHostLoggerService leftover $createLogger then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(LOGGER_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$createLogger(file: UriComponents, options?: ILoggerOptions): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `this.proxy.$createLogger(file, loggerOptions)
			.then(() => {
				this.doLog(this.buffer);
				this.isLoggerCreated = true;
			})`;
		assertDoubleThen(source, thenCall);
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / already-double / two-arg then stay skipped', () => {
		const windowSource = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const trees = fs.readFileSync(resolveSource(TREES_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const search = fs.readFileSync(resolveSource(SEARCH_REL), 'utf8');
		const tools = fs.readFileSync(resolveSource(TOOLS_REL), 'utf8');
		const workspace = fs.readFileSync(resolveSource(WORKSPACE_REL), 'utf8');
		const logger = fs.readFileSync(resolveSource(LOGGER_REL), 'utf8');
		const providers = fs.readFileSync(resolveSource(PROVIDERS_REL), 'utf8');
		const dataChannels = fs.readFileSync(resolveSource(DATA_CHANNELS_REL), 'utf8');
		const worker = fs.readFileSync(resolveSource(WORKER_REL), 'utf8');
		const extWorkspace = fs.readFileSync(resolveSource(EXT_WORKSPACE_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const mainWindow = fs.readFileSync(resolveSource(MAIN_WINDOW_REL), 'utf8');

		assert.ok(windowSource.includes('return this._proxy.$openUri(stringOrUri, uriAsString, options);'));
		assert.ok(mainWindow.includes('async $openUri(uriComponents: UriComponents, uriString: string | undefined, options: IOpenUriOptions): Promise<boolean> {'));
		assert.ok(!/this\._openerService\.open\([^;]+\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(mainWindow));

		assert.ok(providers.includes(`					.catch(onUnexpectedError)
					.catch(onUnexpectedError)`));
		assert.ok(!providers.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));

		assert.ok(dataChannels.includes('void this._proxy.$createLinkPresentationWatcher(handle, providerHandle, resource).then('));
		assert.ok(!dataChannels.includes(doubleCatch));

		assert.ok(worker.includes('connectToRenderer(res.protocol).then(data => {'));
		assert.ok(!worker.includes(`connectToRenderer(res.protocol).then(data => {}${doubleCatch}`));
		assert.ok(!/connectToRenderer\([^)]*\)\.then\([^;]+\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(worker));

		assert.ok(extWorkspace.includes('this._proxy.$updateWorkspaceFolders(extName, index, deleteCount, validatedDistinctWorkspaceFoldersToAdd).then(undefined, error => {'));
		assert.ok(!extWorkspace.includes(`$updateWorkspaceFolders(extName, index, deleteCount, validatedDistinctWorkspaceFoldersToAdd).then(undefined, error => {}${doubleCatch}`));

		assert.ok(terminal.includes('instance.processReady.then(() => this._onTerminalProcessIdReady(instance));'));
		assert.ok(!terminal.includes('instance.processReady.then(() => this._onTerminalProcessIdReady(instance)).catch'));

		assert.ok(trees.includes('return this.viewsService.openView(treeViewId, options.focus)'));
		assert.ok(!/openView\([^)]*\)[\s\S]{0,80}\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(trees));

		for (const source of [windowSource, tabs, trees, config, search, tools, workspace, logger]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
