/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IJSONEditingService } from '../../../../services/configuration/common/jsonEditing.js';
import { EncryptionContribution } from '../../electron-browser/encryption.contribution.js';

const migratedKey = 'encryption.migratedToGnomeLibsecret';

suite('EncryptionContribution', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not store the marker when write fails and writes argv again on retry', async () => {
		await silenceConsoleError(async () => {
			for (const passwordStore of ['gnome', 'gnome-keyring']) {
				const services = createServices(passwordStore, false);
				services.setFailWrite(true);
				await runConstructed(services, async contribution => {
					assert.strictEqual(services.writeCount(), 1);
					assert.strictEqual(services.storage.getBoolean(migratedKey, StorageScope.APPLICATION, false), false);

					await migrateAgain(contribution);

					assert.strictEqual(services.writeCount(), 2);
					assert.strictEqual(services.readCount(), 2);
					assert.strictEqual(services.storage.getBoolean(migratedKey, StorageScope.APPLICATION, false), false);
				});
			}
		});
	});

	test('stores the marker after write succeeds and does not write again', async () => {
		for (const passwordStore of ['gnome', 'gnome-keyring']) {
			const services = createServices(passwordStore, false);
			await runConstructed(services, async contribution => {
				assert.strictEqual(services.writeCount(), 1);
				assert.strictEqual(services.storage.getBoolean(migratedKey, StorageScope.APPLICATION, false), true);

				const reads = services.readCount();
				const writes = services.writeCount();
				await migrateAgain(contribution);

				assert.strictEqual(services.readCount(), reads);
				assert.strictEqual(services.writeCount(), writes);
			});
		}
	});

	test('does not read argv when not on Linux or when the marker is already set', async () => {
		// The electron unit runner loads this file with Chromium's ESM loader, which does not
		// apply Node module hooks. Stub isLinux in a Node child instead.
		const nonLinux = await runNonLinuxProbe();
		assert.strictEqual(nonLinux.reads, 0);
		assert.strictEqual(nonLinux.writes, 0);

		const alreadyMigrated = createServices('gnome-keyring', true);
		await runConstructed(alreadyMigrated, async () => {
			assert.strictEqual(alreadyMigrated.readCount(), 0);
			assert.strictEqual(alreadyMigrated.writeCount(), 0);
			assert.strictEqual(alreadyMigrated.storage.getBoolean(migratedKey, StorageScope.APPLICATION, false), true);
		});
	});

	interface IHarness {
		readonly storage: TestStorageService;
		readonly jsonEditingService: IJSONEditingService;
		readonly environmentService: IEnvironmentService;
		readonly fileService: IFileService;
		readCount(): number;
		writeCount(): number;
		setFailWrite(fail: boolean): void;
	}

	function createServices(passwordStore: string, alreadyMigrated: boolean): IHarness {
		const storage = disposables.add(new TestStorageService());
		if (alreadyMigrated) {
			storage.store(migratedKey, true, StorageScope.APPLICATION, StorageTarget.USER);
		}
		const argvResource = URI.file('/argv.json');
		let readCount = 0;
		let writeCount = 0;
		let failWrite = false;
		const fileService = {
			async readFile(resource: URI) {
				assert.strictEqual(resource.toString(), argvResource.toString());
				readCount++;
				return { value: { toString: () => JSON.stringify({ 'password-store': passwordStore }) } };
			},
		} as unknown as IFileService;
		const jsonEditingService = {
			async write() {
				writeCount++;
				if (failWrite) {
					throw new Error('argv write failed');
				}
			},
		} as unknown as IJSONEditingService;
		return {
			storage,
			jsonEditingService,
			environmentService: { argvResource } as IEnvironmentService,
			fileService,
			readCount: () => readCount,
			writeCount: () => writeCount,
			setFailWrite: (fail: boolean) => { failWrite = fail; },
		};
	}

	async function runConstructed(services: IHarness, afterFirst: (contribution: EncryptionContribution) => Promise<void>): Promise<void> {
		const proto = EncryptionContribution.prototype as unknown as {
			migrateToGnomeLibsecret(this: EncryptionContribution): Promise<void>;
		};
		const original = proto.migrateToGnomeLibsecret;
		let pending: Promise<void> | undefined;
		proto.migrateToGnomeLibsecret = function (this: EncryptionContribution) {
			const result = original.call(this);
			pending = result;
			return result;
		};
		try {
			const contribution = new EncryptionContribution(services.jsonEditingService, services.environmentService, services.fileService, services.storage);
			assert.ok(pending);
			await pending;
			proto.migrateToGnomeLibsecret = original;
			await afterFirst(contribution);
		} finally {
			proto.migrateToGnomeLibsecret = original;
		}
	}

	function migrateAgain(contribution: EncryptionContribution): Promise<void> {
		return (contribution as unknown as { migrateToGnomeLibsecret(): Promise<void> }).migrateToGnomeLibsecret();
	}
});

