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
const TRUST_IFACE_REL = 'src/vs/platform/workspace/common/workspaceTrust.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const PREFERENCES_REL = 'src/vs/workbench/services/preferences/common/preferences.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/workspace/browser/workspace.contribution.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/workspace/browser/workspaceTrustEditor.ts';
const COMMON_REL = 'src/vs/workbench/contrib/workspace/common/workspace.ts';
const WORKSPACES_TRUST_REL = 'src/vs/workbench/services/workspaces/common/workspaceTrust.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const iifeCall = `			}
		})()`;
const showModalCall = 'this.showModalOnStart()';
const doShowModalCall = `				markdownStrings,
				checkboxText
			)`;
const initializedThenCall = `				this._register(this.workspaceTrustManagementService.onDidChangeTrust(isTrusted => this.logWorkspaceTrust(isTrusted).catch(onUnexpectedError).catch(onUnexpectedError)));
			})`;
const logCtorCall = 'this.logWorkspaceTrust(this.workspaceTrustManagementService.isWorkspaceTrusted())';
const logEventCall = 'this.logWorkspaceTrust(isTrusted)';
const editCall = 'this.edit(item.element, true)';
const setUrisTrustCall = 'this.workspaceTrustManagementService.setUrisTrust(uri, true)';
const setTrustedUrisCall = 'this.workspaceTrustManagementService.setTrustedUris(trustedFolders)';
const setWorkspaceTrustCall = 'this.workspaceTrustManagementService.setWorkspaceTrust(!this.workspaceTrustManagementService.isWorkspaceTrusted())';

const d785Calls: Array<[string, string, number]> = [
	[CONTRIB_REL, iifeCall, 1],
	[CONTRIB_REL, showModalCall, 2],
	[CONTRIB_REL, doShowModalCall, 1],
	[CONTRIB_REL, initializedThenCall, 1],
	[CONTRIB_REL, logCtorCall, 1],
	[CONTRIB_REL, logEventCall, 1],
	[EDITOR_REL, editCall, 1],
	[EDITOR_REL, setUrisTrustCall, 1],
	[EDITOR_REL, setTrustedUrisCall, 1],
	[EDITOR_REL, setWorkspaceTrustCall, 1],
];

suite('workspace leftover Promise fire-and-forget catch scan (D785)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eleven leftover Promise double-chain sites in contrib/workspace', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d785Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 11);
		assert.ok(sites >= 4);
	});

	test('contrib/workspace leftover IIFE / showModalOnStart / doShowModal / workspaceTrustInitialized.then / logWorkspaceTrust are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const trust = fs.readFileSync(resolveSource(TRUST_IFACE_REL), 'utf8');
		assertPromiseSignature(trust, 'readonly workspaceTrustInitialized: Promise<void>;');
		assertPromiseSignature(source, 'private async doShowModal(question: string, trustedOption: { label: string; sublabel: string }, untrustedOption: { label: string; sublabel: string }, markdownStrings: string[], trustParentString?: string): Promise<void> {');
		assertPromiseSignature(source, 'private async showModalOnStart(): Promise<void> {');
		assertPromiseSignature(source, 'private async logWorkspaceTrust(isTrusted: boolean): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, iifeCall);
		assertWrapped(source, showModalCall);
		assert.strictEqual(countIncludes(source, `${showModalCall}${doubleCatch}`), 2);
		assertWrapped(source, doShowModalCall);
		assertWrapped(source, initializedThenCall);
		assertWrapped(source, logCtorCall);
		assertWrapped(source, logEventCall);
		assert.ok(!source.includes('this.showModalOnStart();'));
		assert.ok(!source.includes('\t\t})();'));
		assert.ok(!source.includes('this.workspaceTrustManagementService.workspaceTrustInitialized\n\t\t\t.then(() => {\n\t\t\t\tthis.logInitialWorkspaceTrustInfo();\n\t\t\t\tthis.logWorkspaceTrust(this.workspaceTrustManagementService.isWorkspaceTrusted());'));
	});

	test('workspaceTrustEditor leftover edit / setUrisTrust / setTrustedUris / setWorkspaceTrust are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const trust = fs.readFileSync(resolveSource(TRUST_IFACE_REL), 'utf8');
		assertPromiseSignature(trust, 'setWorkspaceTrust(trusted: boolean): Promise<void>;');
		assertPromiseSignature(trust, 'setUrisTrust(uri: URI[], trusted: boolean): Promise<void>;');
		assertPromiseSignature(trust, 'setTrustedUris(uris: URI[]): Promise<void>;');
		assertPromiseSignature(source, 'async edit(item: ITrustedUriItem, usePickerIfPossible?: boolean) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, editCall);
		assertWrapped(source, setUrisTrustCall);
		assertWrapped(source, setTrustedUrisCall);
		assertWrapped(source, setWorkspaceTrustCall);
		assert.ok(!source.includes('this.edit(item.element, true);'));
		assert.ok(!source.includes('this.workspaceTrustManagementService.setUrisTrust(uri, true);'));
		assert.ok(!source.includes('this.workspaceTrustManagementService.setTrustedUris(trustedFolders);'));
		assert.ok(!source.includes('this.workspaceTrustManagementService.setWorkspaceTrust(!this.workspaceTrustManagementService.isWorkspaceTrusted());'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / D145 stay skipped', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const common = fs.readFileSync(resolveSource(COMMON_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const workspacesTrust = fs.readFileSync(resolveSource(WORKSPACES_TRUST_REL), 'utf8');

		assertPromiseSignature(files, 'exists(resource: URI): Promise<boolean>;');
		assert.ok(contrib.includes('return await this.fileService.exists(aiGeneratedWorkspaces).then(async result => {'));
		assert.ok(!contrib.includes(`return await this.fileService.exists(aiGeneratedWorkspaces).then(async result => {${doubleCatch}`));

		assertPromiseSignature(preferences, 'openUserSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;');
		assert.ok(contrib.includes('run(accessor: ServicesAccessor) {'));
		assert.ok(contrib.includes('accessor.get(IPreferencesService).openUserSettings({ jsonEditor: false, query: `@tag:${WORKSPACE_TRUST_SETTING_TAG}` });'));
		assert.ok(!contrib.includes(`openUserSettings({ jsonEditor: false, query: \`@tag:\${WORKSPACE_TRUST_SETTING_TAG}\` })${doubleCatch}`));

		assertPromiseSignature(editorSvc, 'openEditor(editor: EditorInput, options?: IEditorOptions, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assert.ok(contrib.includes('editorService.openEditor(input, { pinned: true });'));
		assert.ok(!contrib.includes(`editorService.openEditor(input, { pinned: true })${doubleCatch}`));

		assert.ok(editor.includes('this._register(this.extensionWorkbenchService.onChange(() => this.render()));'));
		assert.ok(!editor.includes(`() => this.render()${doubleCatch}`));
		assert.ok(editor.includes('action.run();'));
		assert.ok(!editor.includes(`action.run()${doubleCatch}`));
		assert.ok(editor.includes('await this.workspaceTrustManagementService.setUrisTrust([item.uri], false);'));
		assert.ok(!editor.includes(`await this.workspaceTrustManagementService.setUrisTrust([item.uri], false)${doubleCatch}`));
		assert.ok(editor.includes('await this.workspaceTrustManagementService.setWorkspaceTrust(true);'));
		assert.ok(!editor.includes(`await this.workspaceTrustManagementService.setWorkspaceTrust(true)${doubleCatch}`));

		assert.ok(!common.includes('.then('));
		assert.ok(!common.includes(doubleCatch));

		assert.ok(workspacesTrust.includes('this.resolveCanonicalUris()'));
		assert.ok(!workspacesTrust.includes(`this.resolveCanonicalUris()${doubleCatch}`));
		assert.ok(workspacesTrust.includes('this.remoteAuthorityResolverService.resolveAuthority(this.environmentService.remoteAuthority)'));
		assert.ok(!workspacesTrust.includes(`this.remoteAuthorityResolverService.resolveAuthority(this.environmentService.remoteAuthority)${doubleCatch}`));

		for (const source of [contrib, editor, common]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
