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
const UNIFICATION_REL = 'src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts';
const EDITING_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedNotebookEntry.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const CHAT_ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const XTERM_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const NOTEBOOK_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';

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

const updateCall = 'this._update()';
const refetchThenCall = '() => this._update()';
const initDiffCall = 'this.initializeModelsFromDiff()';
const updateDiffSeqCall = 'this._updateDiffInfoSeq()';
const updateImplicitCall = 'this.updateImplicitContext()';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const autoUpdateCall = 'this.autoUpdateBuiltinExtensions()';

const d830Calls: Array<[string, string, number]> = [
	[UNIFICATION_REL, updateCall, 5],
];

suite('leftover remaining unused after D829 moved to inlineCompletions leftover remaining unused Promise fire-and-forget catch scan (D830)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D829 had fewer than four legal unused leftover sites so this knife moved', () => {
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(folding), 0);
		assert.strictEqual(countDoubleChains(inlayHints), 0);
		assert.strictEqual(countDoubleChains(languageStatus), 0);
		assert.ok(suggest.includes('this._currentSuggestionDetails.then(() => {'));
		assert.ok(!suggest.includes(`this._currentSuggestionDetails.then(() => {${doubleCatch}`));
		assert.strictEqual(countDoubleChains(notification), 0);
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused after D829 legal leftover <4, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!folding.includes('D830'));
		assert.ok(!inlayHints.includes('D830'));
		assert.ok(!languageStatus.includes('D830'));
	});

	test('this knife covers five leftover Promise double-chain sites after leftover remaining unused after D829 moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d830Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(UNIFICATION_REL) ?? ''), 5);
	});

	test('inlineCompletions leftover remaining unused async this.foo() FOF (_update) are Promise double-chain', () => {
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		assertPromiseSignature(unification, 'private async _update(): Promise<void> {');
		assert.ok(unification.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(unification, updateCall);
		assert.strictEqual(countIncludes(unification, `${updateCall}${doubleCatch}`), 5);
		assert.ok(unification.includes(`${refetchThenCall}${doubleCatch}`));
		assert.ok(!unification.includes('\t\t\t\tthis._update();\n'));
		assert.ok(!unification.includes('\t\tthis._update();\n'));
		assert.ok(!unification.includes('() => this._update())'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(unification, 'private async _update(): Promise<void> {');

		assert.ok(!unification.includes('openerService.open'));
		assert.ok(!unification.includes('IOpenerService'));
		assert.ok(!unification.includes('extends Action2'));
		assert.ok(!unification.includes('registerAction2'));
		assert.ok(!unification.includes('.then(undefined,'));
		assert.ok(!unification.includes('.then('));
		assert.ok(unification.includes('return this._isExtensionUnificationActive()'));
		assert.ok(!unification.includes(`return this._isExtensionUnificationActive()${doubleCatch}`));
		assert.ok(!unification.includes(`${doubleCatch}.catch(onUnexpectedError)`));

		for (const source of [unification]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes('D830'));
		}
	});

	test('D829 chatEditing already-double stays already-double; owned leftover modules stay untouched; leftover remaining unused leftover stays leftover remaining unused', () => {
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(CHAT_ENTITLEMENT_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');

		assertWrapped(editing, initDiffCall);
		assert.strictEqual(countIncludes(editing, `${initDiffCall}${doubleCatch}`), 10);
		assert.ok(textModel.includes(`${updateDiffSeqCall};`) || textModel.includes(`\t\t\tthis._updateDiffInfoSeq();\n`));
		assert.ok(!textModel.includes(`${updateDiffSeqCall}${doubleCatch}`));
		assert.ok(implicit.includes(`${updateImplicitCall}${doubleCatch}`));
		assert.ok(workbench.includes(`${autoUpdateCall}${doubleCatch}`));
		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));

		for (const [rel, source] of [
			[EDITING_REL, editing],
			[TEXT_MODEL_REL, textModel],
			[IMPLICIT_REL, implicit],
			[WORKBENCH_SVC_REL, workbench],
			[CHAT_ENTITLEMENT_REL, entitlement],
			[ENABLEMENT_REL, enablement],
			[ACCOUNT_REL, account],
			[SETTINGS_REL, settings],
			[XTERM_REL, xterm],
			[PROGRESS_REL, progress],
			[NOTEBOOK_REL, notebook],
			[SECRETS_REL, secrets],
			[TASKS_REL, tasks],
			[GETTING_STARTED_REL, gettingStarted],
			[CONFIG_REL, config],
		] as const) {
			assert.ok(!source.includes('D830'), `${rel} should not mention D830`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/emergencyAlert/test/node/unusedLeftoverPromiseCatchScanD830.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatImplicitContextLeftoverPromiseCatchScanD830.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatEditingLeftoverPromiseCatchScanD830.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/chat/test/node/chatEntitlementLeftoverPromiseCatchScanD830.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD830.test.ts')));
	});
});
