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
const SURVEY_REL = 'src/vs/workbench/contrib/chat/browser/feedbackSurvey/chatModelFeedbackSurveyService.ts';
const PROMPT_REL = 'src/vs/workbench/contrib/chat/common/promptSyntax/service/extensionPromptFileService.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts';
const PLAYBACK_REL = 'src/vs/workbench/contrib/chat/common/voicePlaybackService.ts';
const PET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatPetWidget.ts';
const LIST_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts';
const WELCOME_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationWelcomePagePromptLaunchers.ts';
const VOICE_REL = 'src/vs/workbench/contrib/chat/browser/voiceClient/voiceSessionController.ts';
const PICKER_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/modelPicker/modelPickerWidget.ts';
const SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/chatSessions/chatSessions.contribution.ts';
const FIND_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatFind/chatFindWidget.ts';

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

function countDouble(rel: string, call: string): number {
	const source = fs.readFileSync(resolveSource(rel), 'utf8');
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

suite('Chat remaining leftover Promise fire-and-forget catch scan (D728)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites; D679 stay skipped', () => {
		const sites =
			countDouble(SURVEY_REL, 'void this.resolveConfig()') +
			countDouble(PROMPT_REL, 'void this.filesConfigService.updateReadonly(readonlyUris, true)') +
			countDouble(PROMPT_REL, 'void this.filesConfigService.updateReadonly(uris, true)') +
			countDouble(SERVICE_REL, `void this.sendRequest(targetResource, pending.request.message.text, {
				...pending.sendOptions,
				queue: pending.kind,
			})`) +
			countDouble(PLAYBACK_REL, `void this.commandService.executeCommand('_chat.voicePlayback.stop', {
			sessionId: sessionResource?.toString(),
		})`) +
			countDouble(PET_REL, 'void this.commandService.executeCommand(CHAT_PET_OPEN_ACHIEVEMENTS_COMMAND_ID)') +
			countDouble(LIST_REL, 'void this.commandService.executeCommand(CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID, { chatResource })');
		assert.strictEqual(sites, 8);
		assert.strictEqual(countDouble(FIND_REL, 'void this.updateResultCount()'), 3);
	});

	test('chatService leftover migrate sendRequest is double-chain; await sendRequest stays skipped', () => {
		const source = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const call = `void this.sendRequest(targetResource, pending.request.message.text, {
				...pending.sendOptions,
				queue: pending.kind,
			})`;
		assert.ok(source.includes("import { BugIndicatingError, ErrorNoTelemetry, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('async sendRequest(sessionResource: URI, request: string, options?: IChatSendRequestOptions): Promise<ChatSendResult> {'));
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(source.includes('await this.sendRequest(sessionResource, message, { ...sendOptions, attachedContext, queue: target.kind });'));
		assert.ok(!source.includes('await this.sendRequest(sessionResource, message, { ...sendOptions, attachedContext, queue: target.kind }).catch'));
	});

	test('opener / Action.run / two-arg then / welcome leftover / D679 stay skipped', () => {
		const picker = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		const welcome = fs.readFileSync(resolveSource(WELCOME_REL), 'utf8');
		const voice = fs.readFileSync(resolveSource(VOICE_REL), 'utf8');
		const sessions = fs.readFileSync(resolveSource(SESSIONS_REL), 'utf8');
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
		assert.strictEqual(countDouble(FIND_REL, 'void this.updateResultCount()'), 3);
	});
});
