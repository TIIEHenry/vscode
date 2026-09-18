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
const WORKSPACES_IFACE_REL = 'src/vs/platform/workspaces/common/workspaces.ts';
const CONFIG_REL = 'src/vs/platform/configuration/common/configuration.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const BROWSER_SVC_REL = 'src/vs/workbench/services/workspaces/browser/workspacesService.ts';
const TRUST_REL = 'src/vs/workbench/services/workspaces/common/workspaceTrust.ts';
const ABSTRACT_REL = 'src/vs/workbench/services/workspaces/browser/abstractWorkspaceEditingService.ts';
const NATIVE_REL = 'src/vs/workbench/services/workspaces/electron-browser/workspaceEditingService.ts';
const BROWSER_EDIT_REL = 'src/vs/workbench/services/workspaces/browser/workspaceEditingService.ts';
const IDENTITY_REL = 'src/vs/workbench/services/workspaces/common/workspaceIdentityService.ts';
const EDIT_SESSION_REL = 'src/vs/workbench/services/workspaces/common/editSessionIdentityService.ts';
const UTILS_REL = 'src/vs/workbench/services/workspaces/common/workspaceUtils.ts';
const CANONICAL_REL = 'src/vs/workbench/services/workspaces/common/canonicalUriService.ts';
const LABEL_REL = 'src/vs/workbench/services/workspaces/common/workspaceFolderLabelService.ts';
const NATIVE_SVC_REL = 'src/vs/workbench/services/workspaces/electron-browser/workspacesService.ts';
const EDITOR_INPUT_REL = 'src/vs/workbench/services/workspaces/browser/workspaceTrustEditorInput.ts';
const EDITING_IFACE_REL = 'src/vs/workbench/services/workspaces/common/workspaceEditing.ts';
const TRUST_TEST_REL = 'src/vs/workbench/services/workspaces/test/common/workspaceTrust.test.ts';
const EDIT_TEST_REL = 'src/vs/workbench/services/workspaces/test/browser/workspaceEditingService.test.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/workspace/browser/workspace.contribution.ts';

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

const addedFolderCall = 'this.addRecentlyOpened([{ folderUri: folder.uri }])';
const folderStateCall = 'this.addRecentlyOpened([{ folderUri: workspace.folders[0].uri, remoteAuthority }])';
const workspaceStateCall = 'this.addRecentlyOpened([{ workspace: { id: workspace.id, configPath: workspace.configuration! }, remoteAuthority }])';
const initializedThenCall = `				if (this._storedTrustState.isEmptyWorkspaceTrusted === undefined) {
					this._storedTrustState.isEmptyWorkspaceTrusted = this.isWorkspaceTrusted();
				}
			})`;
const updateValueCall = 'this.configurationService.updateValue(WORKSPACE_TRUST_UNTRUSTED_FILES, value)';
const executeCommandCall = "this.commandService.executeCommand('workbench.action.openWorkspaceConfigFile')";
const reloadCall = 'this.hostService.reload()';
const startHostsCall = 'this.extensionService.startExtensionHosts()';

const d801Calls: Array<[string, string, number]> = [
	[BROWSER_SVC_REL, addedFolderCall, 1],
	[BROWSER_SVC_REL, folderStateCall, 1],
	[BROWSER_SVC_REL, workspaceStateCall, 1],
	[TRUST_REL, initializedThenCall, 1],
	[TRUST_REL, updateValueCall, 1],
	[ABSTRACT_REL, executeCommandCall, 1],
	[NATIVE_REL, reloadCall, 1],
	[NATIVE_REL, startHostsCall, 1],
];

