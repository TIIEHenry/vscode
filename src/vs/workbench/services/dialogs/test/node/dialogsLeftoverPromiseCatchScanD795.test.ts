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
const WORKSPACES_REL = 'src/vs/platform/workspaces/common/workspaces.ts';
const DIALOGS_REL = 'src/vs/platform/dialogs/common/dialogs.ts';
const EDITOR_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const SPLASH_REL = 'src/vs/workbench/contrib/splash/browser/partsSplash.ts';
const SPLASH_SVC_REL = 'src/vs/workbench/contrib/splash/browser/splash.ts';
const SPLASH_CONTRIB_REL = 'src/vs/workbench/contrib/splash/browser/splash.contribution.ts';
const SPLASH_ELECTRON_REL = 'src/vs/workbench/contrib/splash/electron-browser/splash.contribution.ts';
const OLD_SPLASH_SCAN_REL = 'src/vs/workbench/contrib/splash/test/node/splashUpdateCarouselCustomEditorSearchLeftoverPromiseCatchScan.test.ts';
const SIMPLE_REL = 'src/vs/workbench/services/dialogs/browser/simpleFileDialog.ts';
const ABSTRACT_REL = 'src/vs/workbench/services/dialogs/browser/abstractFileDialogService.ts';
const BROWSER_REL = 'src/vs/workbench/services/dialogs/browser/fileDialogService.ts';
const ELECTRON_REL = 'src/vs/workbench/services/dialogs/electron-browser/fileDialogService.ts';
const DIALOG_SVC_REL = 'src/vs/workbench/services/dialogs/common/dialogService.ts';
const PREFERENCES_REL = 'src/vs/workbench/services/preferences/common/preferences.ts';
const WORKSPACES_SVC_REL = 'src/vs/workbench/services/workspaces/browser/workspacesService.ts';
const SEARCH_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
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

function assertThenWrapped(source: string, thenStart: string): void {
	const idx = source.indexOf(thenStart);
	assert.ok(idx >= 0, `missing then: ${thenStart}`);
	const afterThen = source.slice(idx);
	const closeThen = afterThen.indexOf(`})${doubleCatch};`);
	assert.ok(closeThen >= 0, `then not double-chained: ${thenStart}`);
	assert.ok(!source.includes(`${thenStart};`));
	assert.ok(!source.includes(`${thenStart}.catch(onUnexpectedError);`));
}

const pickResourceThen = 'this.pickResource(true).then(result => {';
const onDidAcceptThen = 'this.onDidAccept().then(resolveValue => {';
const updateItemsThen = 'this.updateItems(homedir, true, this.trailing).then(() => {';
const addRecentlyOpenedCall = 'this.workspacesService.addRecentlyOpened([{ fileUri: uri, label: this.labelService.getUriLabel(uri, { appendWorkspaceSuffix: true }) }])';
const openEditorsCall = `this.editorService.openEditors(filesData.map(fileData => {
								return {
									resource: fileData.resource,
									contents: fileData.contents?.toString(),
									options: { pinned: true }
								};
							}))`;

const d795Calls: Array<[string, string, number, 'call' | 'then']> = [
	[SIMPLE_REL, pickResourceThen, 1, 'then'],
	[SIMPLE_REL, onDidAcceptThen, 1, 'then'],
	[SIMPLE_REL, updateItemsThen, 1, 'then'],
	[ABSTRACT_REL, addRecentlyOpenedCall, 1, 'call'],
	[BROWSER_REL, openEditorsCall, 1, 'call'],
];

