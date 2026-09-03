/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Engine root `agent_id` is `"root"`; Conversation root chat id is `default`. */
export function isEngineRootAgentId(agentId: string): boolean {
	return agentId === 'root';
}
