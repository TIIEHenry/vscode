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
const DECORATIONS_REL = 'src/vs/workbench/api/browser/mainThreadDecorations.ts';
const CHAT_AGENTS_REL = 'src/vs/workbench/api/common/extHostChatAgents2.ts';
const MCP_REL = 'src/vs/workbench/api/common/extHostMcp.ts';
const NODE_AUTH_REL = 'src/vs/workbench/api/node/extHostAuthentication.ts';
const AUTH_REL = 'src/vs/workbench/api/common/extHostAuthentication.ts';
const PROTOCOL_REL = 'src/vs/workbench/api/common/extHost.protocol.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const OUTPUT_REL = 'src/vs/workbench/api/common/extHostOutput.ts';
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
const NOTEBOOK_REL = 'src/vs/workbench/api/common/extHostNotebookKernels.ts';
const TELEMETRY_REL = 'src/vs/workbench/api/common/extHostTelemetry.ts';
const CHAT_SESSIONS_REL = 'src/vs/workbench/api/common/extHostChatSessions.ts';
const PROVIDERS_REL = 'src/vs/workbench/api/common/extHostDocumentContentProviders.ts';
const DATA_CHANNELS_REL = 'src/vs/workbench/api/browser/mainThreadDataChannels.ts';
const WORKER_REL = 'src/vs/workbench/api/worker/extensionHostWorker.ts';
const EXT_WORKSPACE_REL = 'src/vs/workbench/api/common/extHostWorkspace.ts';
const TERMINAL_REL = 'src/vs/workbench/api/browser/mainThreadTerminalService.ts';
const MAIN_WINDOW_REL = 'src/vs/workbench/api/browser/mainThreadWindow.ts';
const TUNNEL_REL = 'src/vs/workbench/api/browser/mainThreadTunnelService.ts';
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
const leftoverFiles = [DECORATIONS_REL, CHAT_AGENTS_REL, MCP_REL, NODE_AUTH_REL, AUTH_REL];

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

