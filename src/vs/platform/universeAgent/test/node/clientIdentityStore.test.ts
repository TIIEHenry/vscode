/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IEncryptionMainService, KnownStorageProvider } from '../../../encryption/common/encryptionService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../storage/common/storage.js';
import { ClientIdentityStore, InMemoryClientIdentityStore, type ClientIdentityStoreState } from '../../node/clientIdentityStore.js';

class PrefixEncryptionService implements IEncryptionMainService {
	declare readonly _serviceBrand: undefined;

	setUsePlainTextEncryption(): Promise<void> {
		return Promise.resolve();
	}

	getKeyStorageProvider(): Promise<KnownStorageProvider> {
		return Promise.resolve(KnownStorageProvider.basicText);
	}

	encrypt(value: string): Promise<string> {
		return Promise.resolve(`enc:${value}`);
	}

	decrypt(value: string): Promise<string> {
		return Promise.resolve(value.slice('enc:'.length));
	}

	isEncryptionAvailable(): Promise<boolean> {
		return Promise.resolve(true);
	}
}

class MapApplicationStorage implements Pick<IStorageService, 'get' | 'store' | 'remove'> {
	private readonly data = new Map<string, string>();

	get(key: string, scope: StorageScope, fallbackValue: string): string;
	get(key: string, scope: StorageScope, fallbackValue?: string): string | undefined;
	get(key: string, _scope: StorageScope, fallbackValue?: string): string | undefined {
		return this.data.get(key) ?? fallbackValue;
	}

	store(key: string, value: string | number | boolean | object | null | undefined, _scope: StorageScope, _target: StorageTarget): void {
		this.data.set(key, String(value));
	}

	remove(key: string, _scope: StorageScope): void {
		this.data.delete(key);
	}

	asService(): IStorageService {
		return this as unknown as IStorageService;
	}
}

function identityId(state: ClientIdentityStoreState): string | undefined {
	return state.kind === 'ready' ? state.identity.clientIdentityId : undefined;
}

suite('Client identity store getState', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ClientIdentityStore.getState without a persisted identity returns the identity later calls see', async () => {
		const storage = new MapApplicationStorage();
		const store = new ClientIdentityStore(new PrefixEncryptionService(), storage.asService());

		const first = identityId(await store.getState());
		const second = identityId(await store.getState());
		const created = identityId(await store.getOrCreateIdentity());
		const reopened = identityId(await new ClientIdentityStore(new PrefixEncryptionService(), storage.asService()).getState());

		assert.ok(first);
		assert.deepStrictEqual([second, created, reopened], [first, first, first]);
	});

	test('InMemoryClientIdentityStore.getState without an identity returns the identity later calls see', async () => {
		const store = new InMemoryClientIdentityStore();

		const first = identityId(await store.getState());
		const second = identityId(await store.getState());
		const created = identityId(await store.getOrCreateIdentity());

		assert.ok(first);
		assert.deepStrictEqual([second, created], [first, first]);
	});
});
