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
	HubProfileResult,
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
import { withHubAccessRetry } from './hubAuthAccess.js';
import type { IStorageService } from '../../storage/common/storage.js';

export type UniverseAgentHubServiceOptions = {
	readonly hubSessionStore?: IHubSessionStore;
	readonly connectionProfileStore?: IConnectionProfileStore;
	readonly storageService?: IStorageService;
	readonly http?: HubAuthHttp & HubDirectoryHttp;
	readonly nowMs?: () => number;
	/** When set, startup restore waits for main-process application storage init. */
	readonly storageReady?: Promise<void>;
	/** Test hook: skip constructor-triggered Hub session restore. */
	readonly skipStartupRestore?: boolean;
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
	private readonly _storageReady: Promise<void> | undefined;
	private readonly _skipStartupRestore: boolean;

	private _activeHubBaseUrl: string | undefined;
	private _directoryStatus: HubDirectoryStatus = { kind: 'idle' };
	private _directoryAuthExpired = false;

	readonly whenStartupRestoreComplete: Promise<void>;

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
		this._storageReady = options.storageReady;
		this._skipStartupRestore = options.skipStartupRestore ?? false;
		this.whenStartupRestoreComplete = this._skipStartupRestore
			? Promise.resolve()
			: this.restorePersistedHubSessionIfNeeded();
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
		await this._hubSessionStore.applyAuthSession(trimmed, result.session, this._nowMs(), result.refreshToken);
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
		if (auth.kind === 'mustChangePassword') {
			this._directoryStatus = { kind: 'idle' };
			this._fireDirectoryChanged();
			return this._directoryStatus;
		}
		if (auth.kind === 'signedOut') {
			const hasAccessToken = this._hubSessionStore.getAccessTokenForHub(hubBaseUrl, this._nowMs()) !== null;
			const hasPersistedRefresh = this._hubSessionStore.listPersistedHubBaseUrls().includes(hubBaseUrl);
			if (!hasAccessToken && !hasPersistedRefresh) {
				this._directoryStatus = { kind: 'idle' };
				this._fireDirectoryChanged();
				return this._directoryStatus;
			}
		}

		const result = await withHubAccessRetry(
			{
				store: this._hubSessionStore,
				hubBaseUrl,
				nowMs: this._nowMs(),
				http: this._http,
			},
			accessToken => listHubDevices({ hubBaseUrl, accessToken }, this._http),
		);

		if ('authExpired' in result) {
			this._directoryAuthExpired = true;
			this._directoryStatus = { kind: 'authExpired' };
			this._fireAuthChanged();
			this._fireDirectoryChanged();
			return this._directoryStatus;
		}

		if (!result.ok) {
			if (result.code === 'hub_directory_http_failed') {
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

	private async _runHubControlPlaneMutation(
		mutation: (accessToken: string) => Promise<HubOperationResult>,
	): Promise<HubOperationResult> {
		const hubBaseUrl = this._activeHubBaseUrl;
		if (!hubBaseUrl) {
			return { ok: false, code: 'hub_session_required', reason: 'not signed in to a Hub' };
		}

		const result = await withHubAccessRetry(
			{
				store: this._hubSessionStore,
				hubBaseUrl,
				nowMs: this._nowMs(),
				http: this._http,
			},
			async accessToken => {
				const mutationResult = await mutation(accessToken);
				if (mutationResult.ok) {
					return { ok: true as const, value: undefined };
				}
				return mutationResult;
			},
		);

		if ('authExpired' in result) {
			this._directoryAuthExpired = true;
			this._directoryStatus = { kind: 'authExpired' };
			this._fireAuthChanged();
			this._fireDirectoryChanged();
			return { ok: false, code: 'hub_session_required', reason: 'hub session expired' };
		}

		if (result.ok) {
			return { ok: true };
		}

		return { ok: false, code: result.code, reason: result.reason };
	}

	async renameDevice(deviceId: string, name: string): Promise<HubOperationResult> {
		const hubBaseUrl = this._activeHubBaseUrl;
		if (!hubBaseUrl) {
			return { ok: false, code: 'hub_session_required', reason: 'hub session required' };
		}
		const result = await this._runHubControlPlaneMutation(async accessToken => {
			const apiResult = await renameHubDevice({ hubBaseUrl, accessToken, hubDeviceId: deviceId, name }, this._http);
			if (!apiResult.ok) {
				return { ok: false, code: apiResult.code, reason: apiResult.reason };
			}
			return { ok: true };
		});
		if (!result.ok) {
			return result;
		}
		await this.refreshDirectory();
		return { ok: true };
	}

	async revokeDevice(deviceId: string): Promise<HubOperationResult> {
		const hubBaseUrl = this._activeHubBaseUrl;
		if (!hubBaseUrl) {
			return { ok: false, code: 'hub_session_required', reason: 'hub session required' };
		}
		const result = await this._runHubControlPlaneMutation(async accessToken => {
			const apiResult = await revokeHubDevice({ hubBaseUrl, accessToken, hubDeviceId: deviceId }, this._http);
			if (!apiResult.ok) {
				return { ok: false, code: apiResult.code, reason: apiResult.reason };
			}
			return { ok: true };
		});
		if (!result.ok) {
			return result;
		}
		await this.refreshDirectory();
		this._markHubDeviceProfilesRevoked(deviceId);
		return { ok: true };
	}

	async confirmDeviceCode(code: string): Promise<HubOperationResult> {
		const hubBaseUrl = this._activeHubBaseUrl;
		if (!hubBaseUrl) {
			return { ok: false, code: 'hub_session_required', reason: 'hub session required' };
		}
		const result = await this._runHubControlPlaneMutation(async accessToken => {
			const apiResult = await confirmHubDeviceCode({ hubBaseUrl, accessToken, deviceCode: code }, this._http);
			if (!apiResult.ok) {
				return { ok: false, code: apiResult.code, reason: apiResult.reason };
			}
			return { ok: true };
		});
		if (!result.ok) {
			return result;
		}
		await this.refreshDirectory();
		return { ok: true };
	}

	async addDirectAddressProfile(input: {
		readonly host: string;
		readonly port: number;
		readonly displayName?: string;
		readonly allowPrivateNetwork?: boolean;
	}): Promise<HubProfileResult> {
		const host = input.host.trim();
		if (!host) {
			return { ok: false, code: 'direct_address_invalid', reason: 'host is required' };
		}
		if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
			return { ok: false, code: 'direct_address_invalid', reason: 'port must be between 1 and 65535' };
		}
		const displayName = input.displayName?.trim() || `${host}:${input.port}`;
		const profile = this._connectionProfileStore.createDraft({
			displayName,
			target: { kind: 'directAddress', host, port: input.port },
			allowPrivateNetwork: input.allowPrivateNetwork ?? false,
		});
		this._connectionProfileStore.put(profile);
		this._fireProfilesChanged();
		return { ok: true, profileId: profile.profileId };
	}

	async addHubDeviceProfile(input: {
		readonly hubDeviceId: string;
		readonly displayName?: string;
	}): Promise<HubProfileResult> {
		const hubDeviceId = input.hubDeviceId.trim();
		if (!hubDeviceId) {
			return { ok: false, code: 'hub_device_invalid', reason: 'hub device id is required' };
		}
		const hubBaseUrl = this._activeHubBaseUrl;
		if (!hubBaseUrl) {
			return { ok: false, code: 'hub_session_required', reason: 'hub session required' };
		}
		if (this._hubSessionStore.requiresPasswordChange(hubBaseUrl, this._nowMs())) {
			return { ok: false, code: 'hub_password_change_required', reason: 'hub password change required before adding a device profile' };
		}
		const auth = this.getAuthStatus();
		if (auth.kind !== 'signedIn') {
			return { ok: false, code: 'hub_session_required', reason: 'hub session required' };
		}
		const accountId = this._hubSessionStore.getAccountIdForHub(hubBaseUrl, this._nowMs());
		if (!accountId) {
			return { ok: false, code: 'hub_session_required', reason: 'hub account id unavailable' };
		}
		const existing = this._connectionProfileStore.list().find(profile =>
			profile.target.kind === 'hubDevice'
			&& profile.target.hubBaseUrl === hubBaseUrl
			&& profile.target.hubDeviceId === hubDeviceId
		);
		if (existing) {
			return { ok: true, profileId: existing.profileId };
		}
		const profile = this._connectionProfileStore.createDraft({
			displayName: input.displayName?.trim() || hubDeviceId,
			target: { kind: 'hubDevice', hubBaseUrl, accountId, hubDeviceId },
		});
		this._connectionProfileStore.put(profile);
		this._fireProfilesChanged();
		return { ok: true, profileId: profile.profileId };
	}

	async forgetConnectionProfile(profileId: string): Promise<HubOperationResult> {
		const profile = this._connectionProfileStore.get(profileId);
		if (!profile) {
			return { ok: false, code: 'profile_not_found', reason: `connection profile not found: ${profileId}` };
		}
		this._connectionProfileStore.remove(profileId);
		this._fireProfilesChanged();
		return { ok: true };
	}

	async isEncryptionAvailable(): Promise<boolean> {
		return this._hubSessionStore.isEncryptionAvailable();
	}

	/**
	 * On IDE startup: discover encrypted refresh material and call {@link IHubSessionStore.refreshIfNeeded}.
	 * Fail-closed — refresh failure leaves Hub auth unsigned-in.
	 */
	async restorePersistedHubSessionIfNeeded(): Promise<void> {
		if (this._storageReady) {
			await this._storageReady;
		}

		const hubBaseUrls = this._hubSessionStore.listPersistedHubBaseUrls();
		if (hubBaseUrls.length === 0) {
			return;
		}

		// v1: single Hub bucket — deterministic pick when multiple keys exist.
		const hubBaseUrl = [...hubBaseUrls].sort()[0];
		this._activeHubBaseUrl = hubBaseUrl;
		this._directoryAuthExpired = false;

		const result = await this._hubSessionStore.refreshIfNeeded(hubBaseUrl, this._nowMs(), this._http);
		if (!result.ok) {
			if (result.code === 'hub_auth_http_failed' && /\bHTTP (401|403)\b/.test(result.reason)) {
				this._directoryAuthExpired = true;
			}
			this._fireAuthChanged();
			return;
		}

		this._fireAuthChanged();
		await this.refreshDirectory();
	}

	private _fireAuthChanged(): void {
		this._onDidChangeAuthStatus.fire(this.getAuthStatus());
	}

	private _fireDirectoryChanged(): void {
		this._onDidChangeDirectory.fire(this._directoryStatus);
	}

	private _markHubDeviceProfilesRevoked(hubDeviceId: string): void {
		let changed = false;
		for (const profile of this._connectionProfileStore.list()) {
			if (
				profile.target.kind === 'hubDevice'
				&& profile.target.hubDeviceId === hubDeviceId
				&& profile.state !== 'revoked'
			) {
				this._connectionProfileStore.put({ ...profile, state: 'revoked' });
				changed = true;
			}
		}
		if (changed) {
			this._fireProfilesChanged();
		}
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
