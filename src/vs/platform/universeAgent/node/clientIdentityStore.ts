/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash, createPrivateKey, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { IEncryptionMainService } from '../../encryption/common/encryptionService.js';
import { IApplicationStorageMainService } from '../../storage/electron-main/storageMainService.js';
import { StorageScope, StorageTarget } from '../../storage/common/storage.js';
import { createEd25519DeviceAuthSigner, type Ed25519PrivateKeyMaterial } from './deviceGrant/device-grant-crypto.js';
import type { DeviceAuthTranscriptInput } from './deviceGrant/device-grant-crypto.js';

const DEVICE_IDENTITY_STORAGE_KEY = 'universeAgent.secret.deviceIdentity';
const IDENTITY_ID_PATTERN = /^[0-9a-f]{64}$/;
const ED25519_PUBLIC_RAW_LEN = 32;

export type ClientIdentityMaterial = {
	readonly clientIdentityId: string;
	readonly clientPublicKey: Uint8Array;
	readonly privateKeyPkcs8: Uint8Array;
};

export type ClientIdentityStoreState =
	| { readonly kind: 'ready'; readonly identity: ClientIdentityMaterial }
	| { readonly kind: 'encryption_unavailable' }
	| { readonly kind: 'corrupt'; readonly reason: string };

export interface IClientIdentityStore {
	getState(): Promise<ClientIdentityStoreState>;
	getOrCreateIdentity(): Promise<ClientIdentityStoreState>;
	createSigner(): Promise<((input: DeviceAuthTranscriptInput) => Uint8Array) | undefined>;
}

type StoredDeviceIdentityEnvelope = {
	readonly clientIdentityId: string;
	readonly privateKeyPkcs8: number[];
	readonly clientPublicKey: number[];
};

function extractEd25519PublicKeyRaw(publicKey: KeyObject): Uint8Array {
	const spki = publicKey.export({ type: 'spki', format: 'der' });
	if (spki.length < ED25519_PUBLIC_RAW_LEN) {
		throw new Error('Ed25519 SPKI export too short');
	}
	return Uint8Array.from(spki.subarray(spki.length - ED25519_PUBLIC_RAW_LEN));
}

export function mintClientIdentityMaterial(): ClientIdentityMaterial {
	const { privateKey, publicKey } = generateKeyPairSync('ed25519');
	const privateKeyPkcs8 = Uint8Array.from(privateKey.export({ type: 'pkcs8', format: 'der' }));
	const clientPublicKey = extractEd25519PublicKeyRaw(publicKey);
	const clientIdentityId = createHash('sha256').update(clientPublicKey).digest('hex');
	return { clientIdentityId, clientPublicKey, privateKeyPkcs8 };
}

function parseStoredEnvelope(bytes: Uint8Array): ClientIdentityMaterial {
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		throw new Error('device identity envelope is not valid JSON');
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('device identity envelope shape invalid');
	}
	const record = parsed as StoredDeviceIdentityEnvelope;
	if (typeof record.clientIdentityId !== 'string' || !IDENTITY_ID_PATTERN.test(record.clientIdentityId)) {
		throw new Error('clientIdentityId domain invalid');
	}
	if (!Array.isArray(record.privateKeyPkcs8) || !Array.isArray(record.clientPublicKey)) {
		throw new Error('device identity key material missing');
	}
	const privateKeyPkcs8 = Uint8Array.from(record.privateKeyPkcs8);
	const clientPublicKey = Uint8Array.from(record.clientPublicKey);
	if (clientPublicKey.byteLength !== ED25519_PUBLIC_RAW_LEN) {
		throw new Error('clientPublicKey length out of domain');
	}
	const derivedId = createHash('sha256').update(clientPublicKey).digest('hex');
	if (derivedId !== record.clientIdentityId) {
		throw new Error('clientIdentityId does not match public key');
	}
	createPrivateKey({ key: Buffer.from(privateKeyPkcs8), format: 'der', type: 'pkcs8' });
	return { clientIdentityId: record.clientIdentityId, clientPublicKey, privateKeyPkcs8 };
}

