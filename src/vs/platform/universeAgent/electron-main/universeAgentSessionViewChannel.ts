/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../base/common/cancellation.js';
import { ErrorNoTelemetry } from '../../../base/common/errors.js';
import { Event } from '../../../base/common/event.js';
import { revive } from '../../../base/common/marshalling.js';
import { IServerChannel } from '../../../base/parts/ipc/common/ipc.js';
import type { ConversationWriteMessage, DetailFetchOutcome, PostOutcome } from '../common/conversationViewFrame.js';
import type { IUniverseAgentSessionView, IUniverseAgentSessionViewFrameEvent } from '../common/universeAgentSessionView.js';

/** Must stay identical to `mainProcessService.ts` IPC hello ctx (`window:${windowId}`). */
export function windowConnectionContext(windowId: number): string {
	return `window:${windowId}`;
}

type SessionViewCallName = Exclude<keyof IUniverseAgentSessionView, '_serviceBrand' | 'onDynamicDidApplyFrame'>;

const FORWARDED_CALLS: Record<SessionViewCallName, true> = {
	acquireLease: true,
	whenEngineSessionReady: true,
	releaseLease: true,
	post: true,
	requestResync: true,
	acknowledge: true,
	requestDetail: true,
};

export type UniverseAgentSessionViewChannelService = {
	acquireLeaseFor(owner: string, sessionId: string): Promise<string>;
	whenEngineSessionReady(sessionId: string): Promise<string>;
	releaseLease(leaseId: string): Promise<void>;
	post(leaseId: string, msg: ConversationWriteMessage): Promise<PostOutcome>;
	requestResync(leaseId: string): Promise<void>;
	acknowledge(leaseId: string, ack: { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }): Promise<void>;
	requestDetail(leaseId: string, ref: string): Promise<DetailFetchOutcome>;
	onDynamicDidApplyFrame(leaseId: string): Event<IUniverseAgentSessionViewFrameEvent>;
};

/**
 * Host-side session-view channel. `acquireLease` takes owner from IPC `ctx`
 * (never from renderer-supplied args). Other calls whitelist-forward.
 */
export class UniverseAgentSessionViewChannel implements IServerChannel<string> {

	constructor(
		private readonly service: UniverseAgentSessionViewChannelService,
	) { }

	call<T>(ctx: string, command: string, arg?: any, _cancellationToken?: CancellationToken): Promise<T> {
		const owner = String(ctx);
		const args = Array.isArray(arg) ? arg.map(value => revive(value)) : [];
		if (command === 'acquireLease') {
			return this.service.acquireLeaseFor(owner, String(args[0] ?? '')) as Promise<T>;
		}
		if (!(command in FORWARDED_CALLS)) {
			throw new ErrorNoTelemetry(`Method not found: ${command}`);
		}
		switch (command as SessionViewCallName) {
			case 'acquireLease':
				return this.service.acquireLeaseFor(owner, String(args[0] ?? '')) as Promise<T>;
			case 'whenEngineSessionReady':
				return this.service.whenEngineSessionReady(String(args[0] ?? '')) as Promise<T>;
			case 'releaseLease':
				return this.service.releaseLease(String(args[0] ?? '')) as Promise<T>;
			case 'post':
				return this.service.post(String(args[0] ?? ''), args[1] as ConversationWriteMessage) as Promise<T>;
			case 'requestResync':
				return this.service.requestResync(String(args[0] ?? '')) as Promise<T>;
			case 'acknowledge':
				return this.service.acknowledge(String(args[0] ?? ''), args[1] as { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }) as Promise<T>;
			case 'requestDetail':
				return this.service.requestDetail(String(args[0] ?? ''), String(args[1] ?? '')) as Promise<T>;
		}
	}

	listen<T>(_ctx: string, event: string, arg?: any): Event<T> {
		if (event === 'onDynamicDidApplyFrame') {
			return this.service.onDynamicDidApplyFrame(String(arg ?? '')) as Event<T>;
		}
		throw new ErrorNoTelemetry(`Event not found: ${event}`);
	}
}
