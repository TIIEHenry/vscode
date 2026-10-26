/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const SERVICE_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const USER_SETTINGS_REL = 'src/vs/platform/configuration/common/configurationModels.ts';

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

function assertDoubleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch};`) || source.includes(`${call}${doubleCatch})`) || source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const applicationSchedulerThen = `this.loadConfiguration().then(configurationModel => this._onDidChangeConfiguration.fire(configurationModel))`;
const userSchedulerThen = `this.userConfiguration.value!.loadConfiguration().then(configurationModel => this._onDidChangeConfiguration.fire(configurationModel))`;
const remoteReloadSchedulerThen = `this.reload().then(configurationModel => this._onDidChangeConfiguration.fire(configurationModel))`;
const folderProviderThen = `whenProviderRegistered(workspaceFolder.uri, fileService)
				.then(() => {
					this.folderConfiguration = this._register(this.createFileServiceBasedConfiguration(fileService, uriIdentityService, logService));
					this._register(this.folderConfiguration.onDidChange(e => this.onDidFolderConfigurationChange()));
					this.onDidFolderConfigurationChange();
				})`;
const workspaceChangedThen = `this.onWorkspaceConfigurationChanged(fromCache).then(() => {
				this.workspace.initialized = this.workspaceConfiguration.initialized;
				this.checkAndMarkWorkspaceComplete(fromCache);
			})`;
const schemasRegisteredThen = `extensionService.whenInstalledExtensionsRegistered().then(() => {
			this.registerConfigurationSchemas();

			const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
			const delayer = this._register(new Delayer<void>(50));
			this._register(Event.any(configurationRegistry.onDidUpdateConfiguration, configurationRegistry.onDidSchemaChange, workspaceTrustManagementService.onDidChangeTrust)(() =>
				delayer.trigger(() => this.registerConfigurationSchemas(), lifecycleService.phase === LifecyclePhase.Eventually ? undefined : 2500 /* delay longer in early phases */)));
		})`;

suite('workbench/services/configuration leftover Promise fire-and-forget catch scan (D747)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('six remaining fire-and-forget sites retain their Promise double-chain guards', () => {
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const d747 = [
			[configuration, applicationSchedulerThen],
			[configuration, userSchedulerThen],
			[configuration, remoteReloadSchedulerThen],
			[configuration, folderProviderThen],
			[service, workspaceChangedThen],
			[service, schemasRegisteredThen],
		] as const;
		// D747 drops only the RemoteUserConfiguration environment source pin and the seventh count.
		// That fire-and-forget duty now maps to the public contract suite:
		// "first background rejection is reported once and observed before the next attempt",
		// shared explicit-retry rejection (reports stay the initial error only),
		// and dispose-while-pending / disposed initial background work (late rejection is not reported).
		assert.strictEqual(d747.length, 6);
		for (const [source, call] of d747) {
			assertDoubleThen(source, call);
		}
	});

	test('leftover ApplicationConfiguration / UserConfiguration scheduler thens are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const userSettings = fs.readFileSync(resolveSource(USER_SETTINGS_REL), 'utf8');
		assertPromiseSignature(source, 'override async loadConfiguration(): Promise<ConfigurationModel> {');
		assertPromiseSignature(userSettings, 'async loadConfiguration(): Promise<ConfigurationModel> {');
		assert.ok(source.includes("import { CancellationError, getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, applicationSchedulerThen);
		assertDoubleThen(source, userSchedulerThen);
	});

	test('leftover FileServiceBasedRemoteUserConfiguration reload scheduler then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(source, 'async reload(): Promise<ConfigurationModel> {');
		assert.ok(source.includes("import { CancellationError, getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, remoteReloadSchedulerThen);
	});

	test('leftover FolderConfiguration whenProviderRegistered then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		assertPromiseSignature(files, 'export async function whenProviderRegistered(file: URI, fileService: IFileService): Promise<void> {');
		assert.ok(source.includes("import { CancellationError, getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, folderProviderThen);
	});

	test('leftover WorkspaceService onWorkspaceConfigurationChanged then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		assertPromiseSignature(source, 'private async onWorkspaceConfigurationChanged(fromCache: boolean): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, workspaceChangedThen);
	});

	test('leftover RegisterConfigurationSchemasContribution whenInstalledExtensionsRegistered then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, schemasRegisteredThen);
	});

	test('assigned then / opener / D145 / Connect / Watch / Resolve / Pty stay skipped', () => {
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		assert.ok(configuration.includes('return jsonEditingService.write(this._workspaceIdentifier.configPath, [{ path: [\'folders\'], value: folders }], true)\n\t\t\t\t.then(() => this.reload());'));
		assert.ok(!configuration.includes('then(() => this.reload()).catch(onUnexpectedError)'));
		assert.ok(service.includes('return this.workspaceConfiguration.reload().then(() => this.onWorkspaceConfigurationChanged(false));'));
		assert.ok(!service.includes('reload().then(() => this.onWorkspaceConfigurationChanged(false)).catch(onUnexpectedError)'));
		assert.ok(service.includes('return this.reloadRemoteUserConfiguration().then(() => undefined);'));
		assert.ok(!service.includes('reloadRemoteUserConfiguration().then(() => undefined).catch(onUnexpectedError)'));
		for (const source of [configuration, service]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('openerService.open'));
			assert.ok(!source.includes('IOpenerService'));
		}
	});
});
