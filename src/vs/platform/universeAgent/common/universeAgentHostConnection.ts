/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import type {
	IFileMutationRecord,
	ITurnSettleSignal,
	UniverseAgentAgentTreeNode,
	UniverseAgentFetchToolDetailRequest,
	UniverseAgentFetchToolDetailResult,
} from './universeAgentTypes.js';

/**
 * Electron-main-only surface for SessionViewHost (m6 §11).
 * Not proxied to renderer — AgentService.Tree stays host-only.
 */
export interface IUniverseAgentHostConnection {

	readonly onRequestAgentTreeRefresh: Event<{ readonly sessionId: string }>;

	/** Host-only AgentService.Tree transport. */
	fetchAgentTree(sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined>;

	/** Whether Tree returned UNIMPLEMENTED for this connection (no further retries). */
	isAgentTreeUnsupported(): boolean;

	/** Host-only AgentService.FetchToolDetail (`subscribe=false`). */
	fetchToolDetail(request: UniverseAgentFetchToolDetailRequest): Promise<UniverseAgentFetchToolDetailResult>;

	notifyFileMutation(record: IFileMutationRecord): void;

	notifyTurnSettle(signal: ITurnSettleSignal): void;

	notifyTeamRuntimeChange(sessionId: string): void;
}
