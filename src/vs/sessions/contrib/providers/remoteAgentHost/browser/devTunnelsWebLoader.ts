/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TunnelRelayTunnelClient } from '@microsoft/dev-tunnels-connections';
import type { TunnelManagementHttpClient } from '@microsoft/dev-tunnels-management';
import { AppResourcePath, FileAccess } from '../../../../../base/common/network.js';
import type { ITunnelDescriptor } from '../../../../../platform/agentHost/common/tunnelAgentHostConnector.js';
import type { ITunnelDuplexStream } from '../../../../../platform/agentHost/common/tunnelMessageSocket.js';

const devTunnelsWebBundlePath: AppResourcePath = 'vs/sessions/contrib/providers/remoteAgentHost/browser/devTunnelsModule.js';

/** The subset of tunnel metadata consumed by the browser management and relay adapters. */
export interface IDevTunnelsWebTunnel extends ITunnelDescriptor {
	readonly endpoints?: object;
}

/** Options for browser tunnel management requests. */
export interface IDevTunnelsWebRequestOptions {
	readonly labels?: string[];
	readonly requireAllLabels?: boolean;
	readonly includePorts?: boolean;
	readonly tokenScopes?: string[];
	readonly limit?: number;
}

/** Browser-compatible subset of the Dev Tunnels management client. */
export interface IDevTunnelsWebManagementClient {
	listTunnels(
		clusterId: string | undefined,
		domain: string | undefined,
		options: IDevTunnelsWebRequestOptions,
	): Promise<readonly IDevTunnelsWebTunnel[]>;
	getTunnel(
		tunnel: Pick<IDevTunnelsWebTunnel, 'tunnelId' | 'clusterId'>,
		options: IDevTunnelsWebRequestOptions,
	): Promise<IDevTunnelsWebTunnel | null>;
	deleteTunnel(tunnel: Pick<IDevTunnelsWebTunnel, 'tunnelId' | 'clusterId'>): Promise<boolean>;
}

/** Browser-compatible subset of the Dev Tunnels relay client. */
export interface IDevTunnelsWebRelayClient {
	acceptLocalConnectionsForForwardedPorts: boolean;
	endpoints?: object;
	connect(tunnel: IDevTunnelsWebTunnel): Promise<void>;
	waitForForwardedPort(port: number): Promise<void>;
	connectToForwardedPort(port: number): Promise<ITunnelDuplexStream>;
	dispose(): void;
}

/** The lazily-loaded Dev Tunnels browser bundle. */
export interface IDevTunnelsWeb {
	readonly TunnelManagementHttpClient: new (
		userAgent: string,
		apiVersion: object,
		userTokenCallback: () => Promise<string>,
	) => IDevTunnelsWebManagementClient;
	readonly ManagementApiVersions: {
		readonly Version20230927preview: object;
	};
	readonly TunnelRelayTunnelClient: new (managementClient: IDevTunnelsWebManagementClient) => IDevTunnelsWebRelayClient;
	readonly TunnelAccessScopes: object;
}

/**
 * Compile-time proof that the structural subsets above remain a valid view of the
 * real SDK types. The subsets exist so tests can supply small fakes — implementing
 * the full SDK surface in a fake is impractical — but they would silently drift if
 * the SDK renamed a member or changed a signature. These aliases fail the build if
 * that happens; they are exported only so they count as used.
 */
type AssertSatisfies<TSubset, TActual extends TSubset> = TActual;
export type ManagementClientConformance = AssertSatisfies<IDevTunnelsWebManagementClient, TunnelManagementHttpClient>;
export type RelayClientConformance = AssertSatisfies<IDevTunnelsWebRelayClient, TunnelRelayTunnelClient>;

/**
 * Shares one in-flight or successful Dev Tunnels SDK load.
 * A rejection clears `promise` only while it still points at that attempt,
 * so the next load calls `load` again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareDevTunnelsWebLoad<T>(
	slot: { promise: Promise<T> | undefined },
	load: () => Promise<T>,
): Promise<T> {
	if (slot.promise) {
		return slot.promise;
	}

	const attempt = load();
	slot.promise = attempt;
	// Not assigned. Callers still observe this rejection; the next load calls load again.
	void attempt.catch(() => {
		if (slot.promise === attempt) {
			slot.promise = undefined;
		}
	});
	return attempt;
}

const devTunnelsWebSlot: { promise: Promise<IDevTunnelsWeb> | undefined } = { promise: undefined };

/** Loads the browser-compatible Dev Tunnels SDK bundle on first use. */
export function loadDevTunnelsWeb(): Promise<IDevTunnelsWeb> {
	return shareDevTunnelsWebLoad(devTunnelsWebSlot, () => {
		// This generated browser-only module is emitted beside its loader.
		const devTunnelsWebUrl = FileAccess.asBrowserUri(devTunnelsWebBundlePath).toString(true);
		// Keep the URL runtime-resolved so bundlers do not rewrite the import.
		return import(/* webpackIgnore: true */ /* @vite-ignore */ `${devTunnelsWebUrl}`) as Promise<IDevTunnelsWeb>;
	});
}