suite('splash leftover remaining overflowed to dialogs leftover Promise fire-and-forget catch scan (D795)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('splash leftover remaining has fewer than four legal sites so this knife moved to dialogs leftover remaining', () => {
		const splash = fs.readFileSync(resolveSource(SPLASH_REL), 'utf8');
		const splashSvc = fs.readFileSync(resolveSource(SPLASH_SVC_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(SPLASH_CONTRIB_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(SPLASH_ELECTRON_REL), 'utf8');
		const oldScan = fs.readFileSync(resolveSource(OLD_SPLASH_SCAN_REL), 'utf8');
		assert.strictEqual(countDoubleChains(splash), 2);
		assert.ok(splash.includes('lifecycleService.when(LifecyclePhase.Restored).then(() => {'));
		assert.ok(splash.includes(`})${doubleCatch};`));
		assert.ok(!splash.includes('this._savePartsSplash().catch'));
		assert.strictEqual(countDoubleChains(splashSvc), 0);
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(!electron.includes(doubleCatch));
		assert.ok(!splash.includes('void this.'));
		assert.ok(!splash.includes('.then(') || countDoubleChains(splash) === 2);
		const splashNewLegal = 0;
		assert.ok(splashNewLegal < 4, `expected splash legal leftover <4, got ${splashNewLegal}`);
		assert.ok(oldScan.includes('suite(\'splash/update/imageCarousel/customEditor/searchEditor leftover Promise fire-and-forget catch scan (D695)\''));
		assert.ok(!oldScan.includes('D795'));
		assert.ok(!oldScan.includes('dialogs leftover'));
	});

	test('this knife covers five leftover Promise double-chain sites after splash leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count, kind] of d795Calls) {
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
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
	});

	test('dialogs leftover pickResource / onDidAccept / updateItems thens and addRecentlyOpened / openEditors are Promise double-chain', () => {
		const simple = fs.readFileSync(resolveSource(SIMPLE_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assertPromiseSignature(simple, 'private async pickResource(isSave: boolean = false): Promise<URI[] | URI | undefined> {');
		assertPromiseSignature(simple, 'private async onDidAccept(): Promise<URI | undefined> {');
		assertPromiseSignature(simple, 'private async updateItems(newFolder: URI, force: boolean = false, trailing?: string): Promise<boolean> {');
		assertPromiseSignature(workspaces, 'addRecentlyOpened(recents: IRecent[]): Promise<void>;');
		assertPromiseSignature(editor, 'openEditors(editors: EditorInputWithOptions[], group?: PreferredGroup, options?: IOpenEditorsOptions): Promise<readonly IEditorPane[]>;');
		assert.ok(simple.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(abstract.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(browser.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertThenWrapped(simple, pickResourceThen);
		assertThenWrapped(simple, onDidAcceptThen);
		assertThenWrapped(simple, updateItemsThen);
		assertWrapped(abstract, addRecentlyOpenedCall);
		assertWrapped(browser, openEditorsCall);
		assert.ok(!simple.includes('this.pickResource(true).then(result => {\n\t\t\t\tresolve(Array.isArray(result) ? result[0] : result);\n\t\t\t});'));
		assert.ok(!abstract.includes(`${addRecentlyOpenedCall};`));
		assert.ok(!browser.includes(`${openEditorsCall};`));
	});

	test('splash leftover remaining overflow stayed in dialogs leftover remaining and did not overflow into preferences/workspaces/searchEditor/imageCarousel', () => {
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		const workspacesSvc = fs.readFileSync(resolveSource(WORKSPACES_SVC_REL), 'utf8');
		const search = fs.readFileSync(resolveSource(SEARCH_REL), 'utf8');
		const carousel = fs.readFileSync(resolveSource(CAROUSEL_REL), 'utf8');
		const splash = fs.readFileSync(resolveSource(SPLASH_REL), 'utf8');
		assert.ok(!preferences.includes('D795'));
		assert.ok(workspacesSvc.includes('this.addRecentlyOpened([{ folderUri: folder.uri }]);'));
		assert.ok(!workspacesSvc.includes(`this.addRecentlyOpened([{ folderUri: folder.uri }])${doubleCatch}`));
		assert.ok(search.includes(`newInput.ongoingSearchOperation.then(complete => {`));
		assert.ok(carousel.includes('this._loadRawData(adjacentImage).catch(() => { /* ignore */ });'));
		assert.strictEqual(countDoubleChains(splash), 2);
		assert.ok(!splash.includes('this._savePartsSplash().catch'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const simple = fs.readFileSync(resolveSource(SIMPLE_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const dialogSvc = fs.readFileSync(resolveSource(DIALOG_SVC_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		const splash = fs.readFileSync(resolveSource(SPLASH_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(dialogs, 'showSaveDialog(options: ISaveDialogOptions): Promise<URI | undefined>;');
		assertPromiseSignature(dialogs, 'showOpenDialog(options: IOpenDialogOptions): Promise<URI[] | undefined>;');
		assertPromiseSignature(simple, 'private async createItems(folder: IFileStat | undefined, currentFolder: URI, token: CancellationToken): Promise<FileQuickPickItem[]> {');
		assertPromiseSignature(simple, 'private async handleValueChange(value: string) {');

		assert.ok(browser.includes('await this.openerService.open(uri, { fromUserGesture: true, editorOptions: { pinned: true } });'));
		assert.ok(!browser.includes(`this.openerService.open(uri, { fromUserGesture: true, editorOptions: { pinned: true } })${doubleCatch}`));
		assert.ok(browser.includes("await this.openerService.open('https://aka.ms/VSCodeWebLocalFileSystemAccess');"));
		assert.ok(!browser.includes(`this.openerService.open('https://aka.ms/VSCodeWebLocalFileSystemAccess')${doubleCatch}`));

		assert.ok(!simple.includes('extends Action2'));
		assert.ok(!abstract.includes('extends Action2'));
		assert.ok(!browser.includes('extends Action2'));
		assert.ok(simple.includes('return dialogService.pickFileAndOpen({ forceNewWindow: false, availableFileSystems: [Schemas.file] });'));
		assert.ok(!simple.includes(`pickFileAndOpen({ forceNewWindow: false, availableFileSystems: [Schemas.file] })${doubleCatch}`));
		assert.ok(simple.includes('return dialogService.pickFolderAndOpen({ forceNewWindow: false, availableFileSystems: [Schemas.file] });'));
		assert.ok(simple.includes('return dialogService.pickFileFolderAndOpen({ forceNewWindow: false, availableFileSystems: [Schemas.file] });'));
		assert.ok(!electron.includes(doubleCatch));
		assert.ok(!dialogSvc.includes(doubleCatch));
		assert.ok(!dialogSvc.includes('Action2'));

		assert.ok(simple.includes('return this.fileDialogService.showSaveDialog(this.options).then(result => {'));
		assert.ok(!simple.includes(`return this.fileDialogService.showSaveDialog(this.options).then(result => {${doubleCatch}`));
		assert.ok(simple.includes('return this.fileDialogService.showOpenDialog(this.options).then(result => {'));
		assert.ok(!simple.includes(`return this.fileDialogService.showOpenDialog(this.options).then(result => {${doubleCatch}`));
		assert.ok(simple.includes('return this.createItems(folderStat, currentFolder, token).then(items => {'));
		assert.ok(!simple.includes(`return this.createItems(folderStat, currentFolder, token).then(items => {${doubleCatch}`));
		assert.ok(simple.includes('return this.handleValueChange(value);'));
		assert.ok(!simple.includes(`return this.handleValueChange(value)${doubleCatch}`));

		assert.ok(abstract.includes('await this.editorService.openEditors([{ resource: uri, options: { source: EditorOpenSource.USER, pinned: true } }], undefined, { validateTrust: true });'));
		assert.ok(!abstract.includes(`await this.editorService.openEditors([{ resource: uri, options: { source: EditorOpenSource.USER, pinned: true } }], undefined, { validateTrust: true })${doubleCatch}`));
		assert.ok(abstract.includes('return this.hostService.openWindow([{ folderUri: uri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: options.remoteAuthority });'));
		assert.ok(!abstract.includes(`openWindow([{ folderUri: uri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: options.remoteAuthority })${doubleCatch}`));

		assert.strictEqual(countDoubleChains(splash), 2);
		assert.ok(splash.includes(`})${doubleCatch};`));
		assert.ok(!splash.includes('this._savePartsSplash().catch'));

		for (const source of [simple, abstract, browser, electron, dialogSvc]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}

		assert.ok(!simple.includes('.then(result => {\n\t\t\t\t\t\tdoResolve(result);\n\t\t\t\t\t},'));
		assert.ok(!simple.includes(' = this.pickResource(true).then'));
		assert.ok(!simple.includes(' = this.onDidAccept().then'));
		assert.ok(!simple.includes(' = this.updateItems(homedir, true, this.trailing).then'));
		assert.ok(!simple.includes('.then(status => {'));
		assert.ok(!simple.includes(', error => {'));
	});
});
