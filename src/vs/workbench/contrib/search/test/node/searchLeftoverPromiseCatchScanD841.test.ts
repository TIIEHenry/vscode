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
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const UNIFICATION_REL = 'src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts';
const MGMT_REL = 'src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const EXTENSIONS_WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';

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

const delayMultiplierCall = 'this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod * delayMultiplier)';
const debounceCall = 'this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod)';
const submitCall = 'this.submitSearch()';
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
const refreshCall = 'this.refresh()';
const checkInstallCall = 'this.checkExtensionInstallation(context)';
const registerListenersCall = 'this.registerListeners()';
const maybeDisableCall = 'this.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === \'boolean\' ? EnablementState.DisabledWorkspace : EnablementState.DisabledGlobally)';
const maybeEnableCall = 'this.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === \'boolean\' ? EnablementState.EnabledWorkspace : EnablementState.EnabledGlobally)';
const selectPrevLaunchCall = 'this.selectConfiguration(previousSelectedLaunch, previousSelectedName, undefined, dynamicConfig)';
const selectPrevNameCall = 'this.selectConfiguration(undefined, previousSelectedName, undefined, dynamicConfig)';
const selectUndefinedUndefinedCall = 'this.selectConfiguration(undefined, undefined)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';
const updateCall = 'this._update()';
const switchProfileCall = 'this.switchProfile(profileToUse)';

const d841Calls: Array<[string, string, number]> = [
	[SEARCH_WIDGET_REL, delayMultiplierCall, 1],
	[SEARCH_WIDGET_REL, debounceCall, 1],
	[SEARCH_WIDGET_REL, submitCall, 2],
];

suite('leftover remaining unused searchWidget leftover remaining unused Promise fire-and-forget catch scan (D841)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused searchWidget leftover async this.foo() FOF still had four or more legal unused leftover sites so this knife stayed', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		assertPromiseSignature(source, 'private async submitSearch(triggeredOnType = false, delay: number = 0): Promise<void> {');
		let sites = 0;
		for (const [, call, count] of d841Calls) {
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused searchWidget legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!source.includes('D841'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused stayed on searchWidget', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d841Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 4);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(SEARCH_WIDGET_REL) ?? ''), 4);
	});

	test('searchWidget leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		assertPromiseSignature(source, 'private async submitSearch(triggeredOnType = false, delay: number = 0): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, delayMultiplierCall);
		assertWrapped(source, debounceCall);
		assertWrapped(source, submitCall);
		assert.strictEqual(countIncludes(source, `${delayMultiplierCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${debounceCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${submitCall}${doubleCatch}`), 2);
		assert.ok(!source.includes('\t\t\t\t\tthis.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod * delayMultiplier);\n'));
		assert.ok(!source.includes('\t\t\t\tthis.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod);\n'));
		assert.ok(!source.includes('\t\t\tthis.submitSearch();\n'));
		assert.ok(!source.includes('await this.submitSearch'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'private async submitSearch(triggeredOnType = false, delay: number = 0): Promise<void> {');

		assert.ok(!source.includes('openerService.open'));
		assert.ok(!source.includes('IOpenerService'));
		assert.ok(!source.includes('extends Action2'));
		assert.ok(source.includes('class ReplaceAllAction extends Action'));
		assert.ok(source.includes('new ReplaceAllAction(searchView.searchAndReplaceWidget).run();'));
		assert.ok(!source.includes(`new ReplaceAllAction(searchView.searchAndReplaceWidget).run()${doubleCatch}`));
		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(!source.includes('return this.submitSearch'));
		assert.ok(!source.includes('await this.submitSearch'));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D841'));
	});

	test('locked leftover remaining stay leftover remaining unused; D839/D840/D843/D834/D837 already-double stay already-double; this knife did not overflow', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(EXTENSIONS_WIDGETS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(suggest.includes(assignedThenCall));
		assert.ok(!suggest.includes(`${assignedThenCall}${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));

		assert.ok(gettingStarted.includes(leftoverScrollPrevCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepIdCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepToSelectCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepUndefinedCall));
		assert.ok(gettingStarted.includes('\t\tthis.selectStep(selectedStep ?? toExpand.id, !selectedStep, preserveFocus);\n'));
		assert.ok(!gettingStarted.includes(`this.selectStep(id)${doubleCatch}`));
		assert.ok(!gettingStarted.includes(`this.selectStep(toSelect)${doubleCatch}`));
		assert.ok(!gettingStarted.includes(`this.selectStep(undefined)${doubleCatch}`));
		assert.ok(!gettingStarted.includes(`this.selectStep(selectedStep ?? toExpand.id, !selectedStep, preserveFocus)${doubleCatch}`));
		assert.strictEqual(countIncludes(gettingStarted, leftoverScrollPrevCall), 2);
		assert.ok(gettingStarted.includes(assignedInProgressScroll));
		assert.ok(!gettingStarted.includes(`${assignedInProgressScroll}${doubleCatch}`));
		assert.ok(gettingStartedContrib.includes(leftoverSelectStepLooseCall));
		assert.ok(!gettingStartedContrib.includes(`editorPane.selectStepLoose(stepID)${doubleCatch}`));

		assert.ok(textModel.includes(`${updateDiffSeqCall};`) || textModel.includes(`\t\t\tthis._updateDiffInfoSeq();\n`));
		assert.ok(!textModel.includes(`${updateDiffSeqCall}${doubleCatch}`));

		assert.ok(comments.includes(`${refreshCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(comments, `${refreshCall}${doubleCatch}`), 5);
		assert.ok(setup.includes(`${checkInstallCall}${doubleCatch}`));
		assert.ok(setup.includes(`${registerListenersCall}${doubleCatch}`));
		assert.ok(setup.includes(`${maybeDisableCall}${doubleCatch}`));
		assert.ok(setup.includes(`${maybeEnableCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectPrevLaunchCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectPrevNameCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedUndefinedCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedCall}${doubleCatch}`));
		assert.ok(unification.includes(`${updateCall}${doubleCatch}`));
		assert.ok(mgmt.includes(`${switchProfileCall}${doubleCatch}`));

		for (const [rel, file] of [
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[DEBUG_CONFIG_REL, debugConfig],
			[UNIFICATION_REL, unification],
			[MGMT_REL, mgmt],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[VIEWLET_REL, viewlet],
			[EXTENSIONS_WIDGETS_REL, widgets],
			[SUGGEST_REL, suggest],
			[SETTINGS_REL, settings],
			[TEXT_MODEL_REL, textModel],
		] as const) {
			assert.ok(!file.includes('D841'), `${rel} should stay off this knife`);
		}
		assert.ok(!source.includes('D841'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD841.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD841.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD841.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD841.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD841.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD841.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD841.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD841.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD841.test.ts')));
	});
});
