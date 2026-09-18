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
const PROFILE_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditor.ts';
const MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfileActions.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.contribution.ts';
const COMMON_REL = 'src/vs/workbench/contrib/userDataProfile/common/userDataProfile.ts';
const EDITOR_IFACE_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const TREE_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const SPLASH_REL = 'src/vs/workbench/contrib/splash/browser/partsSplash.ts';
const PREFERENCES_REL = 'src/vs/workbench/contrib/preferences/browser/preferences.contribution.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const INTERACTIVE_REL = 'src/vs/workbench/contrib/interactive/browser/interactive.contribution.ts';
const SPEECH_REL = 'src/vs/workbench/contrib/speech/browser/speechAccessibilitySignal.ts';
const SEARCH_REL = 'src/vs/workbench/contrib/search/browser/searchView.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const SURVEYS_REL = 'src/vs/workbench/contrib/surveys/browser/languageSurveys.contribution.ts';
const REMOTE_REL = 'src/vs/workbench/contrib/remote/browser/remote.ts';
const WALKTHROUGH_REL = 'src/vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughInput.ts';
const URL_REL = 'src/vs/workbench/contrib/url/browser/trustedDomainsValidator.ts';
const WEBVIEW_VIEW_REL = 'src/vs/workbench/contrib/webviewView/browser/webviewViewPane.ts';
const WORKSPACES_REL = 'src/vs/workbench/contrib/workspaces/browser/workspaces.contribution.ts';

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

const reportCall = 'this.reportWorkspaceProfileInfo()';
const handleUrlCreateCall = 'editor.createNewProfile(uri)';
const dropOpenEditorCall = 'editorService.openEditor(textEditorService.createTextEditor({ resource }))';
const dblclickCreateCall = 'this.createNewProfile()';
const importCreateCall = 'this.createNewProfile(url)';
const profileTreeSetInputCall = 'this.profileTree.setInput(profileElement)';
const contentsSetInputCall = 'profilesContentTree.setInput(profileElement.root)';
const contentsUpdateCall = 'profilesContentTree.updateChildren(element.root)';
const eventuallyThen = 'lifecycleService.when(LifecyclePhase.Eventually).then(() => userDataProfilesService.cleanUp())';
const restoredThen = 'lifecycleService.when(LifecyclePhase.Restored).then(() => this.handleURL(URI.revive(environmentService.options!.profileToPreview!)))';
const templatesThen = 'this.model.getTemplates().then(templates => {';

const d797Calls: Array<[string, string, number]> = [
	[PROFILE_REL, reportCall, 1],
	[PROFILE_REL, handleUrlCreateCall, 1],
	[PROFILE_REL, dropOpenEditorCall, 1],
	[EDITOR_REL, dblclickCreateCall, 1],
	[EDITOR_REL, importCreateCall, 1],
	[EDITOR_REL, profileTreeSetInputCall, 1],
	[EDITOR_REL, contentsSetInputCall, 1],
	[EDITOR_REL, contentsUpdateCall, 1],
];

