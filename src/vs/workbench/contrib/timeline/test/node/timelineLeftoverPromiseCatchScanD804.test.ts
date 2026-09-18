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
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const VIEWS_REL = 'src/vs/workbench/services/views/common/viewsService.ts';
const EDITOR_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const PANE_REL = 'src/vs/workbench/contrib/timeline/browser/timelinePane.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/timeline/common/timelineService.ts';
const TIMELINE_IFACE_REL = 'src/vs/workbench/contrib/timeline/common/timeline.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/timeline/browser/timeline.contribution.ts';
const SERVICE_CONTRIB_REL = 'src/vs/workbench/contrib/timeline/browser/timeline.service.contribution.ts';
const EMMET_REL = 'src/vs/workbench/contrib/emmet/browser/emmetActions.ts';
const EDIT_TELEMETRY_REL = 'src/vs/workbench/contrib/editTelemetry/browser/telemetry/editSourceTrackingImpl.ts';
const EDIT_DOC_REL = 'src/vs/workbench/contrib/editTelemetry/browser/helpers/documentWithAnnotatedEdits.ts';
const TYPE_HIERARCHY_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchy.contribution.ts';
const TYPE_PEEK_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchyPeek.ts';
const CALL_HIERARCHY_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';
const CALL_PEEK_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchyPeek.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const PREFERENCES_REL = 'src/vs/workbench/contrib/preferences/browser/preferences.contribution.ts';
const WORKSPACES_SVC_REL = 'src/vs/workbench/services/workspaces/common/workspaceEditing.ts';
const TIMER_REL = 'src/vs/workbench/services/timer/browser/timerService.ts';
const RESOLVER_REL = 'src/vs/workbench/services/configurationResolver/browser/baseConfigurationResolverService.ts';
const ASSIGNMENT_REL = 'src/vs/workbench/services/assignment/common/assignmentService.ts';
const TEXTMATE_REL = 'src/vs/workbench/services/textMate/browser/textMateTokenizationFeatureImpl.ts';
const WALKTHROUGH_REL = 'src/vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughInput.ts';
const WEBVIEW_VIEW_REL = 'src/vs/workbench/contrib/webviewView/browser/webviewViewPane.ts';
const WORKSPACES_CONTRIB_REL = 'src/vs/workbench/contrib/workspaces/browser/workspaces.contribution.ts';
const DIALOGS_REL = 'src/vs/workbench/services/dialogs/common/dialogService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const PROFILE_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts';
const INTERACTIVE_REL = 'src/vs/workbench/contrib/interactive/browser/interactive.contribution.ts';
const BULK_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';
const TERMINAL_CONTRIB_REL = 'src/vs/workbench/contrib/terminalContrib/find/browser/terminalFindWidget.ts';

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

const resetLoadCall = 'this.loadTimeline(true)';
const missingLoadCall = 'this.loadTimeline(true, missing.map(({ id }) => id))';
const addedLoadCall = 'this.loadTimeline(true, e.added)';
const moreLoadCall = 'this.loadTimeline(false)';
const handleRequestCall = 'this.handleRequest(newRequest)';
const executeCommandCall = 'this.commandService.executeCommand(item.command.id, ...args)';
const openViewCall = 'this.viewsService.openView(TimelinePaneId, true)';
const returnedThen = 'provider.provideTimeline(uri, options, tokenSource.token)\n\t\t\t\t.then(result => {';

const d804Calls: Array<[string, string, number]> = [
	[PANE_REL, resetLoadCall, 2],
	[PANE_REL, missingLoadCall, 1],
	[PANE_REL, addedLoadCall, 1],
	[PANE_REL, moreLoadCall, 1],
	[PANE_REL, handleRequestCall, 1],
	[PANE_REL, executeCommandCall, 1],
	[SERVICE_REL, openViewCall, 1],
];

