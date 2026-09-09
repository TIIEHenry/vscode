/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { IChannel, ProxyChannel } from '../../../base/parts/ipc/common/ipc.js';
import {
	IUniverseAgentHubService,
	type ConnectionProfileProjection,
	type HubAuthStatus,
	type HubDirectoryStatus,
} from './hub.js';
import {
	createRemoteForwardingProxy,
	resolveMaybePromise,
	UniverseAgentHubSyncCache,
} from './universeAgentRendererSync.js';

/**
 * Renderer client for Hub / profile control-plane methods on the shared
 * UniverseAgent main-process channel. Sync getters read a hydrated cache.
 */
export class UniverseAgentHubChannelClient extends Disposable {

	declare readonly _serviceBrand: undefined;

	private readonly remote: IUniverseAgentHubService;
	private readonly cache = new UniverseAgentHubSyncCache();
	private readonly _onDidChangeAuthStatus = this._register(new Emitter<HubAuthStatus>());
	private readonly _onDidChangeDirectory = this._register(new Emitter<HubDirectoryStatus>());
	private readonly _onDidChangeProfiles = this._register(new Emitter<readonly ConnectionProfileProjection[]>());

	readonly onDidChangeAuthStatus = this._onDidChangeAuthStatus.event;
	readonly onDidChangeDirectory = this._onDidChangeDirectory.event;
	readonly onDidChangeProfiles = this._onDidChangeProfiles.event;

	constructor(channel: IChannel) {
		super();
		this.remote = ProxyChannel.toService<IUniverseAgentHubService>(channel);
		this._register(this.remote.onDidChangeAuthStatus(status => {
			this.cache.applyAuth(status);
			this._onDidChangeAuthStatus.fire(status);
		}));
		this._register(this.remote.onDidChangeDirectory(status => {
			this.cache.applyDirectory(status);
			this._onDidChangeDirectory.fire(status);
		}));
		this._register(this.remote.onDidChangeProfiles(profiles => {
			this.cache.applyProfiles(profiles);
			this._onDidChangeProfiles.fire(this.cache.profiles);
		}));
		void this.hydrate();
		return createRemoteForwardingProxy(this, this.remote) as this;
	}

	getActiveHubBaseUrl(): string | undefined {
		return this.cache.hubBaseUrl;
	}

	setActiveHubBaseUrl(hubBaseUrl: string | undefined): void {
		this.cache.applyHubBaseUrl(hubBaseUrl);
		void this.remote.setActiveHubBaseUrl(hubBaseUrl);
	}

	getAuthStatus(): HubAuthStatus {
		return this.cache.auth;
	}

	getDirectoryStatus(): HubDirectoryStatus {
		return this.cache.directory;
	}

	listConnectionProfiles(): readonly ConnectionProfileProjection[] {
		return this.cache.profiles;
	}

	private async hydrate(): Promise<void> {
		try {
			const [profiles, auth, directory, hubBaseUrl] = await Promise.all([
				resolveMaybePromise(this.remote.listConnectionProfiles()),
				resolveMaybePromise(this.remote.getAuthStatus()),
				resolveMaybePromise(this.remote.getDirectoryStatus()),
				resolveMaybePromise(this.remote.getActiveHubBaseUrl()),
			]);
			this.cache.applyProfiles(profiles);
			this.cache.applyAuth(auth);
			this.cache.applyDirectory(directory);
			this.cache.applyHubBaseUrl(hubBaseUrl);
			this._onDidChangeAuthStatus.fire(this.cache.auth);
			this._onDidChangeDirectory.fire(this.cache.directory);
			this._onDidChangeProfiles.fire(this.cache.profiles);
		} catch {
			// Keep last-good / pre-hydrate cache; do not notify a half-applied snapshot.
		}
	}
}
