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
const SCM_REL = 'src/vs/workbench/api/common/extHostSCM.ts';
const QUICKDIFF_REL = 'src/vs/workbench/api/common/extHostQuickDiff.ts';
const TUNNEL_EXT_REL = 'src/vs/workbench/api/common/extHostTunnelService.ts';
const TUNNEL_NODE_REL = 'src/vs/workbench/api/node/extHostTunnelService.ts';
const GIT_REL = 'src/vs/workbench/api/common/extHostGitExtensionService.ts';
const PROTOCOL_REL = 'src/vs/workbench/api/common/extHost.protocol.ts';
const INSET_REL = 'src/vs/workbench/api/common/extHostCodeInsets.ts';
const TUNNEL_MAIN_REL = 'src/vs/workbench/api/browser/mainThreadTunnelService.ts';
const AUTH_REL = 'src/vs/workbench/api/common/extHostAuthentication.ts';
const WINDOW_REL = 'src/vs/workbench/api/common/extHostWindow.ts';
const OUTPUT_REL = 'src/vs/workbench/api/common/extHostOutput.ts';
const DATA_CHANNELS_REL = 'src/vs/workbench/api/browser/mainThreadDataChannels.ts';
const WORKER_REL = 'src/vs/workbench/api/worker/extensionHostWorker.ts';
const EXT_WORKSPACE_REL = 'src/vs/workbench/api/common/extHostWorkspace.ts';
const TERMINAL_REL = 'src/vs/workbench/api/browser/mainThreadTerminalService.ts';
const MAIN_WINDOW_REL = 'src/vs/workbench/api/browser/mainThreadWindow.ts';
const KERNELS_REL = 'src/vs/workbench/api/common/extHostNotebookKernels.ts';
const CHAT_SESSIONS_REL = 'src/vs/workbench/api/common/extHostChatSessions.ts';
const SHELL_REL = 'src/vs/workbench/api/common/extHostTerminalShellIntegration.ts';
const TASK_REL = 'src/vs/workbench/api/common/extHostTask.ts';
const NODE_TASK_REL = 'src/vs/workbench/api/node/extHostTask.ts';
const COMMENTS_REL = 'src/vs/workbench/api/common/extHostAgentEditorComments.ts';

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
const leftoverFiles = [SCM_REL, QUICKDIFF_REL, TUNNEL_EXT_REL, TUNNEL_NODE_REL, GIT_REL];

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

