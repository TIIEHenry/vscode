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
const SESSIONS_SVC_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsService.ts';
const PET_EDITOR_REL = 'src/vs/workbench/contrib/chat/browser/chatPetAchievementsEditor.ts';
const CHIPS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostGenericConfigChips.ts';
const INPUT_CONTRIB_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/editor/chatInputEditorContrib.ts';
const VOICE_PILL_REL = 'src/vs/workbench/contrib/chat/browser/voiceInputMode/voiceInputModeActionViewItem.ts';
const HANDLER_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSessionHandler.ts';
const WIDGET_SVC_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidgetService.ts';
const DEBUG_REL = 'src/vs/workbench/contrib/chat/browser/chatDebug/chatDebugCacheExplorerView.ts';
const PERM_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/permissionPickerActionItem.ts';
const LM_REL = 'src/vs/workbench/contrib/chat/browser/actions/chatLanguageModelActions.ts';
const LOCATOR_REL = 'src/vs/workbench/contrib/chat/common/promptSyntax/utils/promptFilesLocator.ts';
const WELCOME_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationWelcomePagePromptLaunchers.ts';
const VOICE_REL = 'src/vs/workbench/contrib/chat/browser/voiceClient/voiceSessionController.ts';
const PICKER_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/modelPicker/modelPickerWidget.ts';
const SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/chatSessions/chatSessions.contribution.ts';
const FIND_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatFind/chatFindWidget.ts';
const EDITOR_GROUPS_REL = 'src/vs/workbench/services/editor/common/editorGroupsService.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const EXTENSIONS_REL = 'src/vs/workbench/contrib/extensions/common/extensions.ts';

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

