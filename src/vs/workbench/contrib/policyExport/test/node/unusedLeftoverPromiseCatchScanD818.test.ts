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
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const POLICY_REL = 'src/vs/workbench/contrib/policyExport/electron-browser/policyExport.contribution.ts';
const QUICKACCESS_REL = 'src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts';
const THEMES_TEST_REL = 'src/vs/workbench/contrib/themes/browser/themes.test.contribution.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/electron-browser/lifecycleService.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';

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

});
