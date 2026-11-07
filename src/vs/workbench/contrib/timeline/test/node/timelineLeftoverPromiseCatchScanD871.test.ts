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
const PANE_REL = 'src/vs/workbench/contrib/timeline/browser/timelinePane.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/timeline/common/timelineService.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/timeline/browser/timeline.contribution.ts';
const LAYOUT_REL = 'src/vs/workbench/browser/layout.ts';
const ACCOUNTS_BAR_REL = 'src/vs/workbench/browser/parts/globalCompositeBar.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const EDITORS_OBSERVER_REL = 'src/vs/workbench/browser/parts/editor/editorsObserver.ts';
const KEYBINDINGS_REL = 'src/vs/workbench/contrib/preferences/browser/keybindingsEditor.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/preferences/browser/preferencesWidgets.ts';

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
	assert.ok(source.includes(`${call}.catch(onUnexpectedError)`), `missing catch: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}.catch(onUnexpectedError);`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}${doubleCatch}`));
}

const sidebarCall = 'this.openViewContainer(ViewContainerLocation.Sidebar, viewletToOpen)';
const panelCall = 'this.openViewContainer(ViewContainerLocation.Panel, panelToOpen, !skipLayout)';
const auxCall = 'this.openViewContainer(ViewContainerLocation.AuxiliaryBar, viewletToOpen, !skipLayout)';
const runCall = 'this.run()';
const initializeCall = 'this.initialize()';
const resetLoadCall = 'this.loadTimeline(true)';
const leftoverLoadForSourceCall = 'this.loadTimelineForSource(source.id, uri, true)';
const leftoverDoRefreshRootCall = 'this.doRefresh([this.root])';
const leftoverDoRefreshElementsCall = 'this.doRefresh(this.elementsToRefresh)';
const leftoverTreeRefreshCall = '\t\t\tthis.refresh();\n';
const leftoverLoadStateCall = '\t\tthis.loadState();\n';
const leftoverEnsureLimitCall = 'this.ensureOpenedEditorsLimit(exclude)';
const leftoverEnsureOpenCall = 'this.ensureOpenedEditorsLimit({ groupId: group.id, editor: e.editor }, group.id)';
const leftoverActionDefineCall = 'run: () => this.defineKeybinding(keybindingItemEntry, false)';
const leftoverSetInputThenCall = '.then(() => this.render(!!(options && options.preserveFocus)))';
const leftoverFolderUpdateCall = '\t\tthis._folder = folder;\n\t\tthis.update();\n';

const d871Calls: Array<[string, string, number]> = [
	[LAYOUT_REL, sidebarCall, 1],
	[LAYOUT_REL, panelCall, 1],
	[LAYOUT_REL, auxCall, 1],
	[ACCOUNTS_BAR_REL, runCall, 3],
	[ACCOUNTS_BAR_REL, initializeCall, 1],
];

suite('leftover remaining unused after timeline leftover remaining unused after already-double overflowed to unused leftover remaining unused workbench leftover remaining unused Promise fire-and-forget catch scan (D871)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused timeline leftover remaining unused after already-double after discarding collision overflow had fewer than four legal unused leftover sites so this knife overflowed', () => {
		const pane = fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		assertPromiseSignature(pane, 'private async loadTimeline(reset: boolean, sources?: string[]) {');
		assertPromiseSignature(pane, 'private async handleRequest(request: TimelineRequest) {');
		assert.ok(pane.includes(`${resetLoadCall}.catch(onUnexpectedError)`));
		assert.ok(service.includes(`this.viewsService.openView(TimelinePaneId, true).catch(onUnexpectedError)`));
		assert.strictEqual(countDoubleChains(pane), 0);
		assert.strictEqual(countDoubleChains(service), 0);
		assert.ok(pane.includes(`${leftoverLoadForSourceCall};`));
		assert.ok(!pane.includes(`${leftoverLoadForSourceCall}${doubleCatch}`));
		assert.ok(pane.includes('\tprivate loadTimelineForSource(source: string, uri: URI, reset: boolean, options?: TimelineOptions) {'));
		assert.ok(pane.includes('\tprivate refresh() {'));
		assert.ok(pane.includes('\t\tthis.refresh();\n') || pane.includes('\t\t\tthis.refresh();\n'));
		assert.ok(!pane.includes(`this.refresh()${doubleCatch}`));
		assert.ok(pane.includes('run(accessor: ServicesAccessor, ...args: unknown[]) {'));
		assert.ok(pane.includes('pane.reset();'));
		assert.ok(!pane.includes(`pane.reset()${doubleCatch}`));
		assert.ok(contrib.includes('return service.setUri(arg);'));
		assert.ok(!contrib.includes(doubleCatch));
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused timeline legal leftover <4, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!pane.includes('D871'));
		assert.ok(!service.includes('D871'));
		assert.ok(!contrib.includes('D871'));
	});

	test('this knife covers seven leftover Promise double-chain sites after leftover remaining unused after timeline leftover remaining unused overflowed to unused leftover remaining unused workbench leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d871Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}.catch(onUnexpectedError)`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 7);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countIncludes(seen.get(LAYOUT_REL) ?? '', `${sidebarCall}.catch(onUnexpectedError)`), 1);
		assert.strictEqual(countIncludes(seen.get(LAYOUT_REL) ?? '', `${panelCall}.catch(onUnexpectedError)`), 1);
		assert.strictEqual(countIncludes(seen.get(LAYOUT_REL) ?? '', `${auxCall}.catch(onUnexpectedError)`), 1);
		assert.strictEqual(countIncludes(seen.get(ACCOUNTS_BAR_REL) ?? '', `${runCall}.catch(onUnexpectedError)`), 3);
		assert.strictEqual(countIncludes(seen.get(ACCOUNTS_BAR_REL) ?? '', `${initializeCall}.catch(onUnexpectedError)`), 1);
		assert.strictEqual(countDoubleChains(seen.get(LAYOUT_REL) ?? ''), 0);
		assert.strictEqual(countDoubleChains(seen.get(ACCOUNTS_BAR_REL) ?? ''), 0);
	});

	test('unused leftover remaining unused workbench leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const accounts = fs.readFileSync(resolveSource(ACCOUNTS_BAR_REL), 'utf8');
		assertPromiseSignature(layout, 'private async openViewContainer(location: ViewContainerLocation, id: string, focus?: boolean): Promise<void> {');
		assertPromiseSignature(accounts, 'private async run(): Promise<void> {');
		assertPromiseSignature(accounts, 'private async initialize(): Promise<void> {');
		assert.ok(layout.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assert.ok(accounts.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertWrapped(layout, sidebarCall);
		assertWrapped(layout, panelCall);
		assertWrapped(layout, auxCall);
		assertWrapped(accounts, runCall);
		assertWrapped(accounts, initializeCall);
		assert.ok(!layout.includes('\t\t\t\tthis.openViewContainer(ViewContainerLocation.Sidebar, viewletToOpen);\n'));
		assert.ok(!layout.includes('\t\t\t\tthis.openViewContainer(ViewContainerLocation.Panel, panelToOpen, !skipLayout);\n'));
		assert.ok(!layout.includes('\t\t\t\tthis.openViewContainer(ViewContainerLocation.AuxiliaryBar, viewletToOpen, !skipLayout);\n'));
		assert.ok(layout.includes('await this.openViewContainer(ViewContainerLocation.Sidebar, this.state.initialization.views.containerToRestore.sideBar);'));
		assert.ok(!layout.includes(`await this.openViewContainer(ViewContainerLocation.Sidebar, this.state.initialization.views.containerToRestore.sideBar)${doubleCatch}`));
		assert.ok(!accounts.includes('\t\t\t\tthis.run();\n'));
		assert.ok(!accounts.includes('\t\t\tthis.run();\n'));
		assert.ok(!accounts.includes('\t\tthis.initialize();\n'));
		assert.ok(!layout.includes(`await ${sidebarCall}${doubleCatch}`));
		assert.ok(!accounts.includes(`await ${runCall}${doubleCatch}`));
		assert.ok(!accounts.includes(`await ${initializeCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const accounts = fs.readFileSync(resolveSource(ACCOUNTS_BAR_REL), 'utf8');
		const pane = fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const keybindings = fs.readFileSync(resolveSource(KEYBINDINGS_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const observer = fs.readFileSync(resolveSource(EDITORS_OBSERVER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(layout, 'private async openViewContainer(location: ViewContainerLocation, id: string, focus?: boolean): Promise<void> {');

		assert.ok(!layout.includes('openerService.open('));
		assert.ok(!accounts.includes('openerService.open('));
		assert.ok(pane.includes('run(accessor: ServicesAccessor, ...args: unknown[]) {'));
		assert.ok(pane.includes('pane.reset();'));
		assert.ok(!pane.includes(`pane.reset()${doubleCatch}`));
		assert.ok(contrib.includes('return service.setUri(arg);'));
		assert.ok(!contrib.includes(`return service.setUri(arg)${doubleCatch}`));
		assert.ok(keybindings.includes(`${leftoverActionDefineCall}`));
		assert.ok(!keybindings.includes(`${leftoverActionDefineCall}${doubleCatch}`));
		assert.ok(keybindings.includes(`${leftoverSetInputThenCall};`));
		assert.ok(!keybindings.includes(`${leftoverSetInputThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(leftoverFolderUpdateCall));
		assert.ok(!widgets.includes(`this._folder = folder;\n\t\tthis.update()${doubleCatch}`));
		assert.ok(treeView.includes(`${leftoverDoRefreshRootCall};`) || treeView.includes(`${leftoverDoRefreshRootCall} /** soft refresh **/`));
		assert.ok(!treeView.includes(`${leftoverDoRefreshRootCall}${doubleCatch}`));
		assert.ok(treeView.includes(`${leftoverDoRefreshElementsCall};`));
		assert.ok(!treeView.includes(`${leftoverDoRefreshElementsCall}${doubleCatch}`));
		assert.ok(treeView.includes(leftoverTreeRefreshCall));
		assert.ok(!treeView.includes(`this.refresh()${doubleCatch}`));
		assert.ok(observer.includes(leftoverLoadStateCall));
		assert.ok(!observer.includes(`this.loadState()${doubleCatch}`));
		assert.ok(observer.includes(`${leftoverEnsureLimitCall};`));
		assert.ok(!observer.includes(`${leftoverEnsureLimitCall}${doubleCatch}`));
		assert.ok(observer.includes(`${leftoverEnsureOpenCall};`));
		assert.ok(!observer.includes(`${leftoverEnsureOpenCall}${doubleCatch}`));
		assert.ok(observer.includes('await this.ensureOpenedEditorsLimit(exclude, group.id);'));
		assert.ok(!observer.includes(`await this.ensureOpenedEditorsLimit(exclude, group.id)${doubleCatch}`));
		assert.ok(treeView.includes('return this.doRefresh(elements.concat(affectedElements));'));
		assert.ok(!treeView.includes(`return this.doRefresh(elements.concat(affectedElements))${doubleCatch}`));

		for (const source of [layout, accounts, pane, contrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D871'));
		}
	});

});
