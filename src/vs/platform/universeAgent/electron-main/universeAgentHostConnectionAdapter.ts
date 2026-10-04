/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IUniverseAgentConnection } from '../common/universeAgentConnection.js';
import { IUniverseAgentHostConnection } from '../common/universeAgentHostConnection.js';
import type {
	IFileMutationRecord,
	ITurnSettleSignal,
	UniverseAgentFetchToolDetailRequest,
} from '../common/universeAgentTypes.js';

/**
 * Main-process host token. Delegates to the single connection instance.
 * A second UniverseAgentConnectionService would open another engine link.
 */
export class UniverseAgentHostConnectionAdapter implements IUniverseAgentHostConnection {

	constructor(
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
	) { }

	private get delegated(): IUniverseAgentHostConnection {
		return this.connection as unknown as IUniverseAgentHostConnection;
	}

	get onRequestAgentTreeRefresh() {
		return this.delegated.onRequestAgentTreeRefresh;
	}

	fetchAgentTree(sessionId: string) {
		return this.delegated.fetchAgentTree(sessionId);
	}

	isAgentTreeUnsupported(): boolean {
		return this.delegated.isAgentTreeUnsupported();
	}

	fetchToolDetail(request: UniverseAgentFetchToolDetailRequest) {
		return this.delegated.fetchToolDetail(request);
	}

	notifyFileMutation(record: IFileMutationRecord): void {
		this.delegated.notifyFileMutation(record);
	}

	notifyTurnSettle(signal: ITurnSettleSignal): void {
		this.delegated.notifyTurnSettle(signal);
	}

	notifyTeamRuntimeChange(sessionId: string): void {
		this.delegated.notifyTeamRuntimeChange(sessionId);
	}
}