async function silenceConsoleError(run: () => Promise<void>): Promise<void> {
	const original = console.error;
	console.error = (() => { }) as typeof console.error;
	try {
		await run();
	} finally {
		console.error = original;
	}
}

function runNonLinuxProbe(): Promise<{ reads: number; writes: number }> {
	const contributionPath = join(process.cwd(), 'out/vs/workbench/contrib/encryption/electron-browser/encryption.contribution.js');
	if (!existsSync(contributionPath)) {
		return Promise.reject(new Error(`Missing compiled encryption contribution: ${contributionPath}`));
	}
	const script = nonLinuxProbeSource(pathToFileURL(contributionPath).href);
	return new Promise((resolve, reject) => {
		execFile(process.execPath, ['--input-type=module', '-e', script], {
			cwd: process.cwd(),
			env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
			encoding: 'utf8',
		}, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(`non-Linux migration probe failed: ${error.message}\n${stdout}\n${stderr}`));
				return;
			}
			resolve(JSON.parse(stdout) as { reads: number; writes: number });
		});
	});
}

function nonLinuxProbeSource(moduleUrl: string): string {
	return [
		"import { registerHooks } from 'node:module';",
		`const moduleUrl = ${JSON.stringify(moduleUrl)};`,
		"const fakeUrl = 'data:text/javascript,' + encodeURIComponent([",
		"\t'export const isLinux = false;',",
		"].join('\\n'));",
		'registerHooks({',
		'\tresolve(specifier, context, nextResolve) {',
		'\t\tconst parent = context.parentURL ?? \'\';',
		'\t\tif (specifier.endsWith(\'/base/common/platform.js\') && parent.includes(\'/encryption.contribution.js\')) {',
		'\t\t\treturn { url: fakeUrl, shortCircuit: true };',
		'\t\t}',
		'\t\treturn nextResolve(specifier, context);',
		'\t},',
		'});',
		'const { EncryptionContribution } = await import(moduleUrl);',
		'const proto = EncryptionContribution.prototype;',
		'const original = proto.migrateToGnomeLibsecret;',
		'let pending;',
		'proto.migrateToGnomeLibsecret = function () {',
		'\tconst result = original.call(this);',
		'\tpending = result;',
		'\treturn result;',
		'};',
		'let reads = 0;',
		'let writes = 0;',
		'const argv = { id: \'argv\' };',
		'try {',
		'\tnew EncryptionContribution(',
		'\t\t{ async write() { writes++; } },',
		'\t\t{ argvResource: argv },',
		'\t\t{ async readFile(resource) { if (resource !== argv) { throw new Error(\'unexpected argv\'); } reads++; return { value: { toString: () => \'{"password-store":"gnome"}\' } }; } },',
		'\t\t{ getBoolean() { return false; }, store() { } },',
		'\t);',
		'\tawait pending;',
		'} finally {',
		'\tproto.migrateToGnomeLibsecret = original;',
		'}',
		'process.stdout.write(JSON.stringify({ reads, writes }));',
	].join('\n');
}
