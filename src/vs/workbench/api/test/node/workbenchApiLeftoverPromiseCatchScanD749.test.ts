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
const INSET_REL = 'src/vs/workbench/api/common/extHostCodeInsets.ts';
const SPEECH_REL = 'src/vs/workbench/api/browser/mainThreadSpeech.ts';
const COMMENTS_REL = 'src/vs/workbench/api/common/extHostAgentEditorComments.ts';
const SCM_REL = 'src/vs/workbench/api/common/extHostSCM.ts';
const TUNNEL_EXT_REL = 'src/vs/workbench/api/common/extHostTunnelService.ts';
const TUNNEL_MAIN_REL = 'src/vs/workbench/api/browser/mainThreadTunnelService.ts';
const PROTOCOL_REL = 'src/vs/workbench/api/common/extHost.protocol.ts';
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
const DEBUG_REL = 'src/vs/workbench/api/common/extHostDebugService.ts';
const EXT_SERVICE_REL = 'src/vs/workbench/api/common/extHostExtensionService.ts';
const TELEMETRY_REL = 'src/vs/workbench/api/common/extHostTelemetry.ts';
const TABS_REL = 'src/vs/workbench/api/browser/mainThreadEditorTabs.ts';
const TREES_REL = 'src/vs/workbench/api/browser/mainThreadTreeViews.ts';
const CONFIG_REL = 'src/vs/workbench/api/common/extHostConfiguration.ts';
const SEARCH_REL = 'src/vs/workbench/api/node/extHostSearch.ts';
const TOOLS_REL = 'src/vs/workbench/api/common/extHostLanguageModelTools.ts';
const WORKSPACE_REL = 'src/vs/workbench/api/browser/mainThreadWorkspace.ts';
const LOGGER_REL = 'src/vs/workbench/api/common/extHostLoggerService.ts';

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
const leftoverFiles = [INSET_REL, SPEECH_REL, COMMENTS_REL];
const lockedLeftoverFiles = [WINDOW_REL, TABS_REL, TREES_REL, CONFIG_REL, SEARCH_REL, TOOLS_REL, WORKSPACE_REL, LOGGER_REL, DEBUG_REL, EXT_SERVICE_REL, OUTPUT_REL, KERNELS_REL, TELEMETRY_REL, CHAT_SESSIONS_REL];

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

