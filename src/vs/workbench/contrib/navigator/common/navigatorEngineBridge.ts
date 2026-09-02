/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import type { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { INavigatorTeamMemberInfo, INavigatorTeamTaskInfo, INavigatorTeamInfo } from './navigatorTeamData.js';

export type NavigatorCapabilitySupport = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';

export type NavigatorCapabilityKey = 'agentTree' | 'team' | 'sessionList';

export interface INavigatorEngineTeamApi {
	memberStatus(sessionId: string, agentId: string): Promise<readonly INavigatorTeamMemberInfo[]>;
	taskList(sessionId: string, agentId: string): Promise<readonly INavigatorTeamTaskInfo[]>;
	teamInfo(sessionId: string, agentId: string, teamId: number): Promise<INavigatorTeamInfo | undefined>;
}

/** Structural extension consumed by navigator; filled by M6-A2 §9 connection surface. */
export interface INavigatorEngineConnectionExtensions {
	readonly team?: INavigatorEngineTeamApi;
	readonly onDidChangeTeamRuntime?: Event<{ readonly sessionId: string }>;
	requestAgentTreeRefresh?(sessionId: string): void;
	getNavigatorCapability?(key: NavigatorCapabilityKey): NavigatorCapabilitySupport;
}

export function asNavigatorEngineConnection(connection: IUniverseAgentConnection): IUniverseAgentConnection & INavigatorEngineConnectionExtensions {
	return connection as IUniverseAgentConnection & INavigatorEngineConnectionExtensions;
}

export function getNavigatorCapability(
	connection: IUniverseAgentConnection,
	key: NavigatorCapabilityKey,
): NavigatorCapabilitySupport {
	const extended = asNavigatorEngineConnection(connection);
	return extended.getNavigatorCapability?.(key) ?? 'UNKNOWN';
}
