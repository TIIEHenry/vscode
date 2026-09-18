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
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const VIEWS_REL = 'src/vs/workbench/services/views/common/viewsService.ts';
const QUICK_INPUT_REL = 'src/vs/platform/quickinput/common/quickInput.ts';
const INPUT_REL = 'src/vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughInput.ts';
const PART_REL = 'src/vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughPart.ts';
const EDITOR_WALK_REL = 'src/vs/workbench/contrib/welcomeWalkthrough/browser/editor/editorWalkThrough.ts';
const PROVIDER_REL = 'src/vs/workbench/contrib/welcomeWalkthrough/common/walkThroughContentProvider.ts';
const URL_VALIDATOR_REL = 'src/vs/workbench/contrib/url/browser/trustedDomainsValidator.ts';
const URL_CONTRIB_REL = 'src/vs/workbench/contrib/url/browser/url.contribution.ts';
const WEBVIEW_PANE_REL = 'src/vs/workbench/contrib/webviewView/browser/webviewViewPane.ts';
const WEBVIEW_SVC_REL = 'src/vs/workbench/contrib/webviewView/browser/webviewViewService.ts';
const WORKSPACES_REL = 'src/vs/workbench/contrib/workspaces/browser/workspaces.contribution.ts';
const PRUNER_REL = 'src/vs/workbench/contrib/workspaces/browser/recentRemoteFolderPruner.ts';
const TIMER_REL = 'src/vs/workbench/services/timer/browser/timerService.ts';
const RESOLVER_REL = 'src/vs/workbench/services/configurationResolver/browser/baseConfigurationResolverService.ts';
const USER_DATA_PROFILE_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts';

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
	const closeThen = afterThen.indexOf(`})${doubleCatch}`);
	assert.ok(closeThen >= 0, `then not double-chained: ${thenStart}`);
	assert.ok(!source.includes(`${thenStart};`));
	assert.ok(!source.includes(`${thenStart}.catch(onUnexpectedError);`));
}

const disposeThen = 'this.promise.then(model => model.dispose())';
const withProgressEnd = `await this.webviewViewService.resolve(this.id, webviewView, source.token);
		})`;
const openViewCall = 'this.viewService.openView(this.id, !preserveFocus)';
const findWorkspacesCall = 'this.findWorkspaces()';
const openWorkspaceFileCall = 'this.hostService.openWindow([{ workspaceUri: joinPath(folder, workspaceFile) }])';
const pickThen = `{ placeHolder: localize('selectToOpen', "Select a workspace to open") }).then(pick => {`;
const openPickCall = 'this.hostService.openWindow([{ workspaceUri: joinPath(folder, pick.label) }])';

const d799Calls: Array<[string, string, number, 'call' | 'then']> = [
	[INPUT_REL, disposeThen, 1, 'call'],
	[WEBVIEW_PANE_REL, withProgressEnd, 1, 'call'],
	[WEBVIEW_PANE_REL, openViewCall, 1, 'call'],
	[WORKSPACES_REL, findWorkspacesCall, 1, 'call'],
	[WORKSPACES_REL, openWorkspaceFileCall, 1, 'call'],
	[WORKSPACES_REL, pickThen, 1, 'then'],
	[WORKSPACES_REL, openPickCall, 1, 'call'],
];

