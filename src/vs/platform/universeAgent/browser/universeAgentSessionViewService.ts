/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../instantiation/common/extensions.js';
import type { ConversationWriteMessage, DetailFetchOutcome, PostOutcome } from '../common/conversationViewFrame.js';
import { IUniverseAgentSessionView, type IUniverseAgentSessionViewFrameEvent } from '../common/universeAgentSessionView.js';

/**
 * Web has no Engine host. Leases are accepted so consumers can hold an id, but
 * they never receive frames and writes are not authenticated.
 * P2b: empty leases never emit `ItemAttribution.compacted` (no L2 demux on Web).
 */
export class WebUniverseAgentSessionView implements IUniverseAgentSessionView {

	declare readonly _serviceBrand: undefined;

	onDynamicDidApplyFrame(_leaseId: string): Event<IUniverseAgentSessionViewFrameEvent> {
		return Event.None;
	}

	async acquireLease(sessionId: string): Promise<string> {
		return `web-empty:${sessionId}`;
	}

	async releaseLease(_leaseId: string): Promise<void> {
		// Empty lease: nothing to tear down.
	}

	async post(_leaseId: string, _msg: ConversationWriteMessage): Promise<PostOutcome> {
		return { accepted: false, reason: 'not_authenticated' };
	}

	async requestResync(_leaseId: string): Promise<void> {
		// Empty lease: no replica to resync.
	}

	async acknowledge(_leaseId: string, _ack: { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }): Promise<void> {
		// Empty lease: no Actor to ack.
	}

	async requestDetail(_leaseId: string, _ref: string): Promise<DetailFetchOutcome> {
		return { ok: false, reason: 'unavailable' };
	}
}

registerSingleton(IUniverseAgentSessionView, WebUniverseAgentSessionView, InstantiationType.Delayed);
