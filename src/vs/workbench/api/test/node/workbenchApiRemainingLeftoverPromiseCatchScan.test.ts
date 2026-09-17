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
const DEBUG_REL = 'src/vs/workbench/api/common/extHostDebugService.ts';
const EXT_SERVICE_REL = 'src/vs/workbench/api/common/extHostExtensionService.ts';
const OUTPUT_REL = 'src/vs/workbench/api/common/extHostOutput.ts';
const NOTEBOOK_REL = 'src/vs/workbench/api/common/extHostNotebookKernels.ts';
const TELEMETRY_REL = 'src/vs/workbench/api/common/extHostTelemetry.ts';
const CHAT_SESSIONS_REL = 'src/vs/workbench/api/common/extHostChatSessions.ts';
const PROTOCOL_REL = 'src/vs/workbench/api/common/extHost.protocol.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const VSCODE_DTS_REL = 'src/vscode-dts/vscode.d.ts';
const WINDOW_REL = 'src/vs/workbench/api/common/extHostWindow.ts';
const TABS_REL = 'src/vs/workbench/api/browser/mainThreadEditorTabs.ts';
const TREES_REL = 'src/vs/workbench/api/browser/mainThreadTreeViews.ts';
const CONFIG_REL = 'src/vs/workbench/api/common/extHostConfiguration.ts';
const SEARCH_REL = 'src/vs/workbench/api/node/extHostSearch.ts';
const TOOLS_REL = 'src/vs/workbench/api/common/extHostLanguageModelTools.ts';
const WORKSPACE_REL = 'src/vs/workbench/api/browser/mainThreadWorkspace.ts';
const LOGGER_REL = 'src/vs/workbench/api/common/extHostLoggerService.ts';
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
const errorsDoubleCatch = '.catch(errors.onUnexpectedError).catch(errors.onUnexpectedError)';
const leftoverFiles = [DEBUG_REL, EXT_SERVICE_REL, OUTPUT_REL, NOTEBOOK_REL, TELEMETRY_REL, CHAT_SESSIONS_REL];

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

suite('workbench/api remaining leftover Promise fire-and-forget catch scan (D712)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers leftover Promise double-chain sites after D708', () => {
		let sites = 0;
		for (const rel of leftoverFiles) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += countDoubleChains(source);
		}
		assert.ok(sites >= 4 && sites <= 8, `expected 4-8 leftover sites, got ${sites}`);
		assert.strictEqual(sites, 8);
	});

	test('debug registry leftover getExtensionRegistry then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(DEBUG_REL), 'utf8');
		const extService = fs.readFileSync(resolveSource(EXT_SERVICE_REL), 'utf8');
		assertPromiseSignature(extService, 'getExtensionRegistry(): Promise<ExtensionDescriptionRegistry>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `this._extensionService.getExtensionRegistry().then((extensionRegistry: ExtensionDescriptionRegistry) => {
			this._register(extensionRegistry.onDidChange(_ => {
				this.registerAllDebugTypes(extensionRegistry);
			}));
			this.registerAllDebugTypes(extensionRegistry);
		})`;
		assertDoubleThen(source, thenCall);
	});

	test('extensionService race leftover then is Promise double-chain; terminate race stays skipped', () => {
		const source = fs.readFileSync(resolveSource(EXT_SERVICE_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(asyncSource, 'export function timeout(millis: number): CancelablePromise<void>;');
		assert.ok(source.includes("import * as errors from '../../../base/common/errors.js';"));
		const thenCall = `Promise.race([eagerExtensionsActivation, timeout(10000)]).then(() => {
			this._activateAllStartupFinished();
		})`;
		assertDoubleThen(source, thenCall, errorsDoubleCatch);
		assert.ok(source.includes('Promise.race([timeout(5000), extensionsDeactivated]).finally(() => {'));
		assert.ok(!/Promise\.race\(\[timeout\(5000\), extensionsDeactivated\]\)\.finally\([^;]+\)\.catch\(errors\.onUnexpectedError\)\.catch\(errors\.onUnexpectedError\)/.test(source));
	});

	test('output leftover channelPromise setup thens are Promise double-chain; API-method thens stay leftover', () => {
		const source = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		assertPromiseSignature(source, 'private createExtHostOutputChannel(name: string, channelPromise: Promise<ExtHostOutputChannel>, channelDisposables: DisposableStore): vscode.OutputChannel {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'channelPromise.then(channel => channelDisposables.add(channel))');
		const logThen = `channelPromise.then(channel => {
			if (channel.logLevel !== logLevel) {
				setLogLevel(channel.logLevel);
			}
			channelDisposables.add(channel.onDidChangeLogLevel(e => setLogLevel(e)));
		})`;
		assertDoubleThen(source, logThen);
		assert.ok(source.includes('channelPromise.then(channel => channel.append(value));'));
		assert.ok(!source.includes('channelPromise.then(channel => channel.append(value)).catch'));
	});

	test('notebook leftover timeout then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(NOTEBOOK_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(asyncSource, 'export function timeout(millis: number): CancelablePromise<void>;');
		assertPromiseSignature(source, 'flush(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `timeout(this.delay).then(() => {
				return this.flush();
			})`;
		assertDoubleThen(source, thenCall);
	});

	test('telemetry leftover flush then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const dts = fs.readFileSync(resolveSource(VSCODE_DTS_REL), 'utf8');
		assertPromiseSignature(dts, 'flush?(): void | Thenable<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'Promise.resolve(tempSender.flush!()).then(tempSender = undefined)');
	});

	test('chatSessions leftover void $updateChatSessionItems are Promise double-chain; void $updateInputState stays skipped', () => {
		const source = fs.readFileSync(resolveSource(CHAT_SESSIONS_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$updateChatSessionItems(controllerHandle: number, change: IChatSessionItemsChange): Promise<void>;');
		assert.ok(protocol.includes('$updateChatSessionInputState(controllerHandle: number, sessionResource: UriComponents, optionGroups: readonly IChatSessionProviderOptionGroup[]): void;'));
		assert.ok(protocol.includes('$updateChatSessionItemControllerCapabilities(controllerHandle: number, supportsResolve: boolean): void;'));
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'void this.#proxy.$updateChatSessionItems(this.#controllerHandle, convertChatSessionDeltaToDto(delta))');
		const deleteCall = `void this.#proxy.$updateChatSessionItems(this.#controllerHandle, {
				addedOrUpdated: [],
				removed: [resource]
			})`;
		assertDoubleThen(source, deleteCall);
		assert.ok(source.includes('void this._proxy.$updateChatSessionInputState(controllerHandle, resource, serializableGroups);'));
		assert.ok(!source.includes('$updateChatSessionInputState(controllerHandle, resource, serializableGroups).catch'));
		assert.ok(source.includes('proxy.$updateChatSessionItemControllerCapabilities(controllerHandle, hasHandler);'));
		assert.ok(!source.includes('$updateChatSessionItemControllerCapabilities(controllerHandle, hasHandler).catch'));
		assert.ok(source.includes('void this.#proxy.$addOrUpdateChatSessionItem(this.#controllerHandle, typeConvert.ChatSessionItem.from(item));'));
		assert.ok(!source.includes('$addOrUpdateChatSessionItem(this.#controllerHandle, typeConvert.ChatSessionItem.from(item)).catch'));
	});

	test('opener / D145 / Watch / Connect / Pty / two-arg / $reveal / D708 eight / already-double stay skipped', () => {
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

		for (const source of [windowSource, tabs, trees, config, search, tools, workspace, logger]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
		}
	});
});
