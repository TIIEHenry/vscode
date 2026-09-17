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
const TERMINAL_REL = 'src/vs/workbench/api/browser/mainThreadTerminalService.ts';
const SOCKETS_REL = 'src/vs/workbench/api/common/extHostManagedSockets.ts';
const PROFILE_REL = 'src/vs/workbench/api/common/extHostProfileContentHandler.ts';
const NOTEBOOK_REL = 'src/vs/workbench/api/common/extHostNotebook.ts';
const TREES_REL = 'src/vs/workbench/api/common/extHostTreeViews.ts';
const PROTOCOL_REL = 'src/vs/workbench/api/common/extHost.protocol.ts';
const REMOTE_REL = 'src/vs/workbench/services/remote/common/remoteAgentService.ts';
const AUTH_REL = 'src/vs/workbench/api/common/extHostAuthentication.ts';
const WINDOW_REL = 'src/vs/workbench/api/common/extHostWindow.ts';
const TABS_REL = 'src/vs/workbench/api/browser/mainThreadEditorTabs.ts';
const MAIN_TREES_REL = 'src/vs/workbench/api/browser/mainThreadTreeViews.ts';
const CONFIG_REL = 'src/vs/workbench/api/common/extHostConfiguration.ts';
const SEARCH_REL = 'src/vs/workbench/api/node/extHostSearch.ts';
const TOOLS_REL = 'src/vs/workbench/api/common/extHostLanguageModelTools.ts';
const WORKSPACE_REL = 'src/vs/workbench/api/browser/mainThreadWorkspace.ts';
const LOGGER_REL = 'src/vs/workbench/api/common/extHostLoggerService.ts';
const DEBUG_REL = 'src/vs/workbench/api/common/extHostDebugService.ts';
const EXT_SERVICE_REL = 'src/vs/workbench/api/common/extHostExtensionService.ts';
const OUTPUT_REL = 'src/vs/workbench/api/common/extHostOutput.ts';
const KERNELS_REL = 'src/vs/workbench/api/common/extHostNotebookKernels.ts';
const TELEMETRY_REL = 'src/vs/workbench/api/common/extHostTelemetry.ts';
const CHAT_SESSIONS_REL = 'src/vs/workbench/api/common/extHostChatSessions.ts';
const DATA_CHANNELS_REL = 'src/vs/workbench/api/browser/mainThreadDataChannels.ts';
const WORKER_REL = 'src/vs/workbench/api/worker/extensionHostWorker.ts';
const EXT_WORKSPACE_REL = 'src/vs/workbench/api/common/extHostWorkspace.ts';
const MAIN_WINDOW_REL = 'src/vs/workbench/api/browser/mainThreadWindow.ts';
const TASK_REL = 'src/vs/workbench/api/common/extHostTask.ts';
const NODE_TASK_REL = 'src/vs/workbench/api/node/extHostTask.ts';
const URLS_REL = 'src/vs/workbench/api/common/extHostUrls.ts';
const DECORATIONS_REL = 'src/vs/workbench/api/browser/mainThreadDecorations.ts';
const CHAT_AGENTS_REL = 'src/vs/workbench/api/common/extHostChatAgents2.ts';
const MCP_REL = 'src/vs/workbench/api/common/extHostMcp.ts';
const NODE_AUTH_REL = 'src/vs/workbench/api/node/extHostAuthentication.ts';
const NODE_LOGGER_REL = 'src/vs/workbench/api/node/extHostLoggerService.ts';
const SHELL_REL = 'src/vs/workbench/api/common/extHostTerminalShellIntegration.ts';
const TUNNEL_REL = 'src/vs/workbench/api/browser/mainThreadTunnelService.ts';

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
const leftoverFiles = [TERMINAL_REL, SOCKETS_REL, PROFILE_REL, NOTEBOOK_REL, TREES_REL];

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