suite('timeline leftover Promise fire-and-forget catch scan (D804)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites in contrib/timeline after emmet/editTelemetry had fewer than four legal wraps', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d804Calls) {
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
		const pane = seen.get(PANE_REL) ?? fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		const service = seen.get(SERVICE_REL) ?? fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		assert.strictEqual(countDoubleChains(pane), 7);
		assert.strictEqual(countDoubleChains(service), 1);
	});

	test('timeline leftover loadTimeline / handleRequest / executeCommand / openView are Promise double-chain', () => {
		const pane = fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(pane, 'private async loadTimeline(reset: boolean, sources?: string[]) {');
		assertPromiseSignature(pane, 'private async handleRequest(request: TimelineRequest) {');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(views, 'openView<T extends IView>(id: string, focus?: boolean): Promise<T | null>;');
		assert.ok(pane.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(service.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(pane, resetLoadCall);
		assertWrapped(pane, missingLoadCall);
		assertWrapped(pane, addedLoadCall);
		assertWrapped(pane, moreLoadCall);
		assertWrapped(pane, handleRequestCall);
		assertWrapped(pane, executeCommandCall);
		assertWrapped(service, openViewCall);
		assert.ok(!pane.includes('\t\tthis.loadTimeline(true);\n'));
		assert.ok(!pane.includes('this.loadTimeline(true, missing.map(({ id }) => id));'));
		assert.ok(!pane.includes('this.loadTimeline(true, e.added);'));
		assert.ok(!pane.includes('this.loadTimeline(false);'));
		assert.ok(!pane.includes('this.handleRequest(newRequest);'));
		assert.ok(!pane.includes('this.commandService.executeCommand(item.command.id, ...args);'));
		assert.ok(!service.includes('this.viewsService.openView(TimelinePaneId, true);'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const pane = fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(TIMELINE_IFACE_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const emmet = fs.readFileSync(resolveSource(EMMET_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(pane.includes('@IOpenerService openerService: IOpenerService,'));
		assert.ok(!pane.includes(`openerService.open(`));
		assert.ok(!service.includes('openerService.open('));

		assert.ok(pane.includes('run(accessor: ServicesAccessor, ...args: unknown[]) {'));
		assert.ok(pane.includes('pane.reset();'));
		assert.ok(!pane.includes(`pane.reset()${doubleCatch}`));

		assertPromiseSignature(iface, 'provideTimeline(uri: URI, options: TimelineOptions, token: CancellationToken): Promise<Timeline | undefined>;');
		assert.ok(service.includes(returnedThen));
		assert.ok(!service.includes(`${returnedThen}${doubleCatch}`));
		assert.ok(service.includes('readonly result: Promise<Timeline | undefined>') || iface.includes('readonly result: Promise<Timeline | undefined>;'));

		assertPromiseSignature(extensions, 'readExtensionPointContributions<T extends IExtensionContributions[keyof IExtensionContributions]>(extPoint: IExtensionPoint<T>): Promise<ExtensionPointContribution<T>[]>;');
		assert.ok(emmet.includes('this._lastGrammarContributions = extensionService.readExtensionPointContributions(grammarsExtPoint).then((contributions) => {'));
		assert.ok(!emmet.includes(doubleCatch));
		assert.ok(emmet.includes('return this._withGrammarContributions(extensionService).then((grammarContributions) => {'));
		assert.ok(emmet.includes('public run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {'));

		assert.ok(contrib.includes('return service.setUri(arg);'));
		assert.ok(!contrib.includes(doubleCatch));

		for (const source of [pane, service, contrib, emmet]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve(Turn|Anchor)\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
		}
	});

	test('emmet / editTelemetry leftover remaining stay unwrapped; typeHierarchy / callHierarchy leftover remaining stay unwrapped because this knife already has eight legal timeline sites', () => {
		const emmet = fs.readFileSync(resolveSource(EMMET_REL), 'utf8');
		const editTelemetry = fs.readFileSync(resolveSource(EDIT_TELEMETRY_REL), 'utf8');
		const editDoc = fs.readFileSync(resolveSource(EDIT_DOC_REL), 'utf8');
		const typeHierarchy = fs.readFileSync(resolveSource(TYPE_HIERARCHY_REL), 'utf8');
		const typePeek = fs.readFileSync(resolveSource(TYPE_PEEK_REL), 'utf8');
		const callHierarchy = fs.readFileSync(resolveSource(CALL_HIERARCHY_REL), 'utf8');
		const callPeek = fs.readFileSync(resolveSource(CALL_PEEK_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');

		assert.strictEqual(countDoubleChains(emmet), 0);
		assert.ok(editTelemetry.includes('void this.sendTelemetry(mode, trigger, tracker, focusTime, actualTime).catch(error => {'));
		assert.ok(!editTelemetry.includes(`sendTelemetry(mode, trigger, tracker, focusTime, actualTime)${doubleCatch}`));
		assert.ok(editDoc.includes('this._runQueue = this._runQueue.then(() => this._run(iterator));'));
		assert.ok(!editDoc.includes(`this._runQueue.then(() => this._run(iterator))${doubleCatch}`));

		assertPromiseSignature(typePeek, 'async showModel(model: TypeHierarchyModel): Promise<void> {');
		assertPromiseSignature(typePeek, 'async updateDirection(newDirection: TypeHierarchyDirection): Promise<void> {');
		assertPromiseSignature(editor, 'openEditor(editor: IResourceEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assert.ok(typeHierarchy.includes('model.then(model => {'));
		assert.ok(typeHierarchy.includes('}).catch(err => {'));
		assert.strictEqual(countDoubleChains(typeHierarchy), 0);
		assert.ok(typeHierarchy.includes('this._widget!.showModel(model);'));
		assert.ok(!typeHierarchy.includes(`this._widget!.showModel(model)${doubleCatch}`));
		assert.ok(typeHierarchy.includes('this._widget?.updateDirection(TypeHierarchyDirection.Supertypes);'));
		assert.ok(!typeHierarchy.includes(`updateDirection(TypeHierarchyDirection.Supertypes)${doubleCatch}`));
		assert.ok(typePeek.includes('this._updatePreview();'));
		assert.ok(!typePeek.includes(`this._updatePreview()${doubleCatch}`));

		assert.ok(callHierarchy.includes('model.then(model => {'));
		assert.ok(callHierarchy.includes('}).catch(err => {'));
		assert.strictEqual(countDoubleChains(callHierarchy), 0);
		assert.ok(callHierarchy.includes('this._widget!.showModel(model);'));
		assert.ok(!callHierarchy.includes(`this._widget!.showModel(model)${doubleCatch}`));
		assert.ok(callPeek.includes('this._updatePreview();'));
		assert.ok(!callPeek.includes(`this._updatePreview()${doubleCatch}`));
	});

	test('this knife stayed in timeline leftover remaining and did not overflow-assert occupied leftover modules as new D804 sites', () => {
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		const workspacesSvc = fs.readFileSync(resolveSource(WORKSPACES_SVC_REL), 'utf8');
		const timer = fs.readFileSync(resolveSource(TIMER_REL), 'utf8');
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const assignment = fs.readFileSync(resolveSource(ASSIGNMENT_REL), 'utf8');
		const textMate = fs.readFileSync(resolveSource(TEXTMATE_REL), 'utf8');
		const walkthrough = fs.readFileSync(resolveSource(WALKTHROUGH_REL), 'utf8');
		const webviewView = fs.readFileSync(resolveSource(WEBVIEW_VIEW_REL), 'utf8');
		const workspacesContrib = fs.readFileSync(resolveSource(WORKSPACES_CONTRIB_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const interactive = fs.readFileSync(resolveSource(INTERACTIVE_REL), 'utf8');
		const bulk = fs.readFileSync(resolveSource(BULK_REL), 'utf8');
		const terminalContrib = fs.readFileSync(resolveSource(TERMINAL_CONTRIB_REL), 'utf8');
		const serviceContrib = fs.readFileSync(resolveSource(SERVICE_CONTRIB_REL), 'utf8');

		for (const source of [host, preferences, workspacesSvc, timer, resolver, assignment, textMate, walkthrough, webviewView, workspacesContrib, dialogs, tasks, interactive, bulk]) {
			assert.ok(!source.includes('D804'));
		}
		assert.ok(!serviceContrib.includes(doubleCatch));
		assert.ok(walkthrough.includes(`this.promise.then(model => model.dispose())${doubleCatch}`));
		assert.ok(webviewView.includes(`this.viewService.openView(this.id, !preserveFocus)${doubleCatch}`));
		assert.ok(workspacesContrib.includes(`this.findWorkspaces()${doubleCatch}`));
		assert.ok(profile.includes(`${doubleCatch}`));
		assert.ok(!profile.includes('D804'));
		assert.ok(terminalContrib.includes(`${doubleCatch}`));
		assert.ok(!terminalContrib.includes('D804'));
	});
});
