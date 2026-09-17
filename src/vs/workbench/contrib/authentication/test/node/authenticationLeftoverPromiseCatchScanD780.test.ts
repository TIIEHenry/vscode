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
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const DIALOGS_REL = 'src/vs/platform/dialogs/common/dialogs.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const EXTENSIONS_REL = 'src/vs/workbench/contrib/extensions/common/extensions.ts';
const USAGE_REL = 'src/vs/workbench/services/authentication/browser/authenticationUsageService.ts';
const TAGS_REL = 'src/vs/workbench/contrib/tags/electron-browser/workspaceTags.ts';
const TAGS_SVC_REL = 'src/vs/workbench/contrib/tags/electron-browser/workspaceTagsService.ts';
const TAGS_CONTRIB_REL = 'src/vs/workbench/contrib/tags/electron-browser/tags.contribution.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/authentication/browser/authentication.contribution.ts';
const ACCOUNTS_REL = 'src/vs/workbench/contrib/authentication/browser/actions/manageAccountsAction.ts';
const TRUSTED_EXT_REL = 'src/vs/workbench/contrib/authentication/browser/actions/manageTrustedExtensionsForAccountAction.ts';
const TRUSTED_MCP_REL = 'src/vs/workbench/contrib/authentication/browser/actions/manageTrustedMcpServersForAccountAction.ts';
const EXT_PREF_REL = 'src/vs/workbench/contrib/authentication/browser/actions/manageAccountPreferencesForExtensionAction.ts';
const MCP_PREF_REL = 'src/vs/workbench/contrib/authentication/browser/actions/manageAccountPreferencesForMcpServerAction.ts';
const SIGN_OUT_REL = 'src/vs/workbench/contrib/authentication/browser/actions/signOutOfAccountAction.ts';
const DYNAMIC_REL = 'src/vs/workbench/contrib/authentication/browser/actions/manageDynamicAuthenticationProvidersAction.ts';

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

const initializeCacheCall = 'this._initializeExtensionUsageCache()';
const trustedExtCommandCall = "this.commandService.executeCommand('_manageTrustedExtensionsForAccount', { providerId, accountLabel })";
const trustedMcpCommandCall = "this.commandService.executeCommand('_manageTrustedMCPServersForAccount', { providerId, accountLabel })";
const signOutCommandCall = "this.commandService.executeCommand('_signOutOfAccount', { providerId, accountLabel })";
const accountsRunCall = 'void this.run()';
const trustedExtPrefCall = "this._commandService.executeCommand('_manageAccountPreferencesForExtension', e.item.extension.id, accountQuery.providerId)";
const openExtensionCall = 'this._extensionsWorkbenchService.open(e.item.extension.id)';
const noTrustedExtInfoCall = `this._dialogService.info(localize('noTrustedExtensions', "This account has not been used by any extensions."))`;
const trustedMcpPrefCall = "this._commandService.executeCommand('_manageAccountPreferencesForMcpServer', e.item.mcpServer.id, accountQuery.providerId)";
const noTrustedMcpInfoCall = `this._dialogService.info(localize('noTrustedMcpServers', "This account has not been used by any MCP servers."))`;
const extPrefRunCall = '() => this.run()';
const mcpPrefRunCall = '() => this.run()';

const d780Calls: Array<[string, string, number]> = [
	[CONTRIB_REL, initializeCacheCall, 1],
	[ACCOUNTS_REL, trustedExtCommandCall, 1],
	[ACCOUNTS_REL, trustedMcpCommandCall, 1],
	[ACCOUNTS_REL, signOutCommandCall, 1],
	[ACCOUNTS_REL, accountsRunCall, 1],
	[TRUSTED_EXT_REL, trustedExtPrefCall, 1],
	[TRUSTED_EXT_REL, openExtensionCall, 1],
	[TRUSTED_EXT_REL, noTrustedExtInfoCall, 1],
	[TRUSTED_MCP_REL, trustedMcpPrefCall, 1],
	[TRUSTED_MCP_REL, noTrustedMcpInfoCall, 1],
	[EXT_PREF_REL, extPrefRunCall, 1],
	[MCP_PREF_REL, mcpPrefRunCall, 1],
];