suite('workbench/api further leftover Promise fire-and-forget catch scan (D717)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers leftover Promise double-chain sites after D712', () => {
		let sites = 0;
		for (const rel of leftoverFiles) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += countDoubleChains(source);
		}
		assert.ok(sites >= 4 && sites <= 8, `expected 4-8 leftover sites, got ${sites}`);
		assert.strictEqual(sites, 8);
	});

	test('decorations leftover $provideDecorations then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(DECORATIONS_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$provideDecorations(handle: number, requests: DecorationRequest[], token: CancellationToken): Promise<DecorationReply>;');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `this._proxy.$provideDecorations(this._handle, [...requests.values()], CancellationToken.None).then(data => {
				for (const [id, defer] of resolver) {
					defer.complete(data[id]);
				}
			})`;
		assertDoubleThen(source, thenCall);
	});

	test('chatAgents leftover progress/task/externalEdit thens are Promise double-chain; Resolve stays skipped', () => {
		const source = fs.readFileSync(resolveSource(CHAT_AGENTS_REL), 'utf8');
		assertPromiseSignature(source, 'function send(chunk: IChatProgressDto, handle: number): Promise<void>;');
		assertPromiseSignature(source, 'async externalEdit(target, callback) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const progressThen = `progressReporterPromise.then(() => {
								if (extHostTypes.MarkdownString.isMarkdownString(p.value)) {
									send(typeConvert.ChatResponseWarningPart.from(<vscode.ChatResponseWarningPart>p), myHandle);
								} else {
									send(typeConvert.ChatResponseReferencePart.from(<vscode.ChatResponseReferencePart>p), myHandle);
								}
							})`;
		assertDoubleThen(source, progressThen);
		const allThen = `Promise.all([progressReporterPromise, task(progressReporter)]).then(([_void, res]) => {
						send(typeConvert.ChatTaskResult.from(res), myHandle);
					})`;
		assertDoubleThen(source, allThen);
		assertDoubleThen(source, 'p.then((value) => part.didGetApplied(value))');
		assert.ok(source.includes('part.resolve(cts.token)'));
		assert.ok(source.includes('.then(() => cts.dispose(), () => cts.dispose());'));
		assert.ok(!/part\.resolve\([^;]+\)[\s\S]{0,220}\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
	});

	test('mcp leftover close then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(MCP_REL), 'utf8');
		assertPromiseSignature(source, 'async close() {');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `this._sseEventSources.get(id)
			?.close()
			.then(() => this._didClose(id))`;
		assertDoubleThen(source, thenCall);
	});

	test('auth leftover $waitForUriHandler is Promise double-chain; opener $openUri stays skipped', () => {
		const source = fs.readFileSync(resolveSource(NODE_AUTH_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$waitForUriHandler(expectedUri: UriComponents): Promise<UriComponents>;');
		assert.ok(source.includes("import { CancellationError, isCancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'void this._proxy.$waitForUriHandler(appUri)');
		assert.ok(source.includes('await this._extHostWindow.openUri(authorizationUrl.toString(), {});'));
		assert.ok(!source.includes('openUri(authorizationUrl.toString(), {}).catch'));
	});

	test('auth leftover queue register/unregister are Promise double-chain; API-method $sendDidChangeSessions stays leftover', () => {
		const source = fs.readFileSync(resolveSource(AUTH_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(asyncSource, 'queue<T>(key: TKey, promiseTask: ITask<Promise<T>>): Promise<T> {');
		assertPromiseSignature(protocol, '$sendDidChangeSessions(providerId: string, event: Dto<AuthenticationSessionsChangeEvent>): Promise<void>;');
		assert.ok(source.includes("import { CancellationError, isCancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		const registerCall = `void this._providerOperations.queue(id, async () => {
			// This use to be synchronous, but that wasn't an accurate representation because the main thread
			// may have unregistered the provider in the meantime. I don't see how this could really be done
			// synchronously, so we just say first one wins.
			if (this._authenticationProviders.get(id)) {
				this._logService.error(\`An authentication provider with id '\${id}' is already registered. The existing provider will not be replaced.\`);
				return;
			}
			const listener = provider.onDidChangeSessions(e => this._proxy.$sendDidChangeSessions(id, e));
			this._authenticationProviders.set(id, { label, provider, disposable: listener, options: options ?? { supportsMultipleAccounts: false } });
			await this._proxy.$registerAuthenticationProvider({
				id,
				label,
				supportsMultipleAccounts: options?.supportsMultipleAccounts ?? false,
				supportedAuthorizationServers: options?.supportedAuthorizationServers,
				supportsChallenges: options?.supportsChallenges
			});
		})`;
		assertDoubleThen(source, registerCall);
		const unregisterCall = `void this._providerOperations.queue(id, async () => {
				const providerData = this._authenticationProviders.get(id);
				if (providerData) {
					providerData.disposable?.dispose();
					this._authenticationProviders.delete(id);
					await this._proxy.$unregisterAuthenticationProvider(id);
				}
			})`;
		assertDoubleThen(source, unregisterCall);
		assert.ok(source.includes('provider.onDidChangeSessions(e => this._proxy.$sendDidChangeSessions(id, e));'));
		assert.ok(!source.includes('$sendDidChangeSessions(id, e).catch'));
	});

	test('D712 API-method then leftover / opener / D145 / Watch / Connect / Pty / two-arg / $reveal / terminate / D708 eight / D712 eight / already-double stay skipped', () => {
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
		const providers = fs.readFileSync(resolveSource(PROVIDERS_REL), 'utf8');
		const dataChannels = fs.readFileSync(resolveSource(DATA_CHANNELS_REL), 'utf8');
		const worker = fs.readFileSync(resolveSource(WORKER_REL), 'utf8');
		const extWorkspace = fs.readFileSync(resolveSource(EXT_WORKSPACE_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const mainWindow = fs.readFileSync(resolveSource(MAIN_WINDOW_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const shell = fs.readFileSync(resolveSource(SHELL_REL), 'utf8');

		assert.ok(output.includes('channelPromise.then(channel => channel.append(value));'));
		assert.ok(!output.includes('channelPromise.then(channel => channel.append(value)).catch'));
		assert.ok(output.includes('channelPromise.then(channel => channel.appendLine(value));'));
		assert.ok(output.includes('channelPromise.then(channel => channel.clear());'));
		assert.ok(output.includes('channelPromise.then(channel => channel.replace(value));'));
		assert.ok(output.includes('channelPromise.then(channel => channel.show(columnOrPreserveFocus, preserveFocus));'));
		assert.ok(output.includes('channelPromise.then(channel => channel.hide());'));
		assert.ok(output.includes('channelPromise.then(channel => channel.trace(value, ...args));'));
		assert.ok(output.includes('channelPromise.then(channel => channel.debug(value, ...args));'));
		assert.ok(output.includes('channelPromise.then(channel => channel.info(value, ...args));'));
		assert.ok(output.includes('channelPromise.then(channel => channel.warn(value, ...args));'));
		assert.ok(output.includes('channelPromise.then(channel => channel.error(value, ...args));'));

		assert.ok(windowSource.includes('return this._proxy.$openUri(stringOrUri, uriAsString, options);'));
		assert.ok(!windowSource.includes('$openUri(stringOrUri, uriAsString, options).catch'));
		assert.ok(mainWindow.includes('async $openUri(uriComponents: UriComponents, uriString: string | undefined, options: IOpenUriOptions): Promise<boolean> {'));
		assert.ok(!/this\._openerService\.open\([^;]+\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(mainWindow));

		assert.ok(providers.includes(`					.catch(onUnexpectedError)
					.catch(onUnexpectedError)`));
		assert.ok(!providers.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));

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

		assert.ok(tunnel.includes(`		}).catch(() => {
			// The remote failed to get setup. Errors from that area will already be surfaced to the user.
		});`));
		assert.ok(!tunnel.includes(doubleCatch));

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
