/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { IUniverseAgentConnection } from '../common/universeAgentConnection.js';
import type {
	IUniverseAgentSessionView,
	IUniverseAgentSessionViewFrameEvent,
} from '../common/universeAgentSessionView.js';
import type { ConversationWriteMessage, DetailFetchOutcome, PostOutcome } from '../common/conversationViewFrame.js';
import { SessionViewHost } from '../node/sessionViewHost.js';

export class UniverseAgentSessionViewService extends Disposable implements IUniverseAgentSessionView {

	declare readonly _serviceBrand: undefined;

	private readonly host: SessionViewHost;

	constructor(
		@IUniverseAgentConnection connection: IUniverseAgentConnection,
	) {
		super();
		const host = connection as unknown as import('../common/universeAgentHostConnection.js').IUniverseAgentHostConnection;
		this.host = this._register(new SessionViewHost(connection, host));
		this._register(connection.onDidChangeConnection(() => this.host.onEngineConnectionChanged()));
	}

	onDynamicDidApplyFrame(leaseId: string) {
		return this.host.onDynamicDidApplyFrame(leaseId);
	}

	acquireLease(sessionId: string): Promise<string> {
		return Promise.resolve(this.host.acquireLease(sessionId));
	}

	releaseLease(leaseId: string): Promise<void> {
		this.host.releaseLease(leaseId);
		return Promise.resolve();
	}

	post(leaseId: string, msg: ConversationWriteMessage): Promise<PostOutcome> {
		return Promise.resolve(this.host.post(leaseId, msg));
	}

	requestResync(leaseId: string): Promise<void> {
		this.host.requestResync(leaseId);
		return Promise.resolve();
	}

	requestDetail(leaseId: string, ref: string): Promise<DetailFetchOutcome> {
		return this.host.requestDetail(leaseId, ref);
	}
}

export type { IUniverseAgentSessionViewFrameEvent };
