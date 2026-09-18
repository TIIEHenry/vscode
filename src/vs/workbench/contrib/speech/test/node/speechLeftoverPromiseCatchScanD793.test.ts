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
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const CONFIG_REL = 'src/vs/platform/configuration/common/configuration.ts';
const SIGNAL_IFACE_REL = 'src/vs/platform/accessibilitySignal/browser/accessibilitySignalService.ts';
const VIEWS_REL = 'src/vs/workbench/services/views/common/viewsService.ts';
const SPEECH_REL = 'src/vs/workbench/contrib/speech/browser/speechService.ts';
const SPEECH_SIGNAL_REL = 'src/vs/workbench/contrib/speech/browser/speechAccessibilitySignal.ts';
const SPEECH_CONTRIB_REL = 'src/vs/workbench/contrib/speech/browser/speech.contribution.ts';
const SPEECH_COMMON_REL = 'src/vs/workbench/contrib/speech/common/speechService.ts';
const VIEW_REL = 'src/vs/workbench/contrib/accessibility/browser/accessibleView.ts';
const STATUS_REL = 'src/vs/workbench/contrib/accessibility/browser/accessibilityStatus.ts';
const HELP_REL = 'src/vs/workbench/contrib/accessibility/browser/extensionAccesibilityHelp.contribution.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/accessibility/browser/accessibleViewActions.ts';
const EDITOR_HELP_REL = 'src/vs/workbench/contrib/accessibility/browser/editorAccessibilityHelp.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/accessibility/browser/accessibleViewContributions.ts';
const CONFIG_ACC_REL = 'src/vs/workbench/contrib/accessibility/browser/accessibilityConfiguration.ts';
const DIM_REL = 'src/vs/workbench/contrib/accessibility/browser/unfocusedViewDimmingContribution.ts';
const RESOLVER_REL = 'src/vs/workbench/contrib/accessibility/browser/accessibleViewKeybindingResolver.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingProgressUiService.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/browser/explorerService.ts';
const KEYBINDINGS_REL = 'src/vs/workbench/contrib/keybindings/browser/keybindings.contribution.ts';
const USER_DATA_SYNC_REL = 'src/vs/workbench/contrib/userDataSync/browser/userDataSync.ts';
const REMOTE_TUNNEL_REL = 'src/vs/workbench/contrib/remoteTunnel/electron-browser/remoteTunnel.contribution.ts';

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
	const closeThen = afterThen.indexOf(`})${doubleCatch};`);
	assert.ok(closeThen >= 0, `then not double-chained: ${thenStart}`);
	assert.ok(!source.includes(`${thenStart};`));
	assert.ok(!source.includes(`${thenStart}.catch(onUnexpectedError);`));
}

const startedCall = 'this._accessibilitySignalService.playSignal(AccessibilitySignal.voiceRecordingStarted)';
const stoppedCall = 'this._accessibilitySignalService.playSignal(AccessibilitySignal.voiceRecordingStopped)';
const insertedCall = 'this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineInserted)';
const deletedCall = 'this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineDeleted)';
const getTextModelThen = 'this._getTextModel(stableUri).then((model) => {';
const openLinkCall = "this._commandService.executeCommand('editor.action.openLink')";
const updateOnCall = "this.configurationService.updateValue('editor.accessibilitySupport', 'on', ConfigurationTarget.USER)";
const updateOffCall = "this.configurationService.updateValue('editor.accessibilitySupport', 'off', ConfigurationTarget.USER)";
const openViewCall = 'viewsService.openView(viewDescriptor.id, true)';

const d793Calls: Array<[string, string, number, 'call' | 'then']> = [
	[SPEECH_SIGNAL_REL, startedCall, 1, 'call'],
	[SPEECH_SIGNAL_REL, stoppedCall, 1, 'call'],
	[VIEW_REL, insertedCall, 1, 'call'],
	[VIEW_REL, deletedCall, 1, 'call'],
	[VIEW_REL, getTextModelThen, 1, 'then'],
	[VIEW_REL, openLinkCall, 1, 'call'],
	[STATUS_REL, updateOnCall, 1, 'call'],
	[STATUS_REL, updateOffCall, 1, 'call'],
	[HELP_REL, openViewCall, 1, 'call'],
];

