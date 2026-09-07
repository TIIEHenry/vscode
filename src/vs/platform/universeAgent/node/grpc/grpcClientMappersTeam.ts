/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentTeamMemberInfo,
	UniverseAgentTeamTaskInfo,
} from '../../common/universeAgentTypes.js';

export interface MemberInfoWire {
	member_name?: string;
	member_agent_id?: string;
	status?: string;
	preset?: string;
	dynamic?: string;
	turn_count?: number;
}

export interface MemberStatusResponseWire {
	members?: MemberInfoWire[];
}

export interface BlackboardTaskWire {
	task_id?: string;
	owner?: string;
	description?: string;
	status?: string;
	blocked_by?: string;
	last_message?: string;
	subject?: string;
}

export interface TaskListResponseWire {
	tasks?: BlackboardTaskWire[];
}

export interface TeamInfoResponseWire {
	team_id?: number;
	status?: string;
}

export function mapMemberInfo(wire: MemberInfoWire): UniverseAgentTeamMemberInfo {
	return {
		memberName: wire.member_name ?? '',
		memberAgentId: wire.member_agent_id ?? '',
		status: wire.status ?? '',
		preset: wire.preset ?? '',
		dynamic: wire.dynamic ?? '',
		turnCount: wire.turn_count ?? 0,
	};
}

export function mapTaskInfo(wire: BlackboardTaskWire): UniverseAgentTeamTaskInfo {
	return {
		taskId: wire.task_id ?? '',
		subject: wire.subject ?? '',
		owner: wire.owner ?? '',
		status: wire.status ?? '',
		blockedBy: wire.blocked_by ?? '',
		lastMessage: wire.last_message ?? '',
		description: wire.description ?? '',
	};
}

