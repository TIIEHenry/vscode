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
const SERVICE_REL = 'src/vs/workbench/contrib/snippets/browser/snippetsService.ts';
const FILE_REL = 'src/vs/workbench/contrib/snippets/browser/snippetsFile.ts';
const CONFIGURE_REL = 'src/vs/workbench/contrib/snippets/browser/commands/configureSnippets.ts';
const INSERT_REL = 'src/vs/workbench/contrib/snippets/browser/commands/insertSnippet.ts';
const TEMPLATE_REL = 'src/vs/workbench/contrib/snippets/browser/commands/fileTemplateSnippets.ts';
const TAB_REL = 'src/vs/workbench/contrib/snippets/browser/tabCompletion.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countWrapped(source: string, call: string): number {
	const needle = `${call}${doubleCatch}`;
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

const initUser = 'this._initUserSnippets()';
const initFolder = 'this._initFolderSnippets(SnippetSource.Workspace, snippetFolder, bucket)';
const addFolder = 'addFolderSnippets()';
const loadIgnore = 'file.load().catch(_err => { /*ignore*/ })';

const d765Calls: Array<[string, string, number]> = [
	[SERVICE_REL, initUser, 1],
	[SERVICE_REL, initFolder, 2],
	[SERVICE_REL, addFolder, 2],
	[SERVICE_REL, loadIgnore, 1],
];

