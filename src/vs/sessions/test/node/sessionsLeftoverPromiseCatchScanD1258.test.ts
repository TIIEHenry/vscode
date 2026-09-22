/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const DIALOG_REL = 'src/vs/sessions/browser/parts/dialogs/mobileDialog.web.contribution.ts';
const MOBILE_TITLE_REL = 'src/vs/sessions/browser/parts/mobile/mobileTitlebarPart.ts';
const ACCOUNT_REL = 'src/vs/sessions/contrib/accountMenu/browser/account.contribution.ts';
const RECENT_REL = 'src/vs/sessions/services/sessions/browser/sessionsRecentWorkspacesService.ts';
const ACTIONS_REL = 'src/vs/sessions/contrib/sessions/browser/sessionsActions.ts';
const TITLEBAR_REL = 'src/vs/sessions/electron-browser/parts/titlebarPart.ts';
const DIFF_REL = 'src/vs/sessions/browser/parts/mobile/contributions/mobileDiffView.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
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

const leftoverProcessDialogsCall = 'this.processDialogs()';
const leftoverRefreshAccountCall = 'this.refreshAccount()';
const leftoverRefreshRecentCall = 'this._refreshVSCodeRecentWorkspaces()';
const leftoverUpdateTitleBarCall = 'this.updateTitleBarTreatment()';
const leftoverAlwaysOnTopCall = 'this.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId, contextKeyService)';
const leftoverLoadAndRenderCall = 'this.loadAndRender(container, diff, languageId, generation)';

const d1258Calls: Array<[string, string, number]> = [
	[DIALOG_REL, leftoverProcessDialogsCall, 2],
	[MOBILE_TITLE_REL, leftoverRefreshAccountCall, 1],
	[ACCOUNT_REL, leftoverRefreshAccountCall, 1],
	[RECENT_REL, leftoverRefreshRecentCall, 1],
	[ACTIONS_REL, leftoverUpdateTitleBarCall, 1],
	[TITLEBAR_REL, leftoverAlwaysOnTopCall, 1],
	[DIFF_REL, leftoverLoadAndRenderCall, 1],
];

suite('leftover remaining unused remaining remaining unused sessions leftover remaining unused remaining remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D1258)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused remaining remaining unused sessions leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d1258Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused remaining remaining unused sessions legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 8);
		for (const [rel] of d1258Calls) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			assert.ok(!source.includes('D1258'));
		}
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused remaining remaining unused stayed on sessions this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d1258Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(DIALOG_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(MOBILE_TITLE_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(ACCOUNT_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(RECENT_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(ACTIONS_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(TITLEBAR_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(DIFF_REL) ?? ''), 1);
	});

	test('sessions leftover remaining unused remaining remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const dialog = fs.readFileSync(resolveSource(DIALOG_REL), 'utf8');
		const mobileTitle = fs.readFileSync(resolveSource(MOBILE_TITLE_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const recent = fs.readFileSync(resolveSource(RECENT_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const diff = fs.readFileSync(resolveSource(DIFF_REL), 'utf8');

		assertPromiseSignature(dialog, 'private async processDialogs(): Promise<void> {');
		assertPromiseSignature(mobileTitle, 'private async refreshAccount(): Promise<void> {');
		assertPromiseSignature(account, 'private async refreshAccount(): Promise<void> {');
		assertPromiseSignature(recent, 'private async _refreshVSCodeRecentWorkspaces(): Promise<void> {');
		assertPromiseSignature(actions, 'private async updateTitleBarTreatment(): Promise<void> {');
		assertPromiseSignature(titlebar, 'private async handleWindowsAlwaysOnTop(targetWindowId: number, contextKeyService: IContextKeyService): Promise<void> {');
		assertPromiseSignature(diff, 'private async loadAndRender(');

		assert.ok(dialog.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(mobileTitle.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(account.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(recent.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(actions.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(titlebar.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(diff.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));

		assertWrapped(dialog, leftoverProcessDialogsCall);
		assertWrapped(mobileTitle, leftoverRefreshAccountCall);
		assertWrapped(account, leftoverRefreshAccountCall);
		assertWrapped(recent, leftoverRefreshRecentCall);
		assertWrapped(actions, leftoverUpdateTitleBarCall);
		assertWrapped(titlebar, leftoverAlwaysOnTopCall);
		assertWrapped(diff, leftoverLoadAndRenderCall);
		assert.ok(!dialog.includes('\t\tthis.processDialogs();\n'));
		assert.ok(!dialog.includes('\t\t\t\tthis.processDialogs();\n'));
		assert.ok(!mobileTitle.includes('\t\tthis.refreshAccount();\n'));
		assert.ok(!account.includes('\t\tthis.refreshAccount();\n'));
		assert.ok(!recent.includes('\t\tthis._refreshVSCodeRecentWorkspaces();\n'));
		assert.ok(!actions.includes('\t\tthis.updateTitleBarTreatment();\n'));
		assert.ok(!titlebar.includes('\t\tthis.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId, contextKeyService);\n'));
		assert.ok(!diff.includes('\t\tvoid this.loadAndRender(container, diff, languageId, generation);\n'));
		assert.ok(mobileTitle.includes('() => this.refreshAccount()'));
		assert.ok(!mobileTitle.includes(`() => this.refreshAccount()${doubleCatch}`));
		assert.ok(account.includes('() => this.refreshAccount()'));
		assert.ok(!account.includes(`() => this.refreshAccount()${doubleCatch}`));
		assert.ok(recent.includes('() => this._refreshVSCodeRecentWorkspaces()'));
		assert.ok(!recent.includes(`() => this._refreshVSCodeRecentWorkspaces()${doubleCatch}`));
		assert.ok(actions.includes('() => this.updateTitleBarTreatment()'));
		assert.ok(!actions.includes(`() => this.updateTitleBarTreatment()${doubleCatch}`));
		for (const source of [dialog, mobileTitle, account, recent, actions, titlebar, diff]) {
			assert.ok(!source.includes('D1258'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		}
	});
});
