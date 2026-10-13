/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { TestSecretStorageService } from '../../../../../platform/secrets/test/common/testSecretStorageService.js';
import { StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { McpRegistryInputStorage } from '../../common/mcpRegistryInputStorage.js';

class KeyGateSecretStorage extends TestSecretStorageService {
	keyReads = 0;
	private gate: Promise<void> | undefined;
	private releaseGate: (() => void) | undefined;

	holdKeyReads(): { release: () => void } {
		let release!: () => void;
		this.gate = new Promise<void>(resolve => { release = resolve; });
		this.releaseGate = release;
		return { release: () => this.releaseHold() };
	}

	readStoredKey(): Promise<string | undefined> {
		return super.get('mcpEncryptionKey');
	}

	override async get(key: string): Promise<string | undefined> {
		if (key === 'mcpEncryptionKey') {
			this.keyReads++;
			const gate = this.gate;
			if (gate) {
				await gate;
			}
		}
		return super.get(key);
	}

	private releaseHold(): void {
		const release = this.releaseGate;
		this.gate = undefined;
		this.releaseGate = undefined;
		release?.();
	}
}

suite('Workbench - MCP - RegistryInputStorage', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let testStorageService: TestStorageService;
	let testSecretStorageService: TestSecretStorageService;
	let testLogService: ILogService;
	let mcpInputStorage: McpRegistryInputStorage;

	setup(() => {
		testStorageService = store.add(new TestStorageService());
		testSecretStorageService = new TestSecretStorageService();
		testLogService = store.add(new NullLogService());

		// Create the input storage with APPLICATION scope
		mcpInputStorage = store.add(new McpRegistryInputStorage(
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
			testStorageService,
			testSecretStorageService,
			testLogService
		));
	});

	test('setPlainText stores values that can be retrieved with getMap', async () => {
		const values = {
			'key1': { value: 'value1' },
			'key2': { value: 'value2' }
		};

		await mcpInputStorage.setPlainText(values);
		const result = await mcpInputStorage.getMap();

		assert.strictEqual(result.key1.value, 'value1');
		assert.strictEqual(result.key2.value, 'value2');
	});

	test('setSecrets stores encrypted values that can be retrieved with getMap', async () => {
		const secrets = {
			'secretKey1': { value: 'secretValue1' },
			'secretKey2': { value: 'secretValue2' }
		};

		await mcpInputStorage.setSecrets(secrets);
		const result = await mcpInputStorage.getMap();

		assert.strictEqual(result.secretKey1.value, 'secretValue1');
		assert.strictEqual(result.secretKey2.value, 'secretValue2');
	});

	test('getMap returns combined plain text and secret values', async () => {
		await mcpInputStorage.setPlainText({
			'plainKey': { value: 'plainValue' }
		});

		await mcpInputStorage.setSecrets({
			'secretKey': { value: 'secretValue' }
		});

		const result = await mcpInputStorage.getMap();

		assert.strictEqual(result.plainKey.value, 'plainValue');
		assert.strictEqual(result.secretKey.value, 'secretValue');
	});

	test('clear removes specific values', async () => {
		await mcpInputStorage.setPlainText({
			'key1': { value: 'value1' },
			'key2': { value: 'value2' }
		});

		await mcpInputStorage.setSecrets({
			'secretKey1': { value: 'secretValue1' },
			'secretKey2': { value: 'secretValue2' }
		});

		// Clear one plain and one secret value
		await mcpInputStorage.clear('key1');
		await mcpInputStorage.clear('secretKey1');

		const result = await mcpInputStorage.getMap();

		assert.strictEqual(result.key1, undefined);
		assert.strictEqual(result.key2.value, 'value2');
		assert.strictEqual(result.secretKey1, undefined);
		assert.strictEqual(result.secretKey2.value, 'secretValue2');
	});

	test('clearAll removes all values', async () => {
		await mcpInputStorage.setPlainText({
			'key1': { value: 'value1' }
		});

		await mcpInputStorage.setSecrets({
			'secretKey1': { value: 'secretValue1' }
		});

		mcpInputStorage.clearAll();

		const result = await mcpInputStorage.getMap();

		assert.deepStrictEqual(result, {});
	});

	test('updates to plain text values overwrite existing values', async () => {
		await mcpInputStorage.setPlainText({
			'key1': { value: 'value1' },
			'key2': { value: 'value2' }
		});

		await mcpInputStorage.setPlainText({
			'key1': { value: 'updatedValue1' }
		});

		const result = await mcpInputStorage.getMap();

		assert.strictEqual(result.key1.value, 'updatedValue1');
		assert.strictEqual(result.key2.value, 'value2');
	});

	test('updates to secret values overwrite existing values', async () => {
		await mcpInputStorage.setSecrets({
			'secretKey1': { value: 'secretValue1' },
			'secretKey2': { value: 'secretValue2' }
		});

		await mcpInputStorage.setSecrets({
			'secretKey1': { value: 'updatedSecretValue1' }
		});

		const result = await mcpInputStorage.getMap();

		assert.strictEqual(result.secretKey1.value, 'updatedSecretValue1');
		assert.strictEqual(result.secretKey2.value, 'secretValue2');
	});

	test('storage persists values across instances', async () => {
		// Set values on first instance
		await mcpInputStorage.setPlainText({
			'key1': { value: 'value1' }
		});

		await mcpInputStorage.setSecrets({
			'secretKey1': { value: 'secretValue1' }
		});

		await testStorageService.flush();

		// Create a second instance that should have access to the same storage
		const secondInstance = store.add(new McpRegistryInputStorage(
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
			testStorageService,
			testSecretStorageService,
			testLogService
		));

		const result = await secondInstance.getMap();

		assert.strictEqual(result.key1.value, 'value1');
		assert.strictEqual(result.secretKey1.value, 'secretValue1');

		assert.ok(!testStorageService.get('mcpInputs', StorageScope.APPLICATION)?.includes('secretValue1'));
	});

	interface IStoredInputs {
		version: number;
		values: Record<string, { value?: string }>;
		secrets?: { iv: string; value: string };
	}

	function readStoredInputs(): IStoredInputs {
		const stored = testStorageService.getObject('mcpInputs', StorageScope.APPLICATION);
		assert.ok(stored);
		return stored as IStoredInputs;
	}

	async function assertStoredCiphertextSurvivesKeyFailure(corruptKey: string): Promise<void> {
		await mcpInputStorage.setPlainText({ plainKey: { value: 'plainValue' } });
		await mcpInputStorage.setSecrets({ secretKey: { value: 'secretValue' } });
		await testStorageService.flush();

		const before = readStoredInputs();
		assert.ok(before.secrets);
		const ciphertext = { iv: before.secrets.iv, value: before.secrets.value };
		const originalKey = await testSecretStorageService.get('mcpEncryptionKey');
		assert.ok(originalKey);

		await testSecretStorageService.set('mcpEncryptionKey', corruptKey);

		const reloaded = store.add(new McpRegistryInputStorage(
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
			testStorageService,
			testSecretStorageService,
			testLogService
		));

		await assert.rejects(() => reloaded.getMap());
		await assert.rejects(() => reloaded.setSecrets({ secretKey: { value: 'replaced' } }));
		await assert.rejects(() => reloaded.clear('plainKey'));
		await assert.rejects(() => reloaded.clear('secretKey'));
		assert.strictEqual(await testSecretStorageService.get('mcpEncryptionKey'), corruptKey);

		await reloaded.setPlainText({ plainKey: { value: 'updatedPlain' } });
		await testStorageService.flush();

		const after = readStoredInputs();
		assert.deepStrictEqual(after.secrets, ciphertext);
		assert.strictEqual(after.values.plainKey?.value, 'updatedPlain');
		const raw = testStorageService.get('mcpInputs', StorageScope.APPLICATION);
		assert.ok(raw);
		assert.ok(!raw.includes('secretValue'));
		assert.ok(!raw.includes('replaced'));

		await testSecretStorageService.set('mcpEncryptionKey', originalKey);
		const restored = await reloaded.getMap();
		assert.strictEqual(restored.plainKey.value, 'updatedPlain');
		assert.strictEqual(restored.secretKey.value, 'secretValue');
	}

	test('reuses a successfully imported encryption key', async () => {
		const secrets = new KeyGateSecretStorage();
		const storageService = store.add(new TestStorageService());
		const storage = store.add(new McpRegistryInputStorage(
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
			storageService,
			secrets,
			testLogService
		));

		await storage.setSecrets({ secretKey: { value: 'secretValue1' } });
		const readsAfterImport = secrets.keyReads;
		assert.strictEqual(readsAfterImport, 1);

		await storage.setSecrets({ secretKey: { value: 'secretValue2' } });
		assert.strictEqual(secrets.keyReads, readsAfterImport);

		const result = await storage.getMap();
		assert.strictEqual(result.secretKey.value, 'secretValue2');
		assert.strictEqual(secrets.keyReads, readsAfterImport);
	});

	test('keeps the stored encryption key and ciphertext when the key JSON cannot be parsed', async () => {
		await assertStoredCiphertextSurvivesKeyFailure('{not-json');
	});

	test('keeps the stored encryption key and ciphertext when the key cannot be imported', async () => {
		await assertStoredCiphertextSurvivesKeyFailure('{"kty":"oct"}');
	});

	test('shares one in-flight encryption key read and reads again after it rejects', async () => {
		const secrets = new KeyGateSecretStorage();
		const storageService = store.add(new TestStorageService());
		const writer = store.add(new McpRegistryInputStorage(
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
			storageService,
			secrets,
			testLogService
		));

		await writer.setPlainText({ plainKey: { value: 'plainValue' } });
		await writer.setSecrets({ secretKey: { value: 'secretValue' } });
		await storageService.flush();

		const originalKey = await secrets.readStoredKey();
		assert.ok(originalKey);
		await secrets.set('mcpEncryptionKey', '{not-json');
		secrets.keyReads = 0;

		const reader = store.add(new McpRegistryInputStorage(
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
			storageService,
			secrets,
			testLogService
		));

		const hold = secrets.holdKeyReads();
		try {
			const read = reader.getMap();
			const write = reader.setSecrets({ secretKey: { value: 'replaced' } });
			const cleared = reader.clear('secretKey');
			const readRejected = assert.rejects(read);
			const writeRejected = assert.rejects(write);
			const clearRejected = assert.rejects(cleared);
			await new Promise(resolve => setTimeout(resolve, 0));
			assert.strictEqual(secrets.keyReads, 1);
			hold.release();
			await readRejected;
			await writeRejected;
			await clearRejected;
		} finally {
			hold.release();
		}

		await assert.rejects(() => reader.getMap());
		assert.strictEqual(secrets.keyReads, 2);
		assert.strictEqual(await secrets.readStoredKey(), '{not-json');

		await secrets.set('mcpEncryptionKey', originalKey);
		const restored = await reader.getMap();
		assert.strictEqual(restored.plainKey.value, 'plainValue');
		assert.strictEqual(restored.secretKey.value, 'secretValue');
		assert.strictEqual(secrets.keyReads, 3);
	});
});

