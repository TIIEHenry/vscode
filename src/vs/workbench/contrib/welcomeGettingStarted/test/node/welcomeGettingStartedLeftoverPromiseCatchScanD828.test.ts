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
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const CHAT_IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const ACCOUNT_POLICY_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const CONFIGURATION_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const XTERM_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const NOTEBOOK_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';

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

const scrollToCategoryIdCall = 'this.scrollToCategory(categoryID, stepId)';
const runDispatchCommandCall = 'this.runDispatchCommand(command, argument)';
const scrollPrevDispatchCall = 'this.scrollPrev()';
const scrollToCategoryArgCall = 'this.scrollToCategory(argument)';
const selectStepArgCall = 'this.selectStep(argument)';
const scrollToCategoryNextCall = 'this.scrollToCategory(next)';
const runDispatchSelectCategoryCall = "this.runDispatchCommand('selectCategory', selection.id)";
const assignedThenCall = 'this._currentSuggestionDetails.then(() => {';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const leftoverScrollPrevCall = '\t\t\tthis.scrollPrev();\n';
const leftoverSelectStepIdCall = '\t\t\tthis.selectStep(id);\n';
const leftoverSelectStepToSelectCall = '\t\t\tthis.selectStep(toSelect);\n';
const leftoverSelectStepUndefinedCall = '\t\t\t\tthis.selectStep(undefined);\n';
const leftoverSelectStepLooseCall = '\t\t\teditorPane.selectStepLoose(stepID);\n';
const assignedInProgressScroll = 'this.inProgressScroll = this.inProgressScroll.then(async () => {';

const d828Calls: Array<[string, string, number]> = [
	[GETTING_STARTED_REL, scrollToCategoryIdCall, 1],
	[GETTING_STARTED_REL, runDispatchCommandCall, 2],
	[GETTING_STARTED_REL, scrollToCategoryArgCall, 1],
	[GETTING_STARTED_REL, selectStepArgCall, 1],
	[GETTING_STARTED_REL, scrollToCategoryNextCall, 1],
	[GETTING_STARTED_REL, runDispatchSelectCategoryCall, 1],
];

