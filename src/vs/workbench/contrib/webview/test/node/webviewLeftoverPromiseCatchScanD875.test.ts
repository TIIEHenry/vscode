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
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const WEBVIEW_REL = 'src/vs/workbench/contrib/webview/browser/webviewElement.ts';
const OVERLAY_REL = 'src/vs/workbench/contrib/webview/browser/overlayWebview.ts';
const WEBVIEW_IFACE_REL = 'src/vs/workbench/contrib/webview/browser/webview.ts';
const ELECTRON_REL = 'src/vs/workbench/contrib/webview/electron-browser/webviewElement.ts';
const SHORTCUTS_REL = 'src/vs/workbench/contrib/webview/electron-browser/windowIgnoreMenuShortcutsManager.ts';
const WEBVIEW_COMMANDS_REL = 'src/vs/workbench/contrib/webview/electron-browser/webviewCommands.ts';
const WEBVIEW_CONTRIB_REL = 'src/vs/workbench/contrib/webview/browser/webview.contribution.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const IFRAME_REL = 'src/vs/base/browser/iframe.ts';
const WEBVIEW_MANAGER_REL = 'src/vs/platform/webview/common/webviewManagerService.ts';
const MAIN_REL = 'src/vs/workbench/contrib/terminal/browser/terminalMainContribution.ts';
const RESOLVER_REL = 'src/vs/workbench/contrib/terminal/browser/terminalProfileResolverService.ts';
const PROFILE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalProfileService.ts';
const TABS_REL = 'src/vs/workbench/contrib/terminal/browser/terminalTabsList.ts';
const INSTANCE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalInstance.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalService.ts';
const PROCESS_EXPLORER_REL = 'src/vs/workbench/contrib/processExplorer/browser/processExplorerControl.ts';
const LANG_DETECT_REL = 'src/vs/workbench/contrib/languageDetection/browser/languageDetection.contribution.ts';
const EDIT_TELEMETRY_REL = 'src/vs/workbench/contrib/editTelemetry/browser/helpers/documentWithAnnotatedEdits.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const AGENT_SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';

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

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const contextMenuVisibleTrueCall = 'this._send(\'set-context-menu-visible\', { visible: true })';
const contextMenuVisibleFalseCall = 'this._send(\'set-context-menu-visible\', { visible: false })';
const confirmBeforeCloseCall = 'this._send(\'set-confirm-before-close\', this._confirmBeforeClose)';
const setTitleCall = 'this._send(\'set-title\', title)';
const initialScrollCall = 'this._send(\'initial-scroll-position\', value)';
const execCommandCall = 'this._send(\'execCommand\', command)';
const findPreviousCall = 'this._send(\'find\', { value, previous })';
const findValueCall = 'this._send(\'find\', { value })';
const leftoverFindStopCall = 'this._send(\'find-stop\', { clearSelection: !keepSelection });';
const leftoverFocusCall = '\t\t\tthis._send(\'focus\', undefined);\n';
const leftoverStylesCall = 'this._send(\'styles\', { styles, activeTheme, themeId, themeLabel, reduceMotion, screenReader });';
const leftoverChunkCall = 'this._send(\'did-load-resource-chunk\', { id, data }, [data.buffer]);';
const leftoverEndErrorCall = 'this._send(\'did-load-resource-end\', { id, error: true });';
const leftoverEndCall = 'this._send(\'did-load-resource-end\', { id });';
const leftoverReturnedMessageCall = 'return this._send(\'message\', { message, transfer });';
const leftoverReturnedLocalhostCall = 'return this._send(\'did-load-localhost\', {';
const assignedOriginThenCall = 'this._encodedWebviewOriginPromise = parentOriginHash(targetWindow.origin, this.origin).then(id => this._encodedWebviewOrigin = id);';
const originThenCall = `this._encodedWebviewOriginPromise.then(encodedWebviewOrigin => {
			if (!this._disposed) {
				this._initElement(encodedWebviewOrigin, this.extension, this._options, targetWindow);
			}
		})`;
const loadResourceCall = 'this.loadResource(entry.id, uri, { ifNoneMatch: entry.ifNoneMatch, range: entry.range }, this._resourceLoadingCts.token)';
const localLocalhostCall = 'this.localLocalhost(entry.id, entry.origin)';
const focusDelayerCall = `this._focusDelayer.trigger(async () => {
			if (!this.isFocused || !this.element) {
				return;
			}

			if (this.window?.document.activeElement && this.window.document.activeElement !== this.element && this.window.document.activeElement?.tagName !== 'BODY') {
				return;
			}

			// It is possible for the webview to be contained in another window
			// that does not have focus. As such, also focus the body of the
			// webview's window to ensure it is properly receiving keyboard focus.
			this.window?.document.body?.focus();

			this._send('focus', undefined);
		})`;
