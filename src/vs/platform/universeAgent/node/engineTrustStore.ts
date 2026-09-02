/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope, StorageTarget } from '../../storage/common/storage.js';
import { deriveEngineLeafFingerprintHex } from './deviceGrant/tls-pin.js';

export interface EngineTrustRecord {
	readonly leafDer: Uint8Array;
	readonly leafSha256Hex: string;
	readonly engineIdentityId: string;
	readonly establishedAt: number;
	readonly establishedVia: 'sas';
}

const STORAGE_KEY_PREFIX = 'universeAgent.engineTrust.';
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

export type TrustIntegrity =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: 'corrupt' | 'invalid_shape' };

export function verifyEngineTrustRecord(trust: EngineTrustRecord): TrustIntegrity {
	if (
		!(trust.leafDer instanceof Uint8Array) ||
		trust.leafDer.byteLength === 0 ||
		typeof trust.leafSha256Hex !== 'string' ||
		!FINGERPRINT_PATTERN.test(trust.leafSha256Hex) ||
		typeof trust.engineIdentityId !== 'string' ||
		trust.engineIdentityId.length === 0 ||
		typeof trust.establishedAt !== 'number' ||
		!Number.isFinite(trust.establishedAt) ||
		trust.establishedVia !== 'sas'
	) {
		return { ok: false, reason: 'invalid_shape' };
	}
	if (deriveEngineLeafFingerprintHex(trust.leafDer) !== trust.leafSha256Hex) {
		return { ok: false, reason: 'corrupt' };
	}
	return { ok: true };
}

export function createEngineTrustRecord(input: {
	readonly leafDer: Uint8Array;
	readonly engineIdentityId: string;
	readonly establishedAt: number;
}): EngineTrustRecord {
	const leafDer = Uint8Array.from(input.leafDer);
	return {
		leafDer,
		leafSha256Hex: deriveEngineLeafFingerprintHex(leafDer),
		engineIdentityId: input.engineIdentityId,
		establishedAt: input.establishedAt,
		establishedVia: 'sas',
	};
}

type PersistedTrustRecord = {
	readonly leafDer: number[];
	readonly leafSha256Hex: string;
	readonly engineIdentityId: string;
	readonly establishedAt: number;
	readonly establishedVia: 'sas';
};

function serializeTrustRecord(record: EngineTrustRecord): string {
	const payload: PersistedTrustRecord = {
		leafDer: Array.from(record.leafDer),
		leafSha256Hex: record.leafSha256Hex,
		engineIdentityId: record.engineIdentityId,
		establishedAt: record.establishedAt,
		establishedVia: record.establishedVia,
	};
	return JSON.stringify(payload);
}

function deserializeTrustRecord(raw: string): EngineTrustRecord | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return undefined;
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return undefined;
	}
	const record = parsed as PersistedTrustRecord;
	if (!Array.isArray(record.leafDer)) {
		return undefined;
	}
	const trust: EngineTrustRecord = {
		leafDer: Uint8Array.from(record.leafDer),
		leafSha256Hex: record.leafSha256Hex,
		engineIdentityId: record.engineIdentityId,
		establishedAt: record.establishedAt,
		establishedVia: record.establishedVia,
	};
	return verifyEngineTrustRecord(trust).ok ? trust : undefined;
}

export interface IEngineTrustStore {
	get(engineIdentityId: string): EngineTrustRecord | undefined;
	list(): EngineTrustRecord[];
	put(record: EngineTrustRecord): void;
	remove(engineIdentityId: string): void;
}

export class EngineTrustStore implements IEngineTrustStore {

	constructor(
		private readonly storageService: IStorageService,
	) { }

	get(engineIdentityId: string): EngineTrustRecord | undefined {
		const raw = this.storageService.get(`${STORAGE_KEY_PREFIX}${engineIdentityId}`, StorageScope.APPLICATION);
		if (!raw) {
			return undefined;
		}
		return deserializeTrustRecord(raw);
	}

	list(): EngineTrustRecord[] {
		const records: EngineTrustRecord[] = [];
		for (const key of this.storageService.keys(StorageScope.APPLICATION, StorageTarget.MACHINE)) {
			if (!key.startsWith(STORAGE_KEY_PREFIX)) {
				continue;
			}
			const raw = this.storageService.get(key, StorageScope.APPLICATION);
			if (!raw) {
				continue;
			}
			const record = deserializeTrustRecord(raw);
			if (record) {
				records.push(record);
			}
		}
		return records;
	}

	put(record: EngineTrustRecord): void {
		const integrity = verifyEngineTrustRecord(record);
		if (!integrity.ok) {
			throw new Error(`refusing to persist EngineTrustRecord: ${integrity.reason}`);
		}
		this.storageService.store(
			`${STORAGE_KEY_PREFIX}${record.engineIdentityId}`,
			serializeTrustRecord(record),
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
		);
	}

	remove(engineIdentityId: string): void {
		this.storageService.remove(`${STORAGE_KEY_PREFIX}${engineIdentityId}`, StorageScope.APPLICATION);
	}
}
