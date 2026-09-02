/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import type {
	ConnectionProfileProjection,
	HubAuthStatus,
	HubDeviceProjection,
	HubDirectoryStatus,
	HubLoginResult,
	HubOperationResult,
	IUniverseAgentHubService,
} from '../common/hub.js';
import type { ConnectionProfile, IConnectionProfileStore } from './connectionProfileStore.js';
import { ConnectionProfileStore } from './connectionProfileStore.js';
import { loginHub, changeHubPassword, logoutHub, type HubAuthHttp } from './hub/hub-auth-client.js';
import {
	confirmHubDeviceCode,
	listHubDevices,
	renameHubDevice,
	revokeHubDevice,
	type HubDevice,
	type HubDirectoryHttp,
} from './hubDirectoryClient.js';
import { InMemoryHubSessionStore, type IHubSessionStore } from './hubSessionStore.js';
import type { IStorageService } from '../../storage/common/storage.js';

export type UniverseAgentHubServiceOptions = {
	readonly hubSessionStore?: IHubSessionStore;
	readonly connectionProfileStore?: IConnectionProfileStore;
	readonly storageService?: IStorageService;
	readonly http?: HubAuthHttp & HubDirectoryHttp;
	readonly nowMs?: () => number;
};

function projectDevice(device: HubDevice): HubDeviceProjection {
	return {
		id: device.id,
		name: device.name,
		presence: device.presence,
		engineStatus: device.engineStatus,
		engineIdentityId: device.engineIdentityId,
		revoked: device.revoked,
	};
}

function projectProfile(profile: ConnectionProfile): ConnectionProfileProjection {
	return {
		profileId: profile.profileId,
		displayName: profile.displayName,
		state: profile.state,
		hasTrust: profile.trust !== null,
		targetKind: profile.target.kind,
	};
}

function mapAuthProjection(
	status: ReturnType<IHubSessionStore['getStatusForHub']>,
	directoryExpired: boolean,
): HubAuthStatus {
	if (directoryExpired) {
		return { kind: 'authExpired' };
	}
	switch (status.status) {
		case 'signedOut':
			return { kind: 'signedOut' };
		case 'signedIn':
			return { kind: 'signedIn', email: status.email };
		case 'mustChangePassword':
			return { kind: 'mustChangePassword', email: status.email };
		default:
			return { kind: 'signedOut' };
	}
}

