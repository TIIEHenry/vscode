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
const ASYNC_REL = 'src/vs/base/common/async.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const PREFERENCES_REL = 'src/vs/workbench/services/preferences/common/preferences.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const POLICY_REL = 'src/vs/workbench/contrib/policyExport/electron-browser/policyExport.contribution.ts';
const QUICKACCESS_REL = 'src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts';
const THEMES_TEST_REL = 'src/vs/workbench/contrib/themes/browser/themes.test.contribution.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/electron-browser/lifecycleService.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const KEYBINDINGS_EXPORT_REL = 'src/vs/workbench/contrib/keybindingsExport/electron-browser/keybindingsExport.contribution.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const TYPE_CONTRIB_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchy.contribution.ts';
const CALL_CONTRIB_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';
const CAROUSEL_REL = 'src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts';

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

const exportCall = 'void this.exportPolicyDataAndQuit(policyDataPath ? policyDataPath : defaultPath)';
const openSettingsCall = "void this.preferencesService.openSettings({ jsonEditor: false, query: 'workbench.commandPalette.showAskInChat' })";
const processThenCall = `process(file).then(result => {
				console.log(result);
			})`;
const vetoThenCall = `value.then(veto => {
						if (veto === true) {
							logService.info(\`[lifecycle]: Shutdown was prevented (id: \${id})\`);
						}
					})`;
const suggestThenCall = `this.element.domNode.classList.remove('docs-side');
				}

			})`;
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';

const d818Calls: Array<[string, string, number]> = [
	[POLICY_REL, exportCall, 1],
	[QUICKACCESS_REL, openSettingsCall, 1],
	[THEMES_TEST_REL, processThenCall, 1],
	[LIFECYCLE_REL, vetoThenCall, 1],
];

