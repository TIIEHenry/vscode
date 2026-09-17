/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const IPC_REL = 'src/vs/base/parts/ipc/common/ipc.ts';
const JSONRPC_REL = 'src/vs/base/common/jsonRpcProtocol.ts';
const DIALOGS_REL = 'src/vs/platform/dialogs/common/dialogs.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const TYPES_REL = 'src/vs/workbench/contrib/mcp/common/mcpTypes.ts';
const TYPES_UTILS_REL = 'src/vs/workbench/contrib/mcp/common/mcpTypesUtils.ts';
const SERVER_REL = 'src/vs/workbench/contrib/mcp/common/mcpServer.ts';
const HANDLER_REL = 'src/vs/workbench/contrib/mcp/common/mcpServerRequestHandler.ts';
const BROKER_REL = 'src/vs/workbench/contrib/mcp/common/mcpGatewayToolBrokerChannel.ts';
const REGISTRY_REL = 'src/vs/workbench/contrib/mcp/common/mcpRegistry.ts';
const CONNECTION_REL = 'src/vs/workbench/contrib/mcp/common/mcpServerConnection.ts';
const FS_REL = 'src/vs/workbench/contrib/mcp/common/mcpResourceFilesystem.ts';
const EXT_DISC_REL = 'src/vs/workbench/contrib/mcp/common/discovery/extensionMcpDiscovery.ts';
const NATIVE_DISC_REL = 'src/vs/workbench/contrib/mcp/electron-browser/nativeMpcDiscovery.ts';
const REMOTE_DISC_REL = 'src/vs/workbench/contrib/mcp/common/discovery/nativeMcpRemoteDiscovery.ts';
const WORKBENCH_REL = 'src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts';
const COMMANDS_REL = 'src/vs/workbench/contrib/mcp/browser/mcpCommands.ts';
const ADD_CONFIG_REL = 'src/vs/workbench/contrib/mcp/browser/mcpCommandsAddConfiguration.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/mcp/browser/mcpServerEditor.ts';
const ELECTRON_GW_REL = 'src/vs/workbench/contrib/mcp/electron-browser/mcpGatewayService.ts';
const BROWSER_GW_REL = 'src/vs/workbench/contrib/mcp/browser/mcpGatewayService.ts';
const QUICK_REL = 'src/vs/workbench/contrib/mcp/browser/mcpResourceQuickAccess.ts';
const ELICIT_REL = 'src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/mcp/browser/mcp.contribution.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
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

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countWrapped(source: string, call: string): number {
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

const triggerCall = `void this.registrySyncDelayer.trigger(() => this.syncInstalledMcpServers(generation))
			.catch(error => this.logService.error(error))`;
const disposeGatewayCall = `					void channel.call('disposeGateway', info.gatewayId).catch(error => {
						this._logService.warn(\`[McpGateway][Workbench] Failed to dispose remote gateway: \${info.gatewayId}\`, error);
					})`;
const confirmCall = `		}).finally(() => {
			this._isSandboxSuggestionDialogVisible = false;
		})`;
const handleMessageCall = 'void this._rpc.handleMessage(message)';
const startThenCall = `server.start({ promptType: 'all-untrusted' }).then(state => {
					if (state.state === McpConnectionState.Kind.Error) {
						server.showOutput();
					}
				})`;
const stopThenCall = 'server.stop().then(() => server.start({ interaction }))';
const openThenCall = `			this.open(id, extension, template, cts.token)
				.then(activeElement => {
					if (cts.token.isCancellationRequested) {
						return;
					}
					this.activeElement = activeElement;
					if (focus) {
						this.focus();
					}
				})`;
const toolUpdateCall = `			toolUpdate.then(tools => {
				this._telemetryService.publicLog2<ServerBootData, ServerBootClassification>('mcp/serverBoot', {
					supportsLogging: !!handler.capabilities.logging,
					supportsPrompts: !!handler.capabilities.prompts,
					supportsResources: !!handler.capabilities.resources,
					toolCount: tools.data.length,
					serverName: handler.serverInfo.name,
					serverVersion: handler.serverInfo.version,
				});
			})`;
const entryPromiseCall = 'entry.promise.then(() => { entry.resolved = true; })';

const d772Calls: Array<[string, string, number]> = [
	[WORKBENCH_REL, triggerCall, 1],
	[ELECTRON_GW_REL, disposeGatewayCall, 1],
	[SERVER_REL, confirmCall, 1],
	[SERVER_REL, toolUpdateCall, 1],
	[HANDLER_REL, handleMessageCall, 1],
	[TYPES_UTILS_REL, startThenCall, 1],
	[COMMANDS_REL, stopThenCall, 1],
	[ADD_CONFIG_REL, startThenCall, 1],
	[EDITOR_REL, openThenCall, 1],
	[BROKER_REL, entryPromiseCall, 1],
];

suite('mcp leftover remaining Promise fire-and-forget catch scan (D772)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers ten leftover Promise double-chain sites', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d772Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 10);
		assert.ok(sites >= 4);
	});

	test('leftover void trigger / disposeGateway / confirm / handleMessage are Promise double-chain', () => {
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');
		const electronGw = fs.readFileSync(resolveSource(ELECTRON_GW_REL), 'utf8');
		const server = fs.readFileSync(resolveSource(SERVER_REL), 'utf8');
		const handler = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		const asyncSrc = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		const jsonrpc = fs.readFileSync(resolveSource(JSONRPC_REL), 'utf8');
		assertPromiseSignature(asyncSrc, 'trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {');
		assertPromiseSignature(workbench, 'private async syncInstalledMcpServers(generation: number): Promise<void> {');
		assertPromiseSignature(ipc, 'call<T>(command: string, arg?: any, cancellationToken?: CancellationToken): Promise<T>;');
		assertPromiseSignature(dialogs, 'confirm(confirmation: IConfirmation): Promise<IConfirmationResult>;');
		assertPromiseSignature(jsonrpc, 'public async handleMessage(message: JsonRpcMessage | JsonRpcMessage[]): Promise<JsonRpcResponse[]> {');
		assert.ok(workbench.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(electronGw.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(server.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(handler.includes('import { CancellationError, onUnexpectedError } from \'../../../../base/common/errors.js\';'));
		assertWrapped(workbench, triggerCall);
		assertWrapped(electronGw, disposeGatewayCall);
		assertWrapped(server, confirmCall);
		assertWrapped(handler, handleMessageCall);
		assert.ok(!workbench.includes('void this.registrySyncDelayer.trigger(() => this.syncInstalledMcpServers(generation))\n\t\t\t.catch(error => this.logService.error(error));'));
		assert.ok(!handler.includes('void this._rpc.handleMessage(message);'));
	});

	test('leftover start / stop / open / toolUpdate / entry.promise then are Promise double-chain', () => {
		const types = fs.readFileSync(resolveSource(TYPES_REL), 'utf8');
		const typesUtils = fs.readFileSync(resolveSource(TYPES_UTILS_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const addConfig = fs.readFileSync(resolveSource(ADD_CONFIG_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const server = fs.readFileSync(resolveSource(SERVER_REL), 'utf8');
		const broker = fs.readFileSync(resolveSource(BROKER_REL), 'utf8');
		assertPromiseSignature(types, 'start(opts?: IMcpServerStartOpts): Promise<McpConnectionState>;');
		assertPromiseSignature(types, 'stop(): Promise<void>;');
		assertPromiseSignature(editor, 'private open(id: string, extension: IWorkbenchMcpServer, template: IExtensionEditorTemplate, token: CancellationToken): Promise<IActiveElement | null> {');
		assertPromiseSignature(server, 'private _setServerTools(nonce: string | undefined, toolsPromise: Promise<MCP.Tool[]>, tx: ITransaction | undefined) {');
		assertPromiseSignature(broker, 'promise: Promise<boolean>');
		assert.ok(typesUtils.includes('import { CancellationError, onUnexpectedError } from \'../../../../base/common/errors.js\';'));
		assert.ok(commands.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(addConfig.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(editor.includes('import { isCancellationError, onUnexpectedError } from \'../../../../base/common/errors.js\';'));
		assert.ok(broker.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(typesUtils, startThenCall);
		assertWrapped(addConfig, startThenCall);
		assertWrapped(commands, stopThenCall);
		assertWrapped(editor, openThenCall);
		assertWrapped(server, toolUpdateCall);
		assertWrapped(broker, entryPromiseCall);
		assert.ok(!commands.includes('server.stop().then(() => server.start({ interaction }));'));
		assert.ok(!broker.includes('entry.promise.then(() => { entry.resolved = true; });'));
	});

	test('leftover remaining executeCommand then / resource / elicitation / getTask stay leftover remaining', () => {
		const addConfig = fs.readFileSync(resolveSource(ADD_CONFIG_REL), 'utf8');
		const quick = fs.readFileSync(resolveSource(QUICK_REL), 'utf8');
		const elicit = fs.readFileSync(resolveSource(ELICIT_REL), 'utf8');
		const handler = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		assert.ok(addConfig.includes('this._commandService.executeCommand<ValidatePackageResult>('));
		assert.ok(addConfig.includes(').then(result => {'));
		assert.ok(!addConfig.includes(`).then(result => {${doubleCatch}`));
		assert.ok(quick.includes('promise.then(values => {'));
		assert.ok(!quick.includes(`promise.then(values => {${doubleCatch}`));
		assert.ok(quick.includes('server.start().then(state => {'));
		assert.ok(!quick.includes(`server.start().then(state => {${doubleCatch}`));
		assert.ok(quick.includes('attachment.then(async a => {'));
		assert.ok(!quick.includes(`attachment.then(async a => {${doubleCatch}`));
		assert.ok(elicit.includes('carousel.completion.p.then(result => {'));
		assert.ok(!elicit.includes(`carousel.completion.p.then(result => {${doubleCatch}`));
		assert.ok(elicit.includes('completePromise.then(() => part.hide());'));
		assert.ok(!elicit.includes(`completePromise.then(() => part.hide())${doubleCatch}`));
		assert.ok(handler.includes('handler.getTask({ taskId: current.taskId }, cts.token)'));
		assert.ok(!handler.includes(`handler.getTask({ taskId: current.taskId }, cts.token)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / Watch / Resolve / Pty / Connect / D145 stay skipped', () => {
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const addConfig = fs.readFileSync(resolveSource(ADD_CONFIG_REL), 'utf8');
		const server = fs.readFileSync(resolveSource(SERVER_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const handler = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const browserGw = fs.readFileSync(resolveSource(BROWSER_GW_REL), 'utf8');
		const nativeDisc = fs.readFileSync(resolveSource(NATIVE_DISC_REL), 'utf8');
		const remoteDisc = fs.readFileSync(resolveSource(REMOTE_DISC_REL), 'utf8');
		const connection = fs.readFileSync(resolveSource(CONNECTION_REL), 'utf8');
		const fsSrc = fs.readFileSync(resolveSource(FS_REL), 'utf8');
		const registry = fs.readFileSync(resolveSource(REGISTRY_REL), 'utf8');
		const quick = fs.readFileSync(resolveSource(QUICK_REL), 'utf8');
		const extDisc = fs.readFileSync(resolveSource(EXT_DISC_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(editorSvc, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assert.ok(files.includes('watch(resource: URI, options?: IWatchOptionsWithoutCorrelation): IDisposable;'));
		assert.ok(addConfig.includes('if (loadingAction.helpUri) { this._openerService.open(loadingAction.helpUri); }'));
		assert.ok(!addConfig.includes(`this._openerService.open(loadingAction.helpUri)${doubleCatch}`));
		assert.ok(server.includes("run: () => this._openerService.open(URI.parse('https://aka.ms/vscode-mcp-install/debugpy')),"));
		assert.ok(!server.includes(`this._openerService.open(URI.parse('https://aka.ms/vscode-mcp-install/debugpy'))${doubleCatch}`));

		assert.ok(commands.includes('override async run(accessor: ServicesAccessor) {'));
		assert.ok(commands.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(!commands.includes(`override async run(accessor: ServicesAccessor) {${doubleCatch}`));
		assert.ok(!contrib.includes(doubleCatch));

		assert.ok(workbench.includes('this.whenInitialLocalMcpServersLoaded = this.queryLocal().then(() => {'));
		assert.ok(workbench.includes('}, error => this.logService.error(error));'));
		assert.ok(!workbench.includes(`this.whenInitialLocalMcpServersLoaded = this.queryLocal().then(() => {${doubleCatch}`));
		assert.ok(server.includes('const toolPromiseSafe = toolsPromise.then(async tools => {'));
		assert.ok(!server.includes(`const toolPromiseSafe = toolsPromise.then(async tools => {${doubleCatch}`));

		assert.ok(browserGw.includes("void channel.call('disposeGateway', info.gatewayId).then(undefined, error => {"));
		assert.ok(!browserGw.includes(doubleCatch));
		assert.ok(nativeDisc.includes('service.load().then('));
		assert.ok(nativeDisc.includes('err => {'));
		assert.ok(!nativeDisc.includes(doubleCatch));
		assert.ok(remoteDisc.includes('service.load().then('));
		assert.ok(!remoteDisc.includes(doubleCatch));
		assert.ok(connection.includes('}, cts.token).then('));
		assert.ok(connection.includes('err => {'));
		assert.ok(!connection.includes(doubleCatch));
		assert.ok(fsSrc.includes('this._readFile(resource, token).then('));
		assert.ok(fsSrc.includes('err => stream.error(err),'));
		assert.ok(!fsSrc.includes(`this._readFile(resource, token).then(${doubleCatch}`));
		assert.ok(editor.includes('result.promise.then(onDone, onDone);'));
		assert.ok(!editor.includes(`result.promise.then(onDone, onDone)${doubleCatch}`));

		assert.ok(registry.includes('return editor.then(Boolean);'));
		assert.ok(!registry.includes(`return editor.then(Boolean)${doubleCatch}`));
		assert.ok(quick.includes('return this._resourceToAttachment(resource).then(val => val || noop);'));
		assert.ok(!quick.includes(`return this._resourceToAttachment(resource).then(val => val || noop)${doubleCatch}`));
		assert.ok(quick.includes('return this._resourceTemplateToAttachment(resource).then(val => val || noop);'));
		assert.ok(!quick.includes(`return this._resourceTemplateToAttachment(resource).then(val => val || noop)${doubleCatch}`));
		assert.ok(workbench.includes('return this.remoteAgentService.getEnvironment().then(remoteEnvironment => {'));
		assert.ok(!workbench.includes(`return this.remoteAgentService.getEnvironment().then(remoteEnvironment => {${doubleCatch}`));
		assert.ok(extDisc.includes('load: () => this._activateExtensionServers(coll.id).then(() => {'));
		assert.ok(!extDisc.includes(`this._activateExtensionServers(coll.id).then(() => {${doubleCatch}`));

		assert.ok(fsSrc.includes('public watch(uri: URI, _opts: IWatchOptions): IDisposable {'));
		assert.ok(fsSrc.includes('handler.subscribe({ uri: resourceURI.toString() }, token).then('));
		assert.ok(!fsSrc.includes(`handler.subscribe({ uri: resourceURI.toString() }, token).then(${doubleCatch}`));
		assert.ok(!fsSrc.includes(doubleCatch));

		for (const source of [server, commands, addConfig, editor, workbench, handler, browserGw, fsSrc, registry, quick, contrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