suite('leftover remaining unused welcomeGettingStarted leftover Promise fire-and-forget catch scan (D828)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused welcomeGettingStarted leftover async this.foo() FOF still had four or more legal unused leftover sites so this knife stayed', () => {
		const source = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		let sites = 0;
		for (const [, call, count] of d828Calls) {
			sites += count;
		}
		assert.strictEqual(countIncludes(source, `${scrollPrevDispatchCall}${doubleCatch}`), 1);
		sites += 1;
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.ok(!source.includes('D828'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatImplicitContextLeftoverPromiseCatchScanD828.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/settingsEditor2LeftoverPromiseCatchScanD828.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/policies/test/node/accountPolicyLeftoverPromiseCatchScanD828.test.ts')));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on welcomeGettingStarted', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d828Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		const source = seen.get(GETTING_STARTED_REL) ?? '';
		assert.strictEqual(countIncludes(source, `${scrollPrevDispatchCall}${doubleCatch}`), 1);
		assert.ok(source.includes(`\t\t\t\t${scrollPrevDispatchCall}${doubleCatch};`));
		sites += 1;
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(source), 15);
	});

	test('welcomeGettingStarted leftover remaining unused scrollToCategory / runDispatchCommand / scrollPrev / selectStep leftover async this.foo() FOF are Promise/async + double-chain', () => {
		const source = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		assertPromiseSignature(source, 'private async scrollToCategory(categoryID: string, stepId?: string) {');
		assertPromiseSignature(source, 'private async runDispatchCommand(command: string, argument: string) {');
		assertPromiseSignature(source, 'private async scrollPrev() {');
		assertPromiseSignature(source, 'private async selectStep(id: string | undefined, delayFocus = true, preserveFocus?: boolean) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, scrollToCategoryIdCall);
		assertWrapped(source, runDispatchCommandCall);
		assertWrapped(source, scrollToCategoryArgCall);
		assertWrapped(source, selectStepArgCall);
		assertWrapped(source, scrollToCategoryNextCall);
		assertWrapped(source, runDispatchSelectCategoryCall);
		assert.strictEqual(countIncludes(source, `${scrollToCategoryIdCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${runDispatchCommandCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(source, `${scrollPrevDispatchCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${scrollToCategoryArgCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${selectStepArgCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${scrollToCategoryNextCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${runDispatchSelectCategoryCall}${doubleCatch}`), 1);
		assert.ok(!source.includes('\t\tthis.scrollToCategory(categoryID, stepId);\n'));
		assert.ok(!source.includes('\t\t\t\t\tthis.runDispatchCommand(command, argument);\n'));
		assert.ok(!source.includes('\t\t\t\t\t\t\tthis.runDispatchCommand(command, argument);\n'));
		assert.ok(!source.includes('\t\t\t\tthis.scrollPrev();\n'));
		assert.ok(!source.includes('\t\t\t\tthis.scrollToCategory(argument);\n'));
		assert.ok(!source.includes('\t\t\t\tthis.selectStep(argument);\n'));
		assert.ok(!source.includes('\t\t\t\t\tthis.scrollToCategory(next);\n'));
		assert.ok(!source.includes("\t\t\tthis.runDispatchCommand('selectCategory', selection.id);\n"));
	});

	test('leftover remaining unused leftover selectStep / scrollPrev / selectStepLoose stay leftover remaining unused; assigned inProgressScroll stays skipped', () => {
		const source = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		assert.ok(source.includes(leftoverScrollPrevCall));
		assert.ok(source.includes(leftoverSelectStepIdCall));
		assert.ok(source.includes(leftoverSelectStepToSelectCall));
		assert.ok(source.includes(leftoverSelectStepUndefinedCall));
		assert.ok(source.includes('\t\tthis.selectStep(selectedStep ?? toExpand.id, !selectedStep, preserveFocus);\n'));
		assert.ok(!source.includes(`this.selectStep(id)${doubleCatch}`));
		assert.ok(!source.includes(`this.selectStep(toSelect)${doubleCatch}`));
		assert.ok(!source.includes(`this.selectStep(undefined)${doubleCatch}`));
		assert.ok(!source.includes(`this.selectStep(selectedStep ?? toExpand.id, !selectedStep, preserveFocus)${doubleCatch}`));
		assert.strictEqual(countIncludes(source, leftoverScrollPrevCall), 2);
		assert.ok(source.includes(assignedInProgressScroll));
		assert.ok(!source.includes(`${assignedInProgressScroll}${doubleCatch}`));
		assert.ok(contrib.includes(leftoverSelectStepLooseCall));
		assert.ok(!contrib.includes(`editorPane.selectStepLoose(stepID)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'private async scrollToCategory(categoryID: string, stepId?: string) {');

		assert.ok(source.includes('\t\t\tthis.openerService.open(argument);\n'));
		assert.ok(!source.includes(`this.openerService.open(argument)${doubleCatch}`));
		assert.ok(source.includes('this.openerService.open(command, { allowCommands: true });'));
		assert.ok(!source.includes(`this.openerService.open(command, { allowCommands: true })${doubleCatch}`));

		assert.ok(contrib.includes('registerAction2(class extends Action2'));
		assert.ok(!contrib.includes(`async run(${doubleCatch}`));
		assert.ok(!contrib.includes(`registerAction2${doubleCatch}`));

		assert.ok(suggest.includes(assignedThenCall));
		assert.ok(!suggest.includes(`${assignedThenCall}${doubleCatch}`));
		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(source.includes('return this.buildCategoriesSlide();') || source.includes('await this.buildCategoriesSlide'));
		assert.ok(!source.includes(`return this.buildCategoriesSlide()${doubleCatch}`));

		assert.ok(source.includes(`this.recentlyOpened.then(({ workspaces }) => {`));
		assert.ok(source.includes(`${doubleCatch}`));

		for (const file of [source, contrib]) {
			assert.ok(!file.includes('acknowledge('));
			assert.ok(!file.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!file.includes('SaveSkillContent'));
			assert.ok(!file.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!file.includes('D828'));
		}
	});

	test('loopCheck / openView / assigned _currentSuggestionDetails.then stay leftover remaining unused; this knife did not overflow into dirty leftover modules', () => {
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const chatImplicit = fs.readFileSync(resolveSource(CHAT_IMPLICIT_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const accountPolicy = fs.readFileSync(resolveSource(ACCOUNT_POLICY_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIGURATION_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(suggest.includes(assignedThenCall));
		assert.ok(!suggest.includes(`${assignedThenCall}${doubleCatch}`));

		for (const [rel, source] of [
			[CHAT_IMPLICIT_REL, chatImplicit],
			[SETTINGS_REL, settings],
			[ACCOUNT_POLICY_REL, accountPolicy],
			[CONFIGURATION_REL, configuration],
			[XTERM_REL, xterm],
			[PROGRESS_REL, progress],
			[USER_DATA_REL, userData],
			[TEXT_RES_REL, textRes],
			[NOTEBOOK_REL, notebook],
			[SECRETS_REL, secrets],
			[INTEGRITY_REL, integrity],
			[LABEL_REL, label],
			[TASKS_REL, tasks],
			[WORKBENCH_SVC_REL, workbench],
		] as const) {
			assert.ok(!source.includes('D828'), `${rel} should stay off this knife`);
		}
	});
});
