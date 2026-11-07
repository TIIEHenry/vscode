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
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const SERVICE_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const singleCatch = '.catch(onUnexpectedError)';
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
	assert.ok(source.includes(`${call}${singleCatch}`), `missing single-chain: ${call}`);
	assert.ok(!source.includes(`${call}${doubleCatch}`), `double catch remains: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${singleCatch};`), `bare leftover remains: ${call}`);
}

const updateCacheCall = 'this.updateCache()';
const updateCachedDefaultsCall = 'this.updateCachedConfigurationDefaultsOverrides()';
const waitAndInitializeCall = 'this.waitAndInitialize(this._workspaceIdentifier)';
const applicationSchedulerThen = `this.loadConfiguration().then(configurationModel => {
			if (this._store.isDisposed) {
				return;
			}
			this._onDidChangeConfiguration.fire(configurationModel);
		})`;
const userSchedulerThen = `this.userConfiguration.value.loadConfiguration().then(configurationModel => {
				if (this._store.isDisposed) {
					return;
				}
				this._onDidChangeConfiguration.fire(configurationModel);
			})`;
const remoteReloadSchedulerThen = `this.reload().then(configurationModel => {
			if (this._store.isDisposed) {
				return;
			}
			this._onDidChangeConfiguration.fire(configurationModel);
		})`;
const workspaceChangedThen = `this.onWorkspaceConfigurationChanged(fromCache).then(() => {
				if (this._store.isDisposed) {
					return;
				}
				this.workspace.initialized = this.workspaceConfiguration.initialized;
				this.checkAndMarkWorkspaceComplete(fromCache);
			})`;
const onDidWorkspaceChangeCall = 'this.onDidWorkspaceConfigurationChange(false, true)';
const onDidWorkspaceListenerCall = 'this.onDidWorkspaceConfigurationChange(true, false)';

const d827Calls: Array<[string, string, number]> = [
	[CONFIG_REL, updateCachedDefaultsCall, 2],
	[CONFIG_REL, updateCacheCall, 4],
	[CONFIG_REL, waitAndInitializeCall, 1],
];

suite('leftover remaining unused after D821 moved to configuration leftover remaining Promise fire-and-forget catch scan (D827)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers seven leftover Promise single-chain sites after leftover remaining unused after D821 moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d827Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${singleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 7);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(CONFIG_REL) ?? ''), 0);
	});

	test('configuration leftover remaining updateCache / updateCachedConfigurationDefaultsOverrides / waitAndInitialize leftover void promises are Promise/async + double-chain', () => {
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(configuration, 'private async updateCachedConfigurationDefaultsOverrides(): Promise<void> {');
		assertPromiseSignature(configuration, 'private async updateCache(): Promise<void> {');
		assertPromiseSignature(configuration, 'private async waitAndInitialize(workspaceIdentifier: IWorkspaceIdentifier): Promise<void> {');
		assert.ok(configuration.includes("import { CancellationError, getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(configuration, updateCachedDefaultsCall);
		assertWrapped(configuration, updateCacheCall);
		assertWrapped(configuration, waitAndInitializeCall);
		assert.strictEqual(countIncludes(configuration, `${updateCachedDefaultsCall}${singleCatch}`), 2);
		assert.strictEqual(countIncludes(configuration, `${updateCacheCall}${singleCatch}`), 4);
		assert.strictEqual(countIncludes(configuration, `${waitAndInitializeCall}${singleCatch}`), 1);
		assert.ok(!configuration.includes('\t\tthis.updateCachedConfigurationDefaultsOverrides();\n'));
		assert.ok(!configuration.includes('\t\t\tthis.updateCachedConfigurationDefaultsOverrides();\n'));
		assert.ok(!configuration.includes('\t\tthis.updateCache();\n'));
		assert.ok(!configuration.includes('\t\t\t\tthis.waitAndInitialize(this._workspaceIdentifier);\n'));
		assert.ok(configuration.includes(`${onDidWorkspaceChangeCall};\n`));
		assert.ok(!configuration.includes(`${onDidWorkspaceChangeCall}${doubleCatch}`));
		assert.ok(configuration.includes(`${onDidWorkspaceListenerCall}`));
		assert.ok(!configuration.includes(`${onDidWorkspaceListenerCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(configuration, 'private async updateCache(): Promise<void> {');

		assert.ok(!configuration.includes('openerService.open'));
		assert.ok(!configuration.includes('IOpenerService'));
		assert.ok(!configuration.includes('extends Action2'));
		assert.ok(!configuration.includes('registerAction2'));
		assert.ok(!configuration.includes('.then(undefined,'));
		assert.ok(configuration.includes('return jsonEditingService.write(this._workspaceIdentifier.configPath, [{ path: [\'folders\'], value: folders }], true)\n\t\t\t\t.then(() => this.reload());'));
		assert.ok(!configuration.includes('then(() => this.reload()).catch(onUnexpectedError)'));
		assert.ok(service.includes('return this.workspaceConfiguration.reload().then(() => this.onWorkspaceConfigurationChanged(false));'));
		assert.ok(!service.includes('reload().then(() => this.onWorkspaceConfigurationChanged(false)).catch(onUnexpectedError)'));
		assert.ok(service.includes('return this.reloadRemoteUserConfiguration().then(() => undefined);'));
		assert.ok(!service.includes('reloadRemoteUserConfiguration().then(() => undefined).catch(onUnexpectedError)'));
		assert.ok(configuration.includes(`${applicationSchedulerThen}${singleCatch}`));
		assert.ok(configuration.includes(`${userSchedulerThen}${singleCatch}`));
		assert.ok(configuration.includes(`${remoteReloadSchedulerThen}${singleCatch}`));
		assert.ok(service.includes(`${workspaceChangedThen}${singleCatch}`));
		assert.ok(!configuration.includes(doubleCatch));
		assert.ok(!service.includes(doubleCatch));
		assert.ok(!configuration.includes(`${doubleCatch}.catch(onUnexpectedError)`));

		for (const source of [configuration, service]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes('D827'));
		}
	});

});
