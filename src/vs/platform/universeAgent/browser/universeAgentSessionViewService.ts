/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../instantiation/common/extensions.js';
import type { ConversationWriteMessage, DetailFetchOutcome, PostOutcome } from '../common/conversationViewFrame.js';
import { IUniverseAgentSessionView, type IUniverseAgentSessionViewFrameEvent } from '../common/universeAgentSessionView.js';
import { rejectUnsupportedEnvironment } from './webUnsupported.js';

/**
 * Web has no Engine host. `acquireLease` still returns a `web-empty:` id so
 * consumers can hold a handle, but that is not bind success.
 * `whenEngineSessionReady` rejects — do not treat a web-empty lease as Create/Resume.
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

	whenEngineSessionReady(_sessionId: string): Promise<string> {
		return rejectUnsupportedEnvironment();
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
