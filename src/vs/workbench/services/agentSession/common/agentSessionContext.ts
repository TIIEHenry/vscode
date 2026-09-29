/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { SessionViewSnapshot } from '../../../../platform/universeAgent/common/sessionView/types.js';

/**
 * Lease the Sources read model and attribution can hold without importing
 * conversation contrib. `attribution` values stay untyped so this service
 * does not depend on review chip types.
 */
export interface IAgentSessionViewLease {
	readonly snapshot: SessionViewSnapshot;
	readonly attribution: ReadonlyMap<string, unknown>;
	dispose(): void;
}

export const IAgentSessionContext = createDecorator<IAgentSessionContext>('agentSessionContext');

/**
 * Session facts Sources used to read off the conversation roster:
 * active id, catalog readiness, pairing hold, plus the two change events.
 */
export interface IAgentSessionContext {
	readonly _serviceBrand: undefined;

	getActiveSessionId(): string;
	isEngineSessionReady(): boolean;
	isPairingHold(): boolean;
	/** Roster `workDir` for this session. Absent or blank when the engine omitted it. */
	getSessionWorkDir?(sessionId: string): string | undefined;
	readonly onDidChangeActiveSession: Event<string>;
	readonly onDidChangeSession: Event<string>;
	acquireSessionView(sessionId: string): IAgentSessionViewLease;
}
