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
const DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const MIGRATION_REL = 'src/vs/workbench/contrib/mcp/browser/mcpMigration.ts';
const WORKBENCH_REL = 'src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/mcp/browser/mcpServerEditor.ts';
const ADD_CONFIG_REL = 'src/vs/workbench/contrib/mcp/browser/mcpCommandsAddConfiguration.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const XTERM_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts';
const NOTEBOOK_WIDGET_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const EMERGENCY_REL = 'src/vs/workbench/contrib/emergencyAlert/electron-browser/emergencyAlert.contribution.ts';
const ENCRYPTION_REL = 'src/vs/workbench/contrib/encryption/electron-browser/encryption.contribution.ts';
const IGNORED_REL = 'src/vs/workbench/services/extensionRecommendations/common/extensionIgnoredRecommendationsService.ts';
const UPDATE_REL = 'src/vs/workbench/services/update/browser/updateService.ts';
const REMOTE_PROFILE_REL = 'src/vs/workbench/services/userDataProfile/common/remoteUserDataProfiles.ts';
const WELCOME_REL = 'src/vs/workbench/contrib/welcomeAgentSessions/browser/agentSessionsWelcome.ts';

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

const syncCall = 'this.sync()';
const migrateCall = 'this.migrateMcpConfig()';
const openLocalCall = 'this.open(local)';
const openInstallCall = 'this.open(this.instantiationService.createInstance(McpWorkbenchServer, e => this.getInstallState(e), e => this.getRuntimeStatus(e), undefined, undefined, { name, config, inputs }))';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const fetchAlertsCall = 'this.fetchAlerts(emergencyAlertUrl)';
const gnomeMigrateCall = 'this.migrateToGnomeLibsecret()';
const ignoredCall = 'this.initIgnoredWorkspaceRecommendations()';
const updateCall = 'this.checkForUpdates(false)';
const cleanUpCall = 'this.cleanUp()';
const openSessionCall = 'this.openSessionInChat(chatSessionResource)';
const revealChatCall = 'this.revealMaximizedChat()';
const updatePolicyCall = 'this._updatePolicyDefinitions(this.policyDefinitions)';
const updateCacheCall = 'this.updateCache()';
const updateCachedDefaultsCall = 'this.updateCachedConfigurationDefaultsOverrides()';
const waitAndInitializeCall = 'this.waitAndInitialize(this._workspaceIdentifier)';
const editorOpenThenCall = `			this.open(id, extension, template, cts.token)
				.then(activeElement => {
					if (cts.token.isCancellationRequested) {
						return;
					}
					this.activeElement = activeElement;
					if (focus) {
						this.focus();
					}
				})`;

const d824Calls: Array<[string, string, number]> = [
	[DISCOVERY_REL, syncCall, 1],
	[MIGRATION_REL, migrateCall, 1],
	[WORKBENCH_REL, openLocalCall, 3],
	[WORKBENCH_REL, openInstallCall, 1],
];