suite('welcomeWalkthrough leftover remaining overflowed to webviewView/workspaces leftover Promise fire-and-forget catch scan (D799)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('welcomeWalkthrough leftover remaining has fewer than four legal sites so this knife moved past url to webviewView and workspaces', () => {
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const part = fs.readFileSync(resolveSource(PART_REL), 'utf8');
		const editorWalk = fs.readFileSync(resolveSource(EDITOR_WALK_REL), 'utf8');
		const provider = fs.readFileSync(resolveSource(PROVIDER_REL), 'utf8');
		const urlValidator = fs.readFileSync(resolveSource(URL_VALIDATOR_REL), 'utf8');
		const urlContrib = fs.readFileSync(resolveSource(URL_CONTRIB_REL), 'utf8');
		const walkthroughLegal = countIncludes(input, `${disposeThen}${doubleCatch}`);
		assert.ok(walkthroughLegal < 4, `expected welcomeWalkthrough legal leftover <4, got ${walkthroughLegal}`);
		assert.strictEqual(walkthroughLegal, 1);
		assert.strictEqual(countDoubleChains(input), 1);
		assert.strictEqual(countDoubleChains(part), 0);
		assert.strictEqual(countDoubleChains(editorWalk), 0);
		assert.strictEqual(countDoubleChains(provider), 0);
		assert.strictEqual(countDoubleChains(urlValidator), 1);
		assert.ok(urlValidator.includes(`this._clipboardService.writeText(typeof originalResource === 'string' ? originalResource : resourceUri.toString(true))${doubleCatch}`));
		assert.ok(!urlContrib.includes(doubleCatch));
		assert.ok(urlContrib.includes('return quickInputService.input({ prompt: localize(\'urlToOpen\', "URL to open"), value }).then(input => {'));
	});

	test('this knife covers seven leftover Promise double-chain sites after welcomeWalkthrough leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count, kind] of d799Calls) {
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
		assert.strictEqual(sites, 7);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		const input = seen.get(INPUT_REL) ?? fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const pane = seen.get(WEBVIEW_PANE_REL) ?? fs.readFileSync(resolveSource(WEBVIEW_PANE_REL), 'utf8');
		const workspaces = seen.get(WORKSPACES_REL) ?? fs.readFileSync(resolveSource(WORKSPACES_REL), 'utf8');
		assert.strictEqual(countDoubleChains(input), 1);
		assert.strictEqual(countDoubleChains(pane), 2);
		assert.strictEqual(countDoubleChains(workspaces), 4);
	});

	test('welcomeWalkthrough leftover dispose then is Promise double-chain; assigned / returned / Action2 / opener stay skipped', () => {
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const part = fs.readFileSync(resolveSource(PART_REL), 'utf8');
		const editorWalk = fs.readFileSync(resolveSource(EDITOR_WALK_REL), 'utf8');
		const provider = fs.readFileSync(resolveSource(PROVIDER_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		assertPromiseSignature(input, 'override resolve(): Promise<WalkThroughModel> {');
		assertPromiseSignature(input, 'private promise: Promise<WalkThroughModel> | null = null;');
		assertPromiseSignature(part, 'override setInput(input: WalkThroughInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {');
		assertPromiseSignature(editorWalk, 'public override run(serviceAccessor: ServicesAccessor): Promise<void> {');
		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(input.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(input, disposeThen);
		assert.ok(!input.includes('this.promise.then(model => model.dispose());'));
		assert.ok(input.includes('this.promise = moduleToContent(this.instantiationService, this.options.resource)'));
		assert.ok(!input.includes(`this.promise = moduleToContent(this.instantiationService, this.options.resource)${doubleCatch}`));
		assert.ok(input.includes('return this.promise;'));
		assert.ok(!input.includes(`return this.promise${doubleCatch}`));
		assert.ok(part.includes('this.openerService.open(this.addFrom(uri), { allowCommands: true });'));
		assert.ok(!part.includes(`this.openerService.open(this.addFrom(uri), { allowCommands: true })${doubleCatch}`));
		assert.ok(part.includes('return super.setInput(input, options, context, token)'));
		assert.ok(!part.includes(doubleCatch));
		assert.ok(editorWalk.includes('return editorService.openEditor(input, { pinned: true })'));
		assert.ok(!editorWalk.includes(doubleCatch));
		assert.ok(provider.includes('ongoing = moduleToContent(this.instantiationService, resource)'));
		assert.ok(!provider.includes(doubleCatch));
	});

	test('webviewView leftover withProgress / openView are Promise double-chain; resolver.resolve then stays skipped', () => {
		const pane = fs.readFileSync(resolveSource(WEBVIEW_PANE_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(WEBVIEW_SVC_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		assertPromiseSignature(pane, 'private async withProgress(task: () => Promise<void>): Promise<void> {');
		assertPromiseSignature(views, 'openView<T extends IView>(id: string, focus?: boolean): Promise<T | null>;');
		assertPromiseSignature(service, 'resolve(webviewView: WebviewView, cancellation: CancellationToken): Promise<void>;');
		assertPromiseSignature(service, 'resolve(viewType: string, webview: WebviewView, cancellation: CancellationToken): Promise<void>;');
		assert.ok(pane.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(pane, withProgressEnd);
		assertWrapped(pane, openViewCall);
		assert.ok(pane.includes('this.withProgress(async () => {'));
		assert.ok(pane.includes(`${withProgressEnd}${doubleCatch};`));
		assert.ok(!pane.includes('this.viewService.openView(this.id, !preserveFocus);'));
		assert.ok(pane.includes('await this.webviewViewService.resolve(this.id, webviewView, source.token);'));
		assert.ok(!pane.includes(`await this.webviewViewService.resolve(this.id, webviewView, source.token)${doubleCatch}`));
		assert.ok(service.includes('resolver.resolve(pending.webview, CancellationToken.None).then(() => {'));
		assert.ok(!service.includes(doubleCatch));
	});

	test('workspaces leftover findWorkspaces / pick then / openWindow fire-and-forgets are Promise double-chain', () => {
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const quickInput = fs.readFileSync(resolveSource(QUICK_INPUT_REL), 'utf8');
		assertPromiseSignature(workspaces, 'private async findWorkspaces(): Promise<void> {');
		assertPromiseSignature(host, 'openWindow(toOpen: IWindowOpenable[], options?: IOpenWindowOptions): Promise<void>;');
		assertPromiseSignature(quickInput, 'pick<T extends IQuickPickItem>(picks: Promise<QuickPickInput<T>[]> | QuickPickInput<T>[], options?: Omit<IPickOptions<T>, \'canPickMany\'>, token?: CancellationToken): Promise<T | undefined>;');
		assert.ok(workspaces.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(workspaces, findWorkspacesCall);
		assertWrapped(workspaces, openWorkspaceFileCall);
		assertThenWrapped(workspaces, pickThen);
		assertWrapped(workspaces, openPickCall);
		assert.ok(!workspaces.includes('\t\tthis.findWorkspaces();\n'));
		assert.ok(workspaces.includes('return hostService.openWindow([{ workspaceUri: uri }]);'));
		assert.ok(!workspaces.includes(`return hostService.openWindow([{ workspaceUri: uri }])${doubleCatch}`));
	});

	test('welcomeWalkthrough leftover remaining overflow stayed in webviewView/workspaces and did not overflow into configurationResolver/timer/userDataProfile', () => {
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const timer = fs.readFileSync(resolveSource(TIMER_REL), 'utf8');
		const userDataProfile = fs.readFileSync(resolveSource(USER_DATA_PROFILE_REL), 'utf8');
		const pruner = fs.readFileSync(resolveSource(PRUNER_REL), 'utf8');
		assert.ok(!resolver.includes(doubleCatch));
		assert.ok(timer.includes('Promise.all(['));
		assert.ok(!timer.includes(doubleCatch));
		assert.ok(!userDataProfile.includes('D799'));
		assert.ok(pruner.includes('pruneRecentRemoteFolderIfMissing(contextService, fileService, workspacesService).catch(error => {'));
		assert.ok(!pruner.includes(`pruneRecentRemoteFolderIfMissing(contextService, fileService, workspacesService)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const part = fs.readFileSync(resolveSource(PART_REL), 'utf8');
		const editorWalk = fs.readFileSync(resolveSource(EDITOR_WALK_REL), 'utf8');
		const provider = fs.readFileSync(resolveSource(PROVIDER_REL), 'utf8');
		const urlValidator = fs.readFileSync(resolveSource(URL_VALIDATOR_REL), 'utf8');
		const urlContrib = fs.readFileSync(resolveSource(URL_CONTRIB_REL), 'utf8');
		const pane = fs.readFileSync(resolveSource(WEBVIEW_PANE_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(WEBVIEW_SVC_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');

		assert.ok(part.includes('this.openerService.open(this.addFrom(uri), { allowCommands: true });'));
		assert.ok(!part.includes(`this.openerService.open(this.addFrom(uri), { allowCommands: true })${doubleCatch}`));
		assert.ok(urlContrib.includes('urlService.open(uri, { originalUrl: input });'));
		assert.ok(!urlContrib.includes(`urlService.open(uri, { originalUrl: input })${doubleCatch}`));

		assert.ok(editorWalk.includes('public override run(serviceAccessor: ServicesAccessor): Promise<void> {'));
		assert.ok(editorWalk.includes('return editorService.openEditor(input, { pinned: true })'));
		assert.ok(!editorWalk.includes(doubleCatch));
		assert.ok(urlContrib.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(urlContrib.includes('return quickInputService.input({ prompt: localize(\'urlToOpen\', "URL to open"), value }).then(input => {'));
		assert.ok(!urlContrib.includes(doubleCatch));
		assert.ok(workspaces.includes('async run(accessor: ServicesAccessor, uri: URI): Promise<void> {'));
		assert.ok(workspaces.includes('return hostService.openWindow([{ workspaceUri: uri }]);'));

		assert.ok(input.includes('this.promise = moduleToContent(this.instantiationService, this.options.resource)'));
		assert.ok(provider.includes('ongoing = moduleToContent(this.instantiationService, resource)'));
		assert.ok(part.includes('return super.setInput(input, options, context, token)'));

		assert.ok(urlValidator.includes(`this._clipboardService.writeText(typeof originalResource === 'string' ? originalResource : resourceUri.toString(true))${doubleCatch}`));
		assert.ok(!urlValidator.includes(`this._clipboardService.writeText(typeof originalResource === 'string' ? originalResource : resourceUri.toString(true)).catch(onUnexpectedError);`));

		assert.ok(service.includes('resolver.resolve(pending.webview, CancellationToken.None).then(() => {'));
		assert.ok(!service.includes(`resolver.resolve(pending.webview, CancellationToken.None).then(() => {${doubleCatch}`));
		assert.ok(!service.includes(doubleCatch));

		assert.ok(editorWalk.includes('.then(() => void (0));'));
		assert.ok(!editorWalk.includes(`.then(() => void (0))${doubleCatch}`));

		for (const source of [input, part, editorWalk, provider, urlValidator, urlContrib, pane, service, workspaces]) {
			assert.ok(!source.includes('.then(undefined,'));
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
