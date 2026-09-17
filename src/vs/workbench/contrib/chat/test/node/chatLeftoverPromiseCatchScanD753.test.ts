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
const LM_REL = 'src/vs/workbench/contrib/chat/common/languageModels.ts';
const MODEL_REL = 'src/vs/workbench/contrib/chat/common/model/chatModel.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts';
const PASTE_REL = 'src/vs/workbench/contrib/chat/browser/chatTerminalCommandPaste.ts';
const SHARED_REL = 'src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts';
const BYOK_REL = 'src/vs/workbench/contrib/chat/browser/hasByokModelsContribution.ts';
const TIP_REL = 'src/vs/workbench/contrib/chat/browser/chatTipService.ts';
const TUNNEL_REL = 'src/vs/workbench/contrib/chat/electron-browser/tunnelHostService.ts';
const CACHE_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostPromptCacheNotification.ts';
const HANDLER_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSessionHandler.ts';
const DEBUG_REL = 'src/vs/workbench/contrib/chat/common/chatDebugServiceImpl.ts';
const PROMPTS_REL = 'src/vs/workbench/contrib/chat/common/promptSyntax/service/promptsServiceImpl.ts';
const SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/chatSessions/chatSessions.contribution.ts';
const VIEWPANE_REL = 'src/vs/workbench/contrib/chat/browser/widgetHosts/viewPane/chatViewPane.ts';
const REC_REL = 'src/vs/workbench/contrib/chat/browser/actions/chatAgentRecommendationActions.ts';
const GROWTH_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupGrowthSession.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/chat/electron-browser/chat.contribution.ts';
const PICKER_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/modelPicker/modelPickerWidget.ts';
const WELCOME_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationWelcomePagePromptLaunchers.ts';
const FIND_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatFind/chatFindWidget.ts';
const EXP_REL = 'src/vs/workbench/contrib/chat/browser/expNotification/chatExpNotificationContribution.ts';
const SLASH_REL = 'src/vs/workbench/contrib/chat/browser/chatSlashCommands.ts';
const ASSIGN_REL = 'src/vs/workbench/services/assignment/common/assignmentService.ts';
const EXT_HOST_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const LM_CFG_REL = 'src/vs/workbench/contrib/chat/common/languageModelsConfiguration.ts';
const CHAT_SVC_REL = 'src/vs/workbench/contrib/chat/common/chatService/chatService.ts';
const SESSIONS_SVC_REL = 'src/vs/workbench/contrib/chat/common/chatSessionsService.ts';
const AGENTS_REL = 'src/vs/workbench/contrib/chat/common/participants/chatAgents.ts';
const TUNNEL_IFACE_REL = 'src/vs/platform/agentHost/common/tunnelAgentHost.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';

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

const refreshCall = `			.then(() => this._refreshChatControlData())
			`;
const taskCall = `progress.task?.().then((content) => {
				// Stop listening for progress updates once the task settles
				disp.dispose();

				// Replace the resolving part's content with the resolved response
				if (typeof content === 'string') {
					(this._responseParts[responsePosition] as IChatTask).content = new MarkdownString(content);
				}
				this._contentChanged(false);
			})`;
const interruptCall = `providedSession.interruptActiveResponseCallback?.().then(userConfirmedInterruption => {
						if (!userConfirmedInterruption) {
							trackNewCancellableRequest();
						}
					})`;
const followupsCall = `agentOrCommandFollowups.then(followups => {
							model.setFollowups(completedRequest, followups);
							const commandForTelemetry = agentSlashCommandPart ? agentSlashCommandPart.command.name : commandPart?.slashCommand.command;
							this._chatServiceTelemetry.retrievedFollowups(model.sessionResource, agentPart?.agent.id ?? '', commandForTelemetry, followups?.length ?? 0);
						})`;
const pasteCall = `shouldPasteTerminalCommand(dialogService, storageService, prefix).then(result => {
		if (result === 'paste') {
			editor.trigger('keyboard', Handler.Paste, { text: pastedText });
		}
	})`;