suite('Snippets leftover remaining Promise fire-and-forget catch scan (D765)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers six leftover Promise double-chain sites', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d765Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 6);
		assert.ok(sites >= 4);
		assert.strictEqual(countDoubleChains(seen.get(SERVICE_REL)!), 6);
	});

	test('leftover _initUserSnippets / _initFolderSnippets fire-and-forgets are Promise double-chain; tracked Restored then stays skipped', () => {
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assertPromiseSignature(service, 'private async _initUserSnippets(): Promise<any> {');
		assertPromiseSignature(service, 'private _initFolderSnippets(source: SnippetSource, folder: URI, bucket: DisposableStore): Promise<any> {');
		assert.ok(service.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(service.includes(`this._trackPendingWork(Promise.resolve(lifecycleService.when(LifecyclePhase.Restored).then(() => {
			this._initExtensionSnippets();
			${initUser}${doubleCatch};
			this._initWorkspaceSnippets();
		})));`));
		assert.ok(!service.includes(`this._initExtensionSnippets();
			this._initUserSnippets();
			this._initWorkspaceSnippets();`));
		assert.ok(!service.includes(`lifecycleService.when(LifecyclePhase.Restored).then(() => {
			this._initExtensionSnippets();
			${initUser}${doubleCatch};
			this._initWorkspaceSnippets();
		})${doubleCatch}`));
		assert.strictEqual(countWrapped(service, initFolder), 2);
		assert.ok(service.includes(`if (value) {
				${initFolder}${doubleCatch};
			}`));
		assert.ok(service.includes(`if (e.contains(snippetFolder, FileChangeType.ADDED)) {
						${initFolder}${doubleCatch};
					}`));
		assert.ok(!service.includes(`${initFolder};`));
	});

	test('leftover addFolderSnippets / getSnippetsSync file.load fire-and-forgets are Promise double-chain; return addFolderSnippets stays skipped', () => {
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const snippetFile = fs.readFileSync(resolveSource(FILE_REL), 'utf8');
		assertPromiseSignature(snippetFile, 'load(): Promise<this> {');
		assertPromiseSignature(service, 'const addFolderSnippets = async () => {');
		assert.ok(service.includes(`if (resources.isEqualOrParent(e.model.resource, folder)) {
				${addFolder}${doubleCatch};
			}`));
		assert.ok(service.includes(`bucket.add(watch(this._fileService, folder, () => {
			${addFolder}${doubleCatch};
		}));`));
		assert.strictEqual(countWrapped(service, addFolder), 2);
		assert.ok(service.includes(`return ${addFolder};`));
		assert.ok(!service.includes(`return ${addFolder}${doubleCatch}`));
		assert.ok(service.includes(`${loadIgnore}${doubleCatch};`));
		assert.ok(!service.includes(`${loadIgnore};`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / Watch / Resolve / Connect / Pty / D145 stay skipped', () => {
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const snippetFile = fs.readFileSync(resolveSource(FILE_REL), 'utf8');
		const configure = fs.readFileSync(resolveSource(CONFIGURE_REL), 'utf8');
		const insert = fs.readFileSync(resolveSource(INSERT_REL), 'utf8');
		const template = fs.readFileSync(resolveSource(TEMPLATE_REL), 'utf8');
		const tab = fs.readFileSync(resolveSource(TAB_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(files.includes('watch(resource: URI, options?: IWatchOptionsWithoutCorrelation): IDisposable;'));
		assertPromiseSignature(files, 'resolve(resource: URI, options?: IResolveFileOptions): Promise<IFileStat>;');
		assert.ok(configure.includes('async run(accessor: ServicesAccessor): Promise<any> {'));
		assert.ok(configure.includes('await opener.open(resource);'));
		assert.ok(!configure.includes('await opener.open(resource).catch'));
		assert.ok(configure.includes('return opener.open(pick.filepath);'));
		assert.ok(!configure.includes(`return opener.open(pick.filepath)${doubleCatch}`));
		assert.ok(configure.includes('return createSnippetFile((pick as SnippetPick).scope, (pick as SnippetPick).uri, quickInputService, fileService, textFileService, opener);'));
		assert.ok(!configure.includes(`return createSnippetFile((pick as SnippetPick).scope, (pick as SnippetPick).uri, quickInputService, fileService, textFileService, opener)${doubleCatch}`));
		assert.ok(template.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(!template.includes(`async run(accessor: ServicesAccessor): Promise<void> {${doubleCatch}`));

		assert.ok(snippetFile.includes('this._loadPromise = Promise.resolve(this._load()).then(content => {'));
		assert.ok(!snippetFile.includes(`this._loadPromise = Promise.resolve(this._load()).then(content => {${doubleCatch}`));

		assert.ok(service.includes(`		work.then(
			() => this._pendingWork.delete(work),
			error => {
				this._pendingWork.delete(work);
				this._logService.error(error);
			}
		);`));
		assert.ok(!service.includes(`work.then(
			() => this._pendingWork.delete(work),
			error => {
				this._pendingWork.delete(work);
				this._logService.error(error);
			}
		)${doubleCatch}`));
		assert.ok(service.includes(`							file.load().then(file => {`));
		assert.ok(service.includes(`							}, err => {`));
		assert.ok(!service.includes(`file.load().then(file => {${doubleCatch}`));
		assert.ok(insert.includes('.then(resolve, reject);'));
		assert.ok(!insert.includes(`.then(resolve, reject)${doubleCatch}`));

		assert.ok(service.includes('promises.push(file.load()'));
		assert.ok(!service.includes(`promises.push(file.load()${doubleCatch}`));
		assert.ok(service.includes('this._trackPendingWork(this._initWorkspaceFolderSnippets(this._contextService.getWorkspace(), disposables));'));
		assert.ok(!service.includes(`this._trackPendingWork(this._initWorkspaceFolderSnippets(this._contextService.getWorkspace(), disposables))${doubleCatch}`));
		assert.ok(service.includes('this._trackPendingWork(updateUserSnippets());'));
		assert.ok(!service.includes(`this._trackPendingWork(updateUserSnippets())${doubleCatch}`));
		assert.ok(tab.includes('handler: x => x.performSnippetCompletions(),'));
		assert.ok(!tab.includes(`handler: x => x.performSnippetCompletions()${doubleCatch}`));

		assert.ok(service.includes('service.watch(resource),'));
		assert.ok(!service.includes('service.watch(resource).catch'));
		assert.ok(service.includes('bucket.add(watch(this._fileService, folder, () => {'));
		assert.ok(!service.includes(`watch(this._fileService, folder, () => {${doubleCatch}`));
		assert.ok(!service.includes(`watch(this._fileService, folder, addFolderSnippets)${doubleCatch}`));
		assert.ok(service.includes('const stat = await this._fileService.resolve(folder);'));
		assert.ok(!service.includes(`this._fileService.resolve(folder)${doubleCatch}`));

		for (const source of [service, snippetFile, configure, insert, template, tab]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
