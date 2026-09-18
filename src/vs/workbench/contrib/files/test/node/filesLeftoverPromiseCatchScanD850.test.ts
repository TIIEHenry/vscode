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
const FILES_REL = 'src/vs/workbench/contrib/files/common/files.ts';
const EXPLORER_VIEWER_REL = 'src/vs/workbench/contrib/files/browser/views/explorerViewer.ts';
const SUGGEST_CONTRIB_REL = 'src/vs/workbench/contrib/terminalContrib/suggest/browser/terminal.suggest.contribution.ts';
const FIND_MODEL_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/find/findModel.ts';
const OUTPUT_SERVICES_REL = 'src/vs/workbench/contrib/output/browser/outputServices.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const UNIFICATION_REL = 'src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts';
const MGMT_REL = 'src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const FIND_REL = 'src/vs/workbench/contrib/terminalContrib/find/browser/terminalFindWidget.ts';
const STICKY_REL = 'src/vs/workbench/contrib/terminalContrib/stickyScroll/browser/terminalStickyScrollOverlay.ts';
const RESIZE_REL = 'src/vs/workbench/contrib/terminalContrib/resizeDimensionsOverlay/browser/terminal.resizeDimensionsOverlay.contribution.ts';

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

const resolveCall = 'this.resolveEditorModel(resource, false /* do not create if missing */)';
const processIgnoreCall = 'this.processIgnoreFile(stat.root.resource.toString(), stat.resource, false)';
const prepareXtermRawCall = 'this._prepareAddonLayout(xtermRaw)';
const prepareXtermCall = 'this._prepareAddonLayout(xterm)';
const prepareInstanceCall = 'this._prepareAddonLayout(this._ctx.instance.xterm.raw)';
const loadLspXtermCall = 'this._loadLspCompletionAddon(xterm)';
const loadLspInstanceCall = 'this._loadLspCompletionAddon(this._ctx.instance.xterm.raw)';
const researchCall = 'this.research()';
const refreshCall = 'this.explorerService.refresh()';
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
const openAndShowCall = 'this.openAndShow(messageItReferenceToUri(m))';
const submitSearchCall = 'this.submitSearch()';

const d850Calls: Array<[string, string, number]> = [
	[FILES_REL, resolveCall, 1],
	[EXPLORER_VIEWER_REL, processIgnoreCall, 1],
	[SUGGEST_CONTRIB_REL, prepareXtermRawCall, 1],
	[SUGGEST_CONTRIB_REL, prepareXtermCall, 1],
	[SUGGEST_CONTRIB_REL, prepareInstanceCall, 1],
	[SUGGEST_CONTRIB_REL, loadLspXtermCall, 1],
	[SUGGEST_CONTRIB_REL, loadLspInstanceCall, 1],
];

