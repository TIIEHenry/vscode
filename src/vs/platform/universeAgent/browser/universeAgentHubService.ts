/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../instantiation/common/extensions.js';
import {
	IUniverseAgentHubService,
	type ConnectionProfileProjection,
	type HubAuthStatus,
	type HubDirectAddressResult,
	type HubDirectoryStatus,
	type HubLoginResult,
	type HubOperationResult,
} from '../common/hub.js';
import { hubUnsupportedResult } from './webUnsupported.js';

export class WebUniverseAgentHubService implements IUniverseAgentHubService {

	declare readonly _serviceBrand: undefined;

	readonly onDidChangeAuthStatus = Event.None;
	readonly onDidChangeDirectory = Event.None;
	readonly onDidChangeProfiles = Event.None;

	getActiveHubBaseUrl(): string | undefined {
		return undefined;
	}

	setActiveHubBaseUrl(_hubBaseUrl: string | undefined): void {
		// Web cannot persist a Hub session; ignore so callers never see a stored URL.
	}

	getAuthStatus(): HubAuthStatus {
		return { kind: 'unavailable' };
	}

	getDirectoryStatus(): HubDirectoryStatus {
		return { kind: 'idle' };
	}

	listConnectionProfiles(): readonly ConnectionProfileProjection[] {
		return [];
	}

	async login(_hubBaseUrl: string, _email: string, _password: string): Promise<HubLoginResult> {
		// Reason is a fixed environment string — never echo credentials.
		return hubUnsupportedResult();
	}

	async logout(): Promise<void> {
		// Already unavailable; nothing to clear.
	}

	async changePassword(_oldPassword: string, _newPassword: string): Promise<HubOperationResult> {
		return hubUnsupportedResult();
	}

	async refreshDirectory(): Promise<HubDirectoryStatus> {
		return { kind: 'idle' };
	}

	async renameDevice(_deviceId: string, _name: string): Promise<HubOperationResult> {
		return hubUnsupportedResult();
	}

	async revokeDevice(_deviceId: string): Promise<HubOperationResult> {
		return hubUnsupportedResult();
	}

	async confirmDeviceCode(_code: string): Promise<HubOperationResult> {
		return hubUnsupportedResult();
	}

	async addDirectAddressProfile(_input: {
		readonly host: string;
		readonly port: number;
		readonly displayName?: string;
		readonly allowPrivateNetwork?: boolean;
	}): Promise<HubDirectAddressResult> {
		return hubUnsupportedResult();
	}

	async forgetConnectionProfile(_profileId: string): Promise<HubOperationResult> {
		return hubUnsupportedResult();
	}

	async isEncryptionAvailable(): Promise<boolean> {
		// True so Web does not paint "restart then sign in" as a keyring problem.
		return true;
	}
}

registerSingleton(IUniverseAgentHubService, WebUniverseAgentHubService, InstantiationType.Delayed);