export class UniverseAgentHubService extends Disposable implements IUniverseAgentHubService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeAuthStatus = this._register(new Emitter<HubAuthStatus>());
	readonly onDidChangeAuthStatus = this._onDidChangeAuthStatus.event;

	private readonly _onDidChangeDirectory = this._register(new Emitter<HubDirectoryStatus>());
	readonly onDidChangeDirectory = this._onDidChangeDirectory.event;

	private readonly _onDidChangeProfiles = this._register(new Emitter<readonly ConnectionProfileProjection[]>());
	readonly onDidChangeProfiles = this._onDidChangeProfiles.event;

	private readonly _hubSessionStore: IHubSessionStore;
	private readonly _connectionProfileStore: IConnectionProfileStore;
	private readonly _http: HubAuthHttp & HubDirectoryHttp;
	private readonly _nowMs: () => number;

	private _activeHubBaseUrl: string | undefined;
	private _directoryStatus: HubDirectoryStatus = { kind: 'idle' };
	private _directoryAuthExpired = false;

	constructor(options: UniverseAgentHubServiceOptions = {}) {
		super();
		this._hubSessionStore = options.hubSessionStore ?? new InMemoryHubSessionStore({ encryptionAvailable: false });
		if (options.connectionProfileStore) {
			this._connectionProfileStore = options.connectionProfileStore;
		} else if (options.storageService) {
			this._connectionProfileStore = new ConnectionProfileStore(options.storageService);
		} else {
			this._connectionProfileStore = new InMemoryConnectionProfileStore();
		}
		this._http = options.http ?? { fetch: globalThis.fetch.bind(globalThis) };
		this._nowMs = options.nowMs ?? Date.now;
	}

	getActiveHubBaseUrl(): string | undefined {
		return this._activeHubBaseUrl;
	}

	setActiveHubBaseUrl(hubBaseUrl: string | undefined): void {
		this._activeHubBaseUrl = hubBaseUrl?.trim() || undefined;
		this._directoryStatus = { kind: 'idle' };
		this._directoryAuthExpired = false;
		this._fireAuthChanged();
		this._fireDirectoryChanged();
		this._fireProfilesChanged();
	}

	getAuthStatus(): HubAuthStatus {
		const hubBaseUrl = this._activeHubBaseUrl;
		if (!hubBaseUrl) {
			return { kind: 'signedOut' };
		}
		return mapAuthProjection(
			this._hubSessionStore.getStatusForHub(hubBaseUrl, this._nowMs()),
			this._directoryAuthExpired,
		);
	}

	getDirectoryStatus(): HubDirectoryStatus {
		return this._directoryStatus;
	}

	listConnectionProfiles(): readonly ConnectionProfileProjection[] {
		return this._connectionProfileStore.list().map(projectProfile);
	}

	async login(hubBaseUrl: string, email: string, password: string): Promise<HubLoginResult> {
		const trimmed = hubBaseUrl.trim();
		if (!trimmed) {
			return { ok: false, code: 'hub_base_url_required', reason: 'hub base URL is required' };
		}
		const result = await loginHub({ hubBaseUrl: trimmed, email, password }, this._http);
		if (!result.ok) {
			return { ok: false, code: result.code, reason: result.reason };
		}
		this._activeHubBaseUrl = trimmed;
		this._directoryAuthExpired = false;
		await this._hubSessionStore.applyAuthSession(trimmed, result.session, this._nowMs());
		this._fireAuthChanged();
		await this.refreshDirectory();
		return { ok: true };
	}

	async logout(): Promise<void> {
		const hubBaseUrl = this._activeHubBaseUrl;
		if (hubBaseUrl) {
			const token = this._hubSessionStore.getAccessTokenForHub(hubBaseUrl, this._nowMs());
			if (token) {
				await logoutHub({ hubBaseUrl, accessToken: token }, this._http).catch(() => undefined);
			}
			await this._hubSessionStore.clear(hubBaseUrl);
		}
		this._directoryAuthExpired = false;
		this._directoryStatus = { kind: 'idle' };
		this._fireAuthChanged();
		this._fireDirectoryChanged();
	}

	async changePassword(oldPassword: string, newPassword: string): Promise<HubOperationResult> {
		const hubBaseUrl = this._activeHubBaseUrl;
		if (!hubBaseUrl) {
			return { ok: false, code: 'hub_session_required', reason: 'not signed in to a Hub' };
		}
		const token = this._hubSessionStore.getAccessTokenForHub(hubBaseUrl, this._nowMs());
		if (!token) {
			return { ok: false, code: 'hub_session_required', reason: 'hub access token unavailable' };
		}
		const result = await changeHubPassword({
			hubBaseUrl,
			accessToken: token,
			oldPassword,
			newPassword,
		}, this._http);
		if (!result.ok) {
			return { ok: false, code: result.code, reason: result.reason };
		}
		await this._hubSessionStore.applyAuthSession(hubBaseUrl, result.session, this._nowMs());
		this._fireAuthChanged();
		return { ok: true };
	}

	async refreshDirectory(): Promise<HubDirectoryStatus> {
		const hubBaseUrl = this._activeHubBaseUrl;
		if (!hubBaseUrl) {
			this._directoryStatus = { kind: 'idle' };
			this._fireDirectoryChanged();
			return this._directoryStatus;
		}
		const auth = this.getAuthStatus();
		if (auth.kind === 'signedOut' || auth.kind === 'mustChangePassword') {
			this._directoryStatus = { kind: 'idle' };
			this._fireDirectoryChanged();
			return this._directoryStatus;
		}

		const token = this._hubSessionStore.getAccessTokenForHub(hubBaseUrl, this._nowMs());
		if (!token) {
			this._directoryAuthExpired = true;
			this._directoryStatus = { kind: 'authExpired' };
			this._fireAuthChanged();
			this._fireDirectoryChanged();
			return this._directoryStatus;
		}

		const result = await listHubDevices({ hubBaseUrl, accessToken: token }, this._http);
		if (!result.ok) {
			if (result.code === 'hub_session_required' || result.code === 'hub_forbidden') {
				this._directoryAuthExpired = true;
				this._directoryStatus = { kind: 'authExpired' };
			} else if (result.code === 'hub_directory_http_failed') {
				this._directoryStatus = { kind: 'unreachable', reason: result.reason };
			} else {
				this._directoryStatus = { kind: 'error', code: result.code, reason: result.reason };
			}
			this._fireAuthChanged();
			this._fireDirectoryChanged();
			return this._directoryStatus;
		}

		this._directoryAuthExpired = false;
		this._directoryStatus = {
			kind: 'ok',
			devices: result.value.map(projectDevice),
		};
		this._fireAuthChanged();
		this._fireDirectoryChanged();
		return this._directoryStatus;
	}

	async renameDevice(deviceId: string, name: string): Promise<HubOperationResult> {
		const hubBaseUrl = this._activeHubBaseUrl;
		const token = hubBaseUrl ? this._hubSessionStore.getAccessTokenForHub(hubBaseUrl, this._nowMs()) : null;
		if (!hubBaseUrl || !token) {
			return { ok: false, code: 'hub_session_required', reason: 'hub session required' };
		}
		const result = await renameHubDevice({ hubBaseUrl, accessToken: token, hubDeviceId: deviceId, name }, this._http);
		if (!result.ok) {
			return { ok: false, code: result.code, reason: result.reason };
		}
		await this.refreshDirectory();
		return { ok: true };
	}

	async revokeDevice(deviceId: string): Promise<HubOperationResult> {
		const hubBaseUrl = this._activeHubBaseUrl;
		const token = hubBaseUrl ? this._hubSessionStore.getAccessTokenForHub(hubBaseUrl, this._nowMs()) : null;
		if (!hubBaseUrl || !token) {
			return { ok: false, code: 'hub_session_required', reason: 'hub session required' };
		}
		const result = await revokeHubDevice({ hubBaseUrl, accessToken: token, hubDeviceId: deviceId }, this._http);
		if (!result.ok) {
			return { ok: false, code: result.code, reason: result.reason };
		}
		await this.refreshDirectory();
		return { ok: true };
	}

	async confirmDeviceCode(code: string): Promise<HubOperationResult> {
		const hubBaseUrl = this._activeHubBaseUrl;
		const token = hubBaseUrl ? this._hubSessionStore.getAccessTokenForHub(hubBaseUrl, this._nowMs()) : null;
		if (!hubBaseUrl || !token) {
			return { ok: false, code: 'hub_session_required', reason: 'hub session required' };
		}
		const result = await confirmHubDeviceCode({ hubBaseUrl, accessToken: token, code }, this._http);
		if (!result.ok) {
			return { ok: false, code: result.code, reason: result.reason };
		}
		await this.refreshDirectory();
		return { ok: true };
	}

	async isEncryptionAvailable(): Promise<boolean> {
		return this._hubSessionStore.isEncryptionAvailable();
	}

	private _fireAuthChanged(): void {
		this._onDidChangeAuthStatus.fire(this.getAuthStatus());
	}

	private _fireDirectoryChanged(): void {
		this._onDidChangeDirectory.fire(this._directoryStatus);
	}

	private _fireProfilesChanged(): void {
		this._onDidChangeProfiles.fire(this.listConnectionProfiles());
	}
}

/** In-memory profile store fallback when main-process storage is not injected. */
class InMemoryConnectionProfileStore implements IConnectionProfileStore {
	private profiles: ConnectionProfile[] = [];

	list(): ConnectionProfile[] {
		return [...this.profiles];
	}

	get(profileId: string): ConnectionProfile | undefined {
		return this.profiles.find(p => p.profileId === profileId);
	}

	put(profile: ConnectionProfile): void {
		this.profiles = this.profiles.filter(p => p.profileId !== profile.profileId);
		this.profiles.push(profile);
	}

	remove(profileId: string): void {
		this.profiles = this.profiles.filter(p => p.profileId !== profileId);
	}

	createDraft(input: {
		readonly displayName: string;
		readonly target: ConnectionProfile['target'];
		readonly allowPrivateNetwork?: boolean;
	}): ConnectionProfile {
		const profile: ConnectionProfile = {
			profileId: randomUUID(),
			displayName: input.displayName,
			target: input.target,
			trust: null,
			state: 'pairingPending',
			allowPrivateNetwork: input.allowPrivateNetwork ?? false,
		};
		this.put(profile);
		return profile;
	}
}
