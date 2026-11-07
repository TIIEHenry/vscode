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
const SERVICE_REL = 'src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts';
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
const SESSIONS_SVC_REL = 'src/vs/workbench/contrib/chat/common/chatSessionsService.ts';
const AGENTS_REL = 'src/vs/workbench/contrib/chat/common/participants/chatAgents.ts';

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

suite('Chat leftover Promise fire-and-forget catch scan (D753)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
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
		assert.ok(viewPane.includes("this.acquireTransferredOrPersistedSession(cts.token, 'ChatViewPane#onDidChangeAgents').then(async session => {"));
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
