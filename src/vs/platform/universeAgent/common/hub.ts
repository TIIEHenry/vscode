/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

/** IPC channel name — hub methods share the UniverseAgent main-process channel (H4a). */
export const universeAgentHubChannelName = 'universeAgentConnection';

export const IUniverseAgentHubService = createDecorator<IUniverseAgentHubService>('universeAgentHubService');

export type HubAuthStatus =
	| { readonly kind: 'signedOut' }
	| { readonly kind: 'signedIn'; readonly email: string }
	| { readonly kind: 'mustChangePassword'; readonly email: string }
	| { readonly kind: 'authExpired' }
	| { readonly kind: 'unavailable' };

export type HubDevicePresence = 'ONLINE' | 'OFFLINE';
export type HubEngineStatus = 'SERVING' | 'NOT_SERVING';

/** Renderer-safe Hub device row — no tokens, tickets, or private keys. */
export type HubDeviceProjection = {
	readonly id: string;
	readonly name: string;
	readonly presence: HubDevicePresence;
	readonly engineStatus: HubEngineStatus | null;
	readonly engineIdentityId: string | null;
	readonly revoked: boolean;
};

export type HubDirectoryStatus =
	| { readonly kind: 'idle' }
	| { readonly kind: 'ok'; readonly devices: readonly HubDeviceProjection[] }
	| { readonly kind: 'authExpired' }
	| { readonly kind: 'unreachable'; readonly reason: string }
	| { readonly kind: 'error'; readonly code: string; readonly reason: string };

export type HubLoginResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly code: string; readonly reason: string };

export type HubOperationResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly code: string; readonly reason: string };

/** Connection profile summary for renderer — no trust leaf / secrets. */
export type ConnectionProfileProjection = {
	readonly profileId: string;
	readonly displayName: string;
	readonly state: 'active' | 'pairingPending' | 'revoked' | 'disabled';
	readonly hasTrust: boolean;
	readonly targetKind: 'loopback' | 'directAddress' | 'hubDevice';
};

/**
 * Hub control-plane surface (connection-hub-client §3.7 / §4.2).
 * Secrets (accessToken, csrf, ticketId, private keys) never cross ProxyChannel.
 */
export interface IUniverseAgentHubService {

	readonly _serviceBrand: undefined;

	getActiveHubBaseUrl(): string | undefined;

	setActiveHubBaseUrl(hubBaseUrl: string | undefined): void;

	getAuthStatus(): HubAuthStatus;

	getDirectoryStatus(): HubDirectoryStatus;

	listConnectionProfiles(): readonly ConnectionProfileProjection[];

	readonly onDidChangeAuthStatus: Event<HubAuthStatus>;

	readonly onDidChangeDirectory: Event<HubDirectoryStatus>;

	readonly onDidChangeProfiles: Event<readonly ConnectionProfileProjection[]>;

	login(hubBaseUrl: string, email: string, password: string): Promise<HubLoginResult>;

	logout(): Promise<void>;

	changePassword(oldPassword: string, newPassword: string): Promise<HubOperationResult>;

	refreshDirectory(): Promise<HubDirectoryStatus>;

	renameDevice(deviceId: string, name: string): Promise<HubOperationResult>;

	revokeDevice(deviceId: string): Promise<HubOperationResult>;

	confirmDeviceCode(code: string): Promise<HubOperationResult>;

	isEncryptionAvailable(): Promise<boolean>;
}