suite('tags leftover remaining overflowed to authentication leftover Promise fire-and-forget catch scan (D780)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('tags leftover remaining has fewer than four legal sites so this knife moved to authentication leftover', () => {
		const tags = fs.readFileSync(resolveSource(TAGS_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(TAGS_SVC_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(TAGS_CONTRIB_REL), 'utf8');

		assert.ok(tags.includes('\t\tthis.report();\n'));
		assert.ok(!tags.includes(`this.report()${doubleCatch}`));
		assert.ok(tags.includes('\t\tthis.reportWindowsEdition();\n'));
		assert.ok(!tags.includes(`this.reportWindowsEdition()${doubleCatch}`));

		assert.ok(tags.includes('.then(tags => this.reportWorkspaceTags(tags), error => onUnexpectedError(error));'));
		assert.ok(tags.includes('this.getWorkspaceInformation().then(stats => this.diagnosticsService.reportWorkspaceStats(stats)).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(tags.includes('}, onUnexpectedError);'));
		assert.ok(tags.includes('})).then(() => { }, onUnexpectedError);'));
		assert.ok(tags.includes('}).then(undefined, onUnexpectedError);'));
		assert.strictEqual(countIncludes(tags, '.then(undefined, onUnexpectedError)'), 2);
		assert.ok(tags.includes('\t\t\tthis.reportRemoteDomains(uris);\n'));
		assert.ok(tags.includes('\t\t\tthis.reportRemotes(uris);\n'));
		assert.ok(tags.includes('\t\t\tthis.reportAzure(uris);\n'));
		assert.ok(!tags.includes(`this.reportCloudStats()${doubleCatch}`));
		assert.ok(!service.includes(doubleCatch));
		assert.ok(!contrib.includes(doubleCatch));

		const tagsLegalLeftover = 2;
		assert.ok(tagsLegalLeftover < 4, `expected tags legal leftover <4, got ${tagsLegalLeftover}`);
		assert.strictEqual(tagsLegalLeftover, 2);
	});

	test('this knife covers twelve leftover Promise double-chain sites after tags leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d780Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 12);
		assert.ok(sites >= 4);
	});

	test('authentication leftover initializeExtensionUsageCache / executeCommand / info / open / impl run are Promise double-chain', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const accounts = fs.readFileSync(resolveSource(ACCOUNTS_REL), 'utf8');
		const trustedExt = fs.readFileSync(resolveSource(TRUSTED_EXT_REL), 'utf8');
		const trustedMcp = fs.readFileSync(resolveSource(TRUSTED_MCP_REL), 'utf8');
		const extPref = fs.readFileSync(resolveSource(EXT_PREF_REL), 'utf8');
		const mcpPref = fs.readFileSync(resolveSource(MCP_PREF_REL), 'utf8');
		const usage = fs.readFileSync(resolveSource(USAGE_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');

		assertPromiseSignature(usage, 'initializeExtensionUsageCache(): Promise<void>;');
		assertPromiseSignature(contrib, 'private async _initializeExtensionUsageCache() {');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(dialogs, 'info(message: string, detail?: string): Promise<void>;');
		assertPromiseSignature(extensions, 'open(extension: IExtension | string, options?: IExtensionEditorOptions): Promise<void>;');
		assertPromiseSignature(accounts, 'public async run() {');
		assertPromiseSignature(extPref, 'async run(extensionId?: string, providerId?: string) {');
		assertPromiseSignature(mcpPref, 'async run(mcpServerId?: string, providerId?: string) {');

		assert.ok(contrib.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(accounts.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(trustedExt.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(trustedMcp.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(extPref.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(mcpPref.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));

		assertWrapped(contrib, initializeCacheCall);
		assertWrapped(accounts, trustedExtCommandCall);
		assertWrapped(accounts, trustedMcpCommandCall);
		assertWrapped(accounts, signOutCommandCall);
		assertWrapped(accounts, accountsRunCall);
		assertWrapped(trustedExt, trustedExtPrefCall);
		assertWrapped(trustedExt, openExtensionCall);
		assertWrapped(trustedExt, noTrustedExtInfoCall);
		assertWrapped(trustedMcp, trustedMcpPrefCall);
		assertWrapped(trustedMcp, noTrustedMcpInfoCall);
		assertWrapped(extPref, extPrefRunCall);
		assertWrapped(mcpPref, mcpPrefRunCall);

		assert.ok(!contrib.includes('this._initializeExtensionUsageCache();'));
		assert.ok(!accounts.includes('void this.run();'));
		assert.ok(!trustedExt.includes("this._commandService.executeCommand('_manageAccountPreferencesForExtension', e.item.extension.id, accountQuery.providerId);"));
		assert.ok(!trustedExt.includes('this._extensionsWorkbenchService.open(e.item.extension.id);'));
		assert.ok(!trustedExt.includes(`this._dialogService.info(localize('noTrustedExtensions', "This account has not been used by any extensions."));`));
		assert.ok(!trustedMcp.includes(`this._dialogService.info(localize('noTrustedMcpServers', "This account has not been used by any MCP servers."));`));
	});

	test('opener / Action2.run / two-arg then / assigned then / returned Promise / already-double / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const tags = fs.readFileSync(resolveSource(TAGS_REL), 'utf8');
		const accounts = fs.readFileSync(resolveSource(ACCOUNTS_REL), 'utf8');
		const trustedExt = fs.readFileSync(resolveSource(TRUSTED_EXT_REL), 'utf8');
		const trustedMcp = fs.readFileSync(resolveSource(TRUSTED_MCP_REL), 'utf8');
		const extPref = fs.readFileSync(resolveSource(EXT_PREF_REL), 'utf8');
		const mcpPref = fs.readFileSync(resolveSource(MCP_PREF_REL), 'utf8');
		const signOut = fs.readFileSync(resolveSource(SIGN_OUT_REL), 'utf8');
		const dynamic = fs.readFileSync(resolveSource(DYNAMIC_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(!accounts.includes('openerService.open'));
		assert.ok(!trustedExt.includes('openerService.open'));
		assert.ok(!trustedMcp.includes('openerService.open'));

		assert.ok(accounts.includes('public override run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(accounts.includes('return instantiationService.createInstance(ManageAccountsActionImpl).run();'));
		assert.ok(!accounts.includes(`return instantiationService.createInstance(ManageAccountsActionImpl).run()${doubleCatch}`));
		assert.ok(trustedExt.includes('override run(accessor: ServicesAccessor, options?: { providerId: string; accountLabel: string }): Promise<void> {'));
		assert.ok(trustedExt.includes('return instantiationService.createInstance(ManageTrustedExtensionsForAccountActionImpl).run(options);'));
		assert.ok(!trustedExt.includes(`return instantiationService.createInstance(ManageTrustedExtensionsForAccountActionImpl).run(options)${doubleCatch}`));
		assert.ok(trustedMcp.includes('override run(accessor: ServicesAccessor, options?: { providerId: string; accountLabel: string }): Promise<void> {'));
		assert.ok(trustedMcp.includes('return instantiationService.createInstance(ManageTrustedMcpServersForAccountActionImpl).run(options);'));
		assert.ok(!trustedMcp.includes(`return instantiationService.createInstance(ManageTrustedMcpServersForAccountActionImpl).run(options)${doubleCatch}`));
		assert.ok(extPref.includes('override run(accessor: ServicesAccessor, extensionId?: string, providerId?: string): Promise<void> {'));
		assert.ok(extPref.includes('return accessor.get(IInstantiationService).createInstance(ManageAccountPreferenceForExtensionActionImpl).run(extensionId, providerId);'));
		assert.ok(!extPref.includes(`return accessor.get(IInstantiationService).createInstance(ManageAccountPreferenceForExtensionActionImpl).run(extensionId, providerId)${doubleCatch}`));
		assert.ok(mcpPref.includes('override run(accessor: ServicesAccessor, mcpServerId?: string, providerId?: string): Promise<void> {'));
		assert.ok(mcpPref.includes('return accessor.get(IInstantiationService).createInstance(ManageAccountPreferenceForMcpServerActionImpl).run(mcpServerId, providerId);'));
		assert.ok(!mcpPref.includes(`return accessor.get(IInstantiationService).createInstance(ManageAccountPreferenceForMcpServerActionImpl).run(mcpServerId, providerId)${doubleCatch}`));
		assert.ok(signOut.includes('override async run(accessor: ServicesAccessor, { providerId, accountLabel }: { providerId: string; accountLabel: string }): Promise<void> {'));
		assert.ok(!signOut.includes(doubleCatch));
		assert.ok(dynamic.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(!dynamic.includes(doubleCatch));

		assert.ok(accounts.includes('selected.action();'));
		assert.ok(!accounts.includes(`selected.action()${doubleCatch}`));
		assert.ok(extPref.includes('await this._accept(extensionId, picker.selectedItems);'));
		assert.ok(!extPref.includes(`await this._accept(extensionId, picker.selectedItems)${doubleCatch}`));
		assert.ok(mcpPref.includes('await this._accept(mcpServerId, picker.selectedItems);'));
		assert.ok(!mcpPref.includes(`await this._accept(mcpServerId, picker.selectedItems)${doubleCatch}`));

		assert.ok(tags.includes('.then(tags => this.reportWorkspaceTags(tags), error => onUnexpectedError(error));'));
		assert.ok(!tags.includes(`.then(tags => this.reportWorkspaceTags(tags), error => onUnexpectedError(error))${doubleCatch}`));
		assert.ok(tags.includes('}).then(undefined, onUnexpectedError);'));
		assert.ok(!tags.includes(`}).then(undefined, onUnexpectedError)${doubleCatch}`));

		for (const source of [accounts, trustedExt, trustedMcp, extPref, mcpPref, signOut, dynamic, tags]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