function countDouble(rel: string, call: string): number {
	const source = fs.readFileSync(resolveSource(rel), 'utf8');
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

suite('Chat leftover Promise fire-and-forget catch scan (D735)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers twenty-one leftover Promise double-chain sites; D679/D728 stay skipped', () => {
		const timeoutThen = `void timeout(200).then(() => {
					if (!this.getWidgetBySessionResource(previousSessionResource) && this.chatService.getSession(previousSessionResource)) {
						this._onDidBackgroundSession.fire(previousSessionResource);
					}
				})`;
		const sites =
			countDouble(SERVICE_REL, 'void generate()') +
			countDouble(SESSIONS_SVC_REL, "void this.chatService.cancelCurrentRequestForSession(session.resource, 'archive')") +
			countDouble(PET_EDITOR_REL, 'void this.group.closeEditor(this.input)') +
			countDouble(CHIPS_REL, 'void this._refreshInitialResolved(sessionResource, backendSession)') +
			countDouble(INPUT_CONTRIB_REL, 'void this.editorService.openEditor({ resource: mouseDownPromptSlashCommand.uri })') +
			countDouble(VOICE_PILL_REL, 'void this._onClickVoicePowerToggle()') +
			countDouble(HANDLER_REL, 'void this._filterAutoGrantedMcpAuthentication(sessionResource, servers)') +
			countDouble(WIDGET_SVC_REL, timeoutThen) +
			countDouble(DEBUG_REL, 'void this.renderContentInner(token, () => token === this.renderToken, true)') +
			countDouble(PERM_REL, 'void setSandboxEnabled(checked)') +
			countDouble(LM_REL, 'void extensionsWorkbenchService.open(extId)') +
			countDouble(LOCATOR_REL, 'void update()') +
			countDouble(LOCATOR_REL, 'void updateWatchers()');
		// renderContentInner without `, true` is counted separately so the prefix does not eat the `, true` site.
		const debug = fs.readFileSync(resolveSource(DEBUG_REL), 'utf8');
		const renderPlain = 'void this.renderContentInner(token, () => token === this.renderToken)';
		assert.ok(debug.includes(`${renderPlain}${doubleCatch};`));
		assert.ok(!debug.includes(`${renderPlain};`));
		assert.strictEqual(sites + 1, 21);
		assert.strictEqual(countDouble(FIND_REL, 'void this.updateResultCount()'), 3);
	});

	test('chatService leftover generate title IIFE is double-chain; await sendRequest stays skipped', () => {
		const source = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		assert.ok(source.includes("import { BugIndicatingError, ErrorNoTelemetry, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('const generate = async () => {'));
		assertDoubleChain(source, 'void generate()', 1);
		assert.ok(source.includes('await this.sendRequest(sessionResource, message, { ...sendOptions, attachedContext, queue: target.kind });'));
		assert.ok(!source.includes('await this.sendRequest(sessionResource, message, { ...sendOptions, attachedContext, queue: target.kind }).catch'));
	});

	test('agentSessions leftover cancelCurrentRequestForSession is double-chain', () => {
		const source = fs.readFileSync(resolveSource(SESSIONS_SVC_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(service.includes('async cancelCurrentRequestForSession(sessionResource: URI, source?: string): Promise<void> {'));
		assertDoubleChain(source, "void this.chatService.cancelCurrentRequestForSession(session.resource, 'archive')", 1);
	});

	test('chatPetAchievements leftover closeEditor voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(PET_EDITOR_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(EDITOR_GROUPS_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(groups.includes('closeEditor(editor?: EditorInput, options?: ICloseEditorOptions): Promise<boolean>;'));
		assertDoubleChain(source, 'void this.group.closeEditor(this.input)', 2);
	});

	test('genericConfigChips leftover _refreshInitialResolved is double-chain', () => {
		const source = fs.readFileSync(resolveSource(CHIPS_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _refreshInitialResolved(sessionResource: URI, backendSession: URI): Promise<void> {'));
		assertDoubleChain(source, 'void this._refreshInitialResolved(sessionResource, backendSession)', 1);
	});

	test('chatInputEditor leftover openEditor is double-chain', () => {
		const source = fs.readFileSync(resolveSource(INPUT_CONTRIB_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.ok(editor.includes('openEditor('));
		assertDoubleChain(source, 'void this.editorService.openEditor({ resource: mouseDownPromptSlashCommand.uri })', 1);
	});

	test('voiceInputMode leftover _onClickVoicePowerToggle voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(VOICE_PILL_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _onClickVoicePowerToggle(): Promise<void> {'));
		assertDoubleChain(source, 'void this._onClickVoicePowerToggle()', 2);
	});

	test('agentHostSessionHandler leftover _filterAutoGrantedMcpAuthentication is double-chain', () => {
		const source = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		assert.ok(source.includes("import { getErrorCode, isCancellationError, onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _filterAutoGrantedMcpAuthentication(sessionResource: URI, servers: readonly IChatMcpAuthenticationRequiredServer[]): Promise<readonly IChatMcpAuthenticationRequiredServer[]> {'));
		assertDoubleChain(source, 'void this._filterAutoGrantedMcpAuthentication(sessionResource, servers)', 1);
	});

	test('chatWidgetService leftover timeout.then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(WIDGET_SVC_REL), 'utf8');
		const thenSite = `void timeout(200).then(() => {
					if (!this.getWidgetBySessionResource(previousSessionResource) && this.chatService.getSession(previousSessionResource)) {
						this._onDidBackgroundSession.fire(previousSessionResource);
					}
				})`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes(`${thenSite}${doubleCatch};`));
		assert.ok(!source.includes(`${thenSite};`));
		assert.ok(!source.includes(`${thenSite}.catch(onUnexpectedError);`));
	});

	test('chatDebugCacheExplorer leftover renderContentInner voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(DEBUG_REL), 'utf8');
		const plain = 'void this.renderContentInner(token, () => token === this.renderToken)';
		const withTrue = 'void this.renderContentInner(token, () => token === this.renderToken, true)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async renderContentInner(token: number, isCurrent: () => boolean, preserveScroll = false): Promise<void> {'));
		assert.ok(source.includes(`${plain}${doubleCatch};`));
		assert.ok(source.includes(`${withTrue}${doubleCatch};`));
		assert.ok(!source.includes(`${plain};`));
		assert.ok(!source.includes(`${withTrue};`));
		assert.ok(!source.includes(`${plain}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${withTrue}.catch(onUnexpectedError);`));
	});

	test('permissionPicker leftover setSandboxEnabled is double-chain', () => {
		const source = fs.readFileSync(resolveSource(PERM_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('const setSandboxEnabled = async (enableSandbox: boolean) => {'));
		assertDoubleChain(source, 'void setSandboxEnabled(checked)', 1);
	});

	test('languageModel leftover extensionsWorkbenchService.open voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(LM_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(extensions.includes('open(extension: IExtension | string, options?: IExtensionEditorOptions): Promise<void>;'));
		assertDoubleChain(source, 'void extensionsWorkbenchService.open(extId)', 2);
	});

	test('promptFilesLocator leftover update / updateWatchers voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(LOCATOR_REL), 'utf8');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('const update = async () => {'));
		assert.ok(source.includes('const updateWatchers = async () => {'));
		assertDoubleChain(source, 'void update()', 4);
		assertDoubleChain(source, 'void updateWatchers()', 2);
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