suite('folding leftover remaining moved to unused leftover Promise fire-and-forget catch scan (D818)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('folding leftover remaining had fewer than four legal unused leftover sites so this knife moved through inlayHints/languageStatus to unused leftover remaining', () => {
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(folding), 0);
		assert.strictEqual(countDoubleChains(inlayHints), 0);
		assert.strictEqual(countDoubleChains(languageStatus), 0);
		const foldingLegal = 0;
		const inlayHintsLegal = 0;
		const languageStatusLegal = 0;
		assert.ok(foldingLegal < 4, `expected folding legal leftover <4, got ${foldingLegal}`);
		assert.ok(inlayHintsLegal < 4, `expected inlayHints legal leftover <4, got ${inlayHintsLegal}`);
		assert.ok(languageStatusLegal < 4, `expected languageStatus legal leftover <4, got ${languageStatusLegal}`);
		assert.ok(!folding.includes('D818'));
		assert.ok(!inlayHints.includes('D818'));
		assert.ok(!languageStatus.includes('D818'));
	});

	test('this knife covers four leftover Promise double-chain sites after folding leftover remaining moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d818Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(POLICY_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(QUICKACCESS_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(THEMES_TEST_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(LIFECYCLE_REL) ?? ''), 1);
	});

	test('unused leftover exportPolicyDataAndQuit / openSettings leftover void promises are Promise/async + double-chain', () => {
		const policy = fs.readFileSync(resolveSource(POLICY_REL), 'utf8');
		const quickaccess = fs.readFileSync(resolveSource(QUICKACCESS_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		assertPromiseSignature(policy, 'private async exportPolicyDataAndQuit(policyDataPath: string): Promise<void> {');
		assertPromiseSignature(preferences, 'openSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;');
		assert.ok(policy.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(quickaccess.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(policy, exportCall);
		assertWrapped(quickaccess, openSettingsCall);
		assert.ok(!policy.includes('void this.exportPolicyDataAndQuit(policyDataPath ? policyDataPath : defaultPath);'));
		assert.ok(!quickaccess.includes("void this.preferencesService.openSettings({ jsonEditor: false, query: 'workbench.commandPalette.showAskInChat' });"));
	});

	test('unused leftover process(file) then / veto then are Promise/async + double-chain; assigned suggest then stays leftover remaining', () => {
		const themes = fs.readFileSync(resolveSource(THEMES_TEST_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		assertPromiseSignature(themes, 'async function captureTokens(accessor: ServicesAccessor, resource: URI | undefined, treeSitter: boolean = false) {');
		assertPromiseSignature(files, 'readFile(resource: URI, options?: IReadFileOptions, token?: CancellationToken): Promise<IFileContent>;');
		assert.ok(lifecycle.includes('else if (value instanceof Promise) {'));
		assert.ok(suggest.includes('private _currentSuggestionDetails?: CancelablePromise<void>;'));
		assert.ok(themes.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(lifecycle.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(themes, processThenCall);
		assertWrapped(lifecycle, vetoThenCall);
		assert.ok(suggest.includes('this._currentSuggestionDetails.then(() => {'));
		assert.ok(!suggest.includes(`${suggestThenCall}${doubleCatch}`));
		assert.ok(themes.includes('return fileService.readFile(resource).then(content => {'));
		assert.ok(!themes.includes(`return fileService.readFile(resource).then(content => {${doubleCatch}`));
		assert.ok(themes.includes('const processResult = await process(resource);'));
		assert.ok(!themes.includes(`await process(resource)${doubleCatch}`));
		assert.ok(lifecycle.includes(`${vetoThenCall}${doubleCatch}.finally(() => pendingVetos.delete(id));`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const policy = fs.readFileSync(resolveSource(POLICY_REL), 'utf8');
		const quickaccess = fs.readFileSync(resolveSource(QUICKACCESS_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_TEST_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(policy, 'private async exportPolicyDataAndQuit(policyDataPath: string): Promise<void> {');

		assert.ok(!policy.includes('openerService.open'));
		assert.ok(!quickaccess.includes('openerService.open'));
		assert.ok(!themes.includes('openerService.open'));
		assert.ok(!lifecycle.includes('openerService.open'));
		assert.ok(!suggest.includes('openerService.open'));

		assert.ok(quickaccess.includes('export class ShowAllCommandsAction extends Action2'));
		assert.ok(quickaccess.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(!quickaccess.includes(`async run(accessor: ServicesAccessor): Promise<void> {${doubleCatch}`));
		assert.ok(!quickaccess.includes(`registerAction2${doubleCatch}`));
		assert.ok(themes.includes('return captureTokens(accessor, resource);'));
		assert.ok(!themes.includes(`return captureTokens(accessor, resource)${doubleCatch}`));
		assert.ok(themes.includes('this._installedExtensions = extensionManagementService.getInstalled().then(installed => {') || !themes.includes('this._installedExtensions ='));
		assert.ok(lifecycle.includes('value.then(veto => {'));
		assert.ok(!lifecycle.includes('value.then(undefined,'));

		for (const source of [policy, quickaccess, themes, lifecycle, suggest]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D818'));
		}
	});

	test('D809/D812 leftover remaining that landed scans lock unwrapped stay unwrapped; already-double leftover stays already-double; this knife did not overflow into dirty leftover modules', () => {
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const typeContrib = fs.readFileSync(resolveSource(TYPE_CONTRIB_REL), 'utf8');
		const callContrib = fs.readFileSync(resolveSource(CALL_CONTRIB_REL), 'utf8');
		const carousel = fs.readFileSync(resolveSource(CAROUSEL_REL), 'utf8');
		const keybindingsExport = fs.readFileSync(resolveSource(KEYBINDINGS_EXPORT_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');

		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));

		assert.ok(typeContrib.includes(doubleCatch));
		assert.ok(callContrib.includes(doubleCatch));
		assert.ok(carousel.includes(`this._loadBlobUrl(adjacentImage).then(url => {`));
		assert.ok(!carousel.includes(`this.updateCurrentImage()${doubleCatch}`));

		for (const [rel, source] of [
			[KEYBINDINGS_EXPORT_REL, keybindingsExport],
			[NOTIFICATION_REL, notification],
			[PROGRESS_REL, progress],
			[USER_DATA_REL, userData],
			[TEXT_RES_REL, textRes],
			[SECRETS_REL, secrets],
			[INTEGRITY_REL, integrity],
			[LABEL_REL, label],
			[TASKS_REL, tasks],
		] as const) {
			assert.ok(!source.includes('D818'), `${rel} should not mention D818`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/folding/test/node/foldingLeftoverPromiseCatchScanD818.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/inlayHints/test/node/inlayHintsLeftoverPromiseCatchScanD818.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/imageCarousel/test/node/imageCarouselLeftoverPromiseCatchScanD818.test.ts')));
	});
});