suite('userDataProfile leftover Promise fire-and-forget catch scan (D797)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites in contrib/userDataProfile', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d797Calls) {
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
	});

	test('userDataProfile leftover reportWorkspaceProfileInfo / createNewProfile / openEditor / tree setInput / updateChildren are Promise double-chain', () => {
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const common = fs.readFileSync(resolveSource(COMMON_REL), 'utf8');
		const editorIface = fs.readFileSync(resolveSource(EDITOR_IFACE_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		assertPromiseSignature(profile, 'private async reportWorkspaceProfileInfo(): Promise<void> {');
		assertPromiseSignature(common, 'createNewProfile(copyFrom?: URI | IUserDataProfile): Promise<void>;');
		assertPromiseSignature(editor, 'async createNewProfile(copyFrom?: URI | IUserDataProfile): Promise<void> {');
		assertPromiseSignature(editorIface, 'openEditor(editor: EditorInput, options?: IEditorOptions, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(tree, 'async setInput(input: TInput, viewState?: IAsyncDataTreeViewState): Promise<void> {');
		assertPromiseSignature(tree, 'async updateChildren(element: TInput | T = this.root.element, recursive = true, rerender = false, options?: IAsyncDataTreeUpdateChildrenOptions<T>): Promise<void> {');
		assert.ok(profile.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(editor.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(profile, reportCall);
		assertWrapped(profile, handleUrlCreateCall);
		assertWrapped(profile, dropOpenEditorCall);
		assertWrapped(editor, dblclickCreateCall);
		assertWrapped(editor, importCreateCall);
		assertWrapped(editor, profileTreeSetInputCall);
		assertWrapped(editor, contentsSetInputCall);
		assertWrapped(editor, contentsUpdateCall);
		assert.ok(!profile.includes('this.reportWorkspaceProfileInfo();'));
		assert.ok(!profile.includes('editor.createNewProfile(uri);'));
		assert.ok(!profile.includes('editorService.openEditor(textEditorService.createTextEditor({ resource }));'));
		assert.ok(!editor.includes('\t\t\t\t\tthis.createNewProfile();\n'));
		assert.ok(!editor.includes('this.createNewProfile(url);'));
		assert.ok(!editor.includes('this.profileTree.setInput(profileElement);'));
		assert.ok(!editor.includes('profilesContentTree.setInput(profileElement.root);'));
		assert.ok(!editor.includes('profilesContentTree.updateChildren(element.root);'));
	});

	test('D693 already-double when / getTemplates thens stay double-chain and are not this knife\'s new leftover sites', () => {
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assert.ok(profile.includes(`${eventuallyThen}${doubleCatch};`));
		assert.ok(profile.includes(`${restoredThen}${doubleCatch};`));
		assertThenWrapped(editor, templatesThen);
		assert.strictEqual(countDoubleChains(profile), 5);
		assert.strictEqual(countDoubleChains(editor), 6);
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(host, 'openWindow(options?: IOpenEmptyWindowOptions): Promise<void>;');

		assert.ok(profile.includes("return accessor.get(IOpenerService).open(URI.parse('https://aka.ms/vscode-profiles-help'));"));
		assert.ok(!profile.includes(`accessor.get(IOpenerService).open(URI.parse('https://aka.ms/vscode-profiles-help'))${doubleCatch}`));
		assert.ok(model.includes('() => this.openerService.open(copyFrom, { openExternal: true })'));
		assert.ok(!model.includes(`this.openerService.open(copyFrom, { openExternal: true })${doubleCatch}`));

		assert.ok(profile.includes('async run(accessor: ServicesAccessor) {'));
		assert.ok(profile.includes('override run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(profile.includes('return that.userDataProfileManagementService.switchProfile(profile);'));
		assert.ok(!profile.includes(`switchProfile(profile)${doubleCatch}`));
		assert.ok(profile.includes('return hostService.openWindow({ remoteAuthority: null, forceProfile: pick.profile.name });'));
		assert.ok(!profile.includes(`openWindow({ remoteAuthority: null, forceProfile: pick.profile.name })${doubleCatch}`));
		assert.ok(profile.includes('return hostService.openWindow({ remoteAuthority: null, forceProfile: profile.name });'));
		assert.ok(profile.includes('return editorService.openEditor(new UserDataProfilesEditorInput(instantiationService));'));
		assert.ok(!profile.includes(`openEditor(new UserDataProfilesEditorInput(instantiationService))${doubleCatch}`));
		assert.ok(actions.includes('async run(accessor: ServicesAccessor) {'));
		assert.ok(actions.includes('accessor.get(IHostService).openWindow({ forceTempProfile: true });'));
		assert.ok(!actions.includes(`openWindow({ forceTempProfile: true })${doubleCatch}`));
		assert.ok(actions.includes('return accessor.get(IUserDataProfilesService).cleanUp();'));
		assert.ok(!actions.includes(`cleanUp()${doubleCatch}`));
		assert.ok(!actions.includes(doubleCatch));
		assert.ok(!contrib.includes(doubleCatch));

		assert.ok(editor.includes('this._register(button.onDidClick(e => this.createNewProfile()));'));
		assert.ok(!editor.includes(`button.onDidClick(e => this.createNewProfile()${doubleCatch}`));
		assert.ok(editor.includes('run: () => this.createNewProfile()'));
		assert.ok(!editor.includes(`run: () => this.createNewProfile()${doubleCatch}`));
		assert.ok(editor.includes('run: () => this.createNewProfile(URI.parse(template.url))'));
		assert.ok(!editor.includes(`this.createNewProfile(URI.parse(template.url))${doubleCatch}`));

		assert.ok(model.includes('this.initialize();'));
		assert.ok(!model.includes(`this.initialize()${doubleCatch}`));
		assert.ok(model.includes('this.hostService.openWindow([{ workspaceUri: workspace }], { forceNewWindow: true });'));
		assert.ok(!model.includes(`openWindow([{ workspaceUri: workspace }], { forceNewWindow: true })${doubleCatch}`));
		assert.ok(model.includes('this.hostService.openWindow([{ folderUri: workspace }], { forceNewWindow: true });'));
		assert.ok(!model.includes(`openWindow([{ folderUri: workspace }], { forceNewWindow: true })${doubleCatch}`));
		assert.ok(model.includes('this.userDataProfilesService.removeProfile(this.previewProfile);'));
		assert.ok(!model.includes(`removeProfile(this.previewProfile)${doubleCatch}`));
		assert.ok(model.includes('this.dialogService.error(getErrorMessage(error));'));
		assert.ok(!model.includes(`this.dialogService.error(getErrorMessage(error))${doubleCatch}`));
		assert.ok(!model.includes(doubleCatch));

		for (const source of [profile, editor, model, actions, contrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve(Turn|Anchor)\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});

	test('this knife stayed in userDataProfile leftover remaining and did not overflow-assert occupied leftover modules as new D797 sites', () => {
		const splash = fs.readFileSync(resolveSource(SPLASH_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const interactive = fs.readFileSync(resolveSource(INTERACTIVE_REL), 'utf8');
		const speech = fs.readFileSync(resolveSource(SPEECH_REL), 'utf8');
		const search = fs.readFileSync(resolveSource(SEARCH_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const surveys = fs.readFileSync(resolveSource(SURVEYS_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const walkthrough = fs.readFileSync(resolveSource(WALKTHROUGH_REL), 'utf8');
		const url = fs.readFileSync(resolveSource(URL_REL), 'utf8');
		const webviewView = fs.readFileSync(resolveSource(WEBVIEW_VIEW_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_REL), 'utf8');

		for (const source of [splash, preferences, tasks, interactive, speech, search, searchEditor, surveys, remote]) {
			assert.ok(!source.includes('D797'));
		}
		assert.ok(walkthrough.includes('this.promise.then(model => model.dispose());'));
		assert.ok(!walkthrough.includes(`this.promise.then(model => model.dispose())${doubleCatch}`));
		assert.ok(!walkthrough.includes(doubleCatch));
		assert.ok(url.includes('this._clipboardService.writeText(typeof originalResource === \'string\' ? originalResource : resourceUri.toString(true)).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(!url.includes('D797'));
		assert.ok(webviewView.includes('this.viewService.openView(this.id, !preserveFocus);'));
		assert.ok(!webviewView.includes(`openView(this.id, !preserveFocus)${doubleCatch}`));
		assert.ok(workspaces.includes('this.findWorkspaces();'));
		assert.ok(!workspaces.includes(`this.findWorkspaces()${doubleCatch}`));
		assert.ok(!speech.includes('D797'));
		assert.ok(!search.includes('D797'));
		assert.ok(!searchEditor.includes('D797'));
	});
});
