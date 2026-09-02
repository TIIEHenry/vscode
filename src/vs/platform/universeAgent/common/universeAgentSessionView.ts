/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import type {
	ConversationViewFrame,
	ConversationViewFrameApplied,
	ConversationWriteMessage,
	PostOutcome,
} from './conversationViewFrame.js';

/** IPC channel name for the electron-main hosted session view host. */
export const universeAgentSessionViewChannelName = 'universeAgentSessionView';

export const IUniverseAgentSessionView = createDecorator<IUniverseAgentSessionView>('universeAgentSessionView');

export interface IUniverseAgentSessionViewFrameEvent {
	readonly leaseId: string;
	readonly sessionId: string;
	readonly frame: ConversationViewFrame;
	readonly applied: ConversationViewFrameApplied;
}

/**
 * Renderer-facing session view lease control (stream-timeline S4 over ProxyChannel).
 */
export interface IUniverseAgentSessionView {

	readonly _serviceBrand: undefined;

	readonly onDidApplyFrame: Event<IUniverseAgentSessionViewFrameEvent>;

	acquireLease(sessionId: string): Promise<string>;

	releaseLease(leaseId: string): Promise<void>;

	post(leaseId: string, msg: ConversationWriteMessage): Promise<PostOutcome>;

	requestResync(leaseId: string): Promise<void>;
}