const findInFrameCall = 'this._webviewMainService.findInFrame({ windowId: this._nativeHostService.windowId }, this.id, value, options)';
const iframeDelayerCall = `this._iframeDelayer.trigger(() => {
			this._findStarted = true;
			this._webviewMainService.findInFrame({ windowId: this._nativeHostService.windowId }, this.id, value, options).catch(onUnexpectedError).catch(onUnexpectedError);
		})`;
const stopFindCall = `this._webviewMainService.stopFindInFrame({ windowId: this._nativeHostService.windowId }, this.id, {
			keepSelection
		})`;
const ignoreShortcutsCall = 'this._webviewMainService.setIgnoreMenuShortcuts({ windowId: this._nativeHostService.windowId }, value)';
const overlayThenCall = `webview.postMessage(msg.message, msg.transfer).then(posted => {
						msg.resolve(posted);
					})`;
const leftoverOpenDevToolsCall = 'nativeHostService.openDevTools();';
const leftoverKillTermCall = "run: () => this.killProcess?.(pid, 'SIGTERM')";
const leftoverResizeCall = 'this._resize();';
const leftoverShowBackgroundCall = 'this.showBackgroundTerminal(value);';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const assignedThenCall = 'this._currentSuggestionDetails.then(() => {';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const leftoverScrollPrevCall = '\t\t\tthis.scrollPrev();\n';
const leftoverSelectStepIdCall = '\t\t\tthis.selectStep(id);\n';
const leftoverSelectStepToSelectCall = '\t\t\tthis.selectStep(toSelect);\n';
const leftoverSelectStepUndefinedCall = '\t\t\t\tthis.selectStep(undefined);\n';
const leftoverSelectStepLooseCall = '\t\t\teditorPane.selectStepLoose(stepID);\n';
const assignedInProgressScroll = 'this.inProgressScroll = this.inProgressScroll.then(async () => {';
const updateDiffSeqCall = 'this._updateDiffInfoSeq()';
const initializeCall = 'this.initialize()';
const initCall = 'this._init(\n\t\t\teditorResolverService,\n\t\t\tembedderTerminalService,\n\t\t\tworkbenchEnvironmentService,\n\t\t\tlabelService,\n\t\t\tlifecycleService,\n\t\t\tterminalService,\n\t\t\tterminalEditorService,\n\t\t\tterminalGroupService,\n\t\t\tterminalInstanceService\n\t\t)';
const refreshDefaultCall = 'this._refreshDefaultProfileName()';
const refreshAvailableCall = 'this._refreshAvailableProfilesNow()';
const handleExternalDropCall = 'this._handleExternalDrop(targetInstance, originalEvent)';
const updateCall = 'this.update()';
const onTreeKeyDownCall = 'this.onTreeKeyDown(e)';
const doUpdateCall = 'this._doUpdate()';
const restartCall = 'this._restart()';

const d875Calls: Array<[string, string, number]> = [
	[WEBVIEW_REL, contextMenuVisibleTrueCall, 1],
	[WEBVIEW_REL, contextMenuVisibleFalseCall, 1],
	[WEBVIEW_REL, confirmBeforeCloseCall, 1],
	[WEBVIEW_REL, setTitleCall, 1],
	[WEBVIEW_REL, initialScrollCall, 1],
	[WEBVIEW_REL, execCommandCall, 1],
	[WEBVIEW_REL, findPreviousCall, 1],
	[WEBVIEW_REL, findValueCall, 1],
];

const d763AlreadyDouble: Array<[string, string, number]> = [
	[WEBVIEW_REL, loadResourceCall, 1],
	[WEBVIEW_REL, localLocalhostCall, 1],
	[WEBVIEW_REL, focusDelayerCall, 1],
	[ELECTRON_REL, findInFrameCall, 2],
	[ELECTRON_REL, iframeDelayerCall, 1],
	[ELECTRON_REL, stopFindCall, 1],
	[SHORTCUTS_REL, ignoreShortcutsCall, 1],
	[OVERLAY_REL, overlayThenCall, 1],
];

