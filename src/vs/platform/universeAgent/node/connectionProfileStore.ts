/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';
import { IStorageService, StorageScope, StorageTarget } from '../../storage/common/storage.js';
import type { EngineTrustRecord } from './engineTrustStore.js';
import { verifyEngineTrustRecord } from './engineTrustStore.js';

export type ConnectionTarget =
	| { readonly kind: 'loopback'; readonly socketOrPort: string | number }
	| { readonly kind: 'directAddress'; readonly host: string; readonly port: number }
	| { readonly kind: 'hubDevice'; readonly hubBaseUrl: string; readonly accountId: string; readonly hubDeviceId: string };

export interface ConnectionProfile {
	readonly profileId: string;
	readonly displayName: string;
	readonly target: ConnectionTarget;
	readonly trust: EngineTrustRecord | null;
	readonly state: 'active' | 'pairingPending' | 'revoked' | 'disabled';
	readonly allowPrivateNetwork: boolean;
}

const STORAGE_KEY = 'universeAgent.connectionProfiles';
const PROFILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type PersistedTrustRecord = {
	readonly leafDer: number[];
	readonly leafSha256Hex: string;
	readonly engineIdentityId: string;
	readonly establishedAt: number;
	readonly establishedVia: 'sas';
};

type PersistedProfile = {
	readonly profileId: string;
	readonly displayName: string;
	readonly target: ConnectionTarget;
	readonly trust: PersistedTrustRecord | null;
	readonly state: ConnectionProfile['state'];
	readonly allowPrivateNetwork: boolean;
};

function serializeTrust(trust: EngineTrustRecord): PersistedTrustRecord {
	return {
		leafDer: Array.from(trust.leafDer),
		leafSha256Hex: trust.leafSha256Hex,
		engineIdentityId: trust.engineIdentityId,
		establishedAt: trust.establishedAt,
		establishedVia: trust.establishedVia,
	};
}

function deserializeTrust(raw: PersistedTrustRecord | null): EngineTrustRecord | null {
	if (raw === null) {
		return null;
	}
	const trust: EngineTrustRecord = {
		leafDer: Uint8Array.from(raw.leafDer),
		leafSha256Hex: raw.leafSha256Hex,
		engineIdentityId: raw.engineIdentityId,
		establishedAt: raw.establishedAt,
		establishedVia: raw.establishedVia,
	};
	return verifyEngineTrustRecord(trust).ok ? trust : null;
}

function validateProfile(input: PersistedProfile): ConnectionProfile | undefined {
	if (!PROFILE_ID_PATTERN.test(input.profileId)) {
		return undefined;
	}
	if (typeof input.displayName !== 'string' || input.displayName.trim().length === 0) {
		return undefined;
	}
	if (
		input.state !== 'active' &&
		input.state !== 'pairingPending' &&
		input.state !== 'revoked' &&
		input.state !== 'disabled'
	) {
		return undefined;
	}
	if (typeof input.allowPrivateNetwork !== 'boolean') {
		return undefined;
	}
	const trust = deserializeTrust(input.trust);
	if (input.trust !== null && trust === null) {
		return undefined;
	}
	return {
		profileId: input.profileId,
		displayName: input.displayName,
		target: input.target,
		trust,
		state: input.state,
		allowPrivateNetwork: input.allowPrivateNetwork,
	};
}

export interface IConnectionProfileStore {
	list(): ConnectionProfile[];
	get(profileId: string): ConnectionProfile | undefined;
	put(profile: ConnectionProfile): void;
	remove(profileId: string): void;
	createDraft(input: {
		readonly displayName: string;
		readonly target: ConnectionTarget;
		readonly allowPrivateNetwork?: boolean;
	}): ConnectionProfile;
}

export class ConnectionProfileStore implements IConnectionProfileStore {

	constructor(
		private readonly storageService: IStorageService,
	) { }

	list(): ConnectionProfile[] {
		return this.readAll().filter((profile): profile is ConnectionProfile => profile !== undefined);
	}

	get(profileId: string): ConnectionProfile | undefined {
		return this.readAll().find(p => p?.profileId === profileId);
	}

	put(profile: ConnectionProfile): void {
		const profiles = this.list().filter(p => p.profileId !== profile.profileId);
		profiles.push(profile);
		this.writeAll(profiles);
	}

	remove(profileId: string): void {
		this.writeAll(this.list().filter(p => p.profileId !== profileId));
	}

	createDraft(input: {
		readonly displayName: string;
		readonly target: ConnectionTarget;
		readonly allowPrivateNetwork?: boolean;
	}): ConnectionProfile {
		return {
			profileId: randomUUID(),
			displayName: input.displayName,
			target: input.target,
			trust: null,
			state: 'pairingPending',
			allowPrivateNetwork: input.allowPrivateNetwork ?? false,
		};
	}

	private readAll(): (ConnectionProfile | undefined)[] {
		const raw = this.storageService.get(STORAGE_KEY, StorageScope.APPLICATION);
		if (!raw) {
			return [];
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return [];
		}
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.map(item => validateProfile(item as PersistedProfile));
	}

	private writeAll(profiles: ConnectionProfile[]): void {
		const payload: PersistedProfile[] = profiles.map(profile => ({
			profileId: profile.profileId,
			displayName: profile.displayName,
			target: profile.target,
			trust: profile.trust ? serializeTrust(profile.trust) : null,
			state: profile.state,
			allowPrivateNetwork: profile.allowPrivateNetwork,
		}));
		this.storageService.store(STORAGE_KEY, JSON.stringify(payload), StorageScope.APPLICATION, StorageTarget.MACHINE);
	}
}
