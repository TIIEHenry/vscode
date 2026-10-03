/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ITunnelHostInfo, TunnelHostStatus } from '../../../../../platform/agentHost/common/tunnelAgentHost.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { ISharedProcessService } from '../../../../../platform/ipc/electron-browser/services.js';
import { NullLoggerService } from '../../../../../platform/log/common/log.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { TunnelHostService } from '../../../../../workbench/contrib/chat/electron-browser/tunnelHostService.js';
import { IAuthenticationService } from '../../../../../workbench/services/authentication/common/authentication.js';

class FakeTunnelHostChannel extends Disposable implements IChannel {

	private readonly _onDidChangeStatus = this._register(new Emitter<TunnelHostStatus>());
	private _hostingStarted = false;

	startResult: ITunnelHostInfo = { tunnelName: 'stale' };
	statusAfterStart: TunnelHostStatus = { active: false };

	listen<T>(event: string): Event<T> {
		if (event === 'onDidChangeStatus') {
			return this._onDidChangeStatus.event as Event<T>;
		}
		return Event.None;
	}

	async call<T>(command: string): Promise<T> {
		if (command === 'getStatus') {
			return (this._hostingStarted ? this.statusAfterStart : { active: false }) as T;
		}
		if (command === 'startHosting') {
			this._hostingStarted = true;
			this._onDidChangeStatus.fire(this.statusAfterStart);
			return this.startResult as T;
		}
		throw new Error(`Unexpected command ${command}`);
	}
}

suite('Sessions - Tunnel Host Service', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(channel: FakeTunnelHostChannel): TunnelHostService {
		const authenticationService = {
			async getSessions() {
				return [{
					id: 'session',
					accessToken: 'token',
					account: { id: 'account', label: 'Ada' },
					scopes: ['tunnel'],
				}];
			},
		} as unknown as IAuthenticationService;
		const productService = {
			tunnelApplicationConfig: {
				authenticationProviders: {
					github: { scopes: ['tunnel'] },
				},
			},
		} as unknown as IProductService;
		const sharedProcessService = {
			getChannel: () => channel,
		} as unknown as ISharedProcessService;

		return new TunnelHostService(
			sharedProcessService,
			authenticationService,
			productService,
			{ getValue: () => false } as IConfigurationService,
			disposables.add(new NullLoggerService()),
			{ logsHome: URI.file('/logs') } as IEnvironmentService,
		);
	}

	test('does not stay connected when the tunnel drops before start is published', async () => {
		const channel = disposables.add(new FakeTunnelHostChannel());
		channel.startResult = { tunnelName: 'stale', tunnelId: 'stale-id' };
		channel.statusAfterStart = { active: false };
		const service = disposables.add(createService(channel));

		await assert.rejects(
			service.startSharing(),
			/disconnected before remote session access was ready/,
		);

		assert.deepStrictEqual({
			isSharing: service.isSharing,
			isConnecting: service.isConnecting,
			sharingInfo: service.sharingInfo,
		}, {
			isSharing: false,
			isConnecting: false,
			sharingInfo: undefined,
		});
	});

	test('publishes the live tunnel instead of the stale start snapshot', async () => {
		const channel = disposables.add(new FakeTunnelHostChannel());
		const live = { tunnelName: 'agent', tunnelId: 'live-id' };
		channel.startResult = { tunnelName: 'stale' };
		channel.statusAfterStart = { active: true, info: live };
		const service = disposables.add(createService(channel));

		await service.startSharing();

		assert.deepStrictEqual({
			isSharing: service.isSharing,
			isConnecting: service.isConnecting,
			sharingInfo: service.sharingInfo,
		}, {
			isSharing: true,
			isConnecting: false,
			sharingInfo: live,
		});
	});
});
