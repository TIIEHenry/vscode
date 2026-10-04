/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { ILogService } from '../../log/common/log.js';
import { IUniverseAgentHostConnection } from '../common/universeAgentHostConnection.js';
import { IUniverseAgentConnection } from '../common/universeAgentConnection.js';
import type {
	IUniverseAgentSessionView,
	IUniverseAgentSessionViewFrameEvent,
} from '../common/universeAgentSessionView.js';
import type { ConversationWriteMessage, DetailFetchOutcome, PostOutcome } from '../common/conversationViewFrame.js';
import { SessionViewHost } from '../node/sessionViewHost.js';
import { createSessionViewDiagnosticsPort } from '../node/sessionViewHostPorts.js';

export class UniverseAgentSessionViewService extends Disposable implements IUniverseAgentSessionView {

	declare readonly _serviceBrand: undefined;

	private readonly host: SessionViewHost;

	constructor(
		@IUniverseAgentConnection connection: IUniverseAgentConnection,
		@IUniverseAgentHostConnection hostConnection: IUniverseAgentHostConnection,
		@ILogService logService: ILogService,
	) {
		super();
		this.host = this._register(new SessionViewHost(connection, hostConnection, {
			diagnostics: createSessionViewDiagnosticsPort(logService),
		}));
		this._register(connection.onDidChangeConnection(() => this.host.onEngineConnectionChanged()));
	}

	onDynamicDidApplyFrame(leaseId: string) {
		return this.host.onDynamicDidApplyFrame(leaseId);
	}

	acquireLease(sessionId: string): Promise<string> {
		return Promise.resolve(this.host.acquireLease(sessionId));
	}

	acquireLeaseFor(owner: string, sessionId: string): Promise<string> {
		return Promise.resolve(this.host.acquireLease(sessionId, owner));
	}

	releaseLeasesOwnedBy(owner: string): number {
		return this.host.releaseLeasesOwnedBy(owner);
	}

	whenEngineSessionReady(sessionId: string): Promise<string> {
		return this.host.whenEngineSessionReady(sessionId);
	}

	releaseLease(leaseId: string, owner?: string): Promise<void> {
		this.host.releaseLease(leaseId, owner);
		return Promise.resolve();
	}

	post(leaseId: string, msg: ConversationWriteMessage, owner?: string): Promise<PostOutcome> {
		return Promise.resolve(this.host.post(leaseId, msg, owner));
	}

	requestResync(leaseId: string, owner?: string): Promise<void> {
		this.host.requestResync(leaseId, owner);
		return Promise.resolve();
	}

	acknowledge(leaseId: string, ack: { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }, owner?: string): Promise<void> {
		this.host.acknowledge(leaseId, ack, owner);
		return Promise.resolve();
	}

	requestDetail(leaseId: string, ref: string, owner?: string): Promise<DetailFetchOutcome> {
		return this.host.requestDetail(leaseId, ref, owner);
	}
}

export type { IUniverseAgentSessionViewFrameEvent };