function encodeEnvelope(identity: ClientIdentityMaterial): string {
	return JSON.stringify({
		clientIdentityId: identity.clientIdentityId,
		privateKeyPkcs8: Array.from(identity.privateKeyPkcs8),
		clientPublicKey: Array.from(identity.clientPublicKey),
	});
}

export class ClientIdentityStore implements IClientIdentityStore {

	private cachedIdentity: ClientIdentityMaterial | undefined;

	constructor(
		private readonly encryptionService: IEncryptionMainService,
		private readonly applicationStorage: IApplicationStorageMainService,
	) { }

	async getState(): Promise<ClientIdentityStoreState> {
		if (!(await this.encryptionService.isEncryptionAvailable())) {
			return { kind: 'encryption_unavailable' };
		}
		try {
			const identity = await this.loadIdentity();
			if (!identity) {
				return { kind: 'ready', identity: mintClientIdentityMaterial() };
			}
			return { kind: 'ready', identity };
		} catch (err) {
			return {
				kind: 'corrupt',
				reason: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async getOrCreateIdentity(): Promise<ClientIdentityStoreState> {
		if (!(await this.encryptionService.isEncryptionAvailable())) {
			return { kind: 'encryption_unavailable' };
		}
		try {
			const existing = await this.loadIdentity();
			if (existing) {
				return { kind: 'ready', identity: existing };
			}
			const identity = mintClientIdentityMaterial();
			await this.persistIdentity(identity);
			return { kind: 'ready', identity };
		} catch (err) {
			return {
				kind: 'corrupt',
				reason: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async createSigner(): Promise<((input: DeviceAuthTranscriptInput) => Uint8Array) | undefined> {
		const state = await this.getOrCreateIdentity();
		if (state.kind !== 'ready') {
			return undefined;
		}
		const material: Ed25519PrivateKeyMaterial = state.identity.privateKeyPkcs8;
		return createEd25519DeviceAuthSigner(material);
	}

	private async loadIdentity(): Promise<ClientIdentityMaterial | undefined> {
		if (this.cachedIdentity) {
			return this.cachedIdentity;
		}
		const encrypted = this.applicationStorage.get(DEVICE_IDENTITY_STORAGE_KEY, StorageScope.APPLICATION);
		if (!encrypted) {
			return undefined;
		}
		const decrypted = await this.encryptionService.decrypt(encrypted);
		const identity = parseStoredEnvelope(new TextEncoder().encode(decrypted));
		this.cachedIdentity = identity;
		return identity;
	}

	private async persistIdentity(identity: ClientIdentityMaterial): Promise<void> {
		const encrypted = await this.encryptionService.encrypt(encodeEnvelope(identity));
		this.applicationStorage.store(
			DEVICE_IDENTITY_STORAGE_KEY,
			encrypted,
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
		);
		this.cachedIdentity = identity;
	}
}

/** In-memory store for tests — never touches safeStorage. */
export class InMemoryClientIdentityStore implements IClientIdentityStore {

	private identity: ClientIdentityMaterial | undefined;
	private encryptionAvailable: boolean;

	constructor(options?: { readonly encryptionAvailable?: boolean; readonly initial?: ClientIdentityMaterial }) {
		this.encryptionAvailable = options?.encryptionAvailable ?? true;
		this.identity = options?.initial;
	}

	async getState(): Promise<ClientIdentityStoreState> {
		if (!this.encryptionAvailable) {
			return { kind: 'encryption_unavailable' };
		}
		if (!this.identity) {
			return { kind: 'ready', identity: mintClientIdentityMaterial() };
		}
		return { kind: 'ready', identity: this.identity };
	}

	async getOrCreateIdentity(): Promise<ClientIdentityStoreState> {
		if (!this.encryptionAvailable) {
			return { kind: 'encryption_unavailable' };
		}
		if (!this.identity) {
			this.identity = mintClientIdentityMaterial();
		}
		return { kind: 'ready', identity: this.identity };
	}

	async createSigner(): Promise<((input: DeviceAuthTranscriptInput) => Uint8Array) | undefined> {
		const state = await this.getOrCreateIdentity();
		if (state.kind !== 'ready') {
			return undefined;
		}
		return createEd25519DeviceAuthSigner(state.identity.privateKeyPkcs8);
	}
}