const maxRequestsCall = `this.experimentService.getTreatment<number>(treatmentId).then((value) => {
				const node: IConfigurationNode = {
					id: 'chatSidebar',
					title: nls.localize('interactiveSessionConfigurationTitle', "Chat"),
					type: 'object',
					properties: {
						'chat.agent.maxRequests': {
							type: 'number',
							markdownDescription: nls.localize('chat.agent.maxRequests', "The maximum number of requests to allow per-turn when using an agent. When the limit is reached, will ask to confirm to continue."),
							default: value ?? 50,
							order: 2,
							agentsWindow: { default: 1000 },
						},
					}
				};
				configurationRegistry.updateConfigurations({ remove: lastNode ? [lastNode] : [], add: [node] });
				lastNode = node;
			})`;
const newButtonCall = `this.experimentService.getTreatment<string>('chatNewButtonIcon').then((value) => {
			const supportedValues = ['copilot', 'new-session', 'comment'];
			if (typeof value === 'string' && supportedValues.includes(value)) {
				this.newChatButtonExperimentIcon.set(value);
			} else {
				this.newChatButtonExperimentIcon.reset();
			}
		})`;
const defaultModeCall = `this.experimentService.getTreatment<string>('chatDefaultNewSessionMode').then(value => {
			const node: IConfigurationNode = {
				id: 'chatSidebar',
				title: nls.localize('interactiveSessionConfigurationTitle', "Chat"),
				type: 'object',
				properties: {
					[ChatConfiguration.DefaultNewSessionMode]: {
						type: 'string',
						description: nls.localize('chat.newSession.defaultMode', "The default mode for new chat sessions. When empty, the chat view's default mode is used."),
						default: typeof value === 'string' ? value : '',
					}
				}
			};
			configurationRegistry.updateConfigurations({ add: [node], remove: [] });
		})`;
const byokExtCall = `extensionService.whenInstalledExtensionsRegistered().then(() => {
			if (!this._store.isDisposed) {
				this._extensionsRegistered = true;
				this._update();
			}
		})`;
const byokReadyCall = `this._languageModelsConfigurationService.whenReady.then(() => {
			if (!this._store.isDisposed) {
				this._configurationLoaded = true;
				this._update();
			}
		})`;
const tipCall = `this._assignmentService.getTreatment<string>(ChatTipExperiment.OpenAgentsWindowTip).then(value => {
			if (typeof value === 'string' && value.length > 0) {
				this._experimentalTipMessages.set(ChatTipExperiment.OpenAgentsWindowTip, value);
			}
		})`;
const tunnelCall = `this._mainService.getStatus().then(status => {
			this._isSharing = status.active;
			this._sharingInfo = status.active ? status.info : undefined;
			if (status.active) {
				this._onDidChangeStatus.fire();
			}
		})`;
const cacheCall = `void assignmentService.getTreatment<boolean>(PROMPT_CACHE_EXPIRATION_NOTIFICATION_EXPERIMENT).then(enabled => {
			this._experimentEnabled = enabled === true;
			for (const sessionResource of this._cacheExpirations.keys()) {
				this._updateNotification(sessionResource);
			}
		}).catch(error => this._logService.warn(\`[AgentHostPromptCacheNotification] Failed to resolve experiment: \${error}\`))`;
const carouselCall = `carousel.completion.p.then(result => {
			if (store.isDisposed || completedFromServer) {
				return;
			}
			if (!result.answers) {
				this._config.connection.dispatch(opts.chatURI, {
					type: ActionType.ChatInputCompleted,
					requestId: inputReq.id,
					response: ChatInputResponseKind.Cancel,
				});
			} else {
				const answers = convertCarouselAnswers(result.answers, inputReq.questions);
				this._config.connection.dispatch(opts.chatURI, {
					type: ActionType.ChatInputCompleted,
					requestId: inputReq.id,
					response: ChatInputResponseKind.Accept,
					answers,
				});
			}
		})`;