suite('workbench/api leftover Promise fire-and-forget catch scan (D734)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers leftover Promise double-chain sites after D724', () => {
		let sites = 0;
		for (const rel of leftoverFiles) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += countDoubleChains(source);
		}
		assert.ok(sites >= 4 && sites <= 8, `expected 4-8 leftover sites, got ${sites}`);
		assert.strictEqual(sites, 8);
	});

	test('terminal leftover getEnvironment then is Promise double-chain; processReady Pty stays skipped', () => {
		const source = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		assertPromiseSignature(remote, 'getEnvironment(): Promise<IRemoteAgentEnvironment | null>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `remoteAgentService.getEnvironment().then(async env => {
			this._os = env?.os || OS;
			this._updateDefaultProfile();
		})`;
		assertDoubleThen(source, thenCall);
		assert.ok(source.includes('instance.processReady.then(() => this._onTerminalProcessIdReady(instance));'));
		assert.ok(!source.includes('instance.processReady.then(() => this._onTerminalProcessIdReady(instance)).catch'));
	});

	test('managed sockets leftover $registerSocketFactory / $unregisterSocketFactory are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SOCKETS_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$registerSocketFactory(socketFactoryId: number): Promise<void>;');
		assertPromiseSignature(protocol, '$unregisterSocketFactory(socketFactoryId: number): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._proxy.$unregisterSocketFactory(this._factory.socketFactoryId)');
		assertDoubleThen(source, 'this._proxy.$registerSocketFactory(this._factory.socketFactoryId)');
	});

	test('profile leftover $registerProfileContentHandler / $unregisterProfileContentHandler are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$registerProfileContentHandler(id: string, name: string, description: string | undefined, extensionId: string): Promise<void>;');
		assertPromiseSignature(protocol, '$unregisterProfileContentHandler(id: string): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.proxy.$registerProfileContentHandler(id, handler.name, handler.description, extension.identifier.value)');
		assertDoubleThen(source, 'this.proxy.$unregisterProfileContentHandler(id)');
	});

	test('notebook leftover $registerNotebookCellStatusBarItemProvider / $unregisterNotebookCellStatusBarItemProvider are Promise double-chain; $emitCellStatusBarEvent stays sync void', () => {
		const source = fs.readFileSync(resolveSource(NOTEBOOK_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$registerNotebookCellStatusBarItemProvider(handle: number, eventHandle: number | undefined, viewType: string): Promise<void>;');
		assertPromiseSignature(protocol, '$unregisterNotebookCellStatusBarItemProvider(handle: number, eventHandle: number | undefined): Promise<void>;');
		assert.ok(protocol.includes('$emitCellStatusBarEvent(eventHandle: number): void;'));
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._notebookProxy.$registerNotebookCellStatusBarItemProvider(handle, eventHandle, notebookType)');
		assertDoubleThen(source, 'this._notebookProxy.$unregisterNotebookCellStatusBarItemProvider(handle, eventHandle)');
		assert.ok(source.includes('this._notebookProxy.$emitCellStatusBarEvent(eventHandle)'));
		assert.ok(!source.includes('$emitCellStatusBarEvent(eventHandle).catch'));
	});

	test('tree leftover $disposeTree is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TREES_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$disposeTree(treeViewId: string): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._proxy.$disposeTree(viewId)');
	});

	test('D724 API-method $sendDidChangeSessions leftover / opener / D145 / Watch / Connect / Pty / two-arg / $reveal / kernels / already-double stay skipped', () => {
		const auth = fs.readFileSync(resolveSource(AUTH_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const windowSource = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const trees = fs.readFileSync(resolveSource(MAIN_TREES_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const search = fs.readFileSync(resolveSource(SEARCH_REL), 'utf8');
		const tools = fs.readFileSync(resolveSource(TOOLS_REL), 'utf8');
		const workspace = fs.readFileSync(resolveSource(WORKSPACE_REL), 'utf8');
		const logger = fs.readFileSync(resolveSource(LOGGER_REL), 'utf8');
		const debug = fs.readFileSync(resolveSource(DEBUG_REL), 'utf8');
		const extService = fs.readFileSync(resolveSource(EXT_SERVICE_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(KERNELS_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const chatSessions = fs.readFileSync(resolveSource(CHAT_SESSIONS_REL), 'utf8');
		const dataChannels = fs.readFileSync(resolveSource(DATA_CHANNELS_REL), 'utf8');
		const worker = fs.readFileSync(resolveSource(WORKER_REL), 'utf8');
		const extWorkspace = fs.readFileSync(resolveSource(EXT_WORKSPACE_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const mainWindow = fs.readFileSync(resolveSource(MAIN_WINDOW_REL), 'utf8');
		const task = fs.readFileSync(resolveSource(TASK_REL), 'utf8');
		const nodeTask = fs.readFileSync(resolveSource(NODE_TASK_REL), 'utf8');
		const urls = fs.readFileSync(resolveSource(URLS_REL), 'utf8');
		const decorations = fs.readFileSync(resolveSource(DECORATIONS_REL), 'utf8');
		const chatAgents = fs.readFileSync(resolveSource(CHAT_AGENTS_REL), 'utf8');
		const mcp = fs.readFileSync(resolveSource(MCP_REL), 'utf8');
		const nodeAuth = fs.readFileSync(resolveSource(NODE_AUTH_REL), 'utf8');
		const nodeLogger = fs.readFileSync(resolveSource(NODE_LOGGER_REL), 'utf8');
		const shell = fs.readFileSync(resolveSource(SHELL_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');

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

		assert.ok(task.includes('this._proxy.$registerTaskSystem(scheme, info);'));
		assert.ok(!task.includes('$registerTaskSystem(scheme, info).catch'));
		assert.ok(nodeTask.includes('this._proxy.$executeTask(handleDto).catch(() => { /* The error here isn\'t actionable. */ });'));
		assert.ok(!nodeTask.includes('$executeTask(handleDto).catch(onUnexpectedError)'));

		assert.ok(tunnel.includes(`		}).catch(() => {
			// The remote failed to get setup. Errors from that area will already be surfaced to the user.
		});`));
		assert.ok(!tunnel.includes(doubleCatch));

		assert.ok(windowSource.includes(doubleCatch));
		assert.ok(tabs.includes(doubleCatch));
		assert.ok(trees.includes(doubleCatch));
		assert.ok(config.includes(doubleCatch));
		assert.ok(search.includes(doubleCatch));
		assert.ok(tools.includes(doubleCatch));
		assert.ok(workspace.includes(doubleCatch));
		assert.ok(logger.includes(doubleCatch));
		assert.ok(debug.includes(doubleCatch));
		assert.ok(extService.includes('.catch(errors.onUnexpectedError).catch(errors.onUnexpectedError)'));
		assert.ok(output.includes(doubleCatch));
		assert.ok(notebook.includes(doubleCatch));
		assert.ok(telemetry.includes(doubleCatch));
		assert.ok(chatSessions.includes(doubleCatch));
		assert.ok(decorations.includes(doubleCatch));
		assert.ok(chatAgents.includes(doubleCatch));
		assert.ok(mcp.includes(doubleCatch));
		assert.ok(nodeAuth.includes(doubleCatch));
		assert.ok(auth.includes(doubleCatch));
		assert.ok(task.includes(doubleCatch));
		assert.ok(nodeTask.includes(doubleCatch));
		assert.ok(nodeLogger.includes(doubleCatch));
		assert.ok(urls.includes(doubleCatch));

		for (const source of [windowSource, tabs, trees, config, search, tools, workspace, logger, debug, extService, output, notebook, telemetry, chatSessions]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
		}
	});
});