suite('workspaces leftover Promise fire-and-forget catch scan (D801)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites in services/workspaces only', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d801Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		const browser = seen.get(BROWSER_SVC_REL) ?? fs.readFileSync(resolveSource(BROWSER_SVC_REL), 'utf8');
		const trust = seen.get(TRUST_REL) ?? fs.readFileSync(resolveSource(TRUST_REL), 'utf8');
		const abstract = seen.get(ABSTRACT_REL) ?? fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const native = seen.get(NATIVE_REL) ?? fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		assert.strictEqual(countDoubleChains(browser), 3);
		assert.strictEqual(countDoubleChains(trust), 2);
		assert.strictEqual(countDoubleChains(abstract), 1);
		assert.strictEqual(countDoubleChains(native), 2);
	});

	test('workspaces leftover addRecentlyOpened / workspaceTrustInitialized.then / updateValue / executeCommand / reload / startExtensionHosts are Promise/async + double-chain', () => {
		const browser = fs.readFileSync(resolveSource(BROWSER_SVC_REL), 'utf8');
		const trust = fs.readFileSync(resolveSource(TRUST_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(WORKSPACES_IFACE_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');

		assertPromiseSignature(iface, 'addRecentlyOpened(recents: IRecent[]): Promise<void>;');
		assertPromiseSignature(browser, 'async addRecentlyOpened(recents: IRecent[]): Promise<void> {');
		assertPromiseSignature(trust, 'get workspaceTrustInitialized(): Promise<void> {');
		assertPromiseSignature(config, 'updateValue(key: string, value: unknown): Promise<void>;');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(host, 'reload(options?: { disableExtensions?: boolean }): Promise<void>;');
		assertPromiseSignature(extensions, 'startExtensionHosts(updates?: { readonly toAdd: readonly IExtension[]; readonly toRemove: readonly string[] }): Promise<void>;');

		assert.ok(browser.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(trust.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(abstract.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(native.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));

		assertWrapped(browser, addedFolderCall);
		assertWrapped(browser, folderStateCall);
		assertWrapped(browser, workspaceStateCall);
		assertWrapped(trust, initializedThenCall);
		assertWrapped(trust, updateValueCall);
		assertWrapped(abstract, executeCommandCall);
		assertWrapped(native, reloadCall);
		assertWrapped(native, startHostsCall);

		assert.ok(trust.includes('this._workspaceTrustInitializedPromise.then(() => {'));
		assert.ok(trust.includes(`${initializedThenCall}${doubleCatch};`));
		assert.ok(!browser.includes('this.addRecentlyOpened([{ folderUri: folder.uri }]);'));
		assert.ok(!trust.includes('this.configurationService.updateValue(WORKSPACE_TRUST_UNTRUSTED_FILES, value);'));
		assert.ok(!native.includes('this.hostService.reload();\n'));
		assert.ok(!native.includes('this.extensionService.startExtensionHosts();\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const browser = fs.readFileSync(resolveSource(BROWSER_SVC_REL), 'utf8');
		const trust = fs.readFileSync(resolveSource(TRUST_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const browserEdit = fs.readFileSync(resolveSource(BROWSER_EDIT_REL), 'utf8');
		const identity = fs.readFileSync(resolveSource(IDENTITY_REL), 'utf8');
		const editSession = fs.readFileSync(resolveSource(EDIT_SESSION_REL), 'utf8');
		const utils = fs.readFileSync(resolveSource(UTILS_REL), 'utf8');
		const canonical = fs.readFileSync(resolveSource(CANONICAL_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const nativeSvc = fs.readFileSync(resolveSource(NATIVE_SVC_REL), 'utf8');
		const editorInput = fs.readFileSync(resolveSource(EDITOR_INPUT_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_IFACE_REL), 'utf8');
		const trustTest = fs.readFileSync(resolveSource(TRUST_TEST_REL), 'utf8');
		const editTest = fs.readFileSync(resolveSource(EDIT_TEST_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');

		assert.ok(!browser.includes('openerService.open('));
		assert.ok(!trust.includes('openerService.open('));
		assert.ok(!abstract.includes('openerService.open('));
		assert.ok(!native.includes('openerService.open('));

		assert.ok(contrib.includes('run(accessor: ServicesAccessor) {'));
		assert.ok(contrib.includes('accessor.get(IPreferencesService).openUserSettings({ jsonEditor: false, query: `@tag:${WORKSPACE_TRUST_SETTING_TAG}` });'));
		assert.ok(!contrib.includes(`openUserSettings({ jsonEditor: false, query: \`@tag:\${WORKSPACE_TRUST_SETTING_TAG}\` })${doubleCatch}`));
		assert.ok(contrib.includes('editorService.openEditor(input, { pinned: true });'));
		assert.ok(!contrib.includes(`editorService.openEditor(input, { pinned: true })${doubleCatch}`));

		assert.ok(editTest.includes('const waitPromise = event.wait().then(() => { waitCompleted = true; });'));
		assert.ok(!editTest.includes(`event.wait().then(() => { waitCompleted = true; })${doubleCatch}`));
		assert.ok(trustTest.includes('setWorkspaceTrustPromise.then(() => setWorkspaceTrustResolved = true);'));
		assert.ok(!trustTest.includes(`setWorkspaceTrustPromise.then(() => setWorkspaceTrustResolved = true)${doubleCatch}`));

		assert.ok(!/\.then\([^)]+,\s*[^)]+\)/.test(browser));
		assert.ok(!trust.includes('.then(async () => {') || trust.includes('this.resolveCanonicalUris()'));
		assert.ok(!abstract.includes('.then('));

		assertPromiseSignature(browser, 'async addRecentlyOpened(recents: IRecent[]): Promise<void> {');
		assert.ok(browser.includes('return this.saveRecentlyOpened(recentlyOpened);'));
		assert.ok(!browser.includes(`return this.saveRecentlyOpened(recentlyOpened)${doubleCatch}`));
		assert.ok(abstract.includes('return this.doAddFolders(foldersToAdd, undefined, donotNotifyError);'));
		assert.ok(!abstract.includes(`return this.doAddFolders(foldersToAdd, undefined, donotNotifyError)${doubleCatch}`));
		assert.ok(abstract.includes('return this.enterWorkspace(path);'));
		assert.ok(!abstract.includes(`return this.enterWorkspace(path)${doubleCatch}`));
		assert.ok(browserEdit.includes('await this.hostService.openWindow([{ workspaceUri }], { forceReuseWindow: true });'));
		assert.ok(!browserEdit.includes(`await this.hostService.openWindow([{ workspaceUri }], { forceReuseWindow: true })${doubleCatch}`));
		assert.ok(native.includes('await this.configurationService.updateValue(\'window.confirmSaveUntitledWorkspace\', false, ConfigurationTarget.USER);'));
		assert.ok(!native.includes(`await this.configurationService.updateValue('window.confirmSaveUntitledWorkspace', false, ConfigurationTarget.USER)${doubleCatch}`));

		assert.ok(!browser.includes('.catch(onUnexpectedError).catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(!trust.includes('.catch(onUnexpectedError).catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(!abstract.includes('.catch(onUnexpectedError).catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(!native.includes('.catch(onUnexpectedError).catch(onUnexpectedError).catch(onUnexpectedError)'));

		assert.ok(trust.includes('this.resolveCanonicalUris()'));
		assert.ok(!trust.includes(`this.resolveCanonicalUris()${doubleCatch}`));
		assert.ok(trust.includes('this.remoteAuthorityResolverService.resolveAuthority(this.environmentService.remoteAuthority)'));
		assert.ok(!trust.includes(`this.remoteAuthorityResolverService.resolveAuthority(this.environmentService.remoteAuthority)${doubleCatch}`));
		assert.ok(utils.includes('const folderStat = await fileService.resolve(folder.uri);'));
		assert.ok(!utils.includes(`fileService.resolve(folder.uri)${doubleCatch}`));
		assert.ok(canonical.includes('return provider.provideCanonicalUri(uri, targetScheme, token);'));
		assert.ok(!canonical.includes(`provideCanonicalUri(uri, targetScheme, token)${doubleCatch}`));
		assert.ok(identity.includes('await this.editSessionIdentityService.getEditSessionIdentifier(workspaceFolder, cancellationToken);'));
		assert.ok(!identity.includes(`getEditSessionIdentifier(workspaceFolder, cancellationToken)${doubleCatch}`));
		assert.ok(editSession.includes('return provider?.getEditSessionIdentifier(workspaceFolder, token);'));
		assert.ok(!editSession.includes(`getEditSessionIdentifier(workspaceFolder, token)${doubleCatch}`));

		assert.ok(browser.includes('this.addWorkspaceToRecentlyOpened();'));
		assert.ok(!browser.includes(`this.addWorkspaceToRecentlyOpened()${doubleCatch}`));
		assert.ok(!label.includes(doubleCatch));
		assert.ok(!nativeSvc.includes(doubleCatch));
		assert.ok(!editorInput.includes(doubleCatch));
		assert.ok(!editing.includes(doubleCatch));

		for (const source of [browser, trust, abstract, native, browserEdit, identity, editSession, utils, canonical, label, nativeSvc, editorInput, editing]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
