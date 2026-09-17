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
const TASK_REL = 'src/vs/workbench/api/common/extHostTask.ts';
const NODE_TASK_REL = 'src/vs/workbench/api/node/extHostTask.ts';
const NODE_LOGGER_REL = 'src/vs/workbench/api/node/extHostLoggerService.ts';
const URLS_REL = 'src/vs/workbench/api/common/extHostUrls.ts';
const PROTOCOL_REL = 'src/vs/workbench/api/common/extHost.protocol.ts';
const AUTH_REL = 'src/vs/workbench/api/common/extHostAuthentication.ts';
const WINDOW_REL = 'src/vs/workbench/api/common/extHostWindow.ts';
const TABS_REL = 'src/vs/workbench/api/browser/mainThreadEditorTabs.ts';
const TREES_REL = 'src/vs/workbench/api/browser/mainThreadTreeViews.ts';
const CONFIG_REL = 'src/vs/workbench/api/common/extHostConfiguration.ts';
const SEARCH_REL = 'src/vs/workbench/api/node/extHostSearch.ts';
const TOOLS_REL = 'src/vs/workbench/api/common/extHostLanguageModelTools.ts';
const WORKSPACE_REL = 'src/vs/workbench/api/browser/mainThreadWorkspace.ts';
const LOGGER_REL = 'src/vs/workbench/api/common/extHostLoggerService.ts';
const DEBUG_REL = 'src/vs/workbench/api/common/extHostDebugService.ts';
const EXT_SERVICE_REL = 'src/vs/workbench/api/common/extHostExtensionService.ts';
const OUTPUT_REL = 'src/vs/workbench/api/common/extHostOutput.ts';
const NOTEBOOK_REL = 'src/vs/workbench/api/common/extHostNotebookKernels.ts';
const TELEMETRY_REL = 'src/vs/workbench/api/common/extHostTelemetry.ts';
const CHAT_SESSIONS_REL = 'src/vs/workbench/api/common/extHostChatSessions.ts';
const DATA_CHANNELS_REL = 'src/vs/workbench/api/browser/mainThreadDataChannels.ts';
const WORKER_REL = 'src/vs/workbench/api/worker/extensionHostWorker.ts';
const EXT_WORKSPACE_REL = 'src/vs/workbench/api/common/extHostWorkspace.ts';
const TERMINAL_REL = 'src/vs/workbench/api/browser/mainThreadTerminalService.ts';
const MAIN_WINDOW_REL = 'src/vs/workbench/api/browser/mainThreadWindow.ts';
const SHELL_REL = 'src/vs/workbench/api/common/extHostTerminalShellIntegration.ts';

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
const leftoverFiles = [TASK_REL, NODE_TASK_REL, NODE_LOGGER_REL, URLS_REL];

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async ') || signature.includes('Thenable<') || signature.includes('CancelablePromise<'));
}

