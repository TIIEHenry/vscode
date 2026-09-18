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
const XTERM_ADDON_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermAddonImporter.ts';
const TERMINAL_IFACE_REL = 'src/vs/workbench/contrib/terminal/browser/terminal.ts';
const FIND_REL = 'src/vs/workbench/contrib/terminalContrib/find/browser/terminalFindWidget.ts';
const STICKY_REL = 'src/vs/workbench/contrib/terminalContrib/stickyScroll/browser/terminalStickyScrollOverlay.ts';
const RESIZE_REL = 'src/vs/workbench/contrib/terminalContrib/resizeDimensionsOverlay/browser/terminal.resizeDimensionsOverlay.contribution.ts';
const NOTIFY_REL = 'src/vs/workbench/contrib/terminalContrib/notification/browser/terminal.notification.contribution.ts';
const VOICE_REL = 'src/vs/workbench/contrib/terminalContrib/voice/browser/terminalVoice.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/terminalContrib/chat/browser/terminalChatWidget.ts';
const CHAT_ACTIONS_REL = 'src/vs/workbench/contrib/terminalContrib/chat/browser/terminalChatActions.ts';
const QUICKFIX_SVC_REL = 'src/vs/workbench/contrib/terminalContrib/quickFix/browser/terminalQuickFixService.ts';
const QUICKFIX_ADDON_REL = 'src/vs/workbench/contrib/terminalContrib/quickFix/browser/quickFixAddon.ts';
const SUGGEST_REL = 'src/vs/workbench/contrib/terminalContrib/suggest/browser/terminalSuggestAddon.ts';
const RUN_TOOL_REL = 'src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/terminal.chatAgentTools.contribution.ts';
const OUTPUT_REL = 'src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/monitoring/outputMonitor.ts';
const LINKS_REL = 'src/vs/workbench/contrib/terminalContrib/links/browser/terminalLinkOpeners.ts';
const DEV_REL = 'src/vs/workbench/contrib/terminalContrib/developer/browser/terminal.developer.contribution.ts';
const KEYBINDINGS_EXPORT_REL = 'src/vs/workbench/contrib/keybindingsExport/electron-browser/keybindingsExport.contribution.ts';
const CALL_HIERARCHY_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';
const TIMELINE_REL = 'src/vs/workbench/contrib/timeline/common/timelineService.ts';
const INTERACTIVE_REL = 'src/vs/workbench/contrib/interactive/browser/interactive.contribution.ts';
const SPEECH_SIGNAL_REL = 'src/vs/workbench/contrib/speech/browser/speechAccessibilitySignal.ts';

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
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function assertThenWrapped(source: string, thenStart: string): void {
	const idx = source.indexOf(thenStart);
	assert.ok(idx >= 0, `missing then: ${thenStart}`);
	const afterThen = source.slice(idx);
	const closeThen = afterThen.indexOf(`})${doubleCatch}`);
	assert.ok(closeThen >= 0, `then not double-chained: ${thenStart}`);
	assert.ok(!source.includes(`${thenStart};`));
	assert.ok(!source.includes(`${thenStart}.catch(onUnexpectedError);`));
}

const findPrevFindCall = 'this._findPreviousWithEvent(xterm, this.inputValue, { regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue(), incremental: update })';
const findNextFindCall = 'this._findNextWithEvent(xterm, this.inputValue, { regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue() })';
const findRevealThen = 'this._findPreviousWithEvent(xterm, inputValue, { incremental: true, regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue() }).then(foundMatch => {';
const findInputThen = 'this._findPreviousWithEvent(xterm, this.inputValue, { regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue(), incremental: true }).then(foundMatch => {';
const findFirstCall = 'this._findPreviousWithEvent(xterm, this.inputValue, { regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue() })';
const xtermCtorThen = 'xtermCtor.then(ctor => {';
const serializeThen = "this._xtermAddonLoader.importAddon('serialize').then(SerializeAddon => {";
const ligaturesThen = "this._xtermAddonLoader.importAddon('ligatures').then(LigaturesAddon => {";

const d798Calls: Array<[string, string, number, 'call' | 'then']> = [
	[FIND_REL, findPrevFindCall, 1, 'call'],
	[FIND_REL, findNextFindCall, 1, 'call'],
	[FIND_REL, findRevealThen, 1, 'then'],
	[FIND_REL, findInputThen, 1, 'then'],
	[FIND_REL, findFirstCall, 1, 'call'],
	[STICKY_REL, xtermCtorThen, 1, 'then'],
	[STICKY_REL, serializeThen, 1, 'then'],
	[STICKY_REL, ligaturesThen, 1, 'then'],
];