suite('leftover remaining unused files leftover remaining unused after D786 overflowed to terminal leftover remaining unused after D798 Promise fire-and-forget catch scan (D850)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused files leftover remaining unused after D786 had fewer than four legal unused leftover sites so this knife overflowed', () => {
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const viewer = fs.readFileSync(resolveSource(EXPLORER_VIEWER_REL), 'utf8');
		assertPromiseSignature(files, 'private async resolveEditorModel(resource: URI, createAsNeeded: boolean = true): Promise<ITextModel | null> {');
		assertPromiseSignature(viewer, 'private async processIgnoreFile(root: string, ignoreFileResource: URI, update?: boolean) {');
		const filesLegal = countIncludes(files, `${resolveCall}${doubleCatch}`) + countIncludes(viewer, `${processIgnoreCall}${doubleCatch}`);
		assert.ok(filesLegal < 4, `expected leftover remaining unused files legal leftover <4, got ${filesLegal}`);
		assert.strictEqual(filesLegal, 2);
		assertWrapped(files, resolveCall);
		assertWrapped(viewer, processIgnoreCall);
		assert.ok(viewer.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(files.includes('await this.resolveEditorModel(resource);'));
		assert.ok(!files.includes(`await this.resolveEditorModel(resource)${doubleCatch}`));
		assert.ok(viewer.includes('await this.processIgnoreFile(root, ignoreResource, true);'));
		assert.ok(!viewer.includes(`await this.processIgnoreFile(root, ignoreResource, true)${doubleCatch}`));
		assert.ok(!files.includes('D850'));
		assert.ok(!viewer.includes('D850'));
	});

	test('this knife covers seven leftover Promise double-chain sites after leftover remaining unused overflowed to terminal leftover remaining unused after D798', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d850Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 7);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(FILES_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(EXPLORER_VIEWER_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(SUGGEST_CONTRIB_REL) ?? ''), 5);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const viewer = fs.readFileSync(resolveSource(EXPLORER_VIEWER_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_CONTRIB_REL), 'utf8');
		assertPromiseSignature(files, 'private async resolveEditorModel(resource: URI, createAsNeeded: boolean = true): Promise<ITextModel | null> {');
		assertPromiseSignature(viewer, 'private async processIgnoreFile(root: string, ignoreFileResource: URI, update?: boolean) {');
		assertPromiseSignature(suggest, 'private async _loadLspCompletionAddon(xterm: RawXtermTerminal): Promise<void> {');
		assertPromiseSignature(suggest, 'private async _prepareAddonLayout(xterm: RawXtermTerminal): Promise<void> {');
		assert.ok(files.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(viewer.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(suggest.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(files, resolveCall);
		assertWrapped(viewer, processIgnoreCall);
		assertWrapped(suggest, prepareXtermRawCall);
		assertWrapped(suggest, prepareXtermCall);
		assertWrapped(suggest, prepareInstanceCall);
		assertWrapped(suggest, loadLspXtermCall);
		assertWrapped(suggest, loadLspInstanceCall);
		assert.ok(!files.includes('\t\t\t\t\tthis.resolveEditorModel(resource, false /* do not create if missing */);\n'));
		assert.ok(!viewer.includes('\t\t\tthis.processIgnoreFile(stat.root.resource.toString(), stat.resource, false);\n'));
		assert.ok(!suggest.includes('\t\t\t\tthis._prepareAddonLayout(xtermRaw);\n'));
		assert.ok(!suggest.includes('\t\tthis._prepareAddonLayout(xterm);\n'));
		assert.ok(!suggest.includes('\t\tthis._loadLspCompletionAddon(xterm);\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const viewer = fs.readFileSync(resolveSource(EXPLORER_VIEWER_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const resize = fs.readFileSync(resolveSource(RESIZE_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(suggest, 'private async _prepareAddonLayout(xterm: RawXtermTerminal): Promise<void> {');

		assert.ok(!files.includes('openerService.open'));
		assert.ok(!files.includes('IOpenerService'));
		assert.ok(!files.includes('extends Action2'));
		assert.ok(!viewer.includes('openerService.open'));
		assert.ok(!viewer.includes('extends Action2'));
		assert.ok(suggest.includes("(accessor.get(IOpenerService)).open('https://aka.ms/vscode-terminal-intellisense');"));
		assert.ok(!suggest.includes(`(accessor.get(IOpenerService)).open('https://aka.ms/vscode-terminal-intellisense')${doubleCatch}`));
		assert.ok(suggest.includes('run: (c, accessor) => {'));
		assert.ok(files.includes('await this.resolveEditorModel(resource);'));
		assert.ok(!files.includes(`return this.resolveEditorModel(resource)${doubleCatch}`));
		assert.ok(viewer.includes('await this.processIgnoreFile(root, ignoreResource, true);'));
		assert.ok(!viewer.includes(`return this.processIgnoreFile(root, ignoreResource, true)${doubleCatch}`));
		assert.ok(viewer.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(resize.includes('this._ctx.processManager.ptyProcessReady.then(() => {'));
		assert.ok(!resize.includes(`ptyProcessReady.then(() => {${doubleCatch}`));

		for (const source of [files, viewer, suggest]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D850'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; already-double stay already-double; this knife did not overflow into dirty leftover modules', () => {
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const viewer = fs.readFileSync(resolveSource(EXPLORER_VIEWER_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_CONTRIB_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const simpleSuggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const find = fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');

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
		assert.ok(testing.includes(`${openAndShowCall};`));
		assert.ok(!testing.includes(`${openAndShowCall}${doubleCatch}`));

		assert.ok(findModel.includes(`${researchCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(findModel, `${researchCall}${doubleCatch}`), 4);
		assert.ok(output.includes(`this.onDidRegisterChannel(channelIdentifier.id)${doubleCatch}`));
		assert.ok(searchWidget.includes(`${submitSearchCall}${doubleCatch}`));
		assert.ok(comments.includes(`this.refresh()${doubleCatch}`));
		assert.ok(setup.includes(`this.checkExtensionInstallation(context)${doubleCatch}`));
		assert.ok(debugConfig.includes(`this.selectConfiguration(undefined)${doubleCatch}`));
		assert.ok(debugService.includes(`this.launchOrAttachToSession(session)${doubleCatch}`));
		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));
		assert.ok(viewer.includes(`${refreshCall}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(find), 5);
		assert.strictEqual(countDoubleChains(sticky), 3);

		for (const [rel, file] of [
			[FIND_MODEL_REL, findModel],
			[OUTPUT_SERVICES_REL, output],
			[SEARCH_WIDGET_REL, searchWidget],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[UNIFICATION_REL, unification],
			[MGMT_REL, mgmt],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[SUGGEST_REL, simpleSuggest],
			[SETTINGS_REL, settings],
			[TEXT_MODEL_REL, textModel],
			[PROFILE_MODEL_REL, profileModel],
			[TASKS_REL, tasks],
			[TESTING_REL, testing],
			[FIND_REL, find],
			[STICKY_REL, sticky],
		] as const) {
			assert.ok(!file.includes('D850'), `${rel} should stay off this knife`);
		}
		assert.ok(!files.includes('D850'));
		assert.ok(!viewer.includes('D850'));
		assert.ok(!suggest.includes('D850'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD850.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD850.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD850.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD850.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD850.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD850.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD850.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD850.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/bulkEdit/test/node/bulkEditLeftoverPromiseCatchScanD850.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD850.test.ts')));
	});
});