const reviewCall = `review.completion.p.then(result => {
			if (store.isDisposed || inputCompleted) {
				return;
			}
			const completion = result
				? convertPlanReviewResult(planReview, result)
				: { response: ChatInputResponseKind.Cancel };
			this._config.connection.dispatch(opts.chatURI, {
				type: ActionType.ChatInputCompleted,
				requestId: inputReq.id,
				...completion,
			});
		})`;
const confirmCall = `IChatToolInvocation.awaitConfirmation(invocation, cancellationToken).then(reason => {`;

suite('Chat leftover Promise fire-and-forget catch scan (D753)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers sixteen leftover Promise double-chain sites; D679/D728/D735/D743 stay skipped', () => {
		const lm = fs.readFileSync(resolveSource(LM_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const paste = fs.readFileSync(resolveSource(PASTE_REL), 'utf8');
		const shared = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const byok = fs.readFileSync(resolveSource(BYOK_REL), 'utf8');
		const tip = fs.readFileSync(resolveSource(TIP_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const cache = fs.readFileSync(resolveSource(CACHE_REL), 'utf8');
		const handler = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		const sites =
			countIncludes(lm, `${refreshCall}${doubleCatch}`) +
			countIncludes(model, `${taskCall}${doubleCatch}`) +
			countIncludes(service, `${interruptCall}${doubleCatch}`) +
			countIncludes(service, `${followupsCall}${doubleCatch}`) +
			countIncludes(paste, `${pasteCall}${doubleCatch}`) +
			countIncludes(shared, `${maxRequestsCall}${doubleCatch}`) +
			countIncludes(shared, `${newButtonCall}${doubleCatch}`) +
			countIncludes(shared, `${defaultModeCall}${doubleCatch}`) +
			countIncludes(byok, `${byokExtCall}${doubleCatch}`) +
			countIncludes(byok, `${byokReadyCall}${doubleCatch}`) +
			countIncludes(tip, `${tipCall}${doubleCatch}`) +
			countIncludes(tunnel, `${tunnelCall}${doubleCatch}`) +
			countIncludes(cache, `${cacheCall}${doubleCatch}`) +
			countIncludes(handler, `${carouselCall}${doubleCatch}`) +
			countIncludes(handler, `${reviewCall}${doubleCatch}`) +
			countIncludes(handler, `${confirmCall}`);
		assert.strictEqual(sites, 16);
		assert.ok(handler.includes(`${confirmCall}`));
		assert.ok(handler.includes(`		}).catch(err => {
			this._logService.warn(\`[AgentHost] Tool confirmation failed for toolCallId=\${toolCallId}\`, err);
		})${doubleCatch};`));
	});

	test('languageModels leftover refresh chain is double-chain', () => {
		const source = fs.readFileSync(resolveSource(LM_REL), 'utf8');
		assert.ok(source.includes("import { CancellationError, getErrorMessage, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private _refreshChatControlData(): void {'));
		assertWrapped(source, refreshCall);
	});

	test('chatModel leftover progress.task.then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const chatSvc = fs.readFileSync(resolveSource(CHAT_SVC_REL), 'utf8');
		assert.ok(source.includes("import { BugIndicatingError, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(chatSvc.includes('task: () => Promise<string | void>;'));
		assertWrapped(source, taskCall);
	});

	test('chatService leftover interrupt / followups .then are double-chain', () => {
		const source = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const sessions = fs.readFileSync(resolveSource(SESSIONS_SVC_REL), 'utf8');
		const agents = fs.readFileSync(resolveSource(AGENTS_REL), 'utf8');
		assert.ok(source.includes("import { BugIndicatingError, ErrorNoTelemetry, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(sessions.includes('readonly interruptActiveResponseCallback?: () => Promise<boolean>;'));
		assert.ok(agents.includes('getFollowups(id: string, request: IChatAgentRequest, result: IChatAgentResult, history: IChatAgentHistoryEntry[], token: CancellationToken): Promise<IChatFollowup[]>;'));
		assertWrapped(source, interruptCall);
		assertWrapped(source, followupsCall);
	});

	test('terminal paste leftover shouldPasteTerminalCommand.then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(PASTE_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('async function shouldPasteTerminalCommand('));
		assertWrapped(source, pasteCall);
	});

	test('shared leftover getTreatment.then sites are double-chain', () => {
		const source = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const assign = fs.readFileSync(resolveSource(ASSIGN_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(assign.includes('async getTreatment<T extends string | number | boolean>(name: string): Promise<T | undefined> {'));
		assertWrapped(source, maxRequestsCall);
		assertWrapped(source, newButtonCall);
		assertWrapped(source, defaultModeCall);
	});

	test('hasByok leftover whenInstalledExtensionsRegistered / whenReady .then are double-chain', () => {
		const source = fs.readFileSync(resolveSource(BYOK_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXT_HOST_REL), 'utf8');
		const cfg = fs.readFileSync(resolveSource(LM_CFG_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(extensions.includes('whenInstalledExtensionsRegistered(): Promise<boolean>;'));
		assert.ok(cfg.includes('readonly whenReady: Promise<void>;'));
		assertWrapped(source, byokExtCall);
		assertWrapped(source, byokReadyCall);
	});

	test('tip leftover getTreatment.then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(TIP_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, tipCall);
	});

	test('tunnel leftover getStatus.then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(TUNNEL_IFACE_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(iface.includes('getStatus(): Promise<TunnelHostStatus>;'));
		assertWrapped(source, tunnelCall);
	});

	test('prompt-cache leftover getTreatment.then is double-chain after the warn catch', () => {
		const source = fs.readFileSync(resolveSource(CACHE_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assertWrapped(source, cacheCall);
	});

	test('agentHostSessionHandler leftover remaining FOF .then sites are double-chain', () => {
		const source = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		const chatSvc = fs.readFileSync(resolveSource(CHAT_SVC_REL), 'utf8');
		const asyncSrc = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assert.ok(source.includes("import { getErrorCode, isCancellationError, onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(chatSvc.includes('export function awaitConfirmation(invocation: IChatToolInvocation, token?: CancellationToken): Promise<ConfirmedReason> {'));
		assert.ok(asyncSrc.includes('public readonly p: Promise<T>;'));
		assertWrapped(source, carouselCall);
		assertWrapped(source, reviewCall);
		assert.ok(source.includes(confirmCall));
		assert.ok(source.includes(`		}).catch(err => {
			this._logService.warn(\`[AgentHost] Tool confirmation failed for toolCallId=\${toolCallId}\`, err);
		})${doubleCatch};`));
		assert.ok(!source.includes(`		}).catch(err => {
			this._logService.warn(\`[AgentHost] Tool confirmation failed for toolCallId=\${toolCallId}\`, err);
		});`));
	});

	test('assigned / two-arg / returned / Pty / opener / Action.run / Resolve / D679/D728/D735/D743 stay skipped', () => {
		const debug = fs.readFileSync(resolveSource(DEBUG_REL), 'utf8');
		const prompts = fs.readFileSync(resolveSource(PROMPTS_REL), 'utf8');
		const sessions = fs.readFileSync(resolveSource(SESSIONS_REL), 'utf8');
		const viewPane = fs.readFileSync(resolveSource(VIEWPANE_REL), 'utf8');
		const rec = fs.readFileSync(resolveSource(REC_REL), 'utf8');
		const growth = fs.readFileSync(resolveSource(GROWTH_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const picker = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		const welcome = fs.readFileSync(resolveSource(WELCOME_REL), 'utf8');
		const handler = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const exp = fs.readFileSync(resolveSource(EXP_REL), 'utf8');
		const slash = fs.readFileSync(resolveSource(SLASH_REL), 'utf8');
		assert.ok(debug.includes(`			}).catch(onUnexpectedError).catch(onUnexpectedError);
		}
	}

	getHistoricalSessionTitle`));
		assert.ok(prompts.includes('this.getPromptSlashCommands(CancellationToken.None).then(commands => {'));
		assert.ok(prompts.includes("}, () => { /* discovery failures already logged; sync cache stays as-is */ });"));
		assert.ok(!prompts.includes(`}, () => { /* discovery failures already logged; sync cache stays as-is */ })${doubleCatch}`));
		assert.ok(sessions.includes('void promise.then(clearPendingSession, clearPendingSession);'));
		assert.ok(!sessions.includes('void promise.then(clearPendingSession, clearPendingSession).catch'));
		assert.ok(sessions.includes('void contentPromise.then(session => {'));
		assert.ok(sessions.includes('}, () => { });'));
		assert.ok(!sessions.includes('}, () => { }).catch'));
		assert.ok(viewPane.includes("this.acquireTransferredOrPersistedSession(CancellationToken.None, 'ChatViewPane#onDidChangeAgents').then(async session => {"));
		assert.ok(viewPane.includes('this.restoringSession =\n\t\t\t\t\tthis.acquireTransferredOrPersistedSession'));
		assert.ok(rec.includes('this.extensionManagementService.getInstalled().then(installedExtensions => {'));
		assert.ok(rec.includes('}, () => {'));
		assert.ok(!rec.includes('onUnexpectedError'));
		assert.ok(growth.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(contrib.includes(`		timeout(AGENT_HOST_REGISTRATION_TIMEOUT_MS).then(() => {
			cts.cancel();
			cts.dispose();
			return undefined;
		}),`));
		assert.ok(!contrib.includes(`		timeout(AGENT_HOST_REGISTRATION_TIMEOUT_MS).then(() => {
			cts.cancel();
			cts.dispose();
			return undefined;
		})${doubleCatch}`));
		assert.ok(picker.includes('void this._openerService.open(uri, { allowCommands: true });'));
		assert.ok(!picker.includes('void this._openerService.open(uri, { allowCommands: true }).catch'));
		assert.ok(welcome.includes('void this.commandService.executeCommand(customization.commandId);'));
		assert.ok(!welcome.includes('void this.commandService.executeCommand(customization.commandId).catch'));
		assert.ok(handler.includes('void terminalInstance.then(() => {'));
		assert.ok(handler.includes("}, error => this._logService.error(`[AgentHost] Failed to revive terminal '${terminalUri}'`, error));"));
		assert.ok(!handler.includes(`}, error => this._logService.error(\`[AgentHost] Failed to revive terminal '\${terminalUri}'\`, error))${doubleCatch}`));
		assert.ok(handler.includes('this._acquireOrWaitForSession(sessionResource, store).then(chatModel => {'));
		assert.ok(handler.includes('}, err => {'));
		assert.ok(handler.includes('this._hideAutoExplainabilityReady = readHideAutoExplainability();'));
		assert.ok(service.includes('void generate().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(viewPane.includes(`void this.restoringSession.finally(() => this.restoringSession = undefined)${doubleCatch};`));
		assert.ok(exp.includes('void this._resolve();'));
		assert.ok(!exp.includes('void this._resolve().catch'));
		assert.ok(slash.includes('void agentHostProvisionalService.refreshResolvedConfig(sessionResource, backendSession.scheme, workingDirectory, nextConfig);'));
		assert.ok(!slash.includes('void agentHostProvisionalService.refreshResolvedConfig(sessionResource, backendSession.scheme, workingDirectory, nextConfig).catch'));
		assert.strictEqual(countIncludes(fs.readFileSync(resolveSource(FIND_REL), 'utf8'), `void this.updateResultCount()${doubleCatch}`), 3);
	});
});