suite('workbench/api leftover Promise fire-and-forget catch scan (D742)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers leftover Promise double-chain sites after D734', () => {
		let sites = 0;
		for (const rel of leftoverFiles) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += countDoubleChains(source);
		}
		assert.ok(sites >= 4 && sites <= 8, `expected 4-8 leftover sites, got ${sites}`);
		assert.strictEqual(sites, 8);
	});

	test('scm leftover $registerGroups is Promise double-chain; leftover $updateSourceControl stays leftover', () => {
		const source = fs.readFileSync(resolveSource(SCM_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$registerGroups(sourceControlHandle: number, groups: [number /*handle*/, string /*id*/, string /*label*/, SCMGroupFeatures, /* multiDiffEditorEnableViewChanges */ boolean][], splices: SCMRawResourceSplices[]): Promise<void>;');
		assertPromiseSignature(protocol, '$updateSourceControl(handle: number, features: SCMProviderFeatures): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.#proxy.$registerGroups(this.handle, groups, splices)');
		assert.ok(source.includes('this.#proxy.$updateSourceControl(this.handle, { count });'));
		assert.ok(!source.includes('$updateSourceControl(this.handle, { count }).catch'));
	});

	test('quickdiff leftover $registerQuickDiffProvider / $unregisterQuickDiffProvider / $createSourceControlDiffInformation / $disposeSourceControlDiffInformation are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(QUICKDIFF_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$registerQuickDiffProvider(handle: number, selector: IDocumentFilterDto[], id: string, label: string, rootUri: UriComponents | undefined): Promise<void>;');
		assertPromiseSignature(protocol, '$unregisterQuickDiffProvider(handle: number): Promise<void>;');
		assertPromiseSignature(protocol, '$createSourceControlDiffInformation(handle: number, uri: UriComponents): Promise<void>;');
		assertPromiseSignature(protocol, '$disposeSourceControlDiffInformation(handle: number): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.proxy.$registerQuickDiffProvider(handle, DocumentSelector.from(selector, this.uriTransformer), `${extensionId}.${id}`, label, rootUri)');
		assertDoubleThen(source, 'this.proxy.$unregisterQuickDiffProvider(handle)');
		assertDoubleThen(source, 'this.proxy.$createSourceControlDiffInformation(handle, uri)');
		assertDoubleThen(source, 'this.proxy.$disposeSourceControlDiffInformation(this.handle)');
	});

	test('tunnel leftover $setTunnelProvider register / $setRemoteTunnelService are Promise double-chain; remaining $setTunnelProvider and mainThread getEnvironment stay skipped', () => {
		const source = fs.readFileSync(resolveSource(TUNNEL_EXT_REL), 'utf8');
		const nodeSource = fs.readFileSync(resolveSource(TUNNEL_NODE_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_MAIN_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$setTunnelProvider(features: TunnelProviderFeatures | undefined, enablePortsView: boolean): Promise<void>;');
		assertPromiseSignature(protocol, '$setRemoteTunnelService(processId: number): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(nodeSource.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._proxy.$setTunnelProvider(tunnelFeatures, true)');
		assertDoubleThen(nodeSource, 'this._proxy.$setRemoteTunnelService(process.pid)');
		assert.ok(source.includes('this._proxy.$setTunnelProvider(undefined, false);'));
		assert.ok(!source.includes('$setTunnelProvider(undefined, false).catch'));
		assert.ok(source.includes('this._proxy.$setTunnelProvider(tunnelFeatures, !!provider.tunnelFactory);'));
		assert.ok(!source.includes('$setTunnelProvider(tunnelFeatures, !!provider.tunnelFactory).catch'));
		assert.ok(tunnel.includes(`		}).catch(() => {
			// The remote failed to get setup. Errors from that area will already be surfaced to the user.
		});`));
		assert.ok(!tunnel.includes(doubleCatch));
	});

	test('git leftover $onDidChangeRepository is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(GIT_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$onDidChangeRepository(handle: number): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._proxy.$onDidChangeRepository(handle)');
	});

	test('D734 leftover opener / Watch / Connect / Pty / two-arg / $sendDidChangeSessions / kernels / empty-catch $executeTask stay skipped; inset / speech / comments create owned by later leftover knife', () => {
		const inset = fs.readFileSync(resolveSource(INSET_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		const auth = fs.readFileSync(resolveSource(AUTH_REL), 'utf8');
		const windowSource = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const dataChannels = fs.readFileSync(resolveSource(DATA_CHANNELS_REL), 'utf8');
		const worker = fs.readFileSync(resolveSource(WORKER_REL), 'utf8');
		const extWorkspace = fs.readFileSync(resolveSource(EXT_WORKSPACE_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const mainWindow = fs.readFileSync(resolveSource(MAIN_WINDOW_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(KERNELS_REL), 'utf8');
		const chatSessions = fs.readFileSync(resolveSource(CHAT_SESSIONS_REL), 'utf8');
		const shell = fs.readFileSync(resolveSource(SHELL_REL), 'utf8');
		const task = fs.readFileSync(resolveSource(TASK_REL), 'utf8');
		const nodeTask = fs.readFileSync(resolveSource(NODE_TASK_REL), 'utf8');

		assert.ok(protocol.includes('$disposeEditorInset(handle: number): void;'));
		assert.ok(inset.includes('that._proxy.$disposeEditorInset(handle);'));
		assert.ok(!inset.includes('$disposeEditorInset(handle).catch'));

		assert.ok(comments.includes('this.proxy.$addComment(this.handle, typeConvert.Range.from(range), body);'));
		assert.ok(!comments.includes('$addComment(this.handle, typeConvert.Range.from(range), body).catch'));

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
	});
});
