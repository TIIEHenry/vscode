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
const AUTO_REL = 'src/vs/workbench/contrib/chat/browser/pluginAutoUpdate.ts';
const STORE_REL = 'src/vs/workbench/contrib/chat/common/plugins/fileBackedInstalledPluginsStore.ts';
const INSTALL_REL = 'src/vs/workbench/contrib/chat/browser/pluginInstallService.ts';
const IMPL_REL = 'src/vs/workbench/contrib/chat/common/plugins/agentPluginServiceImpl.ts';
const SOURCES_REL = 'src/vs/workbench/contrib/chat/browser/pluginSources.ts';
const MARKET_REL = 'src/vs/workbench/contrib/chat/common/plugins/pluginMarketplaceService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/chat/common/plugins/workspacePluginSettingsService.ts';

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

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count);
	assert.ok(source.includes(`${call}${doubleCatch};`));
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('Chat plugin leftover Promise fire-and-forget catch scan (D681)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('pluginAutoUpdate _triggerAutoUpdate leftover voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(AUTO_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _triggerAutoUpdate(marketplaceIds: ReadonlySet<string>): Promise<void> {'));
		assertDoubleChain(source, 'void this._triggerAutoUpdate(marketplaceIds)', 2);
	});

	test('fileBackedInstalledPluginsStore leftover initialize / write / file-change are double-chain', () => {
		const source = fs.readFileSync(resolveSource(STORE_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _initialize(): Promise<void> {'));
		assert.ok(source.includes('private async _onFileChanged(): Promise<void> {'));
		assertDoubleChain(source, 'void this._initialize()', 1);
		assert.ok(source.includes(`void this._writeDelayer.trigger(async () => {
			await this._writeToFile();
		})${doubleCatch};`));
		assert.ok(!source.includes('void this._writeDelayer.trigger(async () => {\n\t\t\tawait this._writeToFile();\n\t\t});'));
		assert.ok(!source.includes('void this._writeDelayer.trigger(async () => {\n\t\t\tawait this._writeToFile();\n\t\t}).catch(onUnexpectedError);'));
		assertDoubleChain(source, 'void this._onFileChanged()', 1);
		assert.ok(!source.includes('new RunOnceScheduler(() => this._onFileChanged(), 100)'));
	});

	test('pluginInstallService leftover cleanupPluginSource is double-chain', () => {
		const source = fs.readFileSync(resolveSource(INSTALL_REL), 'utf8');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, 'void this._pluginRepositoryService.cleanupPluginSource(tempPlugin)', 1);
	});

	test('agentPluginServiceImpl leftover readManifest / _refreshPlugins scheduler are double-chain', () => {
		const source = fs.readFileSync(resolveSource(IMPL_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('protected async _refreshPlugins(): Promise<void> {'));
		assertDoubleChain(source, 'void readManifest()', 3);
		assertDoubleChain(source, 'void this._refreshPlugins()', 4);
		assert.ok(source.includes('await this._refreshPlugins();'));
		assert.ok(!source.includes('new RunOnceScheduler(() => this._refreshPlugins(), 0)'));
		assert.ok(!source.includes('onDidChange(() => readManifest())'));
	});

	test('pluginSources leftover timeoutHandle.then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(SOURCES_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes(`void timeoutHandle.then(() => {`));
		assert.ok(source.includes(`})${doubleCatch};`));
		assert.ok(!source.includes('void timeoutHandle.then(() => {\n\t\t\t\tif (isResolved) {\n\t\t\t\t\treturn;\n\t\t\t\t}\n\t\t\t\tthis._logService.warn(`[${this.kind}] Terminal command completion timed out`);\n\t\t\t\tresolveAndDispose(undefined);\n\t\t\t});'));
		assert.ok(!source.includes('void timeoutHandle.then(() => {\n\t\t\t\tif (isResolved) {\n\t\t\t\t\treturn;\n\t\t\t\t}\n\t\t\t\tthis._logService.warn(`[${this.kind}] Terminal command completion timed out`);\n\t\t\t\tresolveAndDispose(undefined);\n\t\t\t}).catch(onUnexpectedError);'));
	});

	test('pluginMarketplaceService leftover update-check delayer is double-chain', () => {
		const source = fs.readFileSync(resolveSource(MARKET_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(!source.includes('isCancellationError'));
		assert.ok(source.includes(`}, delay)${doubleCatch};`));
		assert.ok(!source.includes('}, delay).catch(error => {'));
		assert.ok(!source.includes('}, delay).catch(onUnexpectedError);'));
	});

	test('workspacePluginSettingsService leftover _readSettings are double-chain', () => {
		const source = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _readSettings(dirs: readonly URI[], logPrefix: string, fileService: IFileService): Promise<void> {'));
		assertDoubleChain(source, 'void this._readSettings(dirs, logPrefix, fileService)', 2);
		assert.ok(!source.includes('new RunOnceScheduler(() => this._readSettings(dirs, logPrefix, fileService), 100)'));
	});
});
