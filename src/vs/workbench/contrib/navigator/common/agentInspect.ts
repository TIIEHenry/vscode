/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { UniverseAgentPublishedLinkOwner } from '../../../../platform/universeAgent/common/universeAgentExpectedOwner.js';
import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';
import type { INavigatorAgentsActivityItem } from './navigatorAgentsActivity.js';
import type { INavigatorTeamMemberInfo, INavigatorTeamTaskInfo } from './navigatorTeamData.js';

export const IAgentInspectService = createDecorator<IAgentInspectService>('agentInspectService');

export type IUniverseAgentConnectionOwner = UniverseAgentPublishedLinkOwner;

export type AgentInspectTarget =
	| { readonly kind: 'agent'; readonly node: LiveAgentTreeNodeView; readonly sessionId: string; readonly expectedOwner?: IUniverseAgentConnectionOwner }
	| { readonly kind: 'member'; readonly info: INavigatorTeamMemberInfo; readonly sessionId: string; readonly expectedOwner?: IUniverseAgentConnectionOwner }
	| { readonly kind: 'task'; readonly task: INavigatorTeamTaskInfo; readonly sessionId: string; readonly expectedOwner?: IUniverseAgentConnectionOwner }
	| { readonly kind: 'activity'; readonly item: INavigatorAgentsActivityItem; readonly sessionId: string; readonly expectedOwner?: IUniverseAgentConnectionOwner };

export type AgentInspectLiveAgentIdSource = 'agents' | 'team';

export interface IAgentInspectService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeTarget: Event<AgentInspectTarget | undefined>;
	readonly onDidChangeLiveAgentIds: Event<void>;
	getTarget(): AgentInspectTarget | undefined;
	setTarget(target: AgentInspectTarget | undefined): void;
	setLiveAgentIds(source: AgentInspectLiveAgentIdSource, ids: ReadonlySet<string> | undefined, sessionId?: string, owner?: IUniverseAgentConnectionOwner): void;
	getLiveAgentIds(): ReadonlySet<string> | undefined;
	getLiveAgentIdsFor(source: AgentInspectLiveAgentIdSource): ReadonlySet<string> | undefined;
	getLiveAgentIdsSession(source: AgentInspectLiveAgentIdSource): string | undefined;
	setLiveActivityIds(ids: ReadonlySet<string> | undefined, sessionId?: string, owner?: IUniverseAgentConnectionOwner): void;
	getLiveActivityIds(): ReadonlySet<string> | undefined;
	getLiveActivityIdsSession(): string | undefined;
	setLiveTaskIds(ids: ReadonlySet<string> | undefined, sessionId?: string, owner?: IUniverseAgentConnectionOwner): void;
	getLiveTaskIds(): ReadonlySet<string> | undefined;
	getLiveTaskIdsSession(): string | undefined;
	getActiveOwner?(): IUniverseAgentConnectionOwner | undefined;
}