const d862AlreadyDouble: Array<[string, string, number]> = [
	[MAIN_REL, initCall, 1],
	[RESOLVER_REL, refreshDefaultCall, 2],
	[PROFILE_REL, refreshAvailableCall, 1],
	[TABS_REL, handleExternalDropCall, 1],
];

suite('leftover remaining unused after D763 leftover remaining unused webview leftover remaining unused Promise fire-and-forget catch scan (D875)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D763 already-double after discarding collision overflow still had four or more legal unused leftover sites so this knife stayed on webview leftover remaining unused', () => {
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const shortcuts = fs.readFileSync(resolveSource(SHORTCUTS_REL), 'utf8');
		const overlay = fs.readFileSync(resolveSource(OVERLAY_REL), 'utf8');
		assert.ok(webview.includes(`${loadResourceCall}${doubleCatch}`));
		assert.ok(webview.includes(`${localLocalhostCall}${doubleCatch}`));
		assert.ok(webview.includes(`${focusDelayerCall}${doubleCatch}`));
		assert.ok(webview.includes(leftoverFocusCall));
		assert.ok(!webview.includes(`${leftoverFocusCall.trimEnd()}${doubleCatch}`));
		assert.ok(webview.includes(leftoverFindStopCall));
		assert.ok(!webview.includes(`this._send('find-stop', { clearSelection: !keepSelection })${doubleCatch}`));
		assert.ok(webview.includes(leftoverReturnedMessageCall));
		assert.ok(!webview.includes(`return this._send('message', { message, transfer })${doubleCatch}`));
		assert.strictEqual(countDoubleChains(electron), 4);
		assert.strictEqual(countDoubleChains(shortcuts), 1);
		assert.strictEqual(countDoubleChains(overlay), 1);
		let leftoverRemainingUnusedLegal = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d875Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			leftoverRemainingUnusedLegal += count;
		}
		assert.ok(leftoverRemainingUnusedLegal >= 4, `expected leftover remaining unused webview legal leftover >=4 after discarding collision overflow, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(leftoverRemainingUnusedLegal <= 8);
		assert.ok(!webview.includes('D875'));
		assert.ok(!electron.includes('D875'));
		assert.ok(!shortcuts.includes('D875'));
		assert.ok(!overlay.includes('D875'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on webview leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d875Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(WEBVIEW_REL) ?? ''), 16);
	});

	test('leftover remaining unused async this._send() FOF leftover void promises are Promise/async + double-chain', () => {
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		assertPromiseSignature(webview, 'private async _send<K extends keyof ToWebviewMessage>(channel: K, data: ToWebviewMessage[K], _createElement: Transferable[] = []): Promise<boolean> {');
		assert.ok(webview.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(webview, contextMenuVisibleTrueCall);
		assertWrapped(webview, contextMenuVisibleFalseCall);
		assertWrapped(webview, confirmBeforeCloseCall);
		assertWrapped(webview, setTitleCall);
		assertWrapped(webview, initialScrollCall);
		assertWrapped(webview, execCommandCall);
		assertWrapped(webview, findPreviousCall);
		assertWrapped(webview, findValueCall);
		assert.strictEqual(countIncludes(webview, `${contextMenuVisibleTrueCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${contextMenuVisibleFalseCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${confirmBeforeCloseCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${setTitleCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${initialScrollCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${execCommandCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${findPreviousCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${findValueCall}${doubleCatch}`), 1);
		assert.ok(!webview.includes('\t\t\tthis._send(\'set-context-menu-visible\', { visible: true });\n'));
		assert.ok(!webview.includes('() => this._send(\'set-context-menu-visible\', { visible: false })));'));
		assert.ok(!webview.includes('\t\t\t\tthis._send(\'set-confirm-before-close\', this._confirmBeforeClose);\n'));
		assert.ok(!webview.includes('\t\tthis._send(\'set-title\', title);\n'));
		assert.ok(!webview.includes('\t\tthis._send(\'initial-scroll-position\', value);\n'));
		assert.ok(!webview.includes('\t\t\tthis._send(\'execCommand\', command);\n'));
		assert.ok(!webview.includes('\t\tthis._send(\'find\', { value, previous });\n'));
		assert.ok(!webview.includes('\t\tthis._send(\'find\', { value });\n'));
		assert.ok(webview.includes(leftoverFindStopCall));
		assert.ok(!webview.includes(`this._send('find-stop', { clearSelection: !keepSelection })${doubleCatch}`));
		assert.ok(webview.includes(leftoverFocusCall));
		assert.ok(!webview.includes(`this._send('focus', undefined)${doubleCatch}`));
		assert.ok(webview.includes(leftoverStylesCall));
		assert.ok(!webview.includes(`this._send('styles', { styles, activeTheme, themeId, themeLabel, reduceMotion, screenReader })${doubleCatch}`));
		assert.ok(webview.includes(leftoverChunkCall));
		assert.ok(!webview.includes(`this._send('did-load-resource-chunk', { id, data }, [data.buffer])${doubleCatch}`));
		assert.ok(webview.includes(leftoverEndErrorCall));
		assert.ok(!webview.includes(`this._send('did-load-resource-end', { id, error: true })${doubleCatch}`));
		assert.ok(webview.includes(leftoverEndCall));
		assert.ok(!webview.includes(`this._send('did-load-resource-end', { id })${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const overlay = fs.readFileSync(resolveSource(OVERLAY_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(WEBVIEW_IFACE_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(WEBVIEW_COMMANDS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(WEBVIEW_CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const iframe = fs.readFileSync(resolveSource(IFRAME_REL), 'utf8');
		const manager = fs.readFileSync(resolveSource(WEBVIEW_MANAGER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(webview, 'private async _send<K extends keyof ToWebviewMessage>(channel: K, data: ToWebviewMessage[K], _createElement: Transferable[] = []): Promise<boolean> {');
		assertPromiseSignature(iface, 'postMessage(message: any, transfer?: readonly ArrayBuffer[]): Promise<boolean>;');
		assertPromiseSignature(asyncSource, 'trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {');
		assertPromiseSignature(iframe, 'export async function parentOriginHash(parentOrigin: string, salt: string): Promise<string> {');
		assertPromiseSignature(manager, 'findInFrame(windowId: WebviewWindowId, frameName: string, text: string, options: FindInFrameOptions): Promise<void>;');

		assert.ok(!webview.includes('openerService.open'));
		assert.ok(!webview.includes('IOpenerService'));
		assert.ok(!webview.includes('extends Action2'));
		assert.ok(commands.includes('export class OpenWebviewDeveloperToolsAction extends Action2 {'));
		assert.ok(commands.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(commands.includes(leftoverOpenDevToolsCall));
		assert.ok(!commands.includes(`nativeHostService.openDevTools()${doubleCatch}`));
		assert.ok(!commands.includes(doubleCatch));
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(webview.includes(assignedOriginThenCall));
		assert.ok(!webview.includes(`${assignedOriginThenCall}${doubleCatch}`));
		assert.ok(webview.includes(`${originThenCall}${doubleCatch};`));
		assert.ok(!webview.includes('.then(undefined,'));
		assert.ok(webview.includes(leftoverReturnedMessageCall));
		assert.ok(!webview.includes(`return this._send('message', { message, transfer })${doubleCatch}`));
		assert.ok(webview.includes(leftoverReturnedLocalhostCall));
		assert.ok(!webview.includes(`return this._send('did-load-localhost', {${doubleCatch}`));
		assert.ok(webview.includes('return this._send(\'did-load-resource\', {'));
		assert.ok(overlay.includes(`${overlayThenCall}${doubleCatch}`));

		for (const source of [webview, overlay, commands, contrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D875'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D763 already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const overlay = fs.readFileSync(resolveSource(OVERLAY_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const shortcuts = fs.readFileSync(resolveSource(SHORTCUTS_REL), 'utf8');
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const processExplorer = fs.readFileSync(resolveSource(PROCESS_EXPLORER_REL), 'utf8');
		const langDetect = fs.readFileSync(resolveSource(LANG_DETECT_REL), 'utf8');
		const editTelemetry = fs.readFileSync(resolveSource(EDIT_TELEMETRY_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const chatWidget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const agentSessions = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const simpleSuggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');

		let d763Sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d763AlreadyDouble) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D763 already-double drifted: ${rel} ${call}`);
			d763Sites += count;
		}
		assert.strictEqual(d763Sites, 9);
		assert.ok(webview.includes(`${originThenCall}${doubleCatch};`));

		let d862Sites = 0;
		const d862Seen = new Map<string, string>();
		for (const [rel, call, count] of d862AlreadyDouble) {
			const source = d862Seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			d862Seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D862 already-double drifted: ${rel} ${call}`);
			d862Sites += count;
		}
		assert.strictEqual(d862Sites, 5);

		assert.ok(instance.includes(leftoverResizeCall));
		assert.ok(!instance.includes(`this._resize()${doubleCatch}`));
		assert.ok(service.includes(leftoverShowBackgroundCall));
		assert.ok(!service.includes(`this.showBackgroundTerminal(value)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(instance), 7);
		assert.strictEqual(countDoubleChains(service), 5);

		assert.strictEqual(countIncludes(processExplorer, `${updateCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(processExplorer, `${onTreeKeyDownCall}${doubleCatch}`), 1);
		assert.ok(processExplorer.includes(leftoverKillTermCall));
		assert.ok(!processExplorer.includes(`${leftoverKillTermCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(langDetect, `${doUpdateCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(editTelemetry, `${restartCall}${doubleCatch}`), 1);

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(simpleSuggest.includes(assignedThenCall));
		assert.ok(!simpleSuggest.includes(`${assignedThenCall}${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));

		assert.ok(gettingStarted.includes(leftoverScrollPrevCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepIdCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepToSelectCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepUndefinedCall));
		assert.ok(!gettingStarted.includes(`this.selectStep(id)${doubleCatch}`));
		assert.ok(!gettingStarted.includes(`this.selectStep(toSelect)${doubleCatch}`));
		assert.ok(!gettingStarted.includes(`this.selectStep(undefined)${doubleCatch}`));
		assert.ok(gettingStarted.includes(assignedInProgressScroll));
		assert.ok(!gettingStarted.includes(`${assignedInProgressScroll}${doubleCatch}`));
		assert.ok(gettingStartedContrib.includes(leftoverSelectStepLooseCall));
		assert.ok(!gettingStartedContrib.includes(`editorPane.selectStepLoose(stepID)${doubleCatch}`));

		assert.ok(textModel.includes(`${updateDiffSeqCall};`) || textModel.includes('\t\t\tthis._updateDiffInfoSeq();\n'));
		assert.ok(!textModel.includes(`${updateDiffSeqCall}${doubleCatch}`));
		assert.ok(profileModel.includes(`${initializeCall};`));
		assert.ok(!profileModel.includes(`${initializeCall}${doubleCatch}`));

		assert.ok(searchEditor.includes(leftoverNoArgIncludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgExcludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgMessageCall));
		assert.ok(!searchEditor.includes(`this.triggerSearch()${doubleCatch}`));

		assert.ok(webview.includes(leftoverFindStopCall));
		assert.ok(webview.includes(leftoverFocusCall));
		assert.ok(webview.includes(leftoverStylesCall));
		assert.ok(webview.includes(leftoverChunkCall));
		assert.ok(webview.includes(leftoverEndErrorCall));
		assert.ok(webview.includes(leftoverEndCall));
		assert.strictEqual(countDoubleChains(electron), 4);
		assert.strictEqual(countDoubleChains(shortcuts), 1);
		assert.strictEqual(countDoubleChains(overlay), 1);

		for (const [rel, file] of [
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[PLAN_REVIEW_REL, planReview],
			[CHAT_WIDGET_REL, chatWidget],
			[AGENT_SESSIONS_REL, agentSessions],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[SUGGEST_REL, simpleSuggest],
			[SETTINGS_REL, settings],
			[TEXT_MODEL_REL, textModel],
			[PROFILE_MODEL_REL, profileModel],
			[TASKS_REL, tasks],
			[TESTING_REL, testing],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[INSTANCE_REL, instance],
			[SERVICE_REL, service],
			[PROCESS_EXPLORER_REL, processExplorer],
			[LANG_DETECT_REL, langDetect],
			[EDIT_TELEMETRY_REL, editTelemetry],
			[ELECTRON_REL, electron],
			[SHORTCUTS_REL, shortcuts],
			[OVERLAY_REL, overlay],
		] as const) {
			assert.ok(!file.includes('D875'), `${rel} should stay off this knife`);
		}
		assert.ok(!webview.includes('D875'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD875.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD875.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD875.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD875.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD875.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD875.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/terminal/test/node/terminalLeftoverPromiseCatchScanD875.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD875.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/preferencesLeftoverPromiseCatchScanD875.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/processExplorer/test/node/processExplorerLeftoverPromiseCatchScanD875.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/webview/test/node/webviewLeftoverPromiseCatchScanD763.test.ts')));
	});
});