suite('leftover remaining unused after D821 moved to leftover remaining unused mcp leftover Promise fire-and-forget catch scan (D824)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D821 had fewer than four legal unused leftover sites so this knife moved', () => {
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(folding), 0);
		assert.strictEqual(countDoubleChains(inlayHints), 0);
		assert.strictEqual(countDoubleChains(languageStatus), 0);
		assert.ok(suggest.includes('this._currentSuggestionDetails.then(() => {'));
		assert.ok(!suggest.includes(`this._currentSuggestionDetails.then(() => {${doubleCatch}`));
		assert.ok(configuration.includes(`\t\tthis.updateCache();\n`));
		assert.ok(!configuration.includes(`${updateCacheCall}${doubleCatch}`));
		assert.ok(configuration.includes(`\t\tthis.updateCachedConfigurationDefaultsOverrides();\n`) || configuration.includes(`\t\t\tthis.updateCachedConfigurationDefaultsOverrides();\n`));
		assert.ok(!configuration.includes(`${updateCachedDefaultsCall}${doubleCatch}`));
		assert.ok(configuration.includes(`\t\t\t\tthis.waitAndInitialize(this._workspaceIdentifier);\n`));
		assert.ok(!configuration.includes(`${waitAndInitializeCall}${doubleCatch}`));
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused after D821 legal leftover <4, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!folding.includes('D824'));
		assert.ok(!inlayHints.includes('D824'));
		assert.ok(!languageStatus.includes('D824'));
		assert.ok(!configuration.includes('D824'));
	});

	test('this knife covers six leftover Promise double-chain sites after leftover remaining unused after D821 moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d824Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 6);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(DISCOVERY_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(MIGRATION_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(WORKBENCH_REL) ?? ''), 5);
	});

	test('mcp leftover remaining unused sync / migrateMcpConfig / open leftover void promises are Promise/async + double-chain', () => {
		const discovery = fs.readFileSync(resolveSource(DISCOVERY_REL), 'utf8');
		const migration = fs.readFileSync(resolveSource(MIGRATION_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');
		assertPromiseSignature(discovery, 'private async sync(): Promise<void> {');
		assertPromiseSignature(migration, 'private async migrateMcpConfig(): Promise<void> {');
		assertPromiseSignature(workbench, 'async open(extension: IWorkbenchMcpServer, options?: IEditorOptions): Promise<void> {');
		assert.ok(discovery.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(migration.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(workbench.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(discovery, syncCall);
		assertWrapped(migration, migrateCall);
		assertWrapped(workbench, openLocalCall);
		assertWrapped(workbench, openInstallCall);
		assert.strictEqual(countIncludes(discovery, `${syncCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(migration, `${migrateCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(workbench, `${openLocalCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(workbench, `${openInstallCall}${doubleCatch}`), 1);
		assert.ok(discovery.includes('throttler.queue(() => this.sync())'));
		assert.ok(!discovery.includes(`throttler.queue(() => this.sync()${doubleCatch}`));
		assert.ok(!discovery.includes('\t\tthis.sync();\n'));
		assert.ok(!migration.includes('\t\tthis.migrateMcpConfig();\n'));
		assert.ok(!workbench.includes('\t\t\tthis.open(local);\n'));
		assert.ok(!workbench.includes('\t\t\t\t\t\tthis.open(local);\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const discovery = fs.readFileSync(resolveSource(DISCOVERY_REL), 'utf8');
		const migration = fs.readFileSync(resolveSource(MIGRATION_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const addConfig = fs.readFileSync(resolveSource(ADD_CONFIG_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(workbench, 'async open(extension: IWorkbenchMcpServer, options?: IEditorOptions): Promise<void> {');

		assert.ok(!discovery.includes('openerService.open'));
		assert.ok(!migration.includes('openerService.open'));
		assert.ok(!workbench.includes('openerService.open'));
		assert.ok(!discovery.includes('extends Action2'));
		assert.ok(!migration.includes('extends Action2'));
		assert.ok(!workbench.includes('extends Action2'));
		assert.ok(!discovery.includes('.then(undefined,'));
		assert.ok(!migration.includes('.then(undefined,'));
		assert.ok(!workbench.includes('.then(undefined,'));
		assert.ok(workbench.includes('this.whenInitialLocalMcpServersLoaded = this.queryLocal().then(() => {'));
		assert.ok(!workbench.includes(`this.whenInitialLocalMcpServersLoaded = this.queryLocal().then(() => {${doubleCatch}`));
		assert.ok(editor.includes(`${editorOpenThenCall}${doubleCatch}`));
		assert.ok(addConfig.includes('return this.pickForUrlHandler(newURI, showIsPrimary);'));
		assert.ok(!addConfig.includes(`return this.pickForUrlHandler(newURI, showIsPrimary)${doubleCatch}`));
		assert.ok(!discovery.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!migration.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!workbench.includes(`${doubleCatch}.catch(onUnexpectedError)`));

		for (const source of [discovery, migration, workbench]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes('D824'));
		}
	});

	test('D794/D817/D819/D821 leftover remaining that landed scans lock unwrapped stay unwrapped; already-double leftover stays already-double; this knife did not overflow into dirty leftover modules', () => {
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const workbenchSvc = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_WIDGET_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const emergency = fs.readFileSync(resolveSource(EMERGENCY_REL), 'utf8');
		const encryption = fs.readFileSync(resolveSource(ENCRYPTION_REL), 'utf8');
		const ignored = fs.readFileSync(resolveSource(IGNORED_REL), 'utf8');
		const update = fs.readFileSync(resolveSource(UPDATE_REL), 'utf8');
		const remoteProfile = fs.readFileSync(resolveSource(REMOTE_PROFILE_REL), 'utf8');
		const welcome = fs.readFileSync(resolveSource(WELCOME_REL), 'utf8');

		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));
		assert.ok(settings.includes(`this.onConfigUpdate(e.affectedKeys)${doubleCatch}`));
		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(workbenchSvc.includes(`this.checkForUpdates(\`Enabled auto check updates\`)${doubleCatch}`));
		assert.ok(account.includes(`${updatePolicyCall}${doubleCatch}`));
		assert.ok(configuration.includes(`\t\tthis.updateCache();\n`));
		assert.ok(!configuration.includes(`${updateCacheCall}${doubleCatch}`));
		assert.ok(!gettingStarted.includes('D824'));

		assert.ok(emergency.includes(`${fetchAlertsCall}${doubleCatch}`));
		assert.ok(encryption.includes(`${gnomeMigrateCall}${doubleCatch}`));
		assert.ok(ignored.includes(`${ignoredCall}${doubleCatch}`));
		assert.ok(update.includes(`${updateCall}${doubleCatch}`));
		assert.ok(remoteProfile.includes(`${cleanUpCall}${doubleCatch}`));
		assert.ok(welcome.includes(`${openSessionCall}${doubleCatch}`));
		assert.ok(welcome.includes(`${revealChatCall}${doubleCatch}`));

		for (const [rel, source] of [
			[SETTINGS_REL, settings],
			[WORKBENCH_SVC_REL, workbenchSvc],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[PROGRESS_REL, progress],
			[USER_DATA_REL, userData],
			[TEXT_RES_REL, textRes],
			[XTERM_REL, xterm],
			[NOTEBOOK_WIDGET_REL, notebook],
			[SECRETS_REL, secrets],
			[INTEGRITY_REL, integrity],
			[LABEL_REL, label],
			[TASKS_REL, tasks],
			[ACCOUNT_REL, account],
			[CONFIG_REL, configuration],
			[GETTING_STARTED_REL, gettingStarted],
			[EMERGENCY_REL, emergency],
			[ENCRYPTION_REL, encryption],
			[IGNORED_REL, ignored],
			[UPDATE_REL, update],
			[REMOTE_PROFILE_REL, remoteProfile],
			[WELCOME_REL, welcome],
		] as const) {
			assert.ok(!source.includes('D824'), `${rel} should not mention D824`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/emergencyAlert/test/node/unusedLeftoverPromiseCatchScanD824.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/policyExport/test/node/unusedLeftoverPromiseCatchScanD824.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD824.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/settingsEditor2LeftoverPromiseCatchScanD824.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD824.test.ts')));
	});
});