suite('workbench/api leftover Promise fire-and-forget catch scan (D749)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers leftover Promise double-chain sites after D742', () => {
		let sites = 0;
		for (const rel of leftoverFiles) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += countDoubleChains(source);
		}
		assert.ok(sites >= 4 && sites <= 8, `expected 4-8 leftover sites, got ${sites}`);
		assert.strictEqual(sites, 8);
	});

	test('inset leftover $createEditorInset is Promise double-chain; sync void $disposeEditorInset stays skipped', () => {
		const source = fs.readFileSync(resolveSource(INSET_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$createEditorInset(handle: number, id: string, uri: UriComponents, line: number, height: number, options: IWebviewContentOptions, extensionId: ExtensionIdentifier, extensionLocation: UriComponents): Promise<void>;');
		assert.ok(protocol.includes('$disposeEditorInset(handle: number): void;'));
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._proxy.$createEditorInset(handle, apiEditor.id, apiEditor.value.document.uri, line + 1, height, options || {}, extension.identifier, extension.extensionLocation)');
		assert.ok(source.includes('that._proxy.$disposeEditorInset(handle);'));
		assert.ok(!source.includes('$disposeEditorInset(handle).catch'));
	});

	test('speech leftover $create*Session / $cancel*Session are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SPEECH_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$createSpeechToTextSession(handle: number, session: number, language?: string): Promise<void>;');
		assertPromiseSignature(protocol, '$cancelSpeechToTextSession(session: number): Promise<void>;');
		assertPromiseSignature(protocol, '$createTextToSpeechSession(handle: number, session: number, language?: string): Promise<void>;');
		assertPromiseSignature(protocol, '$cancelTextToSpeechSession(session: number): Promise<void>;');
		assertPromiseSignature(protocol, '$createKeywordRecognitionSession(handle: number, session: number): Promise<void>;');
		assertPromiseSignature(protocol, '$cancelKeywordRecognitionSession(session: number): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.proxy.$createSpeechToTextSession(handle, session, options?.language)');
		assertDoubleThen(source, 'this.proxy.$cancelSpeechToTextSession(session)');
		assertDoubleThen(source, 'this.proxy.$createTextToSpeechSession(handle, session, options?.language)');
		assertDoubleThen(source, 'this.proxy.$cancelTextToSpeechSession(session)');
		assertDoubleThen(source, 'this.proxy.$createKeywordRecognitionSession(handle, session)');
		assertDoubleThen(source, 'this.proxy.$cancelKeywordRecognitionSession(session)');
	});

	test('comments leftover $createAgentEditorComments is Promise double-chain; leftover add/delete/dispose stay leftover', () => {
		const source = fs.readFileSync(resolveSource(COMMENTS_REL), 'utf8');
		const protocol = fs.readFileSync(resolveSource(PROTOCOL_REL), 'utf8');
		assertPromiseSignature(protocol, '$createAgentEditorComments(handle: number, uri: UriComponents): Promise<void>;');
		assertPromiseSignature(protocol, '$addComment(handle: number, range: IRange, body: string): Promise<void>;');
		assertPromiseSignature(protocol, '$deleteComment(handle: number, id: string): Promise<void>;');
		assertPromiseSignature(protocol, '$disposeAgentEditorComments(handle: number): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.proxy.$createAgentEditorComments(handle, uri)');
		assert.ok(source.includes('this.proxy.$addComment(this.handle, typeConvert.Range.from(range), body);'));
		assert.ok(!source.includes('$addComment(this.handle, typeConvert.Range.from(range), body).catch'));
		assert.ok(source.includes('this.proxy.$deleteComment(this.handle, id);'));
		assert.ok(!source.includes('$deleteComment(this.handle, id).catch'));
		assert.ok(source.includes('this.proxy.$disposeAgentEditorComments(this.handle);'));
		assert.ok(!source.includes('$disposeAgentEditorComments(this.handle).catch'));
	});

	test('D742 leftoverFile SCM remaining / tunnel remaining / D708-D712 leftoverFile pins / D717 !doubleCatch tunnel / opener / Watch / Connect / Pty / two-arg / $sendDidChangeSessions / kernels / empty-catch $executeTask stay skipped', () => {
		const scm = fs.readFileSync(resolveSource(SCM_REL), 'utf8');
		const tunnelExt = fs.readFileSync(resolveSource(TUNNEL_EXT_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_MAIN_REL), 'utf8');
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

		assertPromiseSignature(protocol, '$updateSourceControl(handle: number, features: SCMProviderFeatures): Promise<void>;');
		assertPromiseSignature(protocol, '$registerSourceControl(handle: number, parentHandle: number | undefined, id: string, label: string, rootUri: UriComponents | undefined, iconPath: IconPathDto | undefined, isHidden: boolean | undefined, inputBoxDocumentUri: UriComponents): Promise<void>;');
		assertPromiseSignature(protocol, '$unregisterGroup(sourceControlHandle: number, handle: number): Promise<void>;');
		assertPromiseSignature(protocol, '$spliceResourceStates(sourceControlHandle: number, splices: SCMRawResourceSplices[]): Promise<void>;');
		assertPromiseSignature(protocol, '$unregisterSourceControl(handle: number): Promise<void>;');
		assert.ok(scm.includes('this.#proxy.$updateSourceControl(this.handle, { count });'));
		assert.ok(!scm.includes('$updateSourceControl(this.handle, { count }).catch'));
		assert.ok(scm.includes('this.#proxy.$setInputBoxValue(this._sourceControlHandle, value);'));
		assert.ok(!scm.includes('$setInputBoxValue(this._sourceControlHandle, value).catch'));
		assert.ok(scm.includes('this._proxy.$updateGroup(this._sourceControlHandle, this.handle, this.features);'));
		assert.ok(!scm.includes('$updateGroup(this._sourceControlHandle, this.handle, this.features).catch'));
		assert.ok(scm.includes('this.#proxy.$registerSourceControl(this.handle, _parent?.handle, _id, _label, _rootUri, getHistoryItemIconDto(_iconPath), _isHidden, inputBoxDocumentUri);'));
		assert.ok(!scm.includes('$registerSourceControl(this.handle, _parent?.handle, _id, _label, _rootUri, getHistoryItemIconDto(_iconPath), _isHidden, inputBoxDocumentUri).catch'));
		assert.ok(scm.includes('this.#proxy.$unregisterGroup(this.handle, group.handle);'));
		assert.ok(!scm.includes('$unregisterGroup(this.handle, group.handle).catch'));
		assert.ok(scm.includes('this.#proxy.$spliceResourceStates(this.handle, splices);'));
		assert.ok(!scm.includes('$spliceResourceStates(this.handle, splices).catch'));
		assert.ok(scm.includes('this.#proxy.$unregisterSourceControl(this.handle);'));
		assert.ok(!scm.includes('$unregisterSourceControl(this.handle).catch'));

		assertPromiseSignature(protocol, '$setTunnelProvider(features: TunnelProviderFeatures | undefined, enablePortsView: boolean): Promise<void>;');
		assertPromiseSignature(protocol, '$setCandidatePortSource(source: CandidatePortSource): Promise<void>;');
		assertPromiseSignature(protocol, '$setCandidateFilter(): Promise<void>;');
		assertPromiseSignature(protocol, '$registerPortsAttributesProvider(selector: PortAttributesSelector, providerHandle: number): Promise<void>;');
		assert.ok(tunnelExt.includes('this._proxy.$setTunnelProvider(undefined, false);'));
		assert.ok(!tunnelExt.includes('$setTunnelProvider(undefined, false).catch'));
		assert.ok(tunnelExt.includes('this._proxy.$setTunnelProvider(tunnelFeatures, !!provider.tunnelFactory);'));
		assert.ok(!tunnelExt.includes('$setTunnelProvider(tunnelFeatures, !!provider.tunnelFactory).catch'));
		assert.ok(tunnelExt.includes('this._proxy.$setCandidatePortSource(provider.candidatePortSource);'));
		assert.ok(!tunnelExt.includes('$setCandidatePortSource(provider.candidatePortSource).catch'));
		assert.ok(tunnelExt.includes('this._proxy.$setCandidateFilter();'));
		assert.ok(!tunnelExt.includes('$setCandidateFilter().catch'));
		assert.ok(tunnelExt.includes('this._proxy.$registerPortsAttributesProvider(portSelector, providerHandle);'));
		assert.ok(!tunnelExt.includes('$registerPortsAttributesProvider(portSelector, providerHandle).catch'));

		assert.ok(tunnel.includes(`		}).catch(() => {
			// The remote failed to get setup. Errors from that area will already be surfaced to the user.
		});`));
		assert.ok(!tunnel.includes(doubleCatch));

		let lockedSites = 0;
		for (const rel of lockedLeftoverFiles) {
			lockedSites += countDoubleChains(fs.readFileSync(resolveSource(rel), 'utf8'));
		}
		assert.strictEqual(lockedSites, 16);

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
