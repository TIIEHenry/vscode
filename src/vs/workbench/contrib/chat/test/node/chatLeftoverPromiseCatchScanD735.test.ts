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
const INPUT_CONTRIB_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/editor/chatInputEditorContrib.ts';
const PERM_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/permissionPickerActionItem.ts';
const WELCOME_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationWelcomePagePromptLaunchers.ts';
const VOICE_REL = 'src/vs/workbench/contrib/chat/browser/voiceClient/voiceSessionController.ts';
const PICKER_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/modelPicker/modelPickerWidget.ts';
const SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/chatSessions/chatSessions.contribution.ts';
const FIND_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatFind/chatFindWidget.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/common/editorService.ts';

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

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count);
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function assertSingleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count);
	assert.ok(source.includes(`${call}.catch(onUnexpectedError)`), `missing single-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}${doubleCatch}`));
}

function countSingle(rel: string, call: string): number {
	const source = fs.readFileSync(resolveSource(rel), 'utf8');
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.catch\\(onUnexpectedError\\);`, 'g')) ?? []).length;
}

suite('Chat leftover Promise fire-and-forget catch scan (D735)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('chatService leftover generate title IIFE is double-chain; await sendRequest stays skipped', () => {
		const source = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		assert.ok(source.includes("import { BugIndicatingError, ErrorNoTelemetry, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('const generate = async () => {'));
		assertDoubleChain(source, 'void generate()', 1);
		assert.ok(source.includes('await this.sendRequest(sessionResource, message, { ...sendOptions, attachedContext, queue: target.kind });'));
		assert.ok(!source.includes('await this.sendRequest(sessionResource, message, { ...sendOptions, attachedContext, queue: target.kind }).catch'));
	});

	test('chatInputEditor leftover openEditor is single-chain', () => {
		const source = fs.readFileSync(resolveSource(INPUT_CONTRIB_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.ok(editor.includes('openEditor('));
		assertSingleChain(source, 'void this.editorService.openEditor({ resource: mouseDownPromptSlashCommand.uri })', 1);
	});

	test('permissionPicker leftover setSandboxEnabled is single-chain', () => {
		const source = fs.readFileSync(resolveSource(PERM_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('const setSandboxEnabled = async (enableSandbox: boolean) => {'));
		assertSingleChain(source, 'void setSandboxEnabled(checked)', 1);
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
		assert.strictEqual(countSingle(FIND_REL, 'void this.updateResultCount()'), 3);
	});
});
