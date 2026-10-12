/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { registerHooks } from 'node:module';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IJSONEditingService } from '../../../../services/configuration/common/jsonEditing.js';
import type { EncryptionContribution as EncryptionContributionType } from '../../electron-browser/encryption.contribution.js';

const migratedKey = 'encryption.migratedToGnomeLibsecret';
const fakePlatformUrl = 'data:text/javascript,' + encodeURIComponent([
	'export let isLinux = true;',
	'export function setEncryptionContributionTestIsLinux(value) { isLinux = value; }',
].join('\n'));

registerHooks({
	resolve(specifier, context, nextResolve) {
		const parent = context.parentURL ?? '';
		if (specifier.endsWith('/base/common/platform.js') && parent.includes('/encryption.contribution.js')) {
			return { url: fakePlatformUrl, shortCircuit: true };
		}
		return nextResolve(specifier, context);
	},
});

type EncryptionContributionCtor = new (
	jsonEditingService: IJSONEditingService,
	environmentService: IEnvironmentService,
	fileService: IFileService,
	storageService: IStorageService,
) => EncryptionContributionType;

suite('EncryptionContribution', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	let setLinux!: (value: boolean) => void;
	let EncryptionContribution!: EncryptionContributionCtor;

	suiteSetup(async () => {
		const platform = await import(fakePlatformUrl) as {
			setEncryptionContributionTestIsLinux(value: boolean): void;
		};
		setLinux = platform.setEncryptionContributionTestIsLinux;
		({ EncryptionContribution } = await import('../../electron-browser/encryption.contribution.js') as Promise<{ EncryptionContribution: EncryptionContributionCtor }>);
	});

	setup(() => setLinux(true));

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
		setLinux(false);
		const nonLinux = createServices('gnome', false);
		await runConstructed(nonLinux, async () => {
			assert.strictEqual(nonLinux.readCount(), 0);
			assert.strictEqual(nonLinux.writeCount(), 0);
		});

		setLinux(true);
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

	async function runConstructed(services: IHarness, afterFirst: (contribution: EncryptionContributionType) => Promise<void>): Promise<void> {
		const proto = EncryptionContribution.prototype as unknown as {
			migrateToGnomeLibsecret(this: EncryptionContributionType): Promise<void>;
		};
		const original = proto.migrateToGnomeLibsecret;
		let pending: Promise<void> | undefined;
		proto.migrateToGnomeLibsecret = function (this: EncryptionContributionType) {
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

	function migrateAgain(contribution: EncryptionContributionType): Promise<void> {
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
