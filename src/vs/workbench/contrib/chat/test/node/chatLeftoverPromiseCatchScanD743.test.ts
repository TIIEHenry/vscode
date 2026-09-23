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
const HANDLER_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSessionHandler.ts';
const VOICE_REL = 'src/vs/workbench/contrib/chat/browser/voiceClient/voiceSessionController.ts';
const PICKER_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/modelPicker/modelPickerWidget.ts';
const TERMINAL_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.ts';
const MODE_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/modePickerActionItem.ts';
const TREE_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatTreeContentPart.ts';
const EXT_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatExtensionsContentPart.ts';
const HOVER_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatAgentHover.ts';
const WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const VIEWPANE_REL = 'src/vs/workbench/contrib/chat/browser/widgetHosts/viewPane/chatViewPane.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupRunner.ts';
const SIDECAR_REL = 'src/vs/workbench/contrib/chat/browser/chatDebug/agentHostUsageSidecar.ts';
const WELCOME_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationWelcomePagePromptLaunchers.ts';
const SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/chatSessions/chatSessions.contribution.ts';
const FIND_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatFind/chatFindWidget.ts';
const INPUT_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts';
const EXP_REL = 'src/vs/workbench/contrib/chat/browser/expNotification/chatExpNotificationContribution.ts';
const SLASH_REL = 'src/vs/workbench/contrib/chat/browser/chatSlashCommands.ts';
const GROWTH_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupGrowthSession.ts';
const SIGNAL_REL = 'src/vs/platform/accessibilitySignal/browser/accessibilitySignalService.ts';
const TRUST_REL = 'src/vs/platform/workspace/common/workspaceTrust.ts';
const TERMINAL_SVC_REL = 'src/vs/workbench/contrib/terminal/browser/terminal.ts';
const TREE_IMPL_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';
const EXT_VIEWER_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewer.ts';
const EXT_SVC_REL = 'src/vs/workbench/contrib/extensions/common/extensions.ts';
const CHAT_SVC_REL = 'src/vs/workbench/contrib/chat/common/chatService/chatService.ts';
const SESSIONS_CTRL_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const EXT_HOST_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const ASSIGN_REL = 'src/vs/workbench/services/assignment/common/assignmentService.ts';

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

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`), `single-chain remains: ${call}`);
}

suite('Chat leftover Promise fire-and-forget catch scan (D743)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers seventeen leftover Promise double-chain sites; D679/D728/D735 stay skipped', () => {
		const handler = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		const voice = fs.readFileSync(resolveSource(VOICE_REL), 'utf8');
		const picker = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const mode = fs.readFileSync(resolveSource(MODE_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const ext = fs.readFileSync(resolveSource(EXT_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const viewPane = fs.readFileSync(resolveSource(VIEWPANE_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const find = fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		const sites =
			countIncludes(handler, `						}).catch(onUnexpectedError).catch(onUnexpectedError);
					};
					if (claimant) {`) +
			countIncludes(handler, 'void Promise.resolve(this._filterAutoGrantedMcpAuthentication(opts.sessionResource, pendingAuth))') +
			countIncludes(voice, `void this.accessibilitySignalService.playSignal(AccessibilitySignal.voiceModeStopped, {
				source: 'voiceMode.disconnect',
				userGesture: true,
			})${doubleCatch}`) +
			countIncludes(voice, `void this.accessibilitySignalService.playSignal(AccessibilitySignal.voiceRecordingStopped, {
			source: userGesture ? 'voiceMode.explicitListeningStopped' : 'voiceMode.listeningStopped',
			userGesture,
		})${doubleCatch}`) +
			countIncludes(voice, `void this.accessibilitySignalService.playSignal(AccessibilitySignal.voiceModeStarted, {
				source: 'voiceMode.connectListeningStarted',
				userGesture: true,
			})${doubleCatch}`) +
			countIncludes(voice, `void this.accessibilitySignalService.playSignal(AccessibilitySignal.voiceRecordingStarted, {
			source: 'voiceMode.explicitListeningStarted',
			userGesture: true,
		})${doubleCatch}`) +
			countIncludes(picker, 'void Promise.resolve(this._workspaceTrustManagementService.workspaceTrustInitialized)') +
			countIncludes(terminal, 'void Promise.resolve(this._terminalService.whenConnected)') +
			countIncludes(mode, "void Promise.resolve(assignmentService.getTreatment('chat.showOldAskMode'))") +
			countIncludes(tree, 'void Promise.resolve(this.tree.setInput(data))') +
			countIncludes(ext, 'void Promise.resolve(getExtensions(extensionsContent.extensions, extensionsWorkbenchService))') +
			countIncludes(hover, 'void Promise.resolve(this.extensionService.getExtensions([{ id: agent.extensionId.value }], cancel.token))') +
			countIncludes(widget, 'void Promise.resolve(sent.data.responseCreatedPromise)') +
			countIncludes(widget, 'void Promise.resolve(sent.data.responseCompletePromise)') +
			countIncludes(viewPane, 'void this.restoringSession.finally(() => this.restoringSession = undefined)') +
			countIncludes(viewPane, 'void Promise.resolve(updatePromise)') +
			countIncludes(setup, 'void Promise.resolve(this.extensionService.whenInstalledExtensionsRegistered())');
		assert.strictEqual(sites, 17);
		assert.strictEqual(countIncludes(find, `void this.updateResultCount()${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(handler, 'void this._filterAutoGrantedMcpAuthentication(sessionResource, servers)'), 1);
	});

	test('agentHostSessionHandler leftover _executeClientTool.finally and filter.then are double-chain', () => {
		const source = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		assert.ok(source.includes("import { getErrorCode, isCancellationError, onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _executeClientTool(request: ClientToolExecutionRequest, contextSessionResource: URI | undefined, token: CancellationToken, isCurrent: () => boolean, markInvocationStarted: () => void): Promise<void> {'));
		assert.ok(source.includes('private async _filterAutoGrantedMcpAuthentication(sessionResource: URI, servers: readonly IChatMcpAuthenticationRequiredServer[]): Promise<readonly IChatMcpAuthenticationRequiredServer[]> {'));
		assert.ok(source.includes(`						}).catch(onUnexpectedError).catch(onUnexpectedError);
					};
					if (claimant) {`));
		assert.ok(!source.includes(`						});
					};
					if (claimant) {`));
		const filterCall = 'void Promise.resolve(this._filterAutoGrantedMcpAuthentication(opts.sessionResource, pendingAuth))';
		assert.ok(source.includes(`${filterCall}.then(servers => {`));
		assert.ok(source.includes(`part.servers.set(servers.filter(server => ownedIds.has(server.id)), undefined);
			})${doubleCatch};`));
		assert.ok(!source.includes('this._filterAutoGrantedMcpAuthentication(opts.sessionResource, pendingAuth).then(servers => {'));
	});

	test('voice leftover playSignal voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(VOICE_REL), 'utf8');
		const signal = fs.readFileSync(resolveSource(SIGNAL_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(signal.includes('playSignal(signal: AccessibilitySignal, options?: IAccessbilitySignalOptions): Promise<void>;'));
		assertWrapped(source, `void this.accessibilitySignalService.playSignal(AccessibilitySignal.voiceModeStopped, {
				source: 'voiceMode.disconnect',
				userGesture: true,
			})`);
		assertWrapped(source, `void this.accessibilitySignalService.playSignal(AccessibilitySignal.voiceRecordingStopped, {
			source: userGesture ? 'voiceMode.explicitListeningStopped' : 'voiceMode.listeningStopped',
			userGesture,
		})`);
		assertWrapped(source, `void this.accessibilitySignalService.playSignal(AccessibilitySignal.voiceModeStarted, {
				source: 'voiceMode.connectListeningStarted',
				userGesture: true,
			})`);
		assertWrapped(source, `void this.accessibilitySignalService.playSignal(AccessibilitySignal.voiceRecordingStarted, {
			source: 'voiceMode.explicitListeningStarted',
			userGesture: true,
		})`);
	});

	test('widget leftover .then without void is Promise.resolve double-chain', () => {
		const picker = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const mode = fs.readFileSync(resolveSource(MODE_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const ext = fs.readFileSync(resolveSource(EXT_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const trust = fs.readFileSync(resolveSource(TRUST_REL), 'utf8');
		const terminalSvc = fs.readFileSync(resolveSource(TERMINAL_SVC_REL), 'utf8');
		const treeImpl = fs.readFileSync(resolveSource(TREE_IMPL_REL), 'utf8');
		const extViewer = fs.readFileSync(resolveSource(EXT_VIEWER_REL), 'utf8');
		const extSvc = fs.readFileSync(resolveSource(EXT_SVC_REL), 'utf8');
		const chatSvc = fs.readFileSync(resolveSource(CHAT_SVC_REL), 'utf8');
		const assign = fs.readFileSync(resolveSource(ASSIGN_REL), 'utf8');
		assert.ok(trust.includes('readonly workspaceTrustInitialized: Promise<void>;'));
		assert.ok(terminalSvc.includes('readonly whenConnected: Promise<void>;'));
		assert.ok(treeImpl.includes('async setInput(input: TInput, viewState?: IAsyncDataTreeViewState): Promise<void> {'));
		assert.ok(extViewer.includes('export async function getExtensions(extensions: string[], extensionsWorkbenchService: IExtensionsWorkbenchService): Promise<IExtension[]> {'));
		assert.ok(extSvc.includes('getExtensions(extensionInfos: IExtensionInfo[], token: CancellationToken): Promise<IExtension[]>;'));
		assert.ok(chatSvc.includes('responseCreatedPromise: Promise<IChatResponseModel>;'));
		assert.ok(chatSvc.includes('responseCompletePromise: Promise<void>;'));
		assert.ok(assign.includes('async getTreatment<T extends string | number | boolean>(name: string): Promise<T | undefined> {'));
		assert.ok(picker.includes("import { onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.ok(terminal.includes("import { onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.ok(mode.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(tree.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(ext.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(hover.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(widget.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(picker, `void Promise.resolve(this._workspaceTrustManagementService.workspaceTrustInitialized).then(() => {
			if (this._store.isDisposed) {
				return;
			}
			this._workspaceTrustInitialized = true;
			this._renderLabel();
		})`);
		assertWrapped(terminal, `void Promise.resolve(this._terminalService.whenConnected).then(() => {
			initializeTerminalActionsOnce();
		})`);
		assertWrapped(mode, `void Promise.resolve(assignmentService.getTreatment('chat.showOldAskMode')).then(showOldAskMode => {
			assignments.set({ showOldAskMode: showOldAskMode === 'enabled' }, undefined);
		})`);
		assertWrapped(tree, `void Promise.resolve(this.tree.setInput(data)).then(() => {
			if (!ref.isStale()) {
				this.tree.layout();
			}
		})`);
		assertWrapped(ext, `void Promise.resolve(getExtensions(extensionsContent.extensions, extensionsWorkbenchService)).then(extensions => {
			loadingElement.remove();
			if (this._store.isDisposed) {
				return;
			}
			list.setModel(new PagedModel(extensions));
			list.layout();
		})`);
		assertWrapped(hover, `void Promise.resolve(this.extensionService.getExtensions([{ id: agent.extensionId.value }], cancel.token)).then(extensions => {
				cancel.dispose();
				const extension = extensions[0];
				if (extension?.publisherDomain?.verified) {
					this.domNode.classList.toggle('verifiedPublisher', true);
					this._onDidChangeContents.fire();
				}
			})`);
		assert.ok(widget.includes(`void Promise.resolve(sent.data.responseCreatedPromise).then((responseModel) => {`));
		assert.ok(widget.includes(`void Promise.resolve(sent.data.responseCompletePromise).then(() => {`));
		assert.ok(widget.includes(`			}).catch(onUnexpectedError).catch(onUnexpectedError);
		}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(!widget.includes('sent.data.responseCreatedPromise.then(() => {'));
		assert.ok(!widget.includes('sent.data.responseCompletePromise.then(() => {'));
	});

	test('viewPane leftover restoringSession.finally and updatePromise.then are double-chain', () => {
		const source = fs.readFileSync(resolveSource(VIEWPANE_REL), 'utf8');
		const control = fs.readFileSync(resolveSource(SESSIONS_CTRL_REL), 'utf8');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(control.includes('async update(): Promise<boolean> {'));
		assertWrapped(source, 'void this.restoringSession.finally(() => this.restoringSession = undefined)');
		assertWrapped(source, `void Promise.resolve(updatePromise).then(didUpdate => {
					if (!didUpdate) {
						return;
					}

					const sessionResource = this._widget?.viewModel?.sessionResource;
					if (sessionResource) {
						this.sessionsControl?.reveal(sessionResource);
					}
				})`);
		assert.ok(source.includes('this.restoringSession = this._applyModel(cts.token).catch(err => {'));
		assert.ok(source.includes('this.restoringSession.finally(() => this.restoringSession = undefined);'));
	});

	test('setup leftover whenInstalledExtensionsRegistered.then is Promise.resolve double-chain', () => {
		const source = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXT_HOST_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(extensions.includes('whenInstalledExtensionsRegistered(): Promise<boolean>;'));
		assertWrapped(source, 'void Promise.resolve(this.extensionService.whenInstalledExtensionsRegistered()).then(check)');
	});

	test('opener / Action.run / two-arg then / welcome leftover / Resolve / Pty / queued / D679/D728/D735 stay skipped', () => {
		const picker = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		const welcome = fs.readFileSync(resolveSource(WELCOME_REL), 'utf8');
		const voice = fs.readFileSync(resolveSource(VOICE_REL), 'utf8');
		const sessions = fs.readFileSync(resolveSource(SESSIONS_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const sidecar = fs.readFileSync(resolveSource(SIDECAR_REL), 'utf8');
		const exp = fs.readFileSync(resolveSource(EXP_REL), 'utf8');
		const slash = fs.readFileSync(resolveSource(SLASH_REL), 'utf8');
		const growth = fs.readFileSync(resolveSource(GROWTH_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		assert.ok(picker.includes('void this._openerService.open(uri, { allowCommands: true });'));
		assert.ok(!picker.includes('void this._openerService.open(uri, { allowCommands: true }).catch'));
		assert.ok(welcome.includes('void this.commandService.executeCommand(customization.commandId);'));
		assert.ok(!welcome.includes('void this.commandService.executeCommand(customization.commandId).catch'));
		assert.ok(voice.includes("run: () => { void this.commandService.executeCommand('workbench.action.chat.triggerSetupForceSignIn'); },"));
		assert.ok(!voice.includes("void this.commandService.executeCommand('workbench.action.chat.triggerSetupForceSignIn').catch"));
		assert.ok(voice.includes('run: () => { void this.connect(this._window ?? mainWindow); },'));
		assert.ok(!voice.includes('void this.connect(this._window ?? mainWindow).catch'));
		assert.ok(sessions.includes('void promise.then(clearPendingSession, clearPendingSession);'));
		assert.ok(!sessions.includes('void promise.then(clearPendingSession, clearPendingSession).catch'));
		assert.ok(input.includes('void inputModelReference.then('));
		assert.ok(!input.includes('void inputModelReference.then(\n\t\t\t\t\t() => model.dispose(),\n\t\t\t\t\t() => model.dispose()\n\t\t\t\t).catch'));
		assert.ok(voice.includes('this.voiceToolDispatchService.dispatchToolCall(e).then(result => {'));
		assert.ok(!voice.includes('this.voiceToolDispatchService.dispatchToolCall(e).then(result => {\n\t\t\t\t\t\tthis.voiceClientService.sendToolResult(e.callId, result);\n\t\t\t\t\t}).catch(onUnexpectedError)'));
		assert.ok(sidecar.includes('void pending.finally(() => {'));
		assert.ok(!sidecar.includes(`void pending.finally(() => {
			// Only drop the entry if nothing was queued behind us; otherwise the
			// later operation still owns it and removing it here would let the
			// operation after that run concurrently with it.
			if (this._queues.get(rawId) === pending) {
				this._queues.delete(rawId);
			}
		})${doubleCatch}`));
		assert.ok(sidecar.includes('.catch(err => {'));
		assert.ok(sidecar.includes('void this.queued(rawId, () => this._fileService.writeFile(uri, VSBuffer.fromString(line), { append: true }));'));
		assert.ok(!sidecar.includes('void this.queued(rawId, () => this._fileService.writeFile(uri, VSBuffer.fromString(line), { append: true })).catch'));
		assert.ok(exp.includes('void this._resolve();'));
		assert.ok(!exp.includes('void this._resolve().catch'));
		assert.ok(slash.includes('void agentHostProvisionalService.refreshResolvedConfig(sessionResource, backendSession.scheme, workingDirectory, nextConfig);'));
		assert.ok(!slash.includes('void agentHostProvisionalService.refreshResolvedConfig(sessionResource, backendSession.scheme, workingDirectory, nextConfig).catch'));
		assert.ok(growth.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(hover.includes('commandService.executeCommand(showExtensionsWithIdsCommandId, [agent.extensionId.value]);'));
		assert.ok(!hover.includes('commandService.executeCommand(showExtensionsWithIdsCommandId, [agent.extensionId.value]).catch'));
		assert.ok(tree.includes('this.openerService.open(e.element.uri);'));
		assert.ok(!tree.includes('this.openerService.open(e.element.uri).catch'));
		assert.strictEqual(countIncludes(fs.readFileSync(resolveSource(FIND_REL), 'utf8'), `void this.updateResultCount()${doubleCatch}`), 3);
	});
});