suite('speech leftover remaining overflowed to accessibility leftover Promise fire-and-forget catch scan (D793)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('speech leftover remaining has fewer than four legal sites so this knife moved to accessibility leftover remaining', () => {
		const signal = fs.readFileSync(resolveSource(SPEECH_SIGNAL_REL), 'utf8');
		const speech = fs.readFileSync(resolveSource(SPEECH_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(SPEECH_CONTRIB_REL), 'utf8');
		const common = fs.readFileSync(resolveSource(SPEECH_COMMON_REL), 'utf8');
		const speechLegal = countIncludes(signal, `${startedCall}${doubleCatch}`) + countIncludes(signal, `${stoppedCall}${doubleCatch}`);
		assert.ok(speechLegal < 4, `expected speech legal leftover <4, got ${speechLegal}`);
		assert.strictEqual(speechLegal, 2);
		assert.strictEqual(countDoubleChains(signal), 2);
		assert.strictEqual(countDoubleChains(speech), 0);
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(!common.includes(doubleCatch));
		assert.ok(speech.includes('activeRecognizeKeywordSession = this.doRecognizeKeyword(cts.token).then(status => {'));
		assert.ok(speech.includes(', error => {'));
		assert.ok(!speech.includes(`this.doRecognizeKeyword(cts.token).then(status => {${doubleCatch}`));
	});

	test('this knife covers nine leftover Promise double-chain sites after speech leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count, kind] of d793Calls) {
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
		assert.strictEqual(sites, 9);
		assert.ok(sites >= 4);
	});

	test('speech leftover playSignal fire-and-forgets are Promise double-chain; assigned two-arg recognizeKeyword then stays skipped', () => {
		const signal = fs.readFileSync(resolveSource(SPEECH_SIGNAL_REL), 'utf8');
		const speech = fs.readFileSync(resolveSource(SPEECH_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(SIGNAL_IFACE_REL), 'utf8');
		assertPromiseSignature(iface, 'playSignal(signal: AccessibilitySignal, options?: IAccessbilitySignalOptions): Promise<void>;');
		assertPromiseSignature(speech, 'private async doRecognizeKeyword(token: CancellationToken): Promise<KeywordRecognitionStatus> {');
		assert.ok(signal.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(signal, startedCall);
		assertWrapped(signal, stoppedCall);
		assert.ok(!signal.includes('playSignal(AccessibilitySignal.voiceRecordingStarted));'));
		assert.ok(!signal.includes('playSignal(AccessibilitySignal.voiceRecordingStopped));'));
		assert.ok(speech.includes('const currentRecognizeKeywordSession = activeRecognizeKeywordSession = this.doRecognizeKeyword(cts.token).then(status => {'));
		assert.ok(speech.includes(', error => {'));
		assert.ok(!speech.includes(doubleCatch));
	});

	test('accessibility leftover playSignal / _getTextModel then / executeCommand / updateValue / openView are Promise double-chain', () => {
		const view = fs.readFileSync(resolveSource(VIEW_REL), 'utf8');
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const help = fs.readFileSync(resolveSource(HELP_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(SIGNAL_IFACE_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		assertPromiseSignature(iface, 'playSignal(signal: AccessibilitySignal, options?: IAccessbilitySignalOptions): Promise<void>;');
		assertPromiseSignature(view, 'private async _getTextModel(resource: URI): Promise<ITextModel | null> {');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(config, 'updateValue(key: string, value: unknown, target: ConfigurationTarget): Promise<void>;');
		assertPromiseSignature(views, 'openView<T extends IView>(id: string, focus?: boolean): Promise<T | null>;');
		assert.ok(view.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(status.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(help.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(view, insertedCall);
		assertWrapped(view, deletedCall);
		assertThenWrapped(view, getTextModelThen);
		assertWrapped(view, openLinkCall);
		assertWrapped(status, updateOnCall);
		assertWrapped(status, updateOffCall);
		assertWrapped(help, openViewCall);
		assert.ok(!view.includes('playSignal(AccessibilitySignal.diffLineInserted);'));
		assert.ok(!view.includes('playSignal(AccessibilitySignal.diffLineDeleted);'));
		assert.ok(!view.includes("this._commandService.executeCommand('editor.action.openLink');"));
		assert.ok(view.includes(`})${doubleCatch};\n\t\tthis._updateToolbar(this._currentProvider.actions, provider.options.type);`));
		assert.ok(!status.includes("this.configurationService.updateValue('editor.accessibilitySupport', 'on', ConfigurationTarget.USER);"));
		assert.ok(!status.includes("this.configurationService.updateValue('editor.accessibilitySupport', 'off', ConfigurationTarget.USER);"));
		assert.ok(!help.includes('() => viewsService.openView(viewDescriptor.id, true),'));
	});

	test('speech leftover remaining overflow stayed in accessibility leftover remaining and did not overflow into testing/files/keybindings/userDataSync/remoteTunnel', () => {
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const keybindings = fs.readFileSync(resolveSource(KEYBINDINGS_REL), 'utf8');
		const userDataSync = fs.readFileSync(resolveSource(USER_DATA_SYNC_REL), 'utf8');
		const remoteTunnel = fs.readFileSync(resolveSource(REMOTE_TUNNEL_REL), 'utf8');
		assert.ok(testing.includes('this.viewsService.openView(Testing.ExplorerViewId, false).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(!files.includes('D793'));
		assert.ok(keybindings.includes('run(accessor: ServicesAccessor): void {'));
		assert.ok(userDataSync.includes('private async updateAccountBadge(): Promise<void> {'));
		assert.ok(remoteTunnel.includes('private async initialize(): Promise<void> {'));
		assert.ok(!remoteTunnel.includes('D793'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const speech = fs.readFileSync(resolveSource(SPEECH_REL), 'utf8');
		const view = fs.readFileSync(resolveSource(VIEW_REL), 'utf8');
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const help = fs.readFileSync(resolveSource(HELP_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const editorHelp = fs.readFileSync(resolveSource(EDITOR_HELP_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const accConfig = fs.readFileSync(resolveSource(CONFIG_ACC_REL), 'utf8');
		const dim = fs.readFileSync(resolveSource(DIM_REL), 'utf8');
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');

		assert.ok(status.includes("this.openerService.open('https://code.visualstudio.com/docs/editor/accessibility#_screen-readers');"));
		assert.ok(!status.includes(`this.openerService.open('https://code.visualstudio.com/docs/editor/accessibility#_screen-readers')${doubleCatch}`));
		assert.ok(view.includes('this._openerService.open(URI.parse(this._currentProvider.options.readMoreUrl));'));
		assert.ok(!view.includes(`this._openerService.open(URI.parse(this._currentProvider.options.readMoreUrl))${doubleCatch}`));
		assert.ok(view.includes('this._openerService.open(URI.parse(url));'));
		assert.ok(!view.includes(`this._openerService.open(URI.parse(url))${doubleCatch}`));

		assert.ok(actions.includes('run(accessor: ServicesAccessor): void {'));
		assert.ok(actions.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(!actions.includes(doubleCatch));
		assert.ok(actions.includes('await accessor.get(IAccessibleViewService).configureKeybindings(true);'));
		assert.ok(!actions.includes(`configureKeybindings(true)${doubleCatch}`));
		assert.ok(actions.includes('await model.accept(editor);'));
		assert.ok(!actions.includes(`model.accept(editor)${doubleCatch}`));

		assert.ok(speech.includes('const currentRecognizeKeywordSession = activeRecognizeKeywordSession = this.doRecognizeKeyword(cts.token).then(status => {'));
		assert.ok(speech.includes(', error => {'));
		assert.ok(!speech.includes(doubleCatch));

		assert.ok(editorHelp.includes('await commandService.executeCommand(NEW_UNTITLED_FILE_COMMAND_ID);'));
		assert.ok(!editorHelp.includes(`executeCommand(NEW_UNTITLED_FILE_COMMAND_ID)${doubleCatch}`));
		assert.ok(editorHelp.includes('accessibleViewService.show(instantiationService.createInstance(EditorAccessibilityHelpProvider, codeEditor));'));
		assert.ok(!editorHelp.includes(`accessibleViewService.show(instantiationService.createInstance(EditorAccessibilityHelpProvider, codeEditor))${doubleCatch}`));
		assert.ok(view.includes('this.show(this._currentProvider);'));
		assert.ok(!view.includes(`this.show(this._currentProvider)${doubleCatch}`));
		assert.ok(contrib.includes('accessor.get(IAccessibleViewService).show(provider);'));
		assert.ok(!contrib.includes(`show(provider)${doubleCatch}`));

		assert.ok(resolver.includes('export function resolveContentAndKeybindingItems('));
		assert.ok(!resolver.includes(doubleCatch));
		assert.ok(view.includes('const resolvedContent = resolveContentAndKeybindingItems(this._keybindingService, screenReaderModeHint + content + readMoreLinkHint + disableHelpHint + exitThisDialogHint);'));
		assert.ok(!view.includes(`resolveContentAndKeybindingItems(${doubleCatch}`));
		assert.ok(!accConfig.includes(doubleCatch));
		assert.ok(!dim.includes(doubleCatch));

		assert.ok(view.includes('await this._commandService.executeCommand(\'workbench.action.openGlobalKeybindings\', item.id);'));
		assert.ok(!view.includes(`executeCommand('workbench.action.openGlobalKeybindings', item.id)${doubleCatch}`));

		for (const source of [speech, view, status, help, actions, editorHelp, contrib, accConfig, dim, resolver]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