function assertDoubleThen(source: string, call: string, catchChain: string = doubleCatch): void {
	assert.ok(source.includes(`${call}${catchChain};`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	assert.ok(!source.includes(`${call}.catch(errors.onUnexpectedError);`));
}

function countDoubleChains(source: string): number {
	const named = source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? [];
	const namespaced = source.match(/\.catch\(errors\.onUnexpectedError\)\.catch\(errors\.onUnexpectedError\)/g) ?? [];
	return named.length + namespaced.length;
}

suite('workbench/api still leftover Promise fire-and-forget catch scan (D724)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers leftover Promise double-chain sites after D717', () => {
		let sites = 0;
		for (const rel of leftoverFiles) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += countDoubleChains(source);
		}
		assert.ok(sites >= 4 && sites <= 8, `expected 4-8 leftover sites, got ${sites}`);
		assert.strictEqual(sites, 8);
	});

	test('task leftover $registerSupportedExecutions / $registerTaskProvider / $unregisterTaskProvider are Promise double-chain; $registerTaskSystem stays sync void', () => {
		const source = fs.readFileSync(resolveSource(TASK_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$registerSupportedExecutions(custom?: boolean, shell?: boolean, process?: boolean): Promise<void>;');
		assertPromiseSignature(protocol, '$registerTaskProvider(handle: number, type: string): Promise<void>;');
		assertPromiseSignature(protocol, '$unregisterTaskProvider(handle: number): Promise<void>;');
		assert.ok(protocol.includes('$registerTaskSystem(scheme: string, info: tasks.ITaskSystemInfoDTO): void;'));
		assert.ok(source.includes("import { ErrorNoTelemetry, NotSupportedError, onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._proxy.$registerSupportedExecutions(true)');
		assertDoubleThen(source, 'this._proxy.$registerTaskProvider(handle, type)');
		assertDoubleThen(source, 'this._proxy.$unregisterTaskProvider(handle)');
		assert.ok(source.includes('this._proxy.$registerTaskSystem(scheme, info);'));
		assert.ok(!source.includes('$registerTaskSystem(scheme, info).catch'));
	});

	test('node task leftover $registerSupportedExecutions is Promise double-chain; $executeTask empty catch stays leftover', () => {
		const source = fs.readFileSync(resolveSource(NODE_TASK_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$registerSupportedExecutions(custom?: boolean, shell?: boolean, process?: boolean): Promise<void>;');
		assertPromiseSignature(protocol, '$executeTask(task: tasks.ITaskHandleDTO | tasks.ITaskDTO): Promise<tasks.ITaskExecutionDTO>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._proxy.$registerSupportedExecutions(true, true, true)');
		assert.ok(source.includes('this._proxy.$executeTask(handleDto).catch(() => { /* The error here isn\'t actionable. */ });'));
		assert.ok(source.includes('this._proxy.$executeTask(dto).catch(() => { /* The error here isn\'t actionable. */ });'));
		assert.ok(!source.includes('$executeTask(handleDto).catch(onUnexpectedError)'));
		assert.ok(!source.includes('$executeTask(dto).catch(onUnexpectedError)'));
	});

	test('node logger leftover $registerLogger / $deregisterLogger are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(NODE_LOGGER_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$registerLogger(logger: UriDto<ILoggerResource>): Promise<void>;');
		assertPromiseSignature(protocol, '$deregisterLogger(resource: UriComponents): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._proxy.$registerLogger(resource)');
		assertDoubleThen(source, 'this._proxy.$deregisterLogger(resource)');
	});

	test('urls leftover $registerUriHandler / $unregisterUriHandler are Promise double-chain; opener $openUri stays skipped', () => {
		const source = fs.readFileSync(resolveSource(URLS_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		const windowSource = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		assertPromiseSignature(protocol, '$registerUriHandler(handle: number, extensionId: ExtensionIdentifier, extensionDisplayName: string): Promise<void>;');
		assertPromiseSignature(protocol, '$unregisterUriHandler(handle: number): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._proxy.$registerUriHandler(handle, extensionId, extension.displayName || extension.name)');
		assertDoubleThen(source, 'this._proxy.$unregisterUriHandler(handle)');
		assert.ok(windowSource.includes('return this._proxy.$openUri(stringOrUri, uriAsString, options);'));
		assert.ok(!windowSource.includes('$openUri(stringOrUri, uriAsString, options).catch'));
	});

	test('D717 API-method $sendDidChangeSessions leftover / opener / D145 / Watch / Connect / Pty / two-arg / $reveal / terminate / already-double stay skipped', () => {
		const auth = fs.readFileSync(resolveSource(AUTH_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const windowSource = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const trees = fs.readFileSync(resolveSource(TREES_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const search = fs.readFileSync(resolveSource(SEARCH_REL), 'utf8');
		const tools = fs.readFileSync(resolveSource(TOOLS_REL), 'utf8');
		const workspace = fs.readFileSync(resolveSource(WORKSPACE_REL), 'utf8');
		const logger = fs.readFileSync(resolveSource(LOGGER_REL), 'utf8');
		const debug = fs.readFileSync(resolveSource(DEBUG_REL), 'utf8');
		const extService = fs.readFileSync(resolveSource(EXT_SERVICE_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const chatSessions = fs.readFileSync(resolveSource(CHAT_SESSIONS_REL), 'utf8');
		const dataChannels = fs.readFileSync(resolveSource(DATA_CHANNELS_REL), 'utf8');
		const worker = fs.readFileSync(resolveSource(WORKER_REL), 'utf8');
		const extWorkspace = fs.readFileSync(resolveSource(EXT_WORKSPACE_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const mainWindow = fs.readFileSync(resolveSource(MAIN_WINDOW_REL), 'utf8');
		const shell = fs.readFileSync(resolveSource(SHELL_REL), 'utf8');

		assertPromiseSignature(protocol, '$sendDidChangeSessions(providerId: string, event: Dto<AuthenticationSessionsChangeEvent>): Promise<void>;');
		assert.ok(auth.includes('provider.onDidChangeSessions(e => this._proxy.$sendDidChangeSessions(id, e));'));
		assert.ok(!auth.includes('$sendDidChangeSessions(id, e).catch'));

		assert.ok(output.includes('channelPromise.then(channel => channel.append(value));'));
		assert.ok(!output.includes('channelPromise.then(channel => channel.append(value)).catch'));

		assert.ok(windowSource.includes('return this._proxy.$openUri(stringOrUri, uriAsString, options);'));
		assert.ok(!windowSource.includes('$openUri(stringOrUri, uriAsString, options).catch'));
		assert.ok(mainWindow.includes('async $openUri(uriComponents: UriComponents, uriString: string | undefined, options: IOpenUriOptions): Promise<boolean> {'));
		assert.ok(!/this\._openerService\.open\([^;]+\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(mainWindow));

		assert.ok(dataChannels.includes('void this._proxy.$createLinkPresentationWatcher(handle, providerHandle, resource).then('));
		assert.ok(!dataChannels.includes(doubleCatch));

		assert.ok(worker.includes('connectToRenderer(res.protocol).then(data => {'));
		assert.ok(!/connectToRenderer\([^)]*\)\.then\([^;]+\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(worker));

		assert.ok(extWorkspace.includes('this._proxy.$updateWorkspaceFolders(extName, index, deleteCount, validatedDistinctWorkspaceFoldersToAdd).then(undefined, error => {'));
		assert.ok(!extWorkspace.includes(`$updateWorkspaceFolders(extName, index, deleteCount, validatedDistinctWorkspaceFoldersToAdd).then(undefined, error => {}${doubleCatch}`));

		assert.ok(terminal.includes('instance.processReady.then(() => this._onTerminalProcessIdReady(instance));'));
		assert.ok(!terminal.includes('instance.processReady.then(() => this._onTerminalProcessIdReady(instance)).catch'));

		assert.ok(trees.includes('return this.viewsService.openView(treeViewId, options.focus)'));
		assert.ok(!/openView\([^)]*\)[\s\S]{0,80}\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(trees));

		assert.ok(extService.includes('Promise.race([timeout(5000), extensionsDeactivated]).finally(() => {'));
		assert.ok(!/Promise\.race\(\[timeout\(5000\), extensionsDeactivated\]\)\.finally\([^;]+\)\.catch\(errors\.onUnexpectedError\)\.catch\(errors\.onUnexpectedError\)/.test(extService));

		assert.ok(chatSessions.includes('void this.#proxy.$addOrUpdateChatSessionItem(this.#controllerHandle, typeConvert.ChatSessionItem.from(item));'));
		assert.ok(!chatSessions.includes('$addOrUpdateChatSessionItem(this.#controllerHandle, typeConvert.ChatSessionItem.from(item)).catch'));

		assert.ok(shell.includes('currentExecution.flush().then(() => {'));
		assert.ok(!/currentExecution\.flush\(\)\.then\([\s\S]{0,280}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(shell));

		assert.ok(notebook.includes('this._proxy.$addKernelDetectionTask(handle, viewType);'));
		assert.ok(!notebook.includes('$addKernelDetectionTask(handle, viewType).catch'));
		assert.ok(notebook.includes('this._proxy.$addKernelSourceActionProvider(handle, handle, viewType);'));
		assert.ok(!notebook.includes('$addKernelSourceActionProvider(handle, handle, viewType).catch'));

		for (const source of [windowSource, tabs, trees, config, search, tools, workspace, logger, debug, extService, output, notebook, telemetry, chatSessions]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
		}
	});
});