suite('terminalContrib leftover Promise fire-and-forget catch scan (D798)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites in terminalContrib only', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count, kind] of d798Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			if (kind === 'then') {
				assertThenWrapped(source, call);
				assert.strictEqual(countIncludes(source, call), count, `${rel} ${call}: expected ${count} then starts, got ${countIncludes(source, call)}`);
			} else {
				const wrapped = countIncludes(source, `${call}${doubleCatch}`);
				assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
				assertWrapped(source, call);
			}
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		const find = seen.get(FIND_REL) ?? fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		const sticky = seen.get(STICKY_REL) ?? fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		assert.strictEqual(countDoubleChains(find), 5);
		assert.strictEqual(countDoubleChains(sticky), 3);
	});

	test('terminalContrib leftover find fire-and-forgets are Promise double-chain', () => {
		const find = fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(TERMINAL_IFACE_REL), 'utf8');
		assertPromiseSignature(find, 'private async _findNextWithEvent(xterm: IXtermTerminal, term: string, options: ISearchOptions): Promise<boolean> {');
		assertPromiseSignature(find, 'private async _findPreviousWithEvent(xterm: IXtermTerminal, term: string, options: ISearchOptions): Promise<boolean> {');
		assertPromiseSignature(iface, 'findNext(term: string, searchOptions: ISearchOptions): Promise<boolean>;');
		assertPromiseSignature(iface, 'findPrevious(term: string, searchOptions: ISearchOptions): Promise<boolean>;');
		assert.ok(find.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(find, findPrevFindCall);
		assertWrapped(find, findNextFindCall);
		assertThenWrapped(find, findRevealThen);
		assertThenWrapped(find, findInputThen);
		assertWrapped(find, findFirstCall);
		assert.ok(!find.includes(`${findPrevFindCall};`));
		assert.ok(!find.includes(`${findNextFindCall};`));
		assert.ok(!find.includes(`${findFirstCall};`));
	});

	test('terminalContrib leftover stickyScroll xtermCtor / importAddon thens are Promise double-chain', () => {
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const addon = fs.readFileSync(resolveSource(XTERM_ADDON_REL), 'utf8');
		assertPromiseSignature(sticky, 'xtermCtor: Promise<typeof XTermTerminal>,');
		assertPromiseSignature(addon, 'async importAddon<T extends keyof IXtermAddonNameToCtor>(name: T): Promise<IXtermAddonNameToCtor[T]> {');
		assert.ok(sticky.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertThenWrapped(sticky, xtermCtorThen);
		assertThenWrapped(sticky, serializeThen);
		assertThenWrapped(sticky, ligaturesThen);
		assert.ok(sticky.includes(`})${doubleCatch};\n\t\t})${doubleCatch};`));
	});

	test('terminalContrib leftover remaining and preferred overflow modules stay unwrapped because this knife already has eight legal sites', () => {
		const notify = fs.readFileSync(resolveSource(NOTIFY_REL), 'utf8');
		const voice = fs.readFileSync(resolveSource(VOICE_REL), 'utf8');
		const chat = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const resize = fs.readFileSync(resolveSource(RESIZE_REL), 'utf8');
		const quickFix = fs.readFileSync(resolveSource(QUICKFIX_SVC_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const runTool = fs.readFileSync(resolveSource(RUN_TOOL_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const keybindingsExport = fs.readFileSync(resolveSource(KEYBINDINGS_EXPORT_REL), 'utf8');
		const callHierarchy = fs.readFileSync(resolveSource(CALL_HIERARCHY_REL), 'utf8');
		const timeline = fs.readFileSync(resolveSource(TIMELINE_REL), 'utf8');
		const interactive = fs.readFileSync(resolveSource(INTERACTIVE_REL), 'utf8');
		const speech = fs.readFileSync(resolveSource(SPEECH_SIGNAL_REL), 'utf8');

		assert.ok(notify.includes('void this._ctx.instance.sendText(data, false);'));
		assert.ok(!notify.includes(`sendText(data, false)${doubleCatch}`));
		assert.ok(voice.includes('void this._chatSpeechToTextService.cancel();'));
		assert.ok(!voice.includes(`cancel()${doubleCatch}`));
		assert.ok(chat.includes("void this._chatService.cancelCurrentRequestForSession(model?.sessionResource, 'terminalChat');"));
		assert.ok(!chat.includes(`cancelCurrentRequestForSession(model?.sessionResource, 'terminalChat')${doubleCatch}`));
		assert.ok(resize.includes('this._ctx.processManager.ptyProcessReady.then(() => {'));
		assert.ok(resize.includes('timeout(1000).then(() => {'));
		assert.strictEqual(countDoubleChains(resize), 0);
		assert.ok(quickFix.includes('this.extensionQuickFixes.then(selectors => {'));
		assert.strictEqual(countDoubleChains(quickFix), 0);
		assert.ok(output.includes('timeout(0).then(() => {'));
		assert.strictEqual(countDoubleChains(output), 0);
		assert.ok(runTool.includes('this._commandArtifactCollector.capture(toolSpecificData, terminalInstance, command.id).then(() => {'));
		assert.ok(!runTool.includes(`capture(toolSpecificData, terminalInstance, command.id).then(() => {${doubleCatch}`));
		assert.ok(contrib.includes('this._instantiationService.invokeFunction(createRunInTerminalToolData).then(runInTerminalToolData => {'));
		assert.strictEqual(countDoubleChains(contrib), 0);
		assert.strictEqual(countDoubleChains(keybindingsExport), 0);
		assert.ok(keybindingsExport.includes('void this.extensionService.whenInstalledExtensionsRegistered()'));
		assert.strictEqual(countDoubleChains(callHierarchy), 0);
		assert.ok(callHierarchy.includes('model.then(model => {'));
		assert.strictEqual(countDoubleChains(timeline), 0);
		assert.ok(!interactive.includes('D798'));
		assert.ok(!speech.includes('D798'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const find = fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const links = fs.readFileSync(resolveSource(LINKS_REL), 'utf8');
		const dev = fs.readFileSync(resolveSource(DEV_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(CHAT_ACTIONS_REL), 'utf8');
		const addon = fs.readFileSync(resolveSource(QUICKFIX_ADDON_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const runTool = fs.readFileSync(resolveSource(RUN_TOOL_REL), 'utf8');
		const resize = fs.readFileSync(resolveSource(RESIZE_REL), 'utf8');
		const chat = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(links.includes('this._openerService.open(link.text, {'));
		assert.ok(!links.includes(`this._openerService.open(link.text, {${doubleCatch}`));
		assert.ok(dev.includes('openerService.open(fileUri);'));
		assert.ok(!dev.includes(`openerService.open(fileUri)${doubleCatch}`));
		assert.ok(addon.includes('run: () => openerService.open(fix.uri),'));
		assert.ok(!addon.includes(`openerService.open(fix.uri)${doubleCatch}`));

		assert.ok(actions.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(!actions.includes(doubleCatch));

		assert.ok(suggest.includes('this._shellTypeInit = new Promise<void>(r => {'));
		assert.ok(suggest.includes('}).then(() => {'));
		assert.ok(!suggest.includes(doubleCatch));
		assert.ok(runTool.includes('this._osBackend = this._remoteAgentService.getEnvironment().then(remoteEnv => remoteEnv?.os ?? OS);'));
		assert.ok(!runTool.includes(`getEnvironment().then(remoteEnv => remoteEnv?.os ?? OS)${doubleCatch}`));
		assert.ok(runTool.includes('timeoutRacePromise = timeoutPromise.then('));
		assert.ok(!runTool.includes(`timeoutPromise.then(${doubleCatch}`));

		assert.ok(chat.includes('Promise.all(['));
		assert.ok(chat.includes(']).then(([firstCodeBlock, secondCodeBlock]) => {'));
		assert.ok(!chat.includes(`]).then(([firstCodeBlock, secondCodeBlock]) => {${doubleCatch}`));
		assert.ok(chat.includes('void sessionCtor.catch(error => {'));
		assert.ok(!chat.includes(`sessionCtor.catch(error => {${doubleCatch}`));

		assert.ok(resize.includes('this._ctx.processManager.ptyProcessReady.then(() => {'));
		assert.ok(!resize.includes(`ptyProcessReady.then(() => {${doubleCatch}`));

		for (const source of [find, sticky, links, dev, actions, addon, suggest, runTool, resize, chat]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
